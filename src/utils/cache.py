"""Response caching utility."""

import hashlib
import json
import time
from pathlib import Path
from typing import Any


class Cache:
    """File-based cache for LLM responses."""

    def __init__(self, cache_dir: Path, ttl_seconds: int = 3600):
        """Initialize cache.

        Args:
            cache_dir: Directory to store cache files.
            ttl_seconds: Time to live in seconds.
        """
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.ttl_seconds = ttl_seconds

    def _get_cache_key(self, prompt: str, model: str) -> str:
        """Generate cache key from prompt and model."""
        content = f"{model}:{prompt}"
        return hashlib.sha256(content.encode()).hexdigest()

    def get(self, prompt: str, model: str) -> Any | None:
        """Retrieve cached response.

        Args:
            prompt: Input prompt.
            model: Model name.

        Returns:
            Cached response or None if not found/expired.
        """
        key = self._get_cache_key(prompt, model)
        cache_file = self.cache_dir / f"{key}.json"

        if not cache_file.exists():
            return None

        try:
            with open(cache_file) as f:
                data = json.load(f)

            # Check expiration
            if time.time() - data["timestamp"] > self.ttl_seconds:
                return None

            return data["response"]
        except (json.JSONDecodeError, OSError):
            return None

    def set(self, prompt: str, model: str, response: Any) -> None:
        """Store response in cache.

        Args:
            prompt: Input prompt.
            model: Model name.
            response: Response to cache.
        """
        key = self._get_cache_key(prompt, model)
        cache_file = self.cache_dir / f"{key}.json"

        data = {
            "timestamp": time.time(),
            "response": response
        }

        try:
            with open(cache_file, "w") as f:
                json.dump(data, f)
        except OSError:
            pass # Ignore write errors

    def clear(self) -> None:
        """Clear all cache entries."""
        for f in self.cache_dir.glob("*.json"):
            try:
                f.unlink()
            except OSError:
                pass
