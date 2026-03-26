"""Base provider interface for LLM providers."""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from pathlib import Path
from typing import Any


@dataclass
class ProviderResponse:
    """Standardized response from LLM providers."""

    text: str
    model: str
    usage: dict[str, Any]
    metadata: dict[str, Any]

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary."""
        return {
            "text": self.text,
            "model": self.model,
            "usage": self.usage,
            "metadata": self.metadata,
        }


class BaseLLMProvider(ABC):
    """Abstract base class for LLM providers."""

    def __init__(
        self,
        model: str,
        api_key: str | None = None,
        base_url: str | None = None,
        **kwargs
    ):
        """Initialize provider.

        Args:
            model: Model name/identifier
            api_key: API key for authentication (if required)
            base_url: Base URL for API endpoint (if applicable)
            **kwargs: Additional provider-specific configuration
        """
        self.model = model
        self.api_key = api_key
        self.base_url = base_url
        self.config = kwargs

    @abstractmethod
    def analyze_image(
        self,
        image_path: str | Path,
        prompt: str,
        temperature: float = 0.7,
        max_tokens: int = 2048,
        **kwargs
    ) -> ProviderResponse:
        """Analyze an image with a prompt.

        Args:
            image_path: Path to the image file
            prompt: Text prompt for analysis
            temperature: Sampling temperature
            max_tokens: Maximum tokens to generate
            **kwargs: Additional provider-specific parameters

        Returns:
            ProviderResponse object
        """
        pass

    @abstractmethod
    def chat(
        self,
        messages: list,
        temperature: float = 0.7,
        max_tokens: int = 2048,
        **kwargs
    ) -> ProviderResponse:
        """Chat completion (text only).

        Args:
            messages: List of message dictionaries
            temperature: Sampling temperature
            max_tokens: Maximum tokens to generate
            **kwargs: Additional provider-specific parameters

        Returns:
            ProviderResponse object
        """
        pass

    @abstractmethod
    def verify_connection(self) -> bool:
        """Verify connection to the provider.

        Returns:
            True if connection successful, False otherwise
        """
        pass

    @abstractmethod
    def list_models(self) -> list:
        """List available models.

        Returns:
            List of available model names
        """
        pass

    @property
    @abstractmethod
    def supports_vision(self) -> bool:
        """Check if provider supports vision capabilities.

        Returns:
            True if vision is supported
        """
        pass

    @property
    def provider_name(self) -> str:
        """Get provider name.

        Returns:
            Provider name
        """
        return self.__class__.__name__.replace("Provider", "")
