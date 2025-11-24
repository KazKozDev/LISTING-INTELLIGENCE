"""Provider factory for creating LLM provider instances."""

import logging
from typing import Optional, Dict, Any

from .base import BaseLLMProvider
from .ollama_provider import OllamaProvider
from .openai_provider import OpenAIProvider
from .anthropic_provider import AnthropicProvider
from .google_provider import GoogleProvider
from .azure_provider import AzureOpenAIProvider

logger = logging.getLogger(__name__)


class ProviderFactory:
    """Factory for creating LLM provider instances."""

    PROVIDERS = {
        "ollama": OllamaProvider,
        "openai": OpenAIProvider,
        "anthropic": AnthropicProvider,
        "google": GoogleProvider,
        "azure": AzureOpenAIProvider,
    }

    DEFAULT_MODELS = {
        "ollama": "qwen3-vl:8b",
        "openai": "gpt-4o",
        "anthropic": "claude-3-5-sonnet-20241022",
        "google": "gemini-1.5-pro",
        "azure": "gpt-4o",
    }

    @classmethod
    def create(
        cls,
        provider_name: str,
        model: Optional[str] = None,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        **kwargs
    ) -> BaseLLMProvider:
        """Create a provider instance.

        Args:
            provider_name: Name of the provider (ollama, openai, anthropic, google, azure)
            model: Model name. If None, uses default for provider
            api_key: API key (if required)
            base_url: Base URL (if applicable)
            **kwargs: Additional provider-specific configuration

        Returns:
            Provider instance

        Raises:
            ValueError: If provider is unknown
        """
        provider_name = provider_name.lower()

        if provider_name not in cls.PROVIDERS:
            raise ValueError(
                f"Unknown provider: {provider_name}. "
                f"Available providers: {list(cls.PROVIDERS.keys())}"
            )

        # Use default model if not specified
        if model is None:
            model = cls.DEFAULT_MODELS.get(provider_name)

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
    def get_default_model(cls, provider_name: str) -> Optional[str]:
        """Get default model for a provider.

        Args:
            provider_name: Provider name

        Returns:
            Default model name or None
        """
        return cls.DEFAULT_MODELS.get(provider_name.lower())

    @classmethod
    def get_provider_info(cls) -> Dict[str, Any]:
        """Get information about all providers.

        Returns:
            Dictionary with provider information
        """
        return {
            "ollama": {
                "name": "Ollama",
                "requires_api_key": False,
                "requires_base_url": True,
                "default_model": cls.DEFAULT_MODELS["ollama"],
                "default_base_url": "http://localhost:11434",
                "supports_vision": True,
            },
            "openai": {
                "name": "OpenAI",
                "requires_api_key": True,
                "requires_base_url": False,
                "default_model": cls.DEFAULT_MODELS["openai"],
                "default_base_url": None,
                "supports_vision": True,
            },
            "anthropic": {
                "name": "Anthropic (Claude)",
                "requires_api_key": True,
                "requires_base_url": False,
                "default_model": cls.DEFAULT_MODELS["anthropic"],
                "default_base_url": None,
                "supports_vision": True,
            },
            "google": {
                "name": "Google AI (Gemini)",
                "requires_api_key": True,
                "requires_base_url": False,
                "default_model": cls.DEFAULT_MODELS["google"],
                "default_base_url": None,
                "supports_vision": True,
            },
            "azure": {
                "name": "Azure OpenAI",
                "requires_api_key": True,
                "requires_base_url": True,
                "default_model": cls.DEFAULT_MODELS["azure"],
                "default_base_url": None,
                "supports_vision": True,
                "additional_config": ["api_version"],
            },
        }
