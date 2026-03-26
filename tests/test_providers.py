"""Tests for LLM providers and factory."""

from unittest.mock import MagicMock

import pytest

from src.llm.base import ProviderResponse
from src.llm.factory import ProviderFactory
from src.llm.openai_provider import GrokProvider, OpenAIProvider


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
        assert "grok" in providers
        assert "groq" in providers
        assert "anthropic" in providers
        assert "google" in providers
        assert "azure" in providers
        assert len(providers) == 7

    def test_get_provider_info(self):
        info = ProviderFactory.get_provider_info()
        assert "ollama" in info
        assert "grok" in info
        assert "groq" in info
        assert info["ollama"]["requires_api_key"] is False
        assert info["openai"]["requires_api_key"] is True

    def test_create_grok(self):
        mock_cls = MagicMock()
        mock_instance = MagicMock()
        mock_cls.return_value = mock_instance

        original = ProviderFactory.PROVIDERS["grok"]
        try:
            ProviderFactory.PROVIDERS["grok"] = mock_cls
            provider = ProviderFactory.create(
                "grok", model="grok-2-vision-latest", api_key="test-key"
            )
            assert provider == mock_instance
            mock_cls.assert_called_once_with(
                model="grok-2-vision-latest",
                api_key="test-key",
                base_url=None,
            )
        finally:
            ProviderFactory.PROVIDERS["grok"] = original

    def test_create_groq(self):
        mock_cls = MagicMock()
        mock_instance = MagicMock()
        mock_cls.return_value = mock_instance

        original = ProviderFactory.PROVIDERS["groq"]
        try:
            ProviderFactory.PROVIDERS["groq"] = mock_cls
            provider = ProviderFactory.create(
                "groq", model="llama-3.3-70b-versatile", api_key="test-key"
            )
            assert provider == mock_instance
            mock_cls.assert_called_once_with(
                model="llama-3.3-70b-versatile",
                api_key="test-key",
                base_url=None,
            )
        finally:
            ProviderFactory.PROVIDERS["groq"] = original

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


class FakeModelPage:
    def __init__(self, ids, next_page=None):
        self.data = [type("Model", (), {"id": model_id})() for model_id in ids]
        self._next_page = next_page

    def has_next_page(self):
        return self._next_page is not None

    def get_next_page(self):
        return self._next_page


class TestModelListing:
    def test_openai_list_models_collects_all_pages(self):
        provider = OpenAIProvider.__new__(OpenAIProvider)
        provider.client = MagicMock()
        provider.client.models.list.return_value = FakeModelPage(
            ["model-a", "model-b"],
            next_page=FakeModelPage(["model-c", "model-d"]),
        )

        models = provider.list_models()

        assert models == ["model-a", "model-b", "model-c", "model-d"]

    def test_grok_4_fast_non_reasoning_supports_vision(self):
        provider = GrokProvider.__new__(GrokProvider)
        provider.model = "grok-4-1-fast-non-reasoning"

        assert provider.supports_vision is True

    def test_openai_gpt_4_1_mini_supports_vision(self):
        provider = OpenAIProvider.__new__(OpenAIProvider)
        provider.model = "gpt-4.1-mini"

        assert provider.supports_vision is True

    def test_openai_gpt_5_4_supports_vision(self):
        provider = OpenAIProvider.__new__(OpenAIProvider)
        provider.model = "gpt-5.4"

        assert provider.supports_vision is True

    def test_openai_o4_mini_supports_vision(self):
        provider = OpenAIProvider.__new__(OpenAIProvider)
        provider.model = "o4-mini"

        assert provider.supports_vision is True

    def test_groq_llama_4_scout_supports_vision(self):
        groq_provider_class = ProviderFactory.PROVIDERS["groq"]
        provider = groq_provider_class.__new__(groq_provider_class)
        provider.model = "meta-llama/llama-4-scout-17b-16e-instruct"

        assert provider.supports_vision is True

    def test_groq_llama_3_3_70b_is_not_vision(self):
        groq_provider_class = ProviderFactory.PROVIDERS["groq"]
        provider = groq_provider_class.__new__(groq_provider_class)
        provider.model = "llama-3.3-70b-versatile"

        assert provider.supports_vision is False

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
                "anthropic",
                model="claude-3-5-sonnet-20241022",
                api_key="test-key",
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
