"""Tests for LLM providers and factory."""

import pytest
from unittest.mock import patch, MagicMock
from pathlib import Path

from src.llm.factory import ProviderFactory
from src.llm.base import BaseLLMProvider, ProviderResponse


class TestProviderResponse:
    """Tests for ProviderResponse dataclass."""

    def test_creation(self):
        response = ProviderResponse(
            text="Hello",
            model="test",
            usage={"total_tokens": 10},
            metadata={"key": "value"},
        )
        assert response.text == "Hello"
        assert response.model == "test"

    def test_to_dict(self):
        response = ProviderResponse(
            text="Hello",
            model="test",
            usage={"total_tokens": 10},
            metadata={},
        )
        d = response.to_dict()
        assert d["text"] == "Hello"
        assert d["model"] == "test"
        assert "usage" in d
        assert "metadata" in d


class TestProviderFactory:
    """Tests for ProviderFactory."""

    def test_list_providers(self):
        providers = ProviderFactory.list_providers()
        assert "ollama" in providers
        assert "openai" in providers
        assert "anthropic" in providers
        assert "google" in providers
        assert "azure" in providers
        assert len(providers) == 5

    def test_get_provider_info(self):
        info = ProviderFactory.get_provider_info()
        assert "ollama" in info
        assert info["ollama"]["requires_api_key"] is False
        assert info["openai"]["requires_api_key"] is True

    def test_create_unknown_provider(self):
        with pytest.raises(ValueError, match="Unknown provider"):
            ProviderFactory.create("nonexistent", model="test")

    def test_create_empty_model(self):
        with pytest.raises(ValueError, match="Model name is required"):
            ProviderFactory.create("ollama", model="")

    def test_create_ollama(self):
        mock_cls = MagicMock()
        mock_instance = MagicMock()
        mock_cls.return_value = mock_instance

        original = ProviderFactory.PROVIDERS["ollama"]
        try:
            ProviderFactory.PROVIDERS["ollama"] = mock_cls
            provider = ProviderFactory.create(
                "ollama", model="llava", base_url="http://localhost:11434"
            )
            assert provider == mock_instance
            mock_cls.assert_called_once_with(
                model="llava",
                api_key=None,
                base_url="http://localhost:11434",
            )
        finally:
            ProviderFactory.PROVIDERS["ollama"] = original

    def test_create_openai(self):
        mock_cls = MagicMock()
        mock_instance = MagicMock()
        mock_cls.return_value = mock_instance

        original = ProviderFactory.PROVIDERS["openai"]
        try:
            ProviderFactory.PROVIDERS["openai"] = mock_cls
            provider = ProviderFactory.create(
                "openai", model="gpt-4o", api_key="test-key"
            )
            assert provider == mock_instance
            mock_cls.assert_called_once_with(
                model="gpt-4o",
                api_key="test-key",
                base_url=None,
            )
        finally:
            ProviderFactory.PROVIDERS["openai"] = original

    def test_create_anthropic(self):
        mock_cls = MagicMock()
        mock_instance = MagicMock()
        mock_cls.return_value = mock_instance

        original = ProviderFactory.PROVIDERS["anthropic"]
        try:
            ProviderFactory.PROVIDERS["anthropic"] = mock_cls
            provider = ProviderFactory.create(
                "anthropic", model="claude-3-5-sonnet-20241022", api_key="test-key"
            )
            assert provider == mock_instance
        finally:
            ProviderFactory.PROVIDERS["anthropic"] = original

    def test_create_case_insensitive(self):
        mock_cls = MagicMock()
        mock_cls.return_value = MagicMock()

        original = ProviderFactory.PROVIDERS["ollama"]
        try:
            ProviderFactory.PROVIDERS["ollama"] = mock_cls
            ProviderFactory.create("OLLAMA", model="llava")
            mock_cls.assert_called_once()
        finally:
            ProviderFactory.PROVIDERS["ollama"] = original
