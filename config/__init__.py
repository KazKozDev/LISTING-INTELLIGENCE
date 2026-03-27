"""Configuration management for Listing Intelligence."""

import os
import sys
from pathlib import Path
from typing import Any

import yaml
from dotenv import load_dotenv
from pydantic import Field, model_validator
from pydantic_settings import BaseSettings

# Enable safe PyTorch fallback for unsupported Metal ops on Apple Silicon.
if sys.platform == "darwin":
    os.environ.setdefault("PYTORCH_ENABLE_MPS_FALLBACK", "1")

# Load environment variables
load_dotenv()

CONFIG_DIR = Path(__file__).parent
MODEL_CONFIG_PATH = CONFIG_DIR / "model_config.yaml"
PROMPTS_CONFIG_PATH = CONFIG_DIR / "prompts.yaml"
COMPOSITION_POLICIES_PATH = CONFIG_DIR / "composition_policies.yaml"


def load_yaml_config(path: Path) -> dict[str, Any]:
    if path.exists():
        with open(path) as f:
            return yaml.safe_load(f) or {}
    return {}


class Config(BaseSettings):
    """Application configuration with Pydantic validation."""

    # LLM Provider settings
    provider: str = Field(default="ollama", alias="LLM_PROVIDER")
    model: str = Field(default="", alias="LLM_MODEL")
    api_key: str | None = Field(default=None, alias="LLM_API_KEY")
    base_url: str | None = Field(default=None, alias="LLM_BASE_URL")

    # Backward compatibility - Ollama settings
    ollama_host: str = Field(
        default="http://localhost:11434",
        alias="OLLAMA_HOST",
    )
    ollama_model: str = Field(default="qwen3-vl:8b", alias="OLLAMA_MODEL")

    # Model parameters
    max_tokens: int = Field(default=2048, alias="MAX_TOKENS")
    temperature: float = Field(default=0.7, alias="TEMPERATURE")

    # Output settings
    output_dir: Path = Field(default=Path("outputs"), alias="OUTPUT_DIR")
    report_format: str = Field(default="markdown", alias="REPORT_FORMAT")

    # Processing settings
    max_image_size: tuple[int, int] = (1920, 1080)
    pdf_dpi: int = 150

    # Loaded configs (not from env)
    model_config_data: dict[str, Any] = Field(
        default_factory=dict,
        exclude=True,
    )
    prompts_config: dict[str, Any] = Field(default_factory=dict, exclude=True)
    composition_policies_config: dict[str, Any] = Field(
        default_factory=dict,
        exclude=True,
    )

    model_config = {
        "populate_by_name": True,
        "env_prefix": "",
        "extra": "ignore",
    }

    @model_validator(mode="after")
    def _post_init(self) -> "Config":
        """Ensure output directory exists and set defaults."""
        self.output_dir.mkdir(parents=True, exist_ok=True)

        # Load YAML configs
        self.model_config_data = load_yaml_config(MODEL_CONFIG_PATH)
        self.prompts_config = load_yaml_config(PROMPTS_CONFIG_PATH)
        self.composition_policies_config = load_yaml_config(COMPOSITION_POLICIES_PATH)

        # Set default model if not specified, using model_config
        if not self.model:
            provider_cfg = self.model_config_data.get("models", {}).get(
                self.provider,
                {},
            )
            self.model = provider_cfg.get("model_name", "")

            if not self.model:
                default_models = {
                    "ollama": self.ollama_model,
                    "openai": "gpt-4o",
                    "grok": "grok-2-vision-latest",
                    "groq": "llama-3.3-70b-versatile",
                    "anthropic": "claude-3-5-sonnet-20241022",
                    "google": "gemini-1.5-pro",
                    "azure": "gpt-4o",
                }
                self.model = default_models.get(
                    self.provider,
                    self.ollama_model,
                )

        # Set default base URL for Ollama if not specified
        if self.provider == "ollama" and not self.base_url:
            self.base_url = self.ollama_host

        return self

    def get_provider_config(self) -> dict:
        """Get configuration for LLM provider."""
        config = {
            "max_image_size": self.max_image_size,
        }

        if self.provider == "azure":
            config["api_version"] = os.getenv(
                "AZURE_API_VERSION",
                "2024-02-01",
            )

        return config


def get_config() -> Config:
    """Get application configuration."""
    return Config()
