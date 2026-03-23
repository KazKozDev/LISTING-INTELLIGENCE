"""Tests for CostTracker utility."""

from src.utils.cost_tracker import CostTracker


class TestCostTracker:
    def test_initial_state(self):
        tracker = CostTracker()
        stats = tracker.get_stats()
        assert stats["total_requests"] == 0
        assert stats["total_tokens"] == 0
        assert stats["by_provider"] == {}

    def test_record_single(self):
        tracker = CostTracker()
        tracker.record("openai", "gpt-4o", 100)

        stats = tracker.get_stats()
        assert stats["total_requests"] == 1
        assert stats["total_tokens"] == 100
        assert "openai/gpt-4o" in stats["by_provider"]
        assert stats["by_provider"]["openai/gpt-4o"]["requests"] == 1
        assert stats["by_provider"]["openai/gpt-4o"]["tokens"] == 100

    def test_record_multiple_same_provider(self):
        tracker = CostTracker()
        tracker.record("openai", "gpt-4o", 100)
        tracker.record("openai", "gpt-4o", 200)

        stats = tracker.get_stats()
        assert stats["total_requests"] == 2
        assert stats["total_tokens"] == 300
        assert stats["by_provider"]["openai/gpt-4o"]["requests"] == 2

    def test_record_different_providers(self):
        tracker = CostTracker()
        tracker.record("openai", "gpt-4o", 100)
        tracker.record("anthropic", "claude-3", 150)

        stats = tracker.get_stats()
        assert stats["total_requests"] == 2
        assert stats["total_tokens"] == 250
        assert len(stats["by_provider"]) == 2

    def test_reset(self):
        tracker = CostTracker()
        tracker.record("openai", "gpt-4o", 100)
        tracker.reset()

        stats = tracker.get_stats()
        assert stats["total_requests"] == 0
        assert stats["total_tokens"] == 0
        assert stats["by_provider"] == {}
