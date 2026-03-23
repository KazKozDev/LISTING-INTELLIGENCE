"""Tests for VisionAgent core functionality."""

import pytest
from pathlib import Path
from unittest.mock import patch, MagicMock

from src.vision_agent import VisionAgent, AnalysisResult
from src.llm.base import ProviderResponse


class TestAnalysisResult:
    """Tests for AnalysisResult dataclass."""

    def test_creation(self, analysis_result):
        assert analysis_result.file_type == "image"
        assert analysis_result.task == "Test task"
        assert analysis_result.timestamp is not None

    def test_to_dict(self, analysis_result):
        d = analysis_result.to_dict()
        assert "file_path" in d
        assert "text" in d
        assert "metadata" in d
        assert "timestamp" in d
        assert d["file_type"] == "image"

    def test_auto_timestamp(self):
        result = AnalysisResult(
            file_path=Path("/tmp/x.png"),
            file_type="image",
            task="test",
            text="result",
            metadata={},
        )
        assert result.timestamp is not None


class TestVisionAgent:
    """Tests for VisionAgent class."""

    @patch("src.vision_agent.ProviderFactory")
    def test_init_default_config(self, mock_factory, test_config, mock_provider):
        mock_factory.create.return_value = mock_provider
        agent = VisionAgent(config=test_config)
        assert agent.config.provider == "ollama"
        assert agent.provider == mock_provider

    @patch("src.vision_agent.ProviderFactory")
    def test_analyze_image(self, mock_factory, test_config, mock_provider, sample_image):
        mock_factory.create.return_value = mock_provider
        agent = VisionAgent(config=test_config)
        # Disable cache for this test
        agent.cache = None

        result = agent.analyze_image(sample_image, task="Describe this image")

        assert isinstance(result, AnalysisResult)
        assert result.text == "Test analysis result"
        assert result.file_type == "image"
        assert result.metadata["provider"] == "MockProvider"
        mock_provider.analyze_image.assert_called_once()

    @patch("src.vision_agent.ProviderFactory")
    def test_analyze_image_file_not_found(self, mock_factory, test_config, mock_provider):
        mock_factory.create.return_value = mock_provider
        agent = VisionAgent(config=test_config)

        with pytest.raises(FileNotFoundError):
            agent.analyze_image("/nonexistent/image.png")

    @patch("src.vision_agent.ProviderFactory")
    def test_analyze_image_unsupported_format(
        self, mock_factory, test_config, mock_provider, tmp_path
    ):
        mock_factory.create.return_value = mock_provider
        agent = VisionAgent(config=test_config)

        txt_file = tmp_path / "test.txt"
        txt_file.write_text("hello")

        with pytest.raises(ValueError, match="Unsupported image format"):
            agent.analyze_image(txt_file)

    @patch("src.vision_agent.ProviderFactory")
    def test_analyze_chart(self, mock_factory, test_config, mock_provider, sample_image):
        mock_factory.create.return_value = mock_provider
        agent = VisionAgent(config=test_config)
        agent.cache = None

        result = agent.analyze_chart(sample_image)

        assert isinstance(result, AnalysisResult)
        # Chart analysis uses default prompt when task is None
        mock_provider.analyze_image.assert_called_once()

    @patch("src.vision_agent.ProviderFactory")
    def test_analyze_ui_screenshot(self, mock_factory, test_config, mock_provider, sample_image):
        mock_factory.create.return_value = mock_provider
        agent = VisionAgent(config=test_config)
        agent.cache = None

        result = agent.analyze_ui_screenshot(sample_image)

        assert isinstance(result, AnalysisResult)
        mock_provider.analyze_image.assert_called_once()

    @patch("src.vision_agent.ProviderFactory")
    def test_batch_analyze(self, mock_factory, test_config, mock_provider, sample_image):
        mock_factory.create.return_value = mock_provider
        agent = VisionAgent(config=test_config)
        agent.cache = None

        results = agent.batch_analyze([sample_image, sample_image], task="Test")

        assert len(results) == 2
        assert all(isinstance(r, AnalysisResult) for r in results)

    @patch("src.vision_agent.ProviderFactory")
    def test_batch_analyze_skips_unsupported(
        self, mock_factory, test_config, mock_provider, sample_image, tmp_path
    ):
        mock_factory.create.return_value = mock_provider
        agent = VisionAgent(config=test_config)
        agent.cache = None

        bad_file = tmp_path / "bad.xyz"
        bad_file.write_text("not an image")

        results = agent.batch_analyze([sample_image, bad_file])
        assert len(results) == 1

    @patch("src.vision_agent.ProviderFactory")
    def test_cache_integration(self, mock_factory, test_config, mock_provider, sample_image):
        mock_factory.create.return_value = mock_provider
        agent = VisionAgent(config=test_config)

        # First call — should call provider
        result1 = agent.analyze_image(sample_image, task="Cache test")
        assert mock_provider.analyze_image.call_count == 1

        # Second call with same params — should use cache
        result2 = agent.analyze_image(sample_image, task="Cache test")
        assert mock_provider.analyze_image.call_count == 1  # Not called again
        assert result2.text == result1.text

    @patch("src.vision_agent.ProviderFactory")
    def test_supported_formats(self, mock_factory, test_config, mock_provider):
        mock_factory.create.return_value = mock_provider
        agent = VisionAgent(config=test_config)

        assert ".png" in agent.SUPPORTED_IMAGE_FORMATS
        assert ".jpg" in agent.SUPPORTED_IMAGE_FORMATS
        assert ".pdf" in agent.SUPPORTED_DOC_FORMATS
