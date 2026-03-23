"""Test fixtures and configuration."""

import os
import sys
import tempfile
from pathlib import Path
from unittest.mock import MagicMock
from datetime import datetime

import pytest

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

# Set test env vars before importing Config
os.environ.setdefault("LLM_PROVIDER", "ollama")
os.environ.setdefault("LLM_MODEL", "test-model")
os.environ.setdefault("LLM_BASE_URL", "http://localhost:11434")


@pytest.fixture
def test_config():
    """Create a test Config instance."""
    from config import Config

    return Config(
        provider="ollama",
        model="test-model",
        base_url="http://localhost:11434",
    )


@pytest.fixture
def mock_provider():
    """Create a mock LLM provider."""
    from src.llm.base import BaseLLMProvider, ProviderResponse

    provider = MagicMock(spec=BaseLLMProvider)
    provider.provider_name = "MockProvider"
    provider.supports_vision = True
    provider.verify_connection.return_value = True
    provider.list_models.return_value = ["test-model"]
    provider.analyze_image.return_value = ProviderResponse(
        text="Test analysis result",
        model="test-model",
        usage={"prompt_tokens": 10, "completion_tokens": 20, "total_tokens": 30},
        metadata={"test": True},
    )
    provider.chat.return_value = ProviderResponse(
        text="Test chat response",
        model="test-model",
        usage={"prompt_tokens": 5, "completion_tokens": 10, "total_tokens": 15},
        metadata={},
    )
    return provider


@pytest.fixture
def sample_image(tmp_path):
    """Create a minimal test PNG image."""
    # Minimal valid 1x1 red PNG
    import struct
    import zlib

    def create_png(width=1, height=1):
        def chunk(chunk_type, data):
            c = chunk_type + data
            crc = struct.pack(">I", zlib.crc32(c) & 0xFFFFFFFF)
            return struct.pack(">I", len(data)) + c + crc

        header = b"\x89PNG\r\n\x1a\n"
        ihdr = chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0))
        raw_data = b""
        for _ in range(height):
            raw_data += b"\x00" + b"\xff\x00\x00" * width
        idat = chunk(b"IDAT", zlib.compress(raw_data))
        iend = chunk(b"IEND", b"")
        return header + ihdr + idat + iend

    img_path = tmp_path / "test_image.png"
    img_path.write_bytes(create_png())
    return img_path


@pytest.fixture
def sample_pdf(tmp_path):
    """Create a minimal test PDF."""
    pdf_content = b"""%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>endobj
xref
0 4
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
trailer<</Size 4/Root 1 0 R>>
startxref
206
%%EOF"""
    pdf_path = tmp_path / "test_document.pdf"
    pdf_path.write_bytes(pdf_content)
    return pdf_path


@pytest.fixture
def analysis_result():
    """Create a sample AnalysisResult."""
    from src.vision_agent import AnalysisResult

    return AnalysisResult(
        file_path=Path("/tmp/test.png"),
        file_type="image",
        task="Test task",
        text="Sample analysis text with key: value pairs",
        metadata={
            "model": "test-model",
            "usage": {"total_tokens": 30},
            "provider": "test",
        },
    )


@pytest.fixture
def tmp_cache_dir(tmp_path):
    """Create a temporary cache directory."""
    cache_dir = tmp_path / "cache"
    cache_dir.mkdir()
    return cache_dir
