"""Rate limiter implementation."""

import threading
import time


class RateLimiter:
    """Rate limiter using sliding window or token bucket algorithm."""

    def __init__(self, requests_per_minute: int = 60):
        """Initialize rate limiter.

        Args:
            requests_per_minute: Maximum requests allowed per minute.
        """
        self.rate = requests_per_minute
        self.interval = 60.0 / requests_per_minute if requests_per_minute > 0 else 0
        self.last_request_time = 0.0
        self._lock = threading.Lock()

    def acquire(self) -> None:
        """Acquire permission to make a request.
        
        Blocks if rate limit is exceeded.
        """
        if self.rate <= 0:
            return

        with self._lock:
            current_time = time.time()
            elapsed = current_time - self.last_request_time

            if elapsed < self.interval:
                sleep_time = self.interval - elapsed
                time.sleep(sleep_time)
                self.last_request_time = time.time()
            else:
                self.last_request_time = current_time

    def get_current_usage(self) -> dict[str, float]:
        """Get current usage statistics.

        Returns:
            Dictionary with usage stats.
        """
        return {
            "requests_per_minute": self.rate,
            "interval": self.interval
        }
