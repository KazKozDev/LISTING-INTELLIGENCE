"""Tests for RateLimiter utility."""

import time

from src.utils.rate_limiter import RateLimiter


class TestRateLimiter:
    def test_acquire_no_delay_first_call(self):
        limiter = RateLimiter(requests_per_minute=60)
        start = time.time()
        limiter.acquire()
        elapsed = time.time() - start
        assert elapsed < 0.1  # First call should be instant

    def test_acquire_rate_limit(self):
        limiter = RateLimiter(requests_per_minute=120)  # 0.5s interval
        limiter.acquire()

        start = time.time()
        limiter.acquire()
        elapsed = time.time() - start

        # Should wait approximately 0.5s
        assert elapsed >= 0.4

    def test_zero_rate_no_limit(self):
        limiter = RateLimiter(requests_per_minute=0)
        start = time.time()
        limiter.acquire()
        limiter.acquire()
        limiter.acquire()
        elapsed = time.time() - start
        assert elapsed < 0.1

    def test_get_current_usage(self):
        limiter = RateLimiter(requests_per_minute=30)
        usage = limiter.get_current_usage()
        assert usage["requests_per_minute"] == 30
        assert usage["interval"] == 2.0
