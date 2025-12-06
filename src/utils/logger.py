"""Logging configuration."""

import logging
import logging.config
import yaml
from pathlib import Path
from typing import Optional

def setup_logging(
    config_path: Path,
    default_level: int = logging.INFO
) -> None:
    """Setup logging configuration from YAML file.

    Args:
        config_path: Path to logging configuration YAML.
        default_level: Default logging level if config file not found.
    """
    if config_path.exists():
        with open(config_path, "rt") as f:
            try:
                config = yaml.safe_load(f.read())
                logging.config.dictConfig(config)
            except Exception as e:
                print(f"Error in Logging Configuration. Using default configs. Error: {e}")
                logging.basicConfig(level=default_level)
    else:
        logging.basicConfig(level=default_level)
        print(f"Warning: Logging configuration file not found at {config_path}. Using default configs.")

def get_logger(name: str) -> logging.Logger:
    """Get logger instance.

    Args:
        name: Logger name.

    Returns:
        Logger instance.
    """
    return logging.getLogger(name)
