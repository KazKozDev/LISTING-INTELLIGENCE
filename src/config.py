"""Configuration management for Vision Agent Analyst."""

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv

# Load environment variables
load_dotenv()


@dataclass
class Config:
    """Application configuration."""

    # Ollama settings
    ollama_host: str = os.getenv("OLLAMA_HOST", "http://localhost:11434")
    ollama_model: str = os.getenv("OLLAMA_MODEL", "qwen3-vl:8b")

    # Model parameters
    max_tokens: int = int(os.getenv("MAX_TOKENS", "2048"))
    temperature: float = float(os.getenv("TEMPERATURE", "0.7"))

    # Output settings
    output_dir: Path = Path(os.getenv("OUTPUT_DIR", "outputs"))
    report_format: str = os.getenv("REPORT_FORMAT", "markdown")

    # Processing settings
    max_image_size: tuple = (1920, 1080)
    pdf_dpi: int = 150

    def __post_init__(self):
        """Ensure output directory exists."""
        self.output_dir.mkdir(parents=True, exist_ok=True)


def get_config() -> Config:
    """Get application configuration."""
    return Config()
