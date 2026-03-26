from unittest.mock import MagicMock

from PIL import Image

from src.ecommerce.outpainter import Outpainter


def build_config() -> MagicMock:
    config = MagicMock()
    config.model_config_data = {
        "image_ai": {},
        "outpainting": {
            "enabled": False,
            "feather_px": 0,
            "default_expand_ratio": 0.25,
        },
    }
    return config


class TestOutpainterCanvas:
    def test_build_canvas_and_mask_for_right_expansion(self):
        outpainter = Outpainter(build_config())
        image = Image.new("RGB", (100, 80), (255, 0, 0))

        canvas, mask = outpainter.build_canvas_and_mask(image, "right", 0.25)

        assert canvas.size == (164, 80)
        assert canvas.getpixel((150, 10)) == (255, 255, 255)
        assert mask.getpixel((10, 10)) == 0
        assert mask.getpixel((95, 10)) == 255
        assert mask.getpixel((150, 10)) == 255

    def test_build_canvas_and_mask_for_top_expansion(self):
        outpainter = Outpainter(build_config())
        image = Image.new("RGB", (100, 80), (255, 0, 0))

        canvas, mask = outpainter.build_canvas_and_mask(image, "top", 0.25)

        assert canvas.size == (100, 144)
        assert canvas.getpixel((20, 10)) == (255, 255, 255)
        assert mask.getpixel((20, 10)) == 255
        assert mask.getpixel((20, 100)) == 0
