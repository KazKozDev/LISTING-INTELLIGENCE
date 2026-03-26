from __future__ import annotations

from config import Config
from src.ecommerce.foreground_masking import ForegroundMaskExtractor


class FakeModel:
    def __init__(self) -> None:
        self.float_called = False

    def to(self, _device):
        return self

    def float(self):
        self.float_called = True
        return self

    def eval(self):
        return self


def test_birefnet_prefers_smaller_sizes_on_cpu() -> None:
    extractor = ForegroundMaskExtractor(config=Config())

    assert extractor._get_birefnet_input_sizes("cpu") == [512, 384]


def test_birefnet_keeps_configured_size_on_non_cpu() -> None:
    extractor = ForegroundMaskExtractor(config=Config())

    assert extractor._get_birefnet_input_sizes("cuda:0") == [1024]
