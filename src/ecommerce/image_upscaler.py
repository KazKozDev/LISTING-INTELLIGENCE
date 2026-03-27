"""Image upscaling using Real-ESRGAN."""

from __future__ import annotations

import importlib
import logging
import sys
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any

import numpy as np
from PIL import Image
from torch.hub import download_url_to_file

from config import Config

logger = logging.getLogger(__name__)


def _ensure_torchvision_compatibility() -> None:
    """Alias the legacy torchvision module path expected by basicsr.

    Recent torchvision versions renamed
    ``torchvision.transforms.functional_tensor`` to
    ``torchvision.transforms._functional_tensor``. basicsr still imports the
    legacy path, so provide a runtime alias when needed.
    """

    try:
        importlib.import_module("torchvision.transforms.functional_tensor")
    except ModuleNotFoundError as exc:
        if exc.name != "torchvision.transforms.functional_tensor":
            raise

        functional_tensor_module = importlib.import_module(
            "torchvision.transforms._functional_tensor"
        )
        sys.modules["torchvision.transforms.functional_tensor"] = functional_tensor_module


@dataclass(frozen=True)
class UpscaleResult:
    """Upscaling result."""

    image: Image.Image
    original_width: int
    original_height: int
    upscaled_width: int
    upscaled_height: int
    scale_factor: int
    model_id: str
    warning: str | None = None


class ImageUpscaler:
    """Upscale product images using Real-ESRGAN."""

    DEFAULT_MODEL_URLS = {
        "RealESRGAN_x4plus": (
            "https://github.com/xinntao/Real-ESRGAN/releases/download/"
            "v0.1.0/RealESRGAN_x4plus.pth"
        ),
        "RealESRGAN_x2plus": (
            "https://github.com/xinntao/Real-ESRGAN/releases/download/"
            "v0.2.1/RealESRGAN_x2plus.pth"
        ),
    }

    def __init__(self, config: Config | None = None) -> None:
        self.config = config or Config()
        upscale_config = self.config.model_config_data.get("upscaling", {})
        self.enabled = bool(upscale_config.get("enabled", True))
        self.model_name = str(upscale_config.get("model", "RealESRGAN_x4plus"))
        self.device = str(upscale_config.get("device", "cpu"))
        self.scale = int(upscale_config.get("scale", 4))
        self.tile_size = int(upscale_config.get("tile_size", 512))
        self.cache_dir = Path(upscale_config.get("cache_dir", "outputs/models"))
        configured_model_file = upscale_config.get("model_file")
        self.model_file = str(configured_model_file or f"{self.model_name}.pth")
        self.model_url = str(
            upscale_config.get(
                "model_url",
                self.DEFAULT_MODEL_URLS.get(self.model_name, ""),
            )
        )
        self.auto_upscale_below_width = int(upscale_config.get("auto_upscale_below_width", 800))
        self.auto_upscale_below_height = int(upscale_config.get("auto_upscale_below_height", 800))

    def should_upscale(self, image_path: str | Path) -> bool:
        """Check if the image is small enough to benefit from upscaling."""
        if not self.enabled:
            return False
        with Image.open(image_path) as img:
            return (
                img.width < self.auto_upscale_below_width
                or img.height < self.auto_upscale_below_height
            )

    def upscale(
        self,
        image_path: str | Path,
        target_scale: int | None = None,
    ) -> UpscaleResult:
        """Upscale an image and return the result."""
        with Image.open(image_path) as img:
            original_width = img.width
            original_height = img.height
            rgb_image = img.convert("RGB")

        scale = target_scale or self.scale

        if not self.enabled:
            return UpscaleResult(
                image=rgb_image,
                original_width=original_width,
                original_height=original_height,
                upscaled_width=original_width,
                upscaled_height=original_height,
                scale_factor=1,
                model_id=self.model_name,
                warning="Upscaling is disabled.",
            )

        try:
            upsampler = self._load_upsampler(
                self.model_name,
                self.scale,
                self.tile_size,
                self.device,
                str(self.cache_dir),
                self.model_file,
                self.model_url,
            )
        except Exception as exc:
            logger.warning("Real-ESRGAN model unavailable: %s", exc)
            return UpscaleResult(
                image=rgb_image,
                original_width=original_width,
                original_height=original_height,
                upscaled_width=original_width,
                upscaled_height=original_height,
                scale_factor=1,
                model_id=self.model_name,
                warning=f"Upscaler unavailable: {exc}",
            )

        try:
            input_array = np.array(rgb_image)
            output_array, _ = upsampler.enhance(
                input_array,
                outscale=scale,
            )
            upscaled_image = Image.fromarray(output_array)

            return UpscaleResult(
                image=upscaled_image,
                original_width=original_width,
                original_height=original_height,
                upscaled_width=upscaled_image.width,
                upscaled_height=upscaled_image.height,
                scale_factor=scale,
                model_id=self.model_name,
            )

        except Exception as exc:
            logger.warning("Upscaling failed: %s", exc)
            return UpscaleResult(
                image=rgb_image,
                original_width=original_width,
                original_height=original_height,
                upscaled_width=original_width,
                upscaled_height=original_height,
                scale_factor=1,
                model_id=self.model_name,
                warning=f"Upscaling failed: {exc}",
            )

    def to_dict(self, result: UpscaleResult) -> dict[str, Any]:
        """Serialize upscale result (without image) to a JSON-safe dict."""
        data: dict[str, Any] = {
            "original_size": {
                "width": result.original_width,
                "height": result.original_height,
            },
            "upscaled_size": {
                "width": result.upscaled_width,
                "height": result.upscaled_height,
            },
            "scale_factor": result.scale_factor,
            "model_id": result.model_id,
        }
        if result.warning:
            data["warning"] = result.warning
        return data

    @staticmethod
    @lru_cache(maxsize=1)
    def _load_upsampler(
        model_name: str,
        scale: int,
        tile_size: int,
        device: str,
        cache_dir: str,
        model_file: str,
        model_url: str,
    ):
        """Load and cache the Real-ESRGAN upsampler."""
        _ensure_torchvision_compatibility()

        import torch
        from basicsr.archs.rrdbnet_arch import RRDBNet
        from realesrgan import RealESRGANer

        if "x4plus" in model_name:
            model = RRDBNet(
                num_in_ch=3,
                num_out_ch=3,
                num_feat=64,
                num_block=23,
                num_grow_ch=32,
                scale=4,
            )
        elif "x2plus" in model_name:
            model = RRDBNet(
                num_in_ch=3,
                num_out_ch=3,
                num_feat=64,
                num_block=23,
                num_grow_ch=32,
                scale=2,
            )
        else:
            model = RRDBNet(
                num_in_ch=3,
                num_out_ch=3,
                num_feat=64,
                num_block=23,
                num_grow_ch=32,
                scale=4,
            )

        model_path = ImageUpscaler._resolve_model_path(
            cache_dir,
            model_file,
            model_url,
        )
        half = device.startswith("cuda")
        torch_device = torch.device(device)

        upsampler = RealESRGANer(
            scale=scale,
            model_path=str(model_path),
            model=model,
            tile=tile_size,
            tile_pad=10,
            pre_pad=0,
            half=half,
            device=torch_device,
        )
        return upsampler

    @staticmethod
    def _resolve_model_path(
        cache_dir: str,
        model_file: str,
        model_url: str,
    ) -> Path:
        """Return a local Real-ESRGAN checkpoint path.

        Download the checkpoint into the configured cache directory
        when needed.
        """
        cache_path = Path(cache_dir)
        cache_path.mkdir(parents=True, exist_ok=True)
        model_path = cache_path / model_file

        if model_path.exists():
            return model_path

        if not model_url:
            raise FileNotFoundError(
                "Real-ESRGAN weights not found at " f"{model_path} and no model_url configured."
            )

        download_url_to_file(model_url, str(model_path))
        return model_path
