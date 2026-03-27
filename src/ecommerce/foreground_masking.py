"""Foreground mask extraction helpers for deterministic image composition."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from functools import lru_cache
from typing import Any

import numpy as np
from PIL import Image, ImageChops

from config import Config

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class ForegroundMaskResult:
    """Mask extraction result for auto-composition flows."""

    mask: Image.Image
    bounds: tuple[int, int, int, int] | None
    source: str
    model_id: str | None
    fallback_used: bool
    alpha_threshold: int
    coverage_ratio: float
    fallback_reason: str | None = None


class ForegroundMaskExtractor:
    """Extract a product foreground mask using alpha or an HF model."""

    def __init__(self, config: Config | None = None):
        self.config = config or Config()
        image_ai_config = self.config.model_config_data.get("image_ai", {})
        self.model_id = str(image_ai_config.get("background_removal_model", "briaai/RMBG-1.4"))
        self.alpha_threshold = int(image_ai_config.get("alpha_threshold", 8))
        self.allow_remote_code = bool(image_ai_config.get("allow_remote_code", True))
        self.device = str(image_ai_config.get("device", "cpu"))
        self.rmbg_input_size = int(image_ai_config.get("rmbg_input_size", 1024))
        self.birefnet_input_size = int(image_ai_config.get("birefnet_input_size", 1024))
        self.cpu_birefnet_input_size = int(image_ai_config.get("cpu_birefnet_input_size", 512))
        self.cpu_birefnet_retry_size = int(image_ai_config.get("cpu_birefnet_retry_size", 384))
        self.allow_full_image_fallback = bool(
            image_ai_config.get("allow_full_image_fallback", True)
        )
        self._last_failure_reason: str | None = None

    def extract(self, image: Image.Image) -> ForegroundMaskResult:
        """Return the best available foreground mask for the given image."""
        self._last_failure_reason = None
        alpha_result = self._extract_from_alpha_channel(image)
        if alpha_result is not None:
            return alpha_result

        if self._is_rmbg_model():
            model_result = self._extract_with_rmbg(image)
        elif self._is_birefnet_model():
            model_result = self._extract_with_birefnet(image)
        else:
            model_result = self._extract_with_huggingface(image)
        if model_result is not None:
            return model_result

        return self._fallback_to_full_image(image)

    def _set_failure_reason(self, reason: str) -> None:
        self._last_failure_reason = reason

    def _is_rmbg_model(self) -> bool:
        return "rmbg" in self.model_id.lower()

    def _is_birefnet_model(self) -> bool:
        return "birefnet" in self.model_id.lower()

    def _extract_from_alpha_channel(
        self,
        image: Image.Image,
    ) -> ForegroundMaskResult | None:
        if "A" not in image.getbands():
            return None

        alpha_mask = image.getchannel("A").convert("L")
        if alpha_mask.getextrema()[0] >= 255:
            return None

        bounds, coverage_ratio = self._compute_bounds_and_coverage(alpha_mask)
        if bounds is None:
            return None

        return ForegroundMaskResult(
            mask=alpha_mask,
            bounds=bounds,
            source="alpha-channel",
            model_id=None,
            fallback_used=False,
            alpha_threshold=self.alpha_threshold,
            coverage_ratio=coverage_ratio,
        )

    def _extract_with_huggingface(
        self,
        image: Image.Image,
    ) -> ForegroundMaskResult | None:
        try:
            segmenter = self._load_segmenter(
                self.model_id,
                self.device,
                self.allow_remote_code,
            )
        except Exception as exc:
            logger.info("Foreground mask model unavailable: %s", exc)
            self._set_failure_reason(f"Hugging Face segmentation model could not be loaded: {exc}")
            return None

        try:
            prediction = segmenter(image.convert("RGB"))
            mask = self._coerce_prediction_mask(prediction, image.size)
            if mask is None:
                self._set_failure_reason(
                    "Hugging Face segmentation returned no usable " "foreground mask."
                )
                return None

            bounds, coverage_ratio = self._compute_bounds_and_coverage(mask)
            if bounds is None:
                self._set_failure_reason(
                    "Hugging Face segmentation returned an empty " "foreground region."
                )
                return None

            return ForegroundMaskResult(
                mask=mask,
                bounds=bounds,
                source="huggingface",
                model_id=self.model_id,
                fallback_used=False,
                alpha_threshold=self.alpha_threshold,
                coverage_ratio=coverage_ratio,
            )
        except Exception as exc:
            logger.warning("Foreground mask inference failed: %s", exc)
            self._set_failure_reason(f"Hugging Face segmentation inference failed: {exc}")
            return None

    def _extract_with_rmbg(
        self,
        image: Image.Image,
    ) -> ForegroundMaskResult | None:
        try:
            model, device = self._load_rmbg_model(
                self.model_id,
                self.device,
                self.allow_remote_code,
            )
        except Exception as exc:
            logger.info("RMBG model unavailable: %s", exc)
            self._set_failure_reason(f"Hugging Face RMBG model could not be loaded: {exc}")
            return None

        try:
            mask = self._predict_rmbg_mask(image, model, device)
            bounds, coverage_ratio = self._compute_bounds_and_coverage(mask)
            if bounds is None:
                self._set_failure_reason("Hugging Face RMBG returned an empty foreground region.")
                return None

            return ForegroundMaskResult(
                mask=mask,
                bounds=bounds,
                source="huggingface",
                model_id=self.model_id,
                fallback_used=False,
                alpha_threshold=self.alpha_threshold,
                coverage_ratio=coverage_ratio,
            )
        except Exception as exc:
            logger.warning("RMBG inference failed: %s", exc)
            self._set_failure_reason(f"Hugging Face RMBG inference failed: {exc}")
            return None

    def _extract_with_birefnet(
        self,
        image: Image.Image,
    ) -> ForegroundMaskResult | None:
        try:
            model, device = self._load_birefnet_model(
                self.model_id,
                self.device,
                self.allow_remote_code,
            )
        except Exception as exc:
            logger.info("BiRefNet model unavailable: %s", exc)
            self._set_failure_reason(f"Hugging Face BiRefNet model could not be loaded: {exc}")
            return None

        try:
            mask = self._predict_birefnet_mask(image, model, device)
            bounds, coverage_ratio = self._compute_bounds_and_coverage(mask)
            if bounds is None:
                self._set_failure_reason(
                    "Hugging Face BiRefNet returned an empty foreground " "region."
                )
                return None

            return ForegroundMaskResult(
                mask=mask,
                bounds=bounds,
                source="huggingface",
                model_id=self.model_id,
                fallback_used=False,
                alpha_threshold=self.alpha_threshold,
                coverage_ratio=coverage_ratio,
            )
        except Exception as exc:
            logger.warning("BiRefNet inference failed: %s", exc)
            self._set_failure_reason(f"Hugging Face BiRefNet inference failed: {exc}")
            return None

    def _fallback_to_full_image(
        self,
        image: Image.Image,
    ) -> ForegroundMaskResult:
        full_mask = Image.new("L", image.size, 255)
        bounds = (0, 0, image.width, image.height)
        return ForegroundMaskResult(
            mask=full_mask,
            bounds=bounds,
            source="full-image",
            model_id=self.model_id,
            fallback_used=True,
            alpha_threshold=self.alpha_threshold,
            coverage_ratio=1.0,
            fallback_reason=self._last_failure_reason,
        )

    @staticmethod
    @lru_cache(maxsize=2)
    def _load_segmenter(model_id: str, device: str, allow_remote_code: bool):
        import torch
        from transformers import pipeline

        device_arg: int | str = -1
        if device.startswith("cuda") and torch.cuda.is_available():
            device_arg = 0
        elif (
            device == "mps"
            and getattr(torch.backends, "mps", None)
            and torch.backends.mps.is_available()
        ):
            device_arg = "mps"

        return pipeline(
            task="image-segmentation",
            model=model_id,
            trust_remote_code=allow_remote_code,
            device=device_arg,
        )

    @staticmethod
    @lru_cache(maxsize=2)
    def _load_rmbg_model(model_id: str, device: str, allow_remote_code: bool):
        from transformers import AutoModelForImageSegmentation

        torch_device = ForegroundMaskExtractor._resolve_torch_device(device)
        model = AutoModelForImageSegmentation.from_pretrained(
            model_id,
            trust_remote_code=allow_remote_code,
        )
        model.to(torch_device)
        if torch_device.type == "cpu":
            model.float()
        model.eval()
        return model, torch_device

    @staticmethod
    @lru_cache(maxsize=2)
    def _load_birefnet_model(
        model_id: str,
        device: str,
        allow_remote_code: bool,
    ):
        from transformers import AutoModelForImageSegmentation

        torch_device = ForegroundMaskExtractor._resolve_torch_device(device)
        model = AutoModelForImageSegmentation.from_pretrained(
            model_id,
            trust_remote_code=allow_remote_code,
        )
        model.to(torch_device)
        if torch_device.type == "cpu":
            model.float()
        model.eval()
        return model, torch_device

    @staticmethod
    def _resolve_torch_device(device: str):
        import torch

        if device.startswith("cuda") and torch.cuda.is_available():
            return torch.device("cuda:0")
        if (
            device == "mps"
            and getattr(torch.backends, "mps", None)
            and torch.backends.mps.is_available()
        ):
            return torch.device("mps")
        return torch.device("cpu")

    def _predict_rmbg_mask(
        self,
        image: Image.Image,
        model,
        device,
    ) -> Image.Image:
        import torch
        import torch.nn.functional as functional
        from torchvision.transforms.functional import normalize

        rgb_image = image.convert("RGB")
        image_array = np.asarray(rgb_image)
        original_size = image_array.shape[:2]
        image_tensor = torch.tensor(
            image_array,
            dtype=torch.float32,
            device=device,
        ).permute(2, 0, 1)
        image_tensor = functional.interpolate(
            image_tensor.unsqueeze(0),
            size=[self.rmbg_input_size, self.rmbg_input_size],
            mode="bilinear",
            align_corners=False,
        )
        image_tensor = torch.divide(image_tensor, 255.0)
        image_tensor = normalize(
            image_tensor,
            [0.5, 0.5, 0.5],
            [1.0, 1.0, 1.0],
        )

        with torch.no_grad():
            result = model(image_tensor)

        prediction = functional.interpolate(
            result[0][0],
            size=original_size,
            mode="bilinear",
            align_corners=False,
        )
        prediction = torch.squeeze(prediction, 0)
        max_value = torch.max(prediction)
        min_value = torch.min(prediction)
        if torch.isclose(max_value, min_value):
            normalized = torch.zeros_like(prediction)
        else:
            normalized = (prediction - min_value) / (max_value - min_value)

        mask = (normalized * 255).permute(1, 2, 0).detach().cpu().numpy().astype("uint8").squeeze()
        return Image.fromarray(mask, mode="L")

    def _predict_birefnet_mask(
        self,
        image: Image.Image,
        model,
        device,
    ) -> Image.Image:
        import torch
        from torchvision import transforms

        rgb_image = image.convert("RGB")
        model_dtype = next(model.parameters()).dtype
        last_error: RuntimeError | None = None

        for input_size in self._get_birefnet_input_sizes(device):
            transform_image = transforms.Compose(
                [
                    transforms.Resize((input_size, input_size)),
                    transforms.ToTensor(),
                    transforms.Normalize(
                        [0.485, 0.456, 0.406],
                        [0.229, 0.224, 0.225],
                    ),
                ]
            )
            input_images = (
                transform_image(rgb_image)
                .unsqueeze(0)
                .to(
                    device=device,
                    dtype=model_dtype,
                )
            )

            try:
                with torch.inference_mode():
                    predictions = model(input_images)[-1].sigmoid().cpu()
            except RuntimeError as exc:
                last_error = exc
                if getattr(device, "type", str(device)) != "cpu":
                    raise
                logger.info(
                    "BiRefNet CPU inference failed at %spx, retrying " "smaller size: %s",
                    input_size,
                    exc,
                )
                continue

            prediction = predictions[0].squeeze()
            mask = transforms.ToPILImage()(prediction)
            if mask.size != image.size:
                mask = mask.resize(image.size, Image.Resampling.LANCZOS)
            return mask.convert("L")

        if last_error is not None:
            raise last_error

        raise RuntimeError("BiRefNet inference did not produce a mask")

    def _get_birefnet_input_sizes(self, device: Any) -> list[int]:
        device_type = getattr(device, "type", str(device))
        configured_size = max(128, int(self.birefnet_input_size))
        if device_type != "cpu":
            return [configured_size]

        preferred_cpu_size = max(128, int(self.cpu_birefnet_input_size))
        retry_cpu_size = max(128, int(self.cpu_birefnet_retry_size))
        sizes: list[int] = []

        for size in (min(configured_size, preferred_cpu_size), retry_cpu_size):
            if size not in sizes:
                sizes.append(size)

        return sizes

    def _coerce_prediction_mask(
        self,
        prediction: Any,
        image_size: tuple[int, int],
    ) -> Image.Image | None:
        masks: list[Image.Image] = []

        if isinstance(prediction, dict):
            maybe_mask = self._normalize_mask_image(
                prediction.get("mask"),
                image_size,
            )
            if maybe_mask is not None:
                masks.append(maybe_mask)
        elif isinstance(prediction, list):
            non_background_masks: list[Image.Image] = []
            fallback_masks: list[Image.Image] = []

            for item in prediction:
                if not isinstance(item, dict):
                    continue
                maybe_mask = self._normalize_mask_image(
                    item.get("mask"),
                    image_size,
                )
                if maybe_mask is None:
                    continue

                fallback_masks.append(maybe_mask)
                label = str(item.get("label", "")).lower().strip()
                if label not in {"background", "bg"}:
                    non_background_masks.append(maybe_mask)

            masks = non_background_masks or fallback_masks

        if not masks:
            return None

        composite = Image.new("L", image_size, 0)
        for mask in masks:
            composite = ImageChops.lighter(composite, mask)
        return composite

    @staticmethod
    def _normalize_mask_image(
        mask: Any,
        image_size: tuple[int, int],
    ) -> Image.Image | None:
        if not isinstance(mask, Image.Image):
            return None

        normalized = mask.convert("L")
        if normalized.size != image_size:
            normalized = normalized.resize(
                image_size,
                Image.Resampling.LANCZOS,
            )

        max_value = normalized.getextrema()[1]
        if max_value <= 1:
            normalized = normalized.point(
                lambda pixel: 255 if pixel > 0 else 0,
            )

        return normalized

    def _compute_bounds_and_coverage(
        self,
        mask: Image.Image,
    ) -> tuple[tuple[int, int, int, int] | None, float]:
        binary_mask = mask.point(
            lambda pixel: 255 if pixel >= self.alpha_threshold else 0,
        )
        bounds = binary_mask.getbbox()
        histogram = binary_mask.histogram()
        non_zero_count = histogram[255] if len(histogram) > 255 else 0
        total_pixels = max(1, mask.width * mask.height)
        coverage_ratio = non_zero_count / total_pixels
        return bounds, coverage_ratio
