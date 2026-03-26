"""Tests for FastAPI endpoints."""

import json
import time
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from src.ecommerce.florence_analyzer import FlorenceAnalysisResult
from src.ecommerce.foreground_masking import ForegroundMaskResult
from src.ecommerce.ic_light_relighting import RelightResult
from src.ecommerce.image_upscaler import UpscaleResult
from src.ecommerce.object_detector import DetectionResult, DetectedObject
from src.ecommerce.outpainter import OutpaintResult
from src.ecommerce.text_detector import TextDetectionResult, TextRegion
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
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["prompt"] == ""


class TestInventoryCheckEndpoint:
    def test_inventory_check_uses_deterministic_cv_pipeline(
        self,
        client,
        sample_image,
    ):
        detection_result = DetectionResult(
            objects=[
                DetectedObject(
                    label="bottle",
                    confidence=0.93,
                    bbox=(0, 0, 10, 10),
                    area_ratio=0.25,
                ),
                DetectedObject(
                    label="bottle",
                    confidence=0.91,
                    bbox=(10, 0, 20, 10),
                    area_ratio=0.24,
                ),
                DetectedObject(
                    label="label",
                    confidence=0.84,
                    bbox=(0, 10, 20, 20),
                    area_ratio=0.10,
                ),
            ],
            total_count=3,
            has_watermark=False,
            has_text_overlay=True,
            warnings=["Detected 3 objects in a mixed retail frame."],
        )
        text_result = TextDetectionResult(
            regions=[
                TextRegion(
                    text="2 for $10",
                    confidence=0.88,
                    bbox=(0, 10, 20, 20),
                    area_ratio=0.10,
                )
            ],
            total_text_regions=1,
            has_text=True,
            combined_text="2 for $10",
            text_coverage_ratio=0.10,
            warnings=["Detected 1 text region(s) on the image."],
        )

        with patch(
            "api.main.ObjectDetector.detect",
            return_value=detection_result,
        ):
            with patch(
                "api.main.TextDetector.detect",
                return_value=text_result,
            ):
                with open(sample_image, "rb") as f:
                    response = client.post(
                        "/api/ecommerce/inventory-check",
                        files={"file": ("shelf.png", f, "image/png")},
                    )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["tokens_used"] == 42
        assert data["metadata"]["deterministic"] is True
        assert data["metadata"]["object_detection"]["total_count"] == 3
        assert data["metadata"]["vision_review"]["available"] is True
        assert (
            data["metadata"]["vision_review"]["text"]
            == "Mock analysis result"
        )
        assert (
            data["metadata"]["text_detection"]["combined_text"]
            == "2 for $10"
        )
        assert (
            "Deterministic read built from object detection and OCR"
            in data["analysis"]
        )
        assert (
            "Detected objects**: 3 object(s) across 2 class(es)"
            in data["analysis"]
        )
        assert "## Vision Review" in data["analysis"]
        assert "bottle" in data["analysis"]

    def test_analyze_template_only_request(self, client, sample_image):
        with open(sample_image, "rb") as f:
            response = client.post(
                "/api/analyze",
                files={"file": ("test.png", f, "image/png")},
                data={"template_key": "ecommerce_inventory"},
            )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["prompt"] == ""


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


class TestComplianceCheckEndpoint:
    def test_compliance_check_uses_grounded_prompt_with_measured_facts(
        self,
        client,
        sample_image,
    ):
        with patch("api.main.ProductAnalyzer.check_compliance") as mock_check:
            mock_check.return_value = AnalysisResult(
                file_path=Path("/tmp/test.png"),
                file_type="image",
                task="test",
                text="Compliance Status: PASS",
                metadata={
                    "model": "test-model",
                    "usage": {"total_tokens": 42},
                    "provider": "mock",
                },
            )

            with open(sample_image, "rb") as f:
                response = client.post(
                    "/api/ecommerce/compliance-check",
                    files={"file": ("test.png", f, "image/png")},
                    data={"marketplace": "amazon"},
                )

        assert response.status_code == 200
        mock_check.assert_called_once()


class TestProductAnalysisTimeouts:
    def test_analyze_product_full_returns_504_on_timeout(
        self,
        client,
        sample_image,
    ):
        with patch("api.main.ECOMMERCE_OPERATION_TIMEOUT_SECONDS", 0.01):
            with patch(
                "api.main.ProductAnalyzer.analyze_product_full",
                side_effect=lambda *args, **kwargs: time.sleep(0.05),
            ):
                with open(sample_image, "rb") as f:
                    response = client.post(
                        "/api/ecommerce/analyze-product-full",
                        files={"file": ("test.png", f, "image/png")},
                        data={"marketplace": "amazon"},
                    )

        assert response.status_code == 504
        assert "timed out" in response.text.lower()

    def test_compare_returns_504_on_timeout(
        self,
        client,
        sample_image,
    ):
        with patch("api.main.ECOMMERCE_OPERATION_TIMEOUT_SECONDS", 0.01):
            with patch(
                "api.main.ProductAnalyzer.compare_with_competitor",
                side_effect=lambda *args, **kwargs: time.sleep(0.05),
            ):
                with open(sample_image, "rb") as product_file:
                    with open(sample_image, "rb") as competitor_file:
                        response = client.post(
                            "/api/ecommerce/compare",
                            files={
                                "product_image": (
                                    "product.png",
                                    product_file,
                                    "image/png",
                                ),
                                "competitor_image": (
                                    "competitor.png",
                                    competitor_file,
                                    "image/png",
                                ),
                            },
                            data={"marketplace": "amazon"},
                        )

        assert response.status_code == 504
        assert "timed out" in response.text.lower()


class TestProductAnalyzerCompliancePrompt:
    def test_check_compliance_prompt_includes_measured_facts(
        self,
        sample_image,
    ):
        agent = MagicMock()
        agent.analyze_image.return_value = AnalysisResult(
            file_path=Path(sample_image),
            file_type="image",
            task="compliance",
            text="Compliance Status: PASS",
            metadata={"usage": {"total_tokens": 10}},
        )

        from src.ecommerce.product_analyzer import ProductAnalyzer

        analyzer = ProductAnalyzer(agent)
        analyzer.check_compliance(sample_image, marketplace="amazon")

        _, kwargs = agent.analyze_image.call_args
        prompt = kwargs["task"]

        assert "Known measured file facts" in prompt
        assert "Pixel dimensions:" in prompt
        assert "**Grounding rules**:" in prompt
        assert "do not invent text, watermarks, logos" in prompt.lower()
        assert "Unverifiable Checks" in prompt


class TestComplianceFixEndpoints:
    def test_suggest_compliance_fixes_includes_ai_action(
        self,
        client,
        sample_image,
    ):
        with open(sample_image, "rb") as f:
            response = client.post(
                "/api/ecommerce/compliance-fix/suggestions",
                files={"file": ("test.png", f, "image/png")},
                data={"marketplace": "amazon"},
            )

        assert response.status_code == 200
        data = response.json()
        actions = [suggestion["action"] for suggestion in data["suggestions"]]
        assert "auto_center_ai" in actions

    def test_apply_compliance_fix_supports_ai_auto_center(
        self,
        client,
        sample_image,
    ):
        with Image.open(sample_image) as source_image:
            mask = Image.new("L", source_image.size, 255)
            mask_result = ForegroundMaskResult(
                mask=mask,
                bounds=(0, 0, source_image.width, source_image.height),
                source="huggingface",
                model_id="ZhengPeng7/BiRefNet",
                fallback_used=False,
                alpha_threshold=8,
                coverage_ratio=1.0,
            )

        with patch(
            "src.ecommerce.foreground_masking.ForegroundMaskExtractor.extract",
            return_value=mask_result,
        ):
            with open(sample_image, "rb") as f:
                response = client.post(
                    "/api/ecommerce/compliance-fix/apply",
                    files={"file": ("test.png", f, "image/png")},
                    data={
                        "marketplace": "amazon",
                        "action": "auto_center_ai",
                        "transform_payload": json.dumps(
                            {
                                "target_width": 1000,
                                "target_height": 1000,
                                "background": "white",
                            }
                        ),
                    },
                )

        assert response.status_code == 200
        data = response.json()
        assert data["applied_action"] == "auto_center_ai"
        assert data["fixed_filename"] == "test-auto_center_ai.png"
        assert data["metadata"]["fix"]["ai"]["target"]["width"] == 1000
        assert data["metadata"]["fix"]["ai"]["mask_source"] in {
            "full-image",
            "alpha-channel",
            "huggingface",
        }
        assert data["metadata"]["fix"]["ai"]["target_class"] == "recommended"
        assert data["metadata"]["fix"]["ai"]["image_usage"] == "main_image"


class TestUpscaleEndpoints:
    def test_upscale_apply_exposes_success_headers(self, client, sample_image):
        with Image.open(sample_image) as source_image:
            result = UpscaleResult(
                image=source_image.convert("RGB"),
                original_width=source_image.width,
                original_height=source_image.height,
                upscaled_width=source_image.width,
                upscaled_height=source_image.height,
                scale_factor=4,
                model_id="RealESRGAN_x4plus",
                warning=None,
            )

        with patch("api.main.ImageUpscaler.upscale", return_value=result):
            with open(sample_image, "rb") as f:
                response = client.post(
                    "/api/image-intelligence/upscale/apply",
                    files={"image": ("test.png", f, "image/png")},
                )

        assert response.status_code == 200
        assert response.headers["X-Upscale-Model"] == "RealESRGAN_x4plus"
        assert response.headers["X-Upscale-Applied"] == "true"
        assert "X-Upscale-Warning" not in response.headers

    def test_upscale_apply_exposes_warning_headers(self, client, sample_image):
        with Image.open(sample_image) as source_image:
            result = UpscaleResult(
                image=source_image.convert("RGB"),
                original_width=source_image.width,
                original_height=source_image.height,
                upscaled_width=source_image.width,
                upscaled_height=source_image.height,
                scale_factor=1,
                model_id="RealESRGAN_x4plus",
                warning="Upscaler unavailable",
            )

        with patch("api.main.ImageUpscaler.upscale", return_value=result):
            with open(sample_image, "rb") as f:
                response = client.post(
                    "/api/image-intelligence/upscale/apply",
                    files={"image": ("test.png", f, "image/png")},
                )

        assert response.status_code == 200
        assert response.headers["X-Upscale-Model"] == "RealESRGAN_x4plus"
        assert response.headers["X-Upscale-Applied"] == "false"
        assert response.headers["X-Upscale-Warning"] == "Upscaler unavailable"


class TestImageIntelligenceEndpoints:
    def test_florence_analysis(self, client, sample_image):
        mock_result = FlorenceAnalysisResult(
            caption="White ceramic mug on a clean background",
            seo_title="White ceramic mug on a clean background",
            attributes=["white ceramic mug", "clean background"],
            detected_text="350 ml",
            model_id="microsoft/Florence-2-base",
            task_prompt="<MORE_DETAILED_CAPTION>",
        )

        with patch(
            "api.main.FlorenceAnalyzer.analyze",
            return_value=mock_result,
        ):
            with open(sample_image, "rb") as f:
                response = client.post(
                    "/api/image-intelligence/florence",
                    files={"image": ("test.png", f, "image/png")},
                )

        assert response.status_code == 200
        data = response.json()
        assert data["caption"] == mock_result.caption
        assert data["attributes"] == mock_result.attributes
        assert data["detected_text"] == mock_result.detected_text
        assert data["model_id"] == mock_result.model_id

    def test_relight_apply(self, client, sample_image):
        with Image.open(sample_image) as source_image:
            mock_image = source_image.convert("RGB")

        mock_result = RelightResult(
            image=mock_image,
            model_id="iclight_sd15_fc.safetensors",
            prompt="studio lighting",
            mask_source="huggingface",
        )

        with patch(
            "api.main.ICLightRelighter.relight",
            return_value=mock_result,
        ):
            with open(sample_image, "rb") as f:
                response = client.post(
                    "/api/image-intelligence/relight/apply",
                    files={"image": ("test.png", f, "image/png")},
                    data={"light_direction": "none"},
                )

        assert response.status_code == 200
        assert response.headers["content-type"] == "image/png"
        assert response.headers["x-relight-model"] == mock_result.model_id
        assert (
            response.headers["x-relight-mask-source"]
            == mock_result.mask_source
        )
        assert response.headers["x-relight-applied"] == "true"

    def test_outpaint_apply(self, client, sample_image):
        with Image.open(sample_image) as source_image:
            mock_image = source_image.convert("RGB")

        mock_result = OutpaintResult(
            image=mock_image,
            model_id="runwayml/stable-diffusion-inpainting",
            prompt="extend the canvas",
            direction="right",
            expansion_ratio=0.25,
        )

        with patch(
            "api.main.Outpainter.outpaint",
            return_value=mock_result,
        ):
            with open(sample_image, "rb") as f:
                response = client.post(
                    "/api/image-intelligence/outpaint/apply",
                    files={"image": ("test.png", f, "image/png")},
                    data={"direction": "right", "expand_ratio": "0.25"},
                )

        assert response.status_code == 200
        assert response.headers["content-type"] == "image/png"
        assert (
            response.headers["x-outpaint-model"]
            == "runwayml/stable-diffusion-inpainting"
        )
        assert response.headers["x-outpaint-direction"] == "right"
        assert response.headers["x-outpaint-expansion"] == "0.25"
