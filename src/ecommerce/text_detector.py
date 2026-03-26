"""Text detection and OCR for product images using EasyOCR."""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path
from typing import Any

from config import Config

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class TextRegion:
    """Single detected text region."""

    text: str
    confidence: float
    bbox: tuple[int, int, int, int]
    area_ratio: float


@dataclass(frozen=True)
class TextDetectionResult:
    """Full OCR result for an image."""

    regions: list[TextRegion]
    total_text_regions: int
    has_text: bool
    combined_text: str
    text_coverage_ratio: float
    warnings: list[str] = field(default_factory=list)


class TextDetector:
    """Detect and read text in product images using EasyOCR."""

    def __init__(self, config: Config | None = None) -> None:
        self.config = config or Config()
        ocr_config = self.config.model_config_data.get("ocr", {})
        self.enabled = bool(ocr_config.get("enabled", True))
        self.languages = list(ocr_config.get("languages", ["en"]))
        self.device = str(ocr_config.get("device", "cpu"))
        self.confidence_threshold = float(
            ocr_config.get("confidence_threshold", 0.3)
        )
        self.warn_on_text = bool(
            ocr_config.get("warn_on_text_in_main_image", True)
        )

    def detect(self, image_path: str | Path) -> TextDetectionResult:
        """Run OCR on an image and return detected text regions."""
        if not self.enabled:
            return TextDetectionResult(
                regions=[],
                total_text_regions=0,
                has_text=False,
                combined_text="",
                text_coverage_ratio=0.0,
            )

        try:
            reader = self._load_reader(
                tuple(self.languages),
                self.device != "cpu",
            )
        except Exception as exc:
            logger.warning("EasyOCR reader unavailable: %s", exc)
            return TextDetectionResult(
                regions=[],
                total_text_regions=0,
                has_text=False,
                combined_text="",
                text_coverage_ratio=0.0,
                warnings=[f"OCR model unavailable: {exc}"],
            )

        try:
            from PIL import Image

            with Image.open(image_path) as img:
                image_area = max(1, img.width * img.height)

            raw_results = reader.readtext(str(image_path))

            regions: list[TextRegion] = []
            total_text_area = 0

            for bbox_points, text, confidence in raw_results:
                if confidence < self.confidence_threshold:
                    continue

                xs = [int(p[0]) for p in bbox_points]
                ys = [int(p[1]) for p in bbox_points]
                x1, y1 = min(xs), min(ys)
                x2, y2 = max(xs), max(ys)
                box_area = max(1, (x2 - x1) * (y2 - y1))
                area_ratio = box_area / image_area
                total_text_area += box_area

                regions.append(
                    TextRegion(
                        text=text.strip(),
                        confidence=confidence,
                        bbox=(x1, y1, x2, y2),
                        area_ratio=round(area_ratio, 6),
                    )
                )

            has_text = len(regions) > 0
            combined_text = " ".join(r.text for r in regions)
            text_coverage = total_text_area / image_area
            warnings: list[str] = []

            if has_text and self.warn_on_text:
                warnings.append(
                    f"Detected {len(regions)} text region(s) on the image. "
                    "Most marketplaces prohibit text on main product images."
                )

            if text_coverage > 0.15:
                warnings.append(
                    f"Text covers {text_coverage:.0%} of the image area, "
                    "which is likely too much for a product photo."
                )

            return TextDetectionResult(
                regions=regions,
                total_text_regions=len(regions),
                has_text=has_text,
                combined_text=combined_text,
                text_coverage_ratio=round(text_coverage, 6),
                warnings=warnings,
            )

        except Exception as exc:
            logger.warning("OCR detection failed: %s", exc)
            return TextDetectionResult(
                regions=[],
                total_text_regions=0,
                has_text=False,
                combined_text="",
                text_coverage_ratio=0.0,
                warnings=[f"OCR failed: {exc}"],
            )

    def to_dict(self, result: TextDetectionResult) -> dict[str, Any]:
        """Serialize OCR result to a JSON-safe dict."""
        return {
            "total_text_regions": result.total_text_regions,
            "has_text": result.has_text,
            "combined_text": result.combined_text,
            "text_coverage_ratio": result.text_coverage_ratio,
            "warnings": result.warnings,
            "regions": [
                {
                    "text": r.text,
                    "confidence": round(r.confidence, 4),
                    "bbox": list(r.bbox),
                    "area_ratio": r.area_ratio,
                }
                for r in result.regions
            ],
        }

    @staticmethod
    @lru_cache(maxsize=1)
    def _load_reader(languages: tuple, gpu: bool):
        """Load and cache the EasyOCR reader."""
        import easyocr

        return easyocr.Reader(list(languages), gpu=gpu)
