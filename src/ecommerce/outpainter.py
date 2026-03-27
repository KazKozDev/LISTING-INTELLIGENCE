"""Local outpainting helpers based on Stable Diffusion inpainting."""

from __future__ import annotations

import logging
import math
from dataclasses import dataclass
from enum import Enum
from functools import lru_cache
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

from config import Config

from .foreground_masking import ForegroundMaskExtractor

logger = logging.getLogger(__name__)


class OutpaintDirection(str, Enum):
    """Supported canvas expansion directions."""

    LEFT = "left"
    RIGHT = "right"
    TOP = "top"
    BOTTOM = "bottom"


@dataclass(frozen=True)
class OutpaintResult:
    """Outpainting result with trace metadata."""

    image: Image.Image
    model_id: str
    prompt: str
    direction: str
    expansion_ratio: float
    warning: str | None = None


class Outpainter:
    """Expand a canvas and generate continuation into the new masked area."""

    def __init__(self, config: Config | None = None) -> None:
        self.config = config or Config()
        outpaint_config = self.config.model_config_data.get("outpainting", {})
        self.enabled = bool(outpaint_config.get("enabled", True))
        self.model_id = str(
            outpaint_config.get(
                "model",
                "runwayml/stable-diffusion-inpainting",
            )
        )
        self.device = str(outpaint_config.get("device", "cpu"))
        self.prompt = str(
            outpaint_config.get(
                "prompt",
                (
                    "extend the existing product photo naturally, continue "
                    "the background and surface seamlessly, keep the main "
                    "subject unchanged"
                ),
            )
        )
        self.negative_prompt = str(
            outpaint_config.get(
                "negative_prompt",
                (
                    "extra products, duplicated object, cropped subject, "
                    "text, watermark, border, frame, distortion, blur, "
                    "clutter"
                ),
            )
        )
        self.steps = int(outpaint_config.get("steps", 24))
        self.guidance_scale = float(outpaint_config.get("guidance_scale", 7.0))
        self.strength = float(outpaint_config.get("strength", 0.99))
        self.max_inference_side = int(outpaint_config.get("max_inference_side", 768))
        self.default_expand_ratio = float(outpaint_config.get("default_expand_ratio", 0.25))
        self.feather_px = int(outpaint_config.get("feather_px", 18))
        self.background = str(outpaint_config.get("background", "white"))
        self.seed = int(outpaint_config.get("seed", 12345))
        self.cache_dir = Path(outpaint_config.get("cache_dir", "outputs/models"))
        self.foreground_extractor = ForegroundMaskExtractor(self.config)

    def outpaint(
        self,
        image_path: str | Path,
        *,
        direction: str = "right",
        expand_ratio: float | None = None,
        prompt: str | None = None,
    ) -> OutpaintResult:
        """Expand the image canvas and fill the new area."""
        with Image.open(image_path) as img:
            rgb_image = img.convert("RGB")

        chosen_prompt = (prompt or self.prompt).strip() or self.prompt
        chosen_direction = OutpaintDirection(direction.lower()).value
        chosen_ratio = self._resolve_expand_ratio(expand_ratio)

        if not self.enabled:
            return OutpaintResult(
                image=rgb_image,
                model_id=self.model_id,
                prompt=chosen_prompt,
                direction=chosen_direction,
                expansion_ratio=chosen_ratio,
                warning="Outpainting is disabled.",
            )

        try:
            pipeline, torch_device = self._load_pipeline(
                self.model_id,
                self.device,
                str(self.cache_dir),
            )
        except Exception as exc:
            logger.warning("Outpainting model unavailable: %s", exc)
            return OutpaintResult(
                image=rgb_image,
                model_id=self.model_id,
                prompt=chosen_prompt,
                direction=chosen_direction,
                expansion_ratio=chosen_ratio,
                warning=f"Outpainting model unavailable: {exc}",
            )

        try:
            canvas, mask = self.build_canvas_and_mask(
                rgb_image,
                chosen_direction,
                chosen_ratio,
            )
            working_canvas, working_mask, resized = self._resize_for_inference(
                canvas,
                mask,
            )

            generator = self._build_generator(torch_device)
            result = pipeline(
                prompt=chosen_prompt,
                negative_prompt=self.negative_prompt,
                image=working_canvas,
                mask_image=working_mask,
                num_inference_steps=self.steps,
                guidance_scale=self.guidance_scale,
                strength=self.strength,
                width=working_canvas.width,
                height=working_canvas.height,
                generator=generator,
            )
            output = result.images[0].convert("RGB")
            if resized:
                output = output.resize(canvas.size, Image.Resampling.LANCZOS)

            return OutpaintResult(
                image=output,
                model_id=self.model_id,
                prompt=chosen_prompt,
                direction=chosen_direction,
                expansion_ratio=chosen_ratio,
            )
        except Exception as exc:
            logger.warning("Outpainting failed: %s", exc)
            return OutpaintResult(
                image=rgb_image,
                model_id=self.model_id,
                prompt=chosen_prompt,
                direction=chosen_direction,
                expansion_ratio=chosen_ratio,
                warning=f"Outpainting failed: {exc}",
            )

    def build_canvas_and_mask(
        self,
        image: Image.Image,
        direction: str,
        expand_ratio: float,
    ) -> tuple[Image.Image, Image.Image]:
        """Build the expanded canvas and mask for outpainting."""
        chosen_direction = OutpaintDirection(direction.lower())
        background = self._resolve_background()

        horizontal = chosen_direction in {
            OutpaintDirection.LEFT,
            OutpaintDirection.RIGHT,
        }
        axis_size = image.width if horizontal else image.height
        expansion_px = max(64, int(round(axis_size * expand_ratio)))
        expansion_px = self._round_to_multiple(expansion_px, 8)

        if horizontal:
            canvas_size = (image.width + expansion_px, image.height)
            offset = (expansion_px, 0) if chosen_direction == OutpaintDirection.LEFT else (0, 0)
        else:
            canvas_size = (image.width, image.height + expansion_px)
            offset = (0, expansion_px) if chosen_direction == OutpaintDirection.TOP else (0, 0)

        canvas = Image.new("RGB", canvas_size, background)
        canvas.paste(image, offset)

        seam_overlap = min(max(8, self.feather_px), max(16, axis_size // 10))
        mask = Image.new("L", canvas_size, 0)
        draw = ImageDraw.Draw(mask)

        if chosen_direction == OutpaintDirection.RIGHT:
            draw.rectangle(
                [
                    max(0, image.width - seam_overlap),
                    0,
                    canvas.width,
                    canvas.height,
                ],
                fill=255,
            )
        elif chosen_direction == OutpaintDirection.LEFT:
            draw.rectangle(
                [
                    0,
                    0,
                    min(canvas.width, expansion_px + seam_overlap),
                    canvas.height,
                ],
                fill=255,
            )
        elif chosen_direction == OutpaintDirection.BOTTOM:
            draw.rectangle(
                [
                    0,
                    max(0, image.height - seam_overlap),
                    canvas.width,
                    canvas.height,
                ],
                fill=255,
            )
        else:
            draw.rectangle(
                [
                    0,
                    0,
                    canvas.width,
                    min(canvas.height, expansion_px + seam_overlap),
                ],
                fill=255,
            )

        if self.feather_px > 0:
            mask = mask.filter(ImageFilter.GaussianBlur(radius=self.feather_px))

        return canvas, mask

    def _resolve_expand_ratio(self, expand_ratio: float | None) -> float:
        ratio = float(expand_ratio if expand_ratio is not None else self.default_expand_ratio)
        return max(0.1, min(0.6, ratio))

    def _resolve_background(self) -> tuple[int, int, int]:
        if self.background.lower().strip() == "black":
            return (0, 0, 0)
        return (255, 255, 255)

    def _resize_for_inference(
        self,
        canvas: Image.Image,
        mask: Image.Image,
    ) -> tuple[Image.Image, Image.Image, bool]:
        scale = min(
            1.0,
            self.max_inference_side / max(canvas.width, canvas.height),
        )
        target_width = self._round_to_multiple(
            max(64, int(round(canvas.width * scale))),
            8,
        )
        target_height = self._round_to_multiple(
            max(64, int(round(canvas.height * scale))),
            8,
        )

        if (target_width, target_height) == canvas.size:
            return canvas, mask, False

        resized_canvas = canvas.resize(
            (target_width, target_height),
            Image.Resampling.LANCZOS,
        )
        resized_mask = mask.resize(
            (target_width, target_height),
            Image.Resampling.LANCZOS,
        )
        return resized_canvas, resized_mask, True

    @staticmethod
    def _round_to_multiple(value: int, multiple: int) -> int:
        return max(multiple, int(math.ceil(value / multiple) * multiple))

    @staticmethod
    def _build_generator(torch_device):
        import torch

        generator_device = (
            "cuda" if getattr(torch_device, "type", str(torch_device)) == "cuda" else "cpu"
        )
        return torch.Generator(device=generator_device).manual_seed(12345)

    @staticmethod
    @lru_cache(maxsize=1)
    def _load_pipeline(model_id: str, device: str, cache_dir: str):
        import torch
        from diffusers import StableDiffusionInpaintPipeline

        torch_device = ForegroundMaskExtractor._resolve_torch_device(device)
        torch_dtype = torch.float16 if torch_device.type == "cuda" else torch.float32
        cache_path = Path(cache_dir)
        cache_path.mkdir(parents=True, exist_ok=True)

        pipeline = StableDiffusionInpaintPipeline.from_pretrained(
            model_id,
            torch_dtype=torch_dtype,
            safety_checker=None,
            requires_safety_checker=False,
            cache_dir=str(cache_path),
        )
        pipeline = pipeline.to(torch_device)
        if hasattr(pipeline, "enable_attention_slicing"):
            pipeline.enable_attention_slicing()
        if hasattr(pipeline, "enable_vae_slicing"):
            pipeline.enable_vae_slicing()
        pipeline.set_progress_bar_config(disable=True)
        return pipeline, torch_device
