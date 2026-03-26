"""Deterministic compliance fix suggestions and image transformations."""

from __future__ import annotations

import base64
import io
import math
from pathlib import Path
from typing import Any

from PIL import Image, ImageChops, ImageOps

from config import Config

from .foreground_masking import ForegroundMaskExtractor
from .marketplace_rules import get_marketplace_info

DEFAULT_MINIMUM_FILL_RATIO = 0.82
DEFAULT_RECOMMENDED_FILL_RATIO = 0.88


class ComplianceFixer:
    """Suggest and apply safe marketplace-oriented image fixes."""

    def __init__(
        self,
        config: Config | None = None,
        mask_extractor: ForegroundMaskExtractor | None = None,
    ) -> None:
        self.config = config or Config()
        self.image_ai_config = self.config.model_config_data.get(
            "image_ai",
            {},
        )
        self.composition_policies = self.config.composition_policies_config
        self.mask_extractor = (
            mask_extractor or ForegroundMaskExtractor(self.config)
        )

    def suggest_fixes(
        self,
        image_path: str | Path,
        marketplace: str,
    ) -> dict[str, Any]:
        """Suggest deterministic fixes based on image properties and rules."""
        rules = get_marketplace_info(marketplace)
        with Image.open(image_path) as image:
            width, height = image.size

        suggestions: list[dict[str, Any]] = []

        min_width = rules["min_image_width"]
        min_height = rules["min_image_height"]
        recommended_width = rules.get("recommended_image_width") or min_width
        recommended_height = (
            rules.get("recommended_image_height") or min_height
        )

        if self._should_suggest_auto_center(
            rules,
            width,
            height,
            recommended_width,
            recommended_height,
        ):
            suggestions.append(
                {
                    "id": "auto-center-ai",
                    "title": "Auto Center With AI",
                    "description": (
                        "Extract the product foreground, remove empty "
                        "margins, "
                        "and place it on a centered white marketplace canvas."
                    ),
                    "action": "auto_center_ai",
                    "automated": True,
                    "priority": "high",
                }
            )

        if not suggestions:
            suggestions.append(
                {
                    "id": "recheck-only",
                    "title": "No deterministic fix required",
                    "description": (
                        "This image already matches the main technical rules. "
                        "Run compliance again after any manual edits."
                    ),
                    "action": "recheck_only",
                    "automated": False,
                    "priority": "low",
                }
            )

        return {
            "image_width": width,
            "image_height": height,
            "suggestions": suggestions,
        }

    def apply_fix(
        self,
        image_path: str | Path,
        marketplace: str,
        action: str,
        payload: dict[str, Any] | None = None,
    ) -> tuple[Image.Image, dict[str, Any]]:
        """Apply a supported deterministic fix and return the edited image."""
        rules = get_marketplace_info(marketplace)
        with Image.open(image_path) as source_image:
            image = source_image.convert("RGBA")

        if action == "recheck_only":
            fixed_image = image.convert("RGB")
        elif action == "pad_to_square":
            fixed_image = self._pad_to_square(image, rules)
        elif action == "white_background":
            fixed_image = self._white_background(image)
        elif action == "resize_to_minimum":
            fixed_image = self._fit_to_canvas(
                image,
                rules["min_image_width"],
                rules["min_image_height"],
            )
        elif action == "resize_to_recommended":
            fixed_image = self._fit_to_canvas(
                image,
                rules.get("recommended_image_width")
                or rules["min_image_width"],
                rules.get("recommended_image_height")
                or rules["min_image_height"],
            )
        elif action == "auto_center_ai":
            fixed_image, ai_metadata = self._auto_center_with_ai(
                image,
                rules,
                payload or {},
            )
        elif action == "canvas_transform":
            fixed_image = self._apply_canvas_transform(
                image,
                rules,
                payload or {},
            )
        else:
            raise ValueError(f"Unsupported fix action: {action}")

        details = {
            "action": action,
            "marketplace": marketplace,
            "width": fixed_image.width,
            "height": fixed_image.height,
            "payload": payload or {},
        }
        if action == "auto_center_ai":
            details["ai"] = ai_metadata
        return fixed_image, details

    def image_to_data_url(self, image: Image.Image) -> str:
        """Serialize a PIL image as a PNG data URL."""
        buffer = io.BytesIO()
        image.save(buffer, format="PNG")
        encoded = base64.b64encode(buffer.getvalue()).decode("ascii")
        return f"data:image/png;base64,{encoded}"

    def _needs_square_canvas(self, rules: dict[str, Any]) -> bool:
        aspect_ratio = (rules.get("aspect_ratio") or "").lower()
        return "1:1" in aspect_ratio or "square" in aspect_ratio

    def _needs_white_background(self, rules: dict[str, Any]) -> bool:
        required_background = (rules.get("required_background") or "").lower()
        return "white" in required_background

    def _should_suggest_auto_center(
        self,
        rules: dict[str, Any],
        width: int,
        height: int,
        recommended_width: int,
        recommended_height: int,
    ) -> bool:
        needs_centering_support = (
            self._needs_square_canvas(rules)
            or self._needs_white_background(rules)
            or width < recommended_width
            or height < recommended_height
        )
        return (
            bool(self.image_ai_config.get("enabled", True))
            and needs_centering_support
        )

    def _pad_to_square(
        self,
        image: Image.Image,
        rules: dict[str, Any],
    ) -> Image.Image:
        target_size = max(
            image.width,
            image.height,
            rules.get("recommended_image_width") or 0,
            rules.get("min_image_width") or 0,
        )
        return self._fit_to_canvas(image, target_size, target_size)

    def _white_background(self, image: Image.Image) -> Image.Image:
        background = Image.new("RGBA", image.size, (255, 255, 255, 255))
        background.alpha_composite(image)
        return background.convert("RGB")

    def _fit_to_canvas(
        self,
        image: Image.Image,
        target_width: int,
        target_height: int,
    ) -> Image.Image:
        fitted = ImageOps.contain(image, (target_width, target_height))
        canvas = Image.new(
            "RGBA",
            (target_width, target_height),
            (255, 255, 255, 255),
        )
        offset_x = (target_width - fitted.width) // 2
        offset_y = (target_height - fitted.height) // 2
        canvas.alpha_composite(fitted, (offset_x, offset_y))
        return canvas.convert("RGB")

    def _auto_center_with_ai(
        self,
        image: Image.Image,
        rules: dict[str, Any],
        payload: dict[str, Any],
    ) -> tuple[Image.Image, dict[str, Any]]:
        target_width, target_height = self._resolve_canvas_target(
            rules,
            payload,
        )
        image_usage = self._resolve_image_usage(payload)
        target_class = self._resolve_fill_ratio_target_key(
            rules,
            target_width,
            target_height,
        )
        fill_ratio = self._resolve_fill_ratio(
            rules,
            payload,
            target_width,
            target_height,
        )
        mask_result = self.mask_extractor.extract(image)
        current_alpha = image.getchannel("A")
        mask_alpha = ImageChops.multiply(
            current_alpha,
            mask_result.mask.convert("L"),
        )
        isolated = image.copy()
        isolated.putalpha(mask_alpha)

        bounds = mask_result.bounds or (0, 0, image.width, image.height)
        cropped = isolated.crop(bounds)
        object_width = max(1, bounds[2] - bounds[0])
        object_height = max(1, bounds[3] - bounds[1])

        target_object_width = max(1, round(target_width * fill_ratio))
        target_object_height = max(1, round(target_height * fill_ratio))
        scale = min(
            target_object_width / object_width,
            target_object_height / object_height,
        )
        render_width = max(1, round(object_width * scale))
        render_height = max(1, round(object_height * scale))
        resized = cropped.resize(
            (render_width, render_height),
            Image.Resampling.LANCZOS,
        )

        background_color = self._resolve_background_color(payload)
        canvas = Image.new(
            "RGBA",
            (target_width, target_height),
            background_color,
        )
        paste_x = (target_width - render_width) // 2
        paste_y = (target_height - render_height) // 2
        canvas.alpha_composite(resized, (paste_x, paste_y))

        ai_metadata = {
            "model": mask_result.model_id,
            "mask_source": mask_result.source,
            "fallback_used": mask_result.fallback_used,
            "fallback_reason": mask_result.fallback_reason,
            "coverage_ratio": round(mask_result.coverage_ratio, 6),
            "fill_ratio": fill_ratio,
            "target_class": target_class,
            "image_usage": image_usage,
            "policy_id": f"{rules.get('id', 'default')}:{image_usage}",
            "bounds": {
                "left": bounds[0],
                "top": bounds[1],
                "right": bounds[2],
                "bottom": bounds[3],
            },
            "target": {
                "width": target_width,
                "height": target_height,
            },
            "rendered_object": {
                "width": render_width,
                "height": render_height,
            },
            "alpha_threshold": mask_result.alpha_threshold,
        }
        return canvas.convert("RGB"), ai_metadata

    def _resolve_canvas_target(
        self,
        rules: dict[str, Any],
        payload: dict[str, Any],
    ) -> tuple[int, int]:
        target_width = int(
            payload.get("target_width")
            or rules.get("recommended_image_width")
            or rules["min_image_width"]
        )
        target_height = int(
            payload.get("target_height")
            or rules.get("recommended_image_height")
            or rules["min_image_height"]
        )

        if target_width <= 0 or target_height <= 0:
            raise ValueError("Canvas target dimensions must be positive")

        return target_width, target_height

    def _resolve_fill_ratio(
        self,
        rules: dict[str, Any],
        payload: dict[str, Any],
        target_width: int,
        target_height: int,
    ) -> float:
        if payload.get("fill_ratio") is not None:
            return float(payload["fill_ratio"])

        image_usage = self._resolve_image_usage(payload)
        target_key = self._resolve_fill_ratio_target_key(
            rules,
            target_width,
            target_height,
        )
        return self._get_marketplace_fill_ratio(
            rules,
            image_usage,
            target_key,
        )

    @staticmethod
    def _resolve_image_usage(payload: dict[str, Any]) -> str:
        """Resolve composition intent for marketplace policies."""
        image_usage = str(payload.get("image_usage", "main_image")).strip()
        return image_usage or "main_image"

    def _resolve_fill_ratio_target_key(
        self,
        rules: dict[str, Any],
        target_width: int,
        target_height: int,
    ) -> str:
        """Classify the canvas target for marketplace-specific fill presets."""

        minimum_width = int(rules["min_image_width"])
        minimum_height = int(rules["min_image_height"])
        recommended_width = int(
            rules.get("recommended_image_width") or minimum_width
        )
        recommended_height = int(
            rules.get("recommended_image_height") or minimum_height
        )

        if (
            target_width <= minimum_width
            and target_height <= minimum_height
        ):
            return "minimum"

        if (
            target_width >= recommended_width
            and target_height >= recommended_height
        ):
            return "recommended"

        return "recommended"

    def _get_marketplace_fill_ratio(
        self,
        rules: dict[str, Any],
        image_usage: str,
        target_key: str,
    ) -> float:
        """Resolve fill ratio from marketplace presets with safe defaults."""

        policies = self.composition_policies or {}
        marketplace_id = str(rules.get("id", "default"))
        default_policy = policies.get("default", {})
        marketplace_policy = policies.get(marketplace_id, {})

        fallback_usage_policy = default_policy.get("main_image", {})
        default_usage_policy = default_policy.get(
            image_usage,
            fallback_usage_policy,
        )
        marketplace_usage_policy = marketplace_policy.get(
            image_usage,
            marketplace_policy.get("main_image", {}),
        )

        default_key = (
            DEFAULT_MINIMUM_FILL_RATIO
            if target_key == "minimum"
            else DEFAULT_RECOMMENDED_FILL_RATIO
        )
        policy_key = (
            "minimum_fill_ratio"
            if target_key == "minimum"
            else "recommended_fill_ratio"
        )

        return float(
            marketplace_usage_policy.get(
                policy_key,
                default_usage_policy.get(
                    policy_key,
                    default_key,
                ),
            )
        )

    @staticmethod
    def _resolve_background_color(
        payload: dict[str, Any],
    ) -> tuple[int, int, int, int]:
        background = str(payload.get("background", "white")).lower().strip()
        if background == "transparent":
            return (255, 255, 255, 0)
        return (255, 255, 255, 255)

    def _apply_canvas_transform(
        self,
        image: Image.Image,
        rules: dict[str, Any],
        payload: dict[str, Any],
    ) -> Image.Image:
        target_width, target_height = self._resolve_canvas_target(
            rules,
            payload,
        )

        zoom = max(float(payload.get("zoom", 1.0)), 1.0)
        offset_x = float(payload.get("offset_x", 0.0))
        offset_y = float(payload.get("offset_y", 0.0))

        cover_scale = max(
            target_width / image.width,
            target_height / image.height,
        )
        render_scale = cover_scale * zoom
        render_width = max(1, math.ceil(image.width * render_scale))
        render_height = max(1, math.ceil(image.height * render_scale))

        resized = image.resize(
            (render_width, render_height),
            Image.Resampling.LANCZOS,
        )

        canvas = Image.new(
            "RGBA",
            (target_width, target_height),
            (255, 255, 255, 255),
        )
        base_x = (target_width - render_width) / 2
        base_y = (target_height - render_height) / 2
        paste_x = round(base_x + (offset_x * target_width))
        paste_y = round(base_y + (offset_y * target_height))
        canvas.alpha_composite(resized, (paste_x, paste_y))
        return canvas.convert("RGB")
