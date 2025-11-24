"""Ollama provider implementation."""

import base64
import logging
from pathlib import Path
from typing import Union, Optional

import requests
from PIL import Image

from .base import BaseLLMProvider, ProviderResponse

logger = logging.getLogger(__name__)


class OllamaProvider(BaseLLMProvider):
    """Ollama LLM provider."""

    def __init__(
        self,
        model: str = "qwen3-vl:8b",
        api_key: Optional[str] = None,
        base_url: str = "http://localhost:11434",
        **kwargs
    ):
        """Initialize Ollama provider.

        Args:
            model: Ollama model name
            api_key: Not used for Ollama
            base_url: Ollama server URL
            **kwargs: Additional configuration
        """
        super().__init__(model, api_key, base_url, **kwargs)
        self.api_url = f"{self.base_url}/api/generate"
        self.max_image_size = kwargs.get("max_image_size", (1920, 1080))

    def verify_connection(self) -> bool:
        """Verify connection to Ollama server."""
        try:
            response = requests.get(f"{self.base_url}/api/tags", timeout=5)
            response.raise_for_status()
            return True
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to connect to Ollama: {e}")
            return False

    def list_models(self) -> list:
        """List available Ollama models."""
        try:
            response = requests.get(f"{self.base_url}/api/tags", timeout=5)
            response.raise_for_status()
            models = response.json().get("models", [])
            return [m.get("name", "") for m in models]
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to list models: {e}")
            return []

    @property
    def supports_vision(self) -> bool:
        """Check if model supports vision."""
        vision_models = ["llava", "bakllava", "qwen-vl", "qwen2-vl", "qwen3-vl"]
        return any(vm in self.model.lower() for vm in vision_models)

    def _encode_image(self, image_path: Union[str, Path]) -> str:
        """Encode image to base64."""
        image_path = Path(image_path)

        if not image_path.exists():
            raise FileNotFoundError(f"Image not found: {image_path}")

        # Resize if needed
        with Image.open(image_path) as img:
            if img.size[0] > self.max_image_size[0] or \
               img.size[1] > self.max_image_size[1]:
                img.thumbnail(self.max_image_size, Image.Resampling.LANCZOS)
                temp_path = image_path.parent / f"temp_{image_path.name}"
                img.save(temp_path)
                image_path = temp_path

        # Encode to base64
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
        """Analyze image with Ollama."""
        if not self.supports_vision:
            raise ValueError(f"Model {self.model} does not support vision")

        image_data = self._encode_image(image_path)

        payload = {
            "model": self.model,
            "prompt": prompt,
            "images": [image_data],
            "stream": False,
            "options": {
                "temperature": temperature,
                "num_predict": max_tokens,
            }
        }

        try:
            response = requests.post(self.api_url, json=payload, timeout=120)
            response.raise_for_status()
            result = response.json()

            return ProviderResponse(
                text=result.get("response", ""),
                model=result.get("model", self.model),
                usage={
                    "prompt_tokens": result.get("prompt_eval_count", 0),
                    "completion_tokens": result.get("eval_count", 0),
                    "total_tokens": result.get("prompt_eval_count", 0) + result.get("eval_count", 0),
                },
                metadata={
                    "total_duration": result.get("total_duration", 0) / 1_000_000,
                    "load_duration": result.get("load_duration", 0) / 1_000_000,
                }
            )

        except requests.exceptions.RequestException as e:
            logger.error(f"Ollama API error: {e}")
            raise

    def chat(
        self,
        messages: list,
        temperature: float = 0.7,
        max_tokens: int = 2048,
        **kwargs
    ) -> ProviderResponse:
        """Chat with Ollama."""
        prompt = "\n".join([f"{m['role']}: {m['content']}" for m in messages])

        payload = {
            "model": self.model,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": temperature,
                "num_predict": max_tokens,
            }
        }

        try:
            response = requests.post(self.api_url, json=payload, timeout=120)
            response.raise_for_status()
            result = response.json()

            return ProviderResponse(
                text=result.get("response", ""),
                model=result.get("model", self.model),
                usage={
                    "prompt_tokens": result.get("prompt_eval_count", 0),
                    "completion_tokens": result.get("eval_count", 0),
                    "total_tokens": result.get("prompt_eval_count", 0) + result.get("eval_count", 0),
                },
                metadata={
                    "total_duration": result.get("total_duration", 0) / 1_000_000,
                }
            )

        except requests.exceptions.RequestException as e:
            logger.error(f"Ollama API error: {e}")
            raise
