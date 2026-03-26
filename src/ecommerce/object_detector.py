"""Object detection for product images using YOLO."""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path
from typing import Any

from PIL import Image

from config import Config

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class DetectedObject:
    """Single detected object in an image."""

    label: str
    confidence: float
    bbox: tuple[int, int, int, int]
    area_ratio: float


@dataclass(frozen=True)
class DetectionResult:
    """Full detection result for an image."""

    objects: list[DetectedObject]
    total_count: int
    has_watermark: bool
    has_text_overlay: bool
    warnings: list[str] = field(default_factory=list)


WATERMARK_LABELS = {"logo", "watermark", "stamp", "seal", "badge"}
TEXT_OVERLAY_LABELS = {"text", "label", "sign", "banner", "caption"}


class ObjectDetector:
    """Detect objects, watermarks, and text overlays in product images."""

    def __init__(self, config: Config | None = None) -> None:
        self.config = config or Config()
        detection_config = self.config.model_config_data.get(
            "object_detection", {}
        )
        self.enabled = bool(detection_config.get("enabled", True))
        self.model_name = str(
            detection_config.get("model", "yolo11n.pt")
        )
        self.device = str(detection_config.get("device", "cpu"))
        self.confidence_threshold = float(
            detection_config.get("confidence_threshold", 0.25)
        )
        self.detect_watermarks = bool(
            detection_config.get("detect_watermarks", True)
        )
        self.detect_text_overlays = bool(
            detection_config.get("detect_text_overlays", True)
        )
        self.max_objects_warning = int(
            detection_config.get("max_objects_warning", 3)
        )

    def detect(self, image_path: str | Path) -> DetectionResult:
        """Run object detection on an image."""
        if not self.enabled:
            return DetectionResult(
                objects=[],
                total_count=0,
                has_watermark=False,
                has_text_overlay=False,
            )

        try:
            model = self._load_model(self.model_name, self.device)
        except Exception as exc:
            logger.warning("YOLO model unavailable: %s", exc)
            return DetectionResult(
                objects=[],
                total_count=0,
                has_watermark=False,
                has_text_overlay=False,
                warnings=[f"Detection model unavailable: {exc}"],
            )

        try:
            with Image.open(image_path) as img:
                image_area = img.width * img.height

            results = model(
                str(image_path),
                conf=self.confidence_threshold,
                verbose=False,
            )

            objects: list[DetectedObject] = []
            has_watermark = False
            has_text_overlay = False
            warnings: list[str] = []

            for result in results:
                if result.boxes is None:
                    continue
                for box in result.boxes:
                    label = model.names[int(box.cls[0])].lower()
                    confidence = float(box.conf[0])
                    x1, y1, x2, y2 = (
                        int(v) for v in box.xyxy[0].tolist()
                    )
                    box_area = max(1, (x2 - x1) * (y2 - y1))
                    area_ratio = box_area / max(1, image_area)

                    obj = DetectedObject(
                        label=label,
                        confidence=confidence,
                        bbox=(x1, y1, x2, y2),
                        area_ratio=round(area_ratio, 6),
                    )
                    objects.append(obj)

                    if label in WATERMARK_LABELS:
                        has_watermark = True
                    if label in TEXT_OVERLAY_LABELS:
                        has_text_overlay = True

            if len(objects) > self.max_objects_warning:
                warnings.append(
                    f"Detected {len(objects)} objects; marketplace "
                    f"main images typically show a single product."
                )
            if has_watermark:
                warnings.append(
                    "Potential watermark or logo detected on the image."
                )
            if has_text_overlay:
                warnings.append(
                    "Text overlay detected; most marketplaces "
                    "prohibit text on main product images."
                )

            return DetectionResult(
                objects=objects,
                total_count=len(objects),
                has_watermark=has_watermark,
                has_text_overlay=has_text_overlay,
                warnings=warnings,
            )

        except Exception as exc:
            logger.warning("Object detection failed: %s", exc)
            return DetectionResult(
                objects=[],
                total_count=0,
                has_watermark=False,
                has_text_overlay=False,
                warnings=[f"Detection failed: {exc}"],
            )

    def to_dict(self, result: DetectionResult) -> dict[str, Any]:
        """Serialize detection result to a JSON-safe dict."""
        return {
            "total_count": result.total_count,
            "has_watermark": result.has_watermark,
            "has_text_overlay": result.has_text_overlay,
            "warnings": result.warnings,
            "objects": [
                {
                    "label": obj.label,
                    "confidence": round(obj.confidence, 4),
                    "bbox": list(obj.bbox),
                    "area_ratio": obj.area_ratio,
                }
                for obj in result.objects
            ],
        }

    @staticmethod
    @lru_cache(maxsize=1)
    def _load_model(model_name: str, device: str):
        """Load and cache the YOLO model."""
        from ultralytics import YOLO

        model = YOLO(model_name)
        model.to(device)
        return model
