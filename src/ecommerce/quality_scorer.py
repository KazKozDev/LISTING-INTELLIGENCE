"""Image quality assessment using MUSIQ / NIMA via pyiqa."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any

from config import Config

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class QualityResult:
    """Image quality assessment result."""

    score: float
    score_normalized: float
    rating: str
    model_id: str
    warning: str | None = None


RATING_THRESHOLDS = [
    (80, "excellent"),
    (60, "good"),
    (40, "average"),
    (20, "below_average"),
    (0, "poor"),
]


class QualityScorer:
    """Score image quality using neural IQA models."""

    def __init__(self, config: Config | None = None) -> None:
        self.config = config or Config()
        quality_config = self.config.model_config_data.get("quality_scoring", {})
        self.enabled = bool(quality_config.get("enabled", True))
        self.model_name = str(quality_config.get("model", "musiq-koniq"))
        self.device = str(quality_config.get("device", "cpu"))

    def score(self, image_path: str | Path) -> QualityResult:
        """Score the visual quality of an image."""
        if not self.enabled:
            return QualityResult(
                score=0.0,
                score_normalized=0.0,
                rating="unknown",
                model_id=self.model_name,
                warning="Quality scoring is disabled.",
            )

        try:
            metric = self._load_metric(self.model_name, self.device)
        except Exception as exc:
            logger.warning("Quality model unavailable: %s", exc)
            return QualityResult(
                score=0.0,
                score_normalized=0.0,
                rating="unknown",
                model_id=self.model_name,
                warning=f"Quality model unavailable: {exc}",
            )

        try:
            import torch

            with torch.no_grad():
                raw_score = float(metric(str(image_path)).item())

            normalized = self._normalize_score(raw_score)
            rating = self._classify_rating(normalized)

            return QualityResult(
                score=round(raw_score, 4),
                score_normalized=round(normalized, 2),
                rating=rating,
                model_id=self.model_name,
            )

        except Exception as exc:
            logger.warning("Quality scoring failed: %s", exc)
            return QualityResult(
                score=0.0,
                score_normalized=0.0,
                rating="unknown",
                model_id=self.model_name,
                warning=f"Quality scoring failed: {exc}",
            )

    def to_dict(self, result: QualityResult) -> dict[str, Any]:
        """Serialize quality result to a JSON-safe dict."""
        data: dict[str, Any] = {
            "score": result.score,
            "score_normalized": result.score_normalized,
            "rating": result.rating,
            "model_id": result.model_id,
        }
        if result.warning:
            data["warning"] = result.warning
        return data

    @staticmethod
    def _normalize_score(raw_score: float) -> float:
        """Normalize raw MUSIQ score (typically 0-100) to 0-100."""
        return max(0.0, min(100.0, raw_score))

    @staticmethod
    def _classify_rating(normalized_score: float) -> str:
        """Classify normalized score into a human-readable rating."""
        for threshold, label in RATING_THRESHOLDS:
            if normalized_score >= threshold:
                return label
        return "poor"

    @staticmethod
    @lru_cache(maxsize=1)
    def _load_metric(model_name: str, device: str):
        """Load and cache the IQA metric."""
        import pyiqa

        return pyiqa.create_metric(model_name, device=device)
