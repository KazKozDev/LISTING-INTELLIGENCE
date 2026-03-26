"""Provider factory for creating LLM provider instances."""

import logging
from typing import Any

from .anthropic_provider import AnthropicProvider
from .azure_provider import AzureOpenAIProvider
from .base import BaseLLMProvider
from .google_provider import GoogleProvider
from .ollama_provider import OllamaProvider
from .openai_provider import (
    GROK_BASE_URL,
    GROQ_BASE_URL,
    GrokProvider,
    GroqProvider,
    OpenAIProvider,
)

logger = logging.getLogger(__name__)


class ProviderFactory:
    """Factory for creating LLM provider instances."""

    PROVIDERS = {
        "ollama": OllamaProvider,
        "openai": OpenAIProvider,
        "grok": GrokProvider,
        "groq": GroqProvider,
        "anthropic": AnthropicProvider,
        "google": GoogleProvider,
        "azure": AzureOpenAIProvider,
    }

    @classmethod
    def create(
        cls,
        provider_name: str,
        model: str,
        api_key: str | None = None,
        base_url: str | None = None,
        **kwargs
    ) -> BaseLLMProvider:
        """Create a provider instance.

        Args:
            provider_name: Name of the provider.
            model: Model name (required)
            api_key: API key (if required)
            base_url: Base URL (if applicable)
            **kwargs: Additional provider-specific configuration

        Returns:
            Provider instance

        Raises:
            ValueError: If provider is unknown or model is not specified
        """
        provider_name = provider_name.lower()

        if provider_name not in cls.PROVIDERS:
            raise ValueError(
                f"Unknown provider: {provider_name}. "
                f"Available providers: {list(cls.PROVIDERS.keys())}"
            )

        if not model:
            raise ValueError(
                "Model name is required. Please set LLM_MODEL in .env file"
            )

        provider_class = cls.PROVIDERS[provider_name]

        logger.info(f"Creating {provider_name} provider with model: {model}")

        try:
            provider = provider_class(
                model=model,
                api_key=api_key,
                base_url=base_url,
                **kwargs
            )
            return provider
        except Exception as e:
            logger.error(f"Failed to create provider {provider_name}: {e}")
            raise

    @classmethod
    def list_providers(cls) -> list:
        """List available provider names.

        Returns:
            List of provider names
        """
        return list(cls.PROVIDERS.keys())

    @classmethod
    def get_provider_info(cls) -> dict[str, Any]:
        """Get information about all providers.

        Returns:
            Dictionary with provider information
        """
        return {
            "ollama": {
                "name": "Ollama",
                "requires_api_key": False,
                "requires_base_url": True,
                "default_base_url": "http://localhost:11434",
                "supports_vision": True,
            },
            "openai": {
                "name": "OpenAI",
                "requires_api_key": True,
                "requires_base_url": False,
                "default_base_url": "https://api.openai.com/v1",
                "supports_vision": True,
            },
            "grok": {
                "name": "xAI Grok",
                "requires_api_key": True,
                "requires_base_url": False,
                "default_base_url": GROK_BASE_URL,
                "supports_vision": True,
            },
            "groq": {
                "name": "Groq",
                "requires_api_key": True,
                "requires_base_url": False,
                "default_base_url": GROQ_BASE_URL,
                "supports_vision": True,
            },
            "anthropic": {
                "name": "Anthropic (Claude)",
                "requires_api_key": True,
                "requires_base_url": False,
                "default_base_url": "https://api.anthropic.com",
                "supports_vision": True,
            },
            "google": {
                "name": "Google AI (Gemini)",
                "requires_api_key": True,
                "requires_base_url": False,
                "default_base_url": (
                    "https://generativelanguage.googleapis.com"
                ),
                "supports_vision": True,
            },
            "azure": {
                "name": "Azure OpenAI",
                "requires_api_key": True,
                "requires_base_url": True,
                "default_base_url": "https://your-resource.openai.azure.com",
                "supports_vision": True,
                "additional_config": ["api_version"],
            },
        }
