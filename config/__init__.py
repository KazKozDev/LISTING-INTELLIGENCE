"""Configuration management for Vision Agent Analyst."""

import os
import yaml
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional, Dict, Any

from dotenv import load_dotenv

# Load environment variables
load_dotenv()

CONFIG_DIR = Path(__file__).parent
MODEL_CONFIG_PATH = CONFIG_DIR / "model_config.yaml"
PROMPTS_CONFIG_PATH = CONFIG_DIR / "prompts.yaml"

def load_yaml_config(path: Path) -> Dict[str, Any]:
    if path.exists():
        with open(path, "r") as f:
            return yaml.safe_load(f)
    return {}

@dataclass
class Config:
    """Application configuration."""

    # LLM Provider settings
    provider: str = os.getenv("LLM_PROVIDER", "ollama")
    model: str = os.getenv("LLM_MODEL", "")
    api_key: Optional[str] = os.getenv("LLM_API_KEY", None)
    base_url: Optional[str] = os.getenv("LLM_BASE_URL", None)

    # Backward compatibility - Ollama settings
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

    # Loaded configs
    model_config: Dict = field(default_factory=dict)
    prompts_config: Dict = field(default_factory=dict)

    def __post_init__(self):
        """Ensure output directory exists and set defaults."""
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        # Load YAML configs
        self.model_config = load_yaml_config(MODEL_CONFIG_PATH)
        self.prompts_config = load_yaml_config(PROMPTS_CONFIG_PATH)

        # Set default model if not specified, using model_config
        if not self.model:
            # Try to get from yaml
            provider_config = self.model_config.get("models", {}).get(self.provider, {})
            self.model = provider_config.get("model_name", "")
            
            # Fallback to hardcoded defaults if yaml fails
            if not self.model:
                default_models = {
                    "ollama": self.ollama_model,
                    "openai": "gpt-4o",
                    "anthropic": "claude-3-5-sonnet-20241022",
                    "google": "gemini-1.5-pro",
                    "azure": "gpt-4o",
                }
                self.model = default_models.get(self.provider, self.ollama_model)

        # Set default base URL for Ollama if not specified
        if self.provider == "ollama" and not self.base_url:
            self.base_url = self.ollama_host

    def get_provider_config(self) -> dict:
        """Get configuration for LLM provider.

        Returns:
            Dictionary with provider configuration (excluding model, api_key, base_url)
        """
        config = {
            "max_image_size": self.max_image_size,
        }

        # Add Azure-specific config
        if self.provider == "azure":
            config["api_version"] = os.getenv("AZURE_API_VERSION", "2024-02-01")

        return config


def get_config() -> Config:
    """Get application configuration."""
    return Config()
