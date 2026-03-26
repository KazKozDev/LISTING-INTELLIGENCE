"""Tests for deterministic compliance fixer flows."""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw

from config import Config
from src.ecommerce.compliance_fixer import ComplianceFixer


def _create_transparent_product_image(path: Path) -> Path:
    image = Image.new("RGBA", (240, 180), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle(
        (30, 40, 120, 160),
        radius=16,
        fill=(40, 80, 200, 255),
    )
    image.save(path, format="PNG")
    return path


class TestComplianceFixer:
    def test_auto_center_ai_respects_target_canvas(self, tmp_path):
        image_path = _create_transparent_product_image(tmp_path / "cutout.png")
        fixer = ComplianceFixer(config=Config())

        result_image, metadata = fixer.apply_fix(
            image_path,
            marketplace="amazon",
            action="auto_center_ai",
            payload={
                "target_width": 1000,
                "target_height": 1000,
                "background": "white",
            },
        )

        assert result_image.size == (1000, 1000)
        assert metadata["ai"]["bounds"]["left"] > 0
        assert metadata["ai"]["rendered_object"]["width"] <= 1000
        assert metadata["ai"]["mask_source"] in {
            "alpha-channel",
            "huggingface",
            "full-image",
        }

    def test_suggest_fixes_prioritizes_auto_center_ai(self, tmp_path):
        image_path = _create_transparent_product_image(tmp_path / "cutout.png")
        fixer = ComplianceFixer(config=Config())

        suggestion_data = fixer.suggest_fixes(image_path, marketplace="amazon")
        actions = [
            suggestion["action"]
            for suggestion in suggestion_data["suggestions"]
        ]

        assert "auto_center_ai" in actions

    def test_marketplace_fill_ratio_uses_amazon_minimum_preset(self, tmp_path):
        image_path = _create_transparent_product_image(tmp_path / "amazon.png")
        fixer = ComplianceFixer(config=Config())

        _, metadata = fixer.apply_fix(
            image_path,
            marketplace="amazon",
            action="auto_center_ai",
            payload={
                "target_width": 500,
                "target_height": 500,
                "background": "white",
            },
        )

        assert metadata["ai"]["fill_ratio"] == 0.85

    def test_marketplace_fill_ratio_uses_walmart_recommended_preset(
        self,
        tmp_path,
    ):
        image_path = _create_transparent_product_image(
            tmp_path / "walmart.png"
        )
        fixer = ComplianceFixer(config=Config())

        _, metadata = fixer.apply_fix(
            image_path,
            marketplace="walmart",
            action="auto_center_ai",
            payload={
                "target_width": 2200,
                "target_height": 2200,
                "background": "white",
            },
        )

        assert metadata["ai"]["fill_ratio"] == 0.94

    def test_marketplace_fill_ratio_uses_etsy_main_image_preset(
        self,
        tmp_path,
    ):
        image_path = _create_transparent_product_image(tmp_path / "etsy.png")
        fixer = ComplianceFixer(config=Config())

        _, metadata = fixer.apply_fix(
            image_path,
            marketplace="etsy",
            action="auto_center_ai",
            payload={
                "target_width": 2000,
                "target_height": 1600,
                "background": "white",
                "image_usage": "main_image",
            },
        )

        assert metadata["ai"]["fill_ratio"] == 0.8
        assert metadata["ai"]["target_class"] == "recommended"
        assert metadata["ai"]["image_usage"] == "main_image"

    def test_marketplace_fill_ratio_can_use_gallery_policy(self, tmp_path):
        image_path = _create_transparent_product_image(
            tmp_path / "gallery.png"
        )
        fixer = ComplianceFixer(config=Config())

        _, metadata = fixer.apply_fix(
            image_path,
            marketplace="etsy",
            action="auto_center_ai",
            payload={
                "target_width": 570,
                "target_height": 456,
                "background": "white",
                "image_usage": "gallery_image",
            },
        )

        assert metadata["ai"]["fill_ratio"] == 0.66
        assert metadata["ai"]["target_class"] == "minimum"
        assert metadata["ai"]["policy_id"] == "etsy:gallery_image"
