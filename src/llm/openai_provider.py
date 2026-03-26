"""OpenAI provider implementation."""

import base64
import logging
import os
from pathlib import Path

from .base import BaseLLMProvider, ProviderResponse

logger = logging.getLogger(__name__)

GROQ_BASE_URL = "https://api.groq.com/openai/v1"
GROK_BASE_URL = "https://api.x.ai/v1"

OPENAI_VISION_PREFIXES = (
    "gpt-5",
    "gpt-4.1",
    "gpt-4o",
    "gpt-image-1",
    "o1",
    "o3",
    "o4-mini",
    "computer-use-preview",
)

OPENAI_VISION_SUBSTRINGS = (
    "gpt-4-turbo",
    "gpt-4-vision",
)

GROQ_VISION_PREFIXES = (
    "meta-llama/llama-4-scout",
)


def _collect_paginated_model_ids(initial_page: object) -> list[str]:
    """Collect model ids from a paginated SDK response."""
    page = initial_page
    model_ids: list[str] = []
    seen: set[str] = set()

    while True:
        for model in getattr(page, "data", []) or []:
            model_id = getattr(model, "id", None)
            if model_id and model_id not in seen:
                seen.add(model_id)
                model_ids.append(model_id)

        has_next_page = getattr(page, "has_next_page", None)
        get_next_page = getattr(page, "get_next_page", None)

        if (
            callable(has_next_page)
            and has_next_page()
            and callable(get_next_page)
        ):
            page = get_next_page()
            continue

        break

    return model_ids


class OpenAIProvider(BaseLLMProvider):
    """OpenAI LLM provider."""

    def __init__(
        self,
        model: str = "gpt-4o",
        api_key: str | None = None,
        base_url: str | None = None,
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
            raise ImportError(
                "openai package is required. Install: pip install openai"
            )

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
            return _collect_paginated_model_ids(models)
        except Exception as e:
            logger.error(f"Failed to list models: {e}")
            raise

    def chat(
        self,
        messages: list,
        temperature: float = 0.7,
        max_tokens: int = 2048,
        **kwargs
    ) -> ProviderResponse:
        """Run a chat completion via an OpenAI-compatible API."""
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

    @property
    def supports_vision(self) -> bool:
        """Check if model supports vision."""
        model_name = self.model.lower()

        if model_name.startswith(OPENAI_VISION_PREFIXES):
            return True

        return any(token in model_name for token in OPENAI_VISION_SUBSTRINGS)

    def _encode_image(self, image_path: str | Path) -> str:
        """Encode image to base64."""
        image_path = Path(image_path)
        if not image_path.exists():
            raise FileNotFoundError(f"Image not found: {image_path}")

        with open(image_path, "rb") as f:
            return base64.b64encode(f.read()).decode("utf-8")

    def analyze_image(
        self,
        image_path: str | Path,
        prompt: str,
        temperature: float = 0.7,
        max_tokens: int = 2048,
        **kwargs
    ) -> ProviderResponse:
        """Analyze image with OpenAI."""
        if not self.supports_vision:
            raise ValueError(f"Model {self.model} does not support vision")

        # Guard against empty prompt
        if not prompt or not prompt.strip():
            prompt = "Analyze this image and provide detailed insights."

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
                            "url": (
                                f"data:image/{image_suffix};base64,"
                                f"{image_data}"
                            )
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


class GroqProvider(OpenAIProvider):
    """Groq provider via the OpenAI-compatible API."""

    def __init__(
        self,
        model: str = "llama-3.3-70b-versatile",
        api_key: str | None = None,
        base_url: str | None = None,
        **kwargs
    ):
        resolved_api_key = api_key or os.getenv("GROQ_API_KEY")
        resolved_base_url = (
            base_url
            or os.getenv("GROQ_BASE_URL")
            or GROQ_BASE_URL
        )
        super().__init__(
            model=model,
            api_key=resolved_api_key,
            base_url=resolved_base_url,
            **kwargs,
        )

    @property
    def supports_vision(self) -> bool:
        """Check if the selected Groq model supports image input."""
        model_name = self.model.lower()
        return model_name.startswith(GROQ_VISION_PREFIXES)


class GrokProvider(OpenAIProvider):
    """xAI Grok provider via the OpenAI-compatible API."""

    def __init__(
        self,
        model: str = "grok-2-vision-latest",
        api_key: str | None = None,
        base_url: str | None = None,
        **kwargs
    ):
        resolved_api_key = api_key or os.getenv("XAI_API_KEY")
        resolved_base_url = (
            base_url
            or os.getenv("GROK_BASE_URL")
            or GROK_BASE_URL
        )
        super().__init__(
            model=model,
            api_key=resolved_api_key,
            base_url=resolved_base_url,
            **kwargs,
        )

    @property
    def supports_vision(self) -> bool:
        """Check if the selected Grok model supports image input."""
        model_name = self.model.lower()
        return model_name.startswith("grok-") or "vision" in model_name
