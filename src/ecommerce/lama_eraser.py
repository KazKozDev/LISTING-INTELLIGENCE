"""Image inpainting using LaMa (Large Mask Inpainting)."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any

import numpy as np
from PIL import Image

from config import Config

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class InpaintResult:
    """Inpainting result."""

    image: Image.Image
    model_id: str
    warning: str | None = None


class LamaEraser:
    """Erase (inpaint) masked regions in product images using LaMa."""

    def __init__(self, config: Config | None = None) -> None:
        self.config = config or Config()
        lama_config = self.config.model_config_data.get("lama_inpaint", {})
        self.enabled = bool(lama_config.get("enabled", True))
        self.device = str(lama_config.get("device", "mps"))

    def erase(
        self,
        image_path: str | Path,
        mask_path_or_image: str | Path | Image.Image | np.ndarray,
    ) -> InpaintResult:
        """Erase regions specified by the mask."""
        with Image.open(image_path) as img:
            rgb_image = img.convert("RGB")

        if not self.enabled:
            return InpaintResult(
                image=rgb_image,
                model_id="lama",
                warning="Inpainting is disabled.",
            )

        try:
            lama = self._load_lama(self.device)
        except Exception as exc:
            logger.warning("LaMa model unavailable: %s", exc)
            return InpaintResult(
                image=rgb_image,
                model_id="lama",
                warning=f"Inpainter unavailable: {exc}",
            )

        try:
            # Handle mask format
            if isinstance(mask_path_or_image, (str, Path)):
                mask = Image.open(mask_path_or_image).convert("L")
            elif isinstance(mask_path_or_image, np.ndarray):
                mask = Image.fromarray(mask_path_or_image).convert("L")
            else:
                mask = mask_path_or_image.convert("L")
                
            # If the mask doesn't perfectly match the image dimensions, resize it
            if mask.size != rgb_image.size:
                mask = mask.resize(rgb_image.size, Image.Resampling.NEAREST)

            # SimpleLama takes PIL Image and PIL mask (L-mode)
            result_image = lama(rgb_image, mask)

            return InpaintResult(
                image=result_image,
                model_id="lama",
            )

        except Exception as exc:
            logger.warning("Inpainting failed: %s", exc)
            return InpaintResult(
                image=rgb_image,
                model_id="lama",
                warning=f"Inpainting failed: {exc}",
            )

    @staticmethod
    @lru_cache(maxsize=1)
    def _load_lama(device: str):
        """Load and cache the LaMa inpainter."""
        from simple_lama_inpainting import SimpleLama
        # SimpleLama defaults to cuda/cpu based on availability. 
        # But we can force it inside its pipeline technically or it just works.
        lama = SimpleLama()
        if device == "mps":
            try:
                import torch
                if hasattr(lama, "model") and hasattr(lama.model, "to"):
                    lama.model = lama.model.to(torch.device("mps"))
                    lama.device = torch.device("mps")
            except Exception as e:
                logger.warning(f"Could not force LaMa to MPS, falling back: {e}")
        return lama
