"""OpenAI provider implementation."""

import base64
import logging
from pathlib import Path
from typing import Union, Optional

from .base import BaseLLMProvider, ProviderResponse

logger = logging.getLogger(__name__)


class OpenAIProvider(BaseLLMProvider):
    """OpenAI LLM provider."""

    def __init__(
        self,
        model: str = "gpt-4o",
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        **kwargs
    ):
        """Initialize OpenAI provider.

        Args:
            model: OpenAI model name
            api_key: OpenAI API key
            base_url: Optional custom base URL
            **kwargs: Additional configuration
        """
        super().__init__(model, api_key, base_url, **kwargs)

        if not self.api_key:
            raise ValueError("OpenAI API key is required")

        try:
            import openai
            self.client = openai.OpenAI(
                api_key=self.api_key,
                base_url=self.base_url
            )
        except ImportError:
            raise ImportError("openai package is required. Install: pip install openai")

    def verify_connection(self) -> bool:
        """Verify OpenAI connection."""
        try:
            self.client.models.list()
            return True
        except Exception as e:
            logger.error(f"Failed to connect to OpenAI: {e}")
            return False

    def list_models(self) -> list:
        """List available OpenAI models."""
        try:
            models = self.client.models.list()
            return [m.id for m in models.data]
        except Exception as e:
            logger.error(f"Failed to list models: {e}")
            return []

    @property
    def supports_vision(self) -> bool:
        """Check if model supports vision."""
        vision_models = ["gpt-4o", "gpt-4-turbo", "gpt-4-vision"]
        return any(vm in self.model.lower() for vm in vision_models)

    def _encode_image(self, image_path: Union[str, Path]) -> str:
        """Encode image to base64."""
        image_path = Path(image_path)
        if not image_path.exists():
            raise FileNotFoundError(f"Image not found: {image_path}")

        with open(image_path, "rb") as f:
            return base64.b64encode(f.read()).decode("utf-8")

    def analyze_image(
        self,
        image_path: Union[str, Path],
        prompt: str,
        temperature: float = 0.7,
        max_tokens: int = 2048,
        **kwargs
    ) -> ProviderResponse:
        """Analyze image with OpenAI."""
        if not self.supports_vision:
            raise ValueError(f"Model {self.model} does not support vision")

        image_data = self._encode_image(image_path)
        image_suffix = Path(image_path).suffix.lower().replace(".", "")

        messages = [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/{image_suffix};base64,{image_data}"
                        }
                    }
                ]
            }
        ]

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
                **kwargs
            )

            return ProviderResponse(
                text=response.choices[0].message.content,
                model=response.model,
                usage={
                    "prompt_tokens": response.usage.prompt_tokens,
                    "completion_tokens": response.usage.completion_tokens,
                    "total_tokens": response.usage.total_tokens,
                },
                metadata={
                    "finish_reason": response.choices[0].finish_reason,
                }
            )

        except Exception as e:
            logger.error(f"OpenAI API error: {e}")
            raise

    def chat(
        self,
        messages: list,
        temperature: float = 0.7,
        max_tokens: int = 2048,
        **kwargs
    ) -> ProviderResponse:
        """Chat with OpenAI."""
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
                **kwargs
            )

            return ProviderResponse(
                text=response.choices[0].message.content,
                model=response.model,
                usage={
                    "prompt_tokens": response.usage.prompt_tokens,
                    "completion_tokens": response.usage.completion_tokens,
                    "total_tokens": response.usage.total_tokens,
                },
                metadata={
                    "finish_reason": response.choices[0].finish_reason,
                }
            )

        except Exception as e:
            logger.error(f"OpenAI API error: {e}")
            raise
