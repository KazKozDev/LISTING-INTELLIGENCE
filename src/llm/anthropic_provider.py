"""Anthropic provider implementation."""

import base64
import logging
from pathlib import Path

from .base import BaseLLMProvider, ProviderResponse
from .openai_provider import _collect_paginated_model_ids

logger = logging.getLogger(__name__)


class AnthropicProvider(BaseLLMProvider):
    """Anthropic (Claude) LLM provider."""

    def __init__(
        self,
        model: str = "claude-3-5-sonnet-20241022",
        api_key: str | None = None,
        base_url: str | None = None,
        **kwargs
    ):
        """Initialize Anthropic provider.

        Args:
            model: Anthropic model name
            api_key: Anthropic API key
            base_url: Optional custom base URL
            **kwargs: Additional configuration
        """
        super().__init__(model, api_key, base_url, **kwargs)

        if not self.api_key:
            raise ValueError("Anthropic API key is required")

        try:
            import anthropic
            self.client = anthropic.Anthropic(api_key=self.api_key)
        except ImportError:
            raise ImportError(
                "anthropic package is required. Install: pip install anthropic"
            )

    def verify_connection(self) -> bool:
        """Verify Anthropic connection."""
        try:
            self.client.messages.create(
                model=self.model,
                max_tokens=1,
                messages=[{"role": "user", "content": "test"}]
            )
            return True
        except Exception as e:
            logger.error(f"Failed to connect to Anthropic: {e}")
            return False

    def list_models(self) -> list:
        """List available Anthropic models dynamically via API."""
        try:
            response = self.client.models.list()
            return _collect_paginated_model_ids(response)
        except Exception as e:
            logger.warning(f"Failed to list Anthropic models via API: {e}")
            # Fallback to known models if API call fails
            return [
                "claude-sonnet-4-20250514",
                "claude-haiku-4-20250414",
                "claude-3-5-sonnet-20241022",
                "claude-3-5-haiku-20241022",
                "claude-3-opus-20240229",
            ]

    @property
    def supports_vision(self) -> bool:
        """Check if model supports vision.

        All Claude 3+ models support vision.
        """
        return True

    def _encode_image(self, image_path: str | Path) -> dict:
        """Encode image for Anthropic."""
        image_path = Path(image_path)
        if not image_path.exists():
            raise FileNotFoundError(f"Image not found: {image_path}")

        with open(image_path, "rb") as f:
            image_data = base64.standard_b64encode(f.read()).decode("utf-8")

        # Determine media type
        suffix = image_path.suffix.lower()
        media_type_map = {
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".png": "image/png",
            ".gif": "image/gif",
            ".webp": "image/webp",
        }
        media_type = media_type_map.get(suffix, "image/jpeg")

        return {
            "type": "image",
            "source": {
                "type": "base64",
                "media_type": media_type,
                "data": image_data,
            }
        }

    def analyze_image(
        self,
        image_path: str | Path,
        prompt: str,
        temperature: float = 0.7,
        max_tokens: int = 2048,
        **kwargs
    ) -> ProviderResponse:
        """Analyze image with Anthropic."""
        if not self.supports_vision:
            raise ValueError(f"Model {self.model} does not support vision")

        # Guard against empty prompt — Anthropic API rejects empty text blocks
        if not prompt or not prompt.strip():
            prompt = "Analyze this image and provide detailed insights."

        image_content = self._encode_image(image_path)

        messages = [
            {
                "role": "user",
                "content": [
                    image_content,
                    {"type": "text", "text": prompt},
                ]
            }
        ]

        try:
            response = self.client.messages.create(
                model=self.model,
                max_tokens=max_tokens,
                temperature=temperature,
                messages=messages,
                **kwargs
            )

            return ProviderResponse(
                text=response.content[0].text,
                model=response.model,
                usage={
                    "prompt_tokens": response.usage.input_tokens,
                    "completion_tokens": response.usage.output_tokens,
                    "total_tokens": (
                        response.usage.input_tokens
                        + response.usage.output_tokens
                    ),
                },
                metadata={
                    "stop_reason": response.stop_reason,
                }
            )

        except Exception as e:
            logger.error(f"Anthropic API error: {e}")
            raise

    def chat(
        self,
        messages: list,
        temperature: float = 0.7,
        max_tokens: int = 2048,
        **kwargs
    ) -> ProviderResponse:
        """Chat with Anthropic."""
        try:
            response = self.client.messages.create(
                model=self.model,
                max_tokens=max_tokens,
                temperature=temperature,
                messages=messages,
                **kwargs
            )

            return ProviderResponse(
                text=response.content[0].text,
                model=response.model,
                usage={
                    "prompt_tokens": response.usage.input_tokens,
                    "completion_tokens": response.usage.output_tokens,
                    "total_tokens": (
                        response.usage.input_tokens
                        + response.usage.output_tokens
                    ),
                },
                metadata={
                    "stop_reason": response.stop_reason,
                }
            )

        except Exception as e:
            logger.error(f"Anthropic API error: {e}")
            raise
