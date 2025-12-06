"""Ollama API client for vision language model."""

import base64
import logging
from pathlib import Path
from typing import Union, Optional, Dict, Any

import requests
from PIL import Image

from config import Config

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class OllamaClient:
    """Client for interacting with Ollama API."""

    def __init__(self, config: Optional[Config] = None):
        """Initialize Ollama client.

        Args:
            config: Configuration object. If None, uses default config.
        """
        self.config = config or Config()
        self.base_url = self.config.ollama_host
        self.model = self.config.ollama_model
        self.api_url = f"{self.base_url}/api/generate"

        logger.info(f"Initialized OllamaClient with model: {self.model}")
        self._verify_connection()

    def _verify_connection(self) -> bool:
        """Verify connection to Ollama server.

        Returns:
            True if connection successful, raises exception otherwise.
        """
        try:
            response = requests.get(f"{self.base_url}/api/tags", timeout=5)
            response.raise_for_status()

            models = response.json().get("models", [])
            model_names = [m.get("name", "") for m in models]

            if not any(self.model in name for name in model_names):
                logger.warning(
                    f"Model {self.model} not found. Available models: {model_names}"
                )
                logger.warning("Run: ollama pull qwen3-vl:8b")

            logger.info("Successfully connected to Ollama")
            return True

        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to connect to Ollama: {e}")
            raise ConnectionError(
                f"Cannot connect to Ollama at {self.base_url}. "
                "Make sure Ollama is running: 'ollama serve'"
            )

    def _encode_image(self, image_path: Union[str, Path]) -> str:
        """Encode image to base64.

        Args:
            image_path: Path to image file.

        Returns:
            Base64 encoded image string.
        """
        image_path = Path(image_path)

        if not image_path.exists():
            raise FileNotFoundError(f"Image not found: {image_path}")

        # Resize if needed
        with Image.open(image_path) as img:
            if img.size[0] > self.config.max_image_size[0] or \
               img.size[1] > self.config.max_image_size[1]:
                img.thumbnail(self.config.max_image_size, Image.Resampling.LANCZOS)

                # Save resized image temporarily
                temp_path = image_path.parent / f"temp_{image_path.name}"
                img.save(temp_path)
                image_path = temp_path

        # Encode to base64
        with open(image_path, "rb") as f:
            image_data = base64.b64encode(f.read()).decode("utf-8")

        return image_data

    def generate(
        self,
        prompt: str,
        image_path: Optional[Union[str, Path]] = None,
        stream: bool = False,
        **kwargs
    ) -> Dict[str, Any]:
        """Generate response from Ollama model.

        Args:
            prompt: Text prompt for the model.
            image_path: Optional path to image for vision tasks.
            stream: Whether to stream the response.
            **kwargs: Additional parameters for the model.

        Returns:
            Dictionary containing the response.
        """
        payload = {
            "model": self.model,
            "prompt": prompt,
            "stream": stream,
            "options": {
                "temperature": kwargs.get("temperature", self.config.temperature),
                "num_predict": kwargs.get("max_tokens", self.config.max_tokens),
            }
        }

        # Add image if provided
        if image_path:
            try:
                image_data = self._encode_image(image_path)
                payload["images"] = [image_data]
                logger.info(f"Analyzing image: {image_path}")
            except Exception as e:
                logger.error(f"Error encoding image: {e}")
                raise

        try:
            response = requests.post(
                self.api_url,
                json=payload,
                timeout=120
            )
            response.raise_for_status()

            if stream:
                return response

            result = response.json()

            return {
                "text": result.get("response", ""),
                "model": result.get("model", self.model),
                "done": result.get("done", False),
                "context": result.get("context", []),
                "total_duration": result.get("total_duration", 0),
                "load_duration": result.get("load_duration", 0),
                "prompt_eval_count": result.get("prompt_eval_count", 0),
                "eval_count": result.get("eval_count", 0),
            }

        except requests.exceptions.RequestException as e:
            logger.error(f"Error calling Ollama API: {e}")
            raise

    def analyze_image(
        self,
        image_path: Union[str, Path],
        task: str = "Describe this image in detail.",
        **kwargs
    ) -> Dict[str, Any]:
        """Analyze an image with a specific task.

        Args:
            image_path: Path to the image.
            task: Analysis task/question.
            **kwargs: Additional parameters.

        Returns:
            Analysis result dictionary.
        """
        return self.generate(prompt=task, image_path=image_path, **kwargs)

    def chat(self, messages: list, **kwargs) -> Dict[str, Any]:
        """Chat with the model (text only).

        Args:
            messages: List of message dictionaries.
            **kwargs: Additional parameters.

        Returns:
            Response dictionary.
        """
        # Convert messages to single prompt
        prompt = "\n".join([f"{m['role']}: {m['content']}" for m in messages])
        return self.generate(prompt=prompt, **kwargs)
