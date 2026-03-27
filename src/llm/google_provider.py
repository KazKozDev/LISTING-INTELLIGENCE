"""Google AI provider implementation."""

import logging
from pathlib import Path

from .base import BaseLLMProvider, ProviderResponse

logger = logging.getLogger(__name__)


class GoogleProvider(BaseLLMProvider):
    """Google AI (Gemini) LLM provider."""

    def __init__(
        self,
        model: str = "gemini-1.5-pro",
        api_key: str | None = None,
        base_url: str | None = None,
        **kwargs,
    ):
        """Initialize Google provider.

        Args:
            model: Google model name
            api_key: Google API key
            base_url: Not used for Google
            **kwargs: Additional configuration
        """
        super().__init__(model, api_key, base_url, **kwargs)

        if not self.api_key:
            raise ValueError("Google API key is required")

        try:
            import google.generativeai as genai

            genai.configure(api_key=self.api_key)
            self.genai = genai
            self.client = genai.GenerativeModel(self.model)
        except ImportError:
            raise ImportError(
                "google-generativeai package is required. "
                "Install: pip install google-generativeai"
            )

    def verify_connection(self) -> bool:
        """Verify Google AI connection."""
        try:
            self.client.generate_content("test")
            return True
        except Exception as e:
            logger.error(f"Failed to connect to Google AI: {e}")
            return False

    def list_models(self) -> list:
        """List available Google models."""
        try:
            models = self.genai.list_models()
            return [m.name for m in models if "generateContent" in m.supported_generation_methods]
        except Exception as e:
            logger.error(f"Failed to list models: {e}")
            return [
                "gemini-1.5-pro",
                "gemini-1.5-flash",
                "gemini-1.0-pro-vision",
            ]

    @property
    def supports_vision(self) -> bool:
        """Check if model supports vision."""
        return True  # All Gemini models support vision

    def _load_image(self, image_path: str | Path):
        """Load image for Google AI."""
        from PIL import Image as PILImage

        image_path = Path(image_path)
        if not image_path.exists():
            raise FileNotFoundError(f"Image not found: {image_path}")

        return PILImage.open(image_path)

    def analyze_image(
        self,
        image_path: str | Path,
        prompt: str,
        temperature: float = 0.7,
        max_tokens: int = 2048,
        **kwargs,
    ) -> ProviderResponse:
        """Analyze image with Google AI."""
        # Guard against empty prompt
        if not prompt or not prompt.strip():
            prompt = "Analyze this image and provide detailed insights."

        image = self._load_image(image_path)

        generation_config = {
            "temperature": temperature,
            "max_output_tokens": max_tokens,
        }

        try:
            response = self.client.generate_content(
                [prompt, image], generation_config=generation_config, **kwargs
            )

            # Extract usage information if available
            usage = {
                "prompt_tokens": getattr(response.usage_metadata, "prompt_token_count", 0),
                "completion_tokens": getattr(response.usage_metadata, "candidates_token_count", 0),
                "total_tokens": getattr(response.usage_metadata, "total_token_count", 0),
            }

            return ProviderResponse(
                text=response.text,
                model=self.model,
                usage=usage,
                metadata={
                    "finish_reason": (
                        response.candidates[0].finish_reason.name if response.candidates else None
                    ),
                },
            )

        except Exception as e:
            logger.error(f"Google AI API error: {e}")
            raise

    def chat(
        self, messages: list, temperature: float = 0.7, max_tokens: int = 2048, **kwargs
    ) -> ProviderResponse:
        """Chat with Google AI."""
        # Convert messages to Google AI format
        chat_history = []
        for msg in messages[:-1]:
            role = "user" if msg["role"] == "user" else "model"
            chat_history.append({"role": role, "parts": [msg["content"]]})

        last_message = messages[-1]["content"]

        generation_config = {
            "temperature": temperature,
            "max_output_tokens": max_tokens,
        }

        try:
            chat = self.client.start_chat(history=chat_history)
            response = chat.send_message(
                last_message, generation_config=generation_config, **kwargs
            )

            usage = {
                "prompt_tokens": getattr(response.usage_metadata, "prompt_token_count", 0),
                "completion_tokens": getattr(response.usage_metadata, "candidates_token_count", 0),
                "total_tokens": getattr(response.usage_metadata, "total_token_count", 0),
            }

            return ProviderResponse(
                text=response.text,
                model=self.model,
                usage=usage,
                metadata={
                    "finish_reason": (
                        response.candidates[0].finish_reason.name if response.candidates else None
                    ),
                },
            )

        except Exception as e:
            logger.error(f"Google AI API error: {e}")
            raise
