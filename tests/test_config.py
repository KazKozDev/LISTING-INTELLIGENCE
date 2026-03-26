"""Tests for Config."""

from config import Config, load_yaml_config


class TestLoadYamlConfig:
    def test_load_existing(self, tmp_path):
        yaml_file = tmp_path / "test.yaml"
        yaml_file.write_text("key: value\nnested:\n  a: 1")

        result = load_yaml_config(yaml_file)
        assert result["key"] == "value"
        assert result["nested"]["a"] == 1

    def test_load_nonexistent(self, tmp_path):
        result = load_yaml_config(tmp_path / "missing.yaml")
        assert result == {}


class TestConfig:
    def test_default_creation(self):
        config = Config()
        assert config.provider in [
            "ollama",
            "openai",
            "grok",
            "groq",
            "anthropic",
            "google",
            "azure",
        ]
        assert config.max_tokens > 0
        assert 0 <= config.temperature <= 2

    def test_custom_values(self, tmp_path):
        config = Config(
            provider="openai",
            model="gpt-4o",
            api_key="test-key",
            max_tokens=4096,
            temperature=0.5,
            output_dir=tmp_path / "out",
        )
        assert config.provider == "openai"
        assert config.model == "gpt-4o"
        assert config.max_tokens == 4096
        assert (tmp_path / "out").exists()

    def test_output_dir_created(self, tmp_path):
        out = tmp_path / "new_output"
        Config(output_dir=out)
        assert out.exists()

    def test_get_provider_config(self):
        config = Config()
        pc = config.get_provider_config()
        assert "max_image_size" in pc

    def test_azure_provider_config(self):
        config = Config(provider="azure")
        pc = config.get_provider_config()
        assert "api_version" in pc

    def test_default_model_fallback(self):
        config = Config(provider="openai", model="")
        # Should have a default model set by __post_init__
        assert config.model != ""

    def test_ollama_default_base_url(self):
        config = Config(provider="ollama", base_url=None)
        assert config.base_url is not None
        assert "11434" in config.base_url

    def test_prompts_config_loaded(self):
        config = Config()
        # May be empty in isolated test environments, but must stay a dict.
        assert isinstance(config.prompts_config, dict)

    def test_model_config_loaded(self):
        config = Config()
        assert isinstance(config.model_config_data, dict)

    def test_ollama_default_model_uses_yaml_default(self):
        config = Config(provider="ollama", model="")
        assert config.model == "qwen3-vl:8b"

    def test_composition_policies_config_loaded(self):
        config = Config()
        assert isinstance(config.composition_policies_config, dict)
        assert "default" in config.composition_policies_config
