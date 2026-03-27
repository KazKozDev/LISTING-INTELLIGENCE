"""IC-Light relighting helpers for product-photo cleanup."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from enum import Enum
from functools import lru_cache
from pathlib import Path
from typing import Any

import numpy as np
from PIL import Image

from config import Config
from .foreground_masking import ForegroundMaskExtractor

logger = logging.getLogger(__name__)


class LightDirection(str, Enum):
    """Supported IC-Light initial lighting presets."""

    NONE = "none"
    LEFT = "left"
    RIGHT = "right"
    TOP = "top"
    BOTTOM = "bottom"


@dataclass(frozen=True)
class RelightResult:
    """Relighting result with trace metadata."""

    image: Image.Image
    model_id: str
    prompt: str
    mask_source: str
    warning: str | None = None


class ICLightRelighter:
    """Run the foreground-conditioned IC-Light relighting model."""

    def __init__(self, config: Config | None = None) -> None:
        self.config = config or Config()
        relight_config = self.config.model_config_data.get("ic_light", {})
        self.enabled = bool(relight_config.get("enabled", True))
        self.base_model = str(relight_config.get("base_model", "runwayml/stable-diffusion-v1-5"))
        self.model_url = str(
            relight_config.get(
                "model_url",
                (
                    "https://huggingface.co/lllyasviel/ic-light/"
                    "resolve/main/iclight_sd15_fc.safetensors"
                ),
            )
        )
        self.model_file = str(relight_config.get("model_file", "iclight_sd15_fc.safetensors"))
        self.device = str(relight_config.get("device", "cpu"))
        self.prompt = str(
            relight_config.get(
                "prompt",
                (
                    "product photo, soft studio lighting, subtle "
                    "realistic contact shadow, clean white background"
                ),
            )
        )
        self.negative_prompt = str(
            relight_config.get(
                "negative_prompt",
                ("lowres, blurry, dark, noisy, cluttered " "background, watermark, text"),
            )
        )
        self.width = int(relight_config.get("width", 768))
        self.height = int(relight_config.get("height", 768))
        self.steps = int(relight_config.get("steps", 20))
        self.cfg_scale = float(relight_config.get("cfg_scale", 4.0))
        self.lowres_denoise = float(relight_config.get("lowres_denoise", 0.9))
        self.seed = int(relight_config.get("seed", 12345))
        self.cache_dir = Path(relight_config.get("cache_dir", "outputs/models"))
        self.foreground_extractor = ForegroundMaskExtractor(self.config)

    def relight(
        self,
        image_path: str | Path,
        *,
        prompt: str | None = None,
        light_direction: str = "none",
    ) -> RelightResult:
        """Relight a product image with IC-Light."""
        with Image.open(image_path) as img:
            rgb_image = img.convert("RGB")

        mask_result = self.foreground_extractor.extract(rgb_image)
        chosen_prompt = (prompt or self.prompt).strip() or self.prompt

        if not self.enabled:
            return RelightResult(
                image=rgb_image,
                model_id=self.model_file,
                prompt=chosen_prompt,
                mask_source=mask_result.source,
                warning="IC-Light relighting is disabled.",
            )

        try:
            bundle = self._load_pipeline_bundle(
                self.base_model,
                self.model_url,
                self.model_file,
                self.device,
                str(self.cache_dir),
            )
        except Exception as exc:
            logger.warning("IC-Light model unavailable: %s", exc)
            return RelightResult(
                image=rgb_image,
                model_id=self.model_file,
                prompt=chosen_prompt,
                mask_source=mask_result.source,
                warning=f"IC-Light model unavailable: {exc}",
            )

        try:
            output_image = self._generate_relight(
                rgb_image,
                bundle,
                chosen_prompt,
                light_direction,
            )
            return RelightResult(
                image=output_image,
                model_id=self.model_file,
                prompt=chosen_prompt,
                mask_source=mask_result.source,
            )
        except Exception as exc:
            logger.warning("IC-Light relighting failed: %s", exc)
            return RelightResult(
                image=rgb_image,
                model_id=self.model_file,
                prompt=chosen_prompt,
                mask_source=mask_result.source,
                warning=f"IC-Light relighting failed: {exc}",
            )

    def _generate_relight(
        self,
        image: Image.Image,
        bundle: dict[str, Any],
        prompt: str,
        light_direction: str,
    ) -> Image.Image:
        import torch

        width, height = self._resolve_target_size(image.size)
        foreground = self._prepare_foreground(image)
        background = self._build_background(width, height, light_direction)

        fg = self._resize_and_center_crop(foreground, width, height)
        conds, unconds = self._encode_prompt_pair(
            bundle,
            prompt,
            self.negative_prompt,
        )
        concat_conds = self._numpy_to_pytorch([fg]).to(
            device=bundle["vae"].device,
            dtype=bundle["vae"].dtype,
        )
        concat_conds = (
            bundle["vae"].encode(concat_conds).latent_dist.mode()
            * bundle["vae"].config.scaling_factor
        )

        rng = self._build_generator(bundle["device"])
        if background is None:
            latents = bundle["t2i_pipe"](
                prompt_embeds=conds,
                negative_prompt_embeds=unconds,
                width=width,
                height=height,
                num_inference_steps=self.steps,
                num_images_per_prompt=1,
                generator=rng,
                output_type="latent",
                guidance_scale=self.cfg_scale,
                cross_attention_kwargs={"concat_conds": concat_conds},
            ).images
        else:
            bg = self._resize_and_center_crop(background, width, height)
            bg_latent = self._numpy_to_pytorch([bg]).to(
                device=bundle["vae"].device,
                dtype=bundle["vae"].dtype,
            )
            bg_latent = (
                bundle["vae"].encode(bg_latent).latent_dist.mode()
                * bundle["vae"].config.scaling_factor
            )
            latents = bundle["i2i_pipe"](
                image=bg_latent,
                strength=self.lowres_denoise,
                prompt_embeds=conds,
                negative_prompt_embeds=unconds,
                width=width,
                height=height,
                num_inference_steps=max(
                    1,
                    int(round(self.steps / self.lowres_denoise)),
                ),
                num_images_per_prompt=1,
                generator=rng,
                output_type="latent",
                guidance_scale=self.cfg_scale,
                cross_attention_kwargs={"concat_conds": concat_conds},
            ).images

        latents = latents.to(bundle["vae"].dtype)
        latents = latents / bundle["vae"].config.scaling_factor
        pixels = bundle["vae"].decode(latents).sample
        rendered = self._pytorch_to_numpy(pixels)[0]
        return Image.fromarray(rendered, mode="RGB")

    def _prepare_foreground(self, image: Image.Image) -> np.ndarray:
        mask_result = self.foreground_extractor.extract(image)
        rgb = np.asarray(image.convert("RGB"), dtype=np.float32)
        alpha = (
            np.asarray(
                mask_result.mask.convert("L"),
                dtype=np.float32,
            )[..., None]
            / 255.0
        )
        prepared = 127.0 + (rgb - 127.0) * alpha
        return prepared.clip(0, 255).astype(np.uint8)

    def _resolve_target_size(self, size: tuple[int, int]) -> tuple[int, int]:
        width, height = size
        scale = min(
            self.width / max(width, 1),
            self.height / max(height, 1),
            1.0,
        )
        scaled_width = max(256, int(round(width * scale / 64.0) * 64))
        scaled_height = max(256, int(round(height * scale / 64.0) * 64))
        return scaled_width, scaled_height

    def _build_background(
        self,
        width: int,
        height: int,
        light_direction: str,
    ) -> np.ndarray | None:
        direction = LightDirection(light_direction.lower())
        if direction == LightDirection.NONE:
            return None
        if direction == LightDirection.LEFT:
            gradient = np.linspace(255, 0, width)
            image = np.tile(gradient, (height, 1))
        elif direction == LightDirection.RIGHT:
            gradient = np.linspace(0, 255, width)
            image = np.tile(gradient, (height, 1))
        elif direction == LightDirection.TOP:
            gradient = np.linspace(255, 0, height)[:, None]
            image = np.tile(gradient, (1, width))
        else:
            gradient = np.linspace(0, 255, height)[:, None]
            image = np.tile(gradient, (1, width))
        return np.stack((image,) * 3, axis=-1).astype(np.uint8)

    @staticmethod
    def _resize_and_center_crop(
        image: np.ndarray,
        target_width: int,
        target_height: int,
    ) -> np.ndarray:
        pil_image = Image.fromarray(image)
        original_width, original_height = pil_image.size
        scale_factor = max(
            target_width / original_width,
            target_height / original_height,
        )
        resized_width = int(round(original_width * scale_factor))
        resized_height = int(round(original_height * scale_factor))
        resized_image = pil_image.resize(
            (resized_width, resized_height),
            Image.LANCZOS,
        )
        left = (resized_width - target_width) / 2
        top = (resized_height - target_height) / 2
        right = (resized_width + target_width) / 2
        bottom = (resized_height + target_height) / 2
        cropped_image = resized_image.crop((left, top, right, bottom))
        return np.array(cropped_image)

    @staticmethod
    def _numpy_to_pytorch(images: list[np.ndarray]):
        import torch

        tensor = torch.from_numpy(np.stack(images, axis=0)).float()
        tensor = tensor / 127.0 - 1.0
        return tensor.movedim(-1, 1)

    @staticmethod
    def _pytorch_to_numpy(images, quant: bool = True) -> list[np.ndarray]:
        results: list[np.ndarray] = []
        for image in images:
            array = image.movedim(0, -1)
            if quant:
                array = array * 127.5 + 127.5
                converted = array.detach().float().cpu().numpy().clip(0, 255).astype(np.uint8)
            else:
                array = array * 0.5 + 0.5
                converted = array.detach().float().cpu().numpy().clip(0, 1).astype(np.float32)
            results.append(converted)
        return results

    def _build_generator(self, torch_device):
        import torch

        generator_device = (
            "cuda" if getattr(torch_device, "type", str(torch_device)) == "cuda" else "cpu"
        )
        return torch.Generator(device=generator_device).manual_seed(self.seed)

    @staticmethod
    def _encode_prompt_pair(
        bundle: dict[str, Any],
        positive_prompt: str,
        negative_prompt: str,
    ):
        import math
        import torch

        def encode_prompt_inner(text: str):
            tokenizer = bundle["tokenizer"]
            text_encoder = bundle["text_encoder"]
            max_length = tokenizer.model_max_length
            chunk_length = tokenizer.model_max_length - 2
            id_start = tokenizer.bos_token_id
            id_end = tokenizer.eos_token_id
            id_pad = id_end

            def pad(values, padding, count):
                if len(values) >= count:
                    return values[:count]
                return values + [padding] * (count - len(values))

            tokens = tokenizer(
                text,
                truncation=False,
                add_special_tokens=False,
            )["input_ids"]
            chunks = [
                [id_start] + tokens[index : index + chunk_length] + [id_end]
                for index in range(0, len(tokens), chunk_length)
            ]
            chunks = [pad(chunk, id_pad, max_length) for chunk in chunks]
            token_ids = torch.tensor(chunks).to(
                device=bundle["device"],
                dtype=torch.int64,
            )
            return text_encoder(token_ids).last_hidden_state

        conds = encode_prompt_inner(positive_prompt)
        unconds = encode_prompt_inner(negative_prompt)
        conds_len = float(len(conds))
        unconds_len = float(len(unconds))
        max_count = max(conds_len, unconds_len)
        conds_repeat = int(math.ceil(max_count / conds_len))
        unconds_repeat = int(math.ceil(max_count / unconds_len))
        max_chunk = max(len(conds), len(unconds))

        conds = torch.cat([conds] * conds_repeat, dim=0)[:max_chunk]
        unconds = torch.cat([unconds] * unconds_repeat, dim=0)[:max_chunk]
        conds = torch.cat([part[None, ...] for part in conds], dim=1)
        unconds = torch.cat([part[None, ...] for part in unconds], dim=1)
        return conds, unconds

    @staticmethod
    @lru_cache(maxsize=2)
    def _load_pipeline_bundle(
        base_model: str,
        model_url: str,
        model_file: str,
        device: str,
        cache_dir: str,
    ) -> dict[str, Any]:
        import torch
        import safetensors.torch as safetensors_torch
        from diffusers import (
            AutoencoderKL,
            DPMSolverMultistepScheduler,
            StableDiffusionImg2ImgPipeline,
            StableDiffusionPipeline,
            UNet2DConditionModel,
        )
        from diffusers.models.attention_processor import AttnProcessor2_0
        from torch.hub import download_url_to_file
        from transformers import CLIPTextModel, CLIPTokenizer

        torch_device = ForegroundMaskExtractor._resolve_torch_device(device)
        torch_dtype = torch.float16 if torch_device.type == "cuda" else torch.float32

        tokenizer = CLIPTokenizer.from_pretrained(
            base_model,
            subfolder="tokenizer",
        )
        text_encoder = CLIPTextModel.from_pretrained(
            base_model,
            subfolder="text_encoder",
        )
        vae = AutoencoderKL.from_pretrained(base_model, subfolder="vae")
        unet = UNet2DConditionModel.from_pretrained(
            base_model,
            subfolder="unet",
        )

        with torch.no_grad():
            new_conv_in = torch.nn.Conv2d(
                8,
                unet.conv_in.out_channels,
                unet.conv_in.kernel_size,
                unet.conv_in.stride,
                unet.conv_in.padding,
            )
            new_conv_in.weight.zero_()
            new_conv_in.weight[:, :4, :, :].copy_(unet.conv_in.weight)
            new_conv_in.bias = unet.conv_in.bias
            unet.conv_in = new_conv_in

        unet_original_forward = unet.forward

        def hooked_unet_forward(
            sample,
            timestep,
            encoder_hidden_states,
            **kwargs,
        ):
            concat_conds = kwargs["cross_attention_kwargs"]["concat_conds"].to(sample)
            concat_conds = torch.cat(
                [concat_conds] * (sample.shape[0] // concat_conds.shape[0]),
                dim=0,
            )
            new_sample = torch.cat([sample, concat_conds], dim=1)
            kwargs["cross_attention_kwargs"] = {}
            return unet_original_forward(
                new_sample,
                timestep,
                encoder_hidden_states,
                **kwargs,
            )

        unet.forward = hooked_unet_forward

        model_cache_dir = Path(cache_dir)
        model_cache_dir.mkdir(parents=True, exist_ok=True)
        model_path = model_cache_dir / model_file
        if not model_path.exists():
            download_url_to_file(model_url, str(model_path))

        offset_state = safetensors_torch.load_file(str(model_path))
        origin_state = unet.state_dict()
        merged_state = {key: origin_state[key] + offset_state[key] for key in origin_state.keys()}
        unet.load_state_dict(merged_state, strict=True)
        del offset_state, origin_state, merged_state

        text_encoder = text_encoder.to(device=torch_device, dtype=torch_dtype)
        vae = vae.to(device=torch_device, dtype=torch_dtype)
        unet = unet.to(device=torch_device, dtype=torch_dtype)

        try:
            unet.set_attn_processor(AttnProcessor2_0())
            vae.set_attn_processor(AttnProcessor2_0())
        except Exception:
            logger.debug("AttnProcessor2_0 not available for current backend")

        scheduler = DPMSolverMultistepScheduler(
            num_train_timesteps=1000,
            beta_start=0.00085,
            beta_end=0.012,
            algorithm_type="sde-dpmsolver++",
            use_karras_sigmas=True,
            steps_offset=1,
        )

        t2i_pipe = StableDiffusionPipeline(
            vae=vae,
            text_encoder=text_encoder,
            tokenizer=tokenizer,
            unet=unet,
            scheduler=scheduler,
            safety_checker=None,
            requires_safety_checker=False,
            feature_extractor=None,
            image_encoder=None,
        )
        i2i_pipe = StableDiffusionImg2ImgPipeline(
            vae=vae,
            text_encoder=text_encoder,
            tokenizer=tokenizer,
            unet=unet,
            scheduler=scheduler,
            safety_checker=None,
            requires_safety_checker=False,
            feature_extractor=None,
            image_encoder=None,
        )

        return {
            "tokenizer": tokenizer,
            "text_encoder": text_encoder,
            "vae": vae,
            "unet": unet,
            "t2i_pipe": t2i_pipe,
            "i2i_pipe": i2i_pipe,
            "device": torch_device,
            "dtype": torch_dtype,
            "model_path": str(model_path),
        }
