"""Progress tracker for long-running operations."""

import asyncio
import logging
from typing import Optional, Callable

logger = logging.getLogger(__name__)


class ProgressTracker:
    """Tracks progress of batch operations and notifies via callback."""

    def __init__(self, total: int, task_id: str = ""):
        self.total = total
        self.current = 0
        self.task_id = task_id
        self.current_file = ""
        self.status = "pending"
        self._callbacks: list[Callable] = []

    def add_callback(self, callback: Callable) -> None:
        """Register a progress callback."""
        self._callbacks.append(callback)

    def update(self, current: int, filename: str = "", status: str = "processing") -> None:
        """Update progress and notify callbacks."""
        self.current = current
        self.current_file = filename
        self.status = status

        message = {
            "task_id": self.task_id,
            "current": self.current,
            "total": self.total,
            "filename": self.current_file,
            "status": self.status,
            "percent": round((self.current / self.total) * 100) if self.total > 0 else 0,
        }

        for cb in self._callbacks:
            try:
                cb(message)
            except Exception as e:
                logger.error(f"Progress callback error: {e}")

    def complete(self) -> None:
        """Mark as complete."""
        self.update(self.total, status="completed")

    def fail(self, error: str = "") -> None:
        """Mark as failed."""
        self.status = "failed"
        message = {
            "task_id": self.task_id,
            "current": self.current,
            "total": self.total,
            "filename": self.current_file,
            "status": "failed",
            "error": error,
            "percent": round((self.current / self.total) * 100) if self.total > 0 else 0,
        }
        for cb in self._callbacks:
            try:
                cb(message)
            except Exception as e:
                logger.error(f"Progress callback error: {e}")
