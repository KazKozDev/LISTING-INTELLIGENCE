"""Tests for FastAPI endpoints."""

import pytest
from unittest.mock import patch, MagicMock
from pathlib import Path
from datetime import datetime
from io import BytesIO

from fastapi.testclient import TestClient

from src.llm.base import ProviderResponse
from src.vision_agent import AnalysisResult


@pytest.fixture
def client():
    """Create a test client with mocked agent."""
    with patch("api.main.VisionAgent") as MockAgent:
        mock_agent = MagicMock()
        mock_agent.provider.provider_name = "MockProvider"
        mock_agent.provider.verify_connection.return_value = True
        mock_agent.analyze_image.return_value = AnalysisResult(
            file_path=Path("/tmp/test.png"),
            file_type="image",
            task="test",
            text="Mock analysis result",
            metadata={
                "model": "test-model",
                "usage": {"total_tokens": 42},
                "provider": "mock",
            },
        )
        mock_agent.analyze_pdf.return_value = [
            AnalysisResult(
                file_path=Path("/tmp/test.pdf"),
                file_type="pdf",
                task="test",
                text="Page 1 analysis",
                metadata={
                    "page": 1,
                    "model": "test-model",
                    "usage": {"total_tokens": 50},
                    "provider": "mock",
                },
            )
        ]

        MockAgent.return_value = mock_agent

        import api.main as api_module

        api_module._agent = mock_agent
        api_module._config = MagicMock()
        api_module._config.provider = "ollama"
        api_module._config.model = "test-model"
        api_module._config.temperature = 0.7
        api_module._config.max_tokens = 2048
        api_module._config.prompts_config = {"industry_templates": {}}

        yield TestClient(api_module.app, raise_server_exceptions=False)


class TestRootEndpoint:
    def test_root(self, client):
        response = client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "running"
        assert "version" in data


class TestConfigEndpoint:
    def test_get_config(self, client):
        response = client.get("/api/config")
        assert response.status_code == 200
        data = response.json()
        assert "provider" in data
        assert "model" in data
        assert "temperature" in data
        assert "max_tokens" in data


class TestAnalyzeEndpoint:
    def test_analyze_image(self, client, sample_image):
        with open(sample_image, "rb") as f:
            response = client.post(
                "/api/analyze",
                files={"file": ("test.png", f, "image/png")},
                data={"prompt": "Describe this image"},
            )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["filename"] == "test.png"
        assert "analysis" in data
        assert "timestamp" in data

    def test_analyze_missing_file(self, client):
        response = client.post(
            "/api/analyze",
            data={"prompt": "test"},
        )
        assert response.status_code == 422  # Validation error

    def test_analyze_missing_prompt(self, client, sample_image):
        with open(sample_image, "rb") as f:
            response = client.post(
                "/api/analyze",
                files={"file": ("test.png", f, "image/png")},
            )
        assert response.status_code == 422


class TestHealthEndpoint:
    def test_health(self, client):
        response = client.get("/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "timestamp" in data
        assert data["provider"] == "MockProvider"
        assert data["provider_connected"] is True


class TestUsageEndpoint:
    def test_usage_empty(self, client):
        response = client.get("/api/usage")
        assert response.status_code == 200
        data = response.json()
        assert data["total_requests"] >= 0
        assert data["total_tokens"] >= 0
        assert "by_provider" in data
