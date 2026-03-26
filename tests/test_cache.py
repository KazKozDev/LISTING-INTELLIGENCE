"""Tests for Cache utility."""

import time

from src.utils.cache import Cache


class TestCache:
    def test_set_and_get(self, tmp_cache_dir):
        cache = Cache(cache_dir=tmp_cache_dir, ttl_seconds=3600)
        cache.set("test prompt", "model-1", {"text": "hello"})

        result = cache.get("test prompt", "model-1")
        assert result == {"text": "hello"}

    def test_get_missing_key(self, tmp_cache_dir):
        cache = Cache(cache_dir=tmp_cache_dir)
        result = cache.get("nonexistent", "model")
        assert result is None

    def test_ttl_expiration(self, tmp_cache_dir):
        cache = Cache(cache_dir=tmp_cache_dir, ttl_seconds=1)
        cache.set("prompt", "model", "data")

        # Immediately should return data
        assert cache.get("prompt", "model") == "data"

        # Wait for expiration
        time.sleep(1.1)
        assert cache.get("prompt", "model") is None

    def test_different_keys(self, tmp_cache_dir):
        cache = Cache(cache_dir=tmp_cache_dir)
        cache.set("prompt1", "model", "data1")
        cache.set("prompt2", "model", "data2")

        assert cache.get("prompt1", "model") == "data1"
        assert cache.get("prompt2", "model") == "data2"

    def test_different_models(self, tmp_cache_dir):
        cache = Cache(cache_dir=tmp_cache_dir)
        cache.set("prompt", "model-a", "result-a")
        cache.set("prompt", "model-b", "result-b")

        assert cache.get("prompt", "model-a") == "result-a"
        assert cache.get("prompt", "model-b") == "result-b"

    def test_overwrite(self, tmp_cache_dir):
        cache = Cache(cache_dir=tmp_cache_dir)
        cache.set("prompt", "model", "old")
        cache.set("prompt", "model", "new")

        assert cache.get("prompt", "model") == "new"

    def test_clear(self, tmp_cache_dir):
        cache = Cache(cache_dir=tmp_cache_dir)
        cache.set("p1", "m", "d1")
        cache.set("p2", "m", "d2")

        cache.clear()

        assert cache.get("p1", "m") is None
        assert cache.get("p2", "m") is None

    def test_creates_directory(self, tmp_path):
        cache_dir = tmp_path / "new_cache"
        cache = Cache(cache_dir=cache_dir)
        assert cache_dir.exists()
