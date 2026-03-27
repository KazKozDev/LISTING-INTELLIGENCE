"""Tests for Real-ESRGAN checkpoint resolution."""

from __future__ import annotations

import sys
from pathlib import Path
from types import ModuleType
from unittest.mock import patch

from src.ecommerce.image_upscaler import (
    ImageUpscaler,
    _ensure_torchvision_compatibility,
)


class TestImageUpscaler:
    def test_resolve_model_path_uses_existing_checkpoint(self, tmp_path):
        checkpoint = tmp_path / "RealESRGAN_x4plus.pth"
        checkpoint.write_bytes(b"weights")

        with patch("src.ecommerce.image_upscaler.download_url_to_file") as mocked_download:
            resolved = ImageUpscaler._resolve_model_path(
                str(tmp_path),
                checkpoint.name,
                "https://example.com/model.pth",
            )

        assert resolved == checkpoint
        mocked_download.assert_not_called()

    def test_resolve_model_path_downloads_missing_checkpoint(self, tmp_path):
        checkpoint = tmp_path / "RealESRGAN_x4plus.pth"

        def _fake_download(url: str, destination: str) -> None:
            Path(destination).write_bytes(url.encode("utf-8"))

        with patch(
            "src.ecommerce.image_upscaler.download_url_to_file",
            side_effect=_fake_download,
        ) as mocked_download:
            resolved = ImageUpscaler._resolve_model_path(
                str(tmp_path),
                checkpoint.name,
                "https://example.com/model.pth",
            )

        assert resolved == checkpoint
        assert checkpoint.read_bytes() == b"https://example.com/model.pth"
        mocked_download.assert_called_once_with(
            "https://example.com/model.pth",
            str(checkpoint),
        )

    def test_ensure_torchvision_compatibility_aliases_legacy_module(self):
        fallback_module = ModuleType("torchvision.transforms._functional_tensor")

        def _fake_import(name: str):
            if name == "torchvision.transforms.functional_tensor":
                raise ModuleNotFoundError(
                    ("No module named " "'torchvision.transforms.functional_tensor'"),
                    name=name,
                )
            if name == "torchvision.transforms._functional_tensor":
                return fallback_module
            raise AssertionError(f"Unexpected import: {name}")

        with patch(
            "src.ecommerce.image_upscaler.importlib.import_module",
            side_effect=_fake_import,
        ):
            with patch.dict(sys.modules, {}, clear=False):
                _ensure_torchvision_compatibility()
                from src.ecommerce import (
                    image_upscaler as image_upscaler_module,
                )

                assert (
                    fallback_module
                    is image_upscaler_module.sys.modules["torchvision.transforms.functional_tensor"]
                )
