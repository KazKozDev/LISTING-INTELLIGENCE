"""In-memory cost and usage tracker for LLM API calls."""

import threading
from typing import Dict, Any


class CostTracker:
    """Tracks token usage and estimated costs per provider."""

    def __init__(self):
        self._lock = threading.Lock()
        self._stats: Dict[str, Dict[str, int]] = {}
        self._total_requests = 0
        self._total_tokens = 0

    def record(self, provider: str, model: str, tokens: int) -> None:
        """Record a completed API call.

        Args:
            provider: Provider name (e.g. 'openai', 'anthropic').
            model: Model name.
            tokens: Total tokens used.
        """
        with self._lock:
            self._total_requests += 1
            self._total_tokens += tokens

            key = f"{provider}/{model}"
            if key not in self._stats:
                self._stats[key] = {"requests": 0, "tokens": 0}
            self._stats[key]["requests"] += 1
            self._stats[key]["tokens"] += tokens

    def get_stats(self) -> Dict[str, Any]:
        """Get usage statistics.

        Returns:
            Dictionary with total and per-provider stats.
        """
        with self._lock:
            return {
                "total_requests": self._total_requests,
                "total_tokens": self._total_tokens,
                "by_provider": dict(self._stats),
            }

    def reset(self) -> None:
        """Reset all statistics."""
        with self._lock:
            self._stats.clear()
            self._total_requests = 0
            self._total_tokens = 0
