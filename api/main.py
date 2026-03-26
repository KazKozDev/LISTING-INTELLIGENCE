"""FastAPI backend for Listing Intelligence."""

import asyncio
from collections import Counter
import html
import json
import logging
import os
import re

# Add parent directory to path for imports
import sys
import tempfile
import time
import io
from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path
from urllib.parse import urlparse

import requests
from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from PIL import Image, ImageDraw
from pydantic import BaseModel

sys.path.insert(0, str(Path(__file__).parent.parent))

from api.schemas import (  # noqa: E402
    AnalysisResponse,
    AttributeExtractionResponse,
    BatchAnalysisResponse,
    CompetitorCompareResponse,
    ComplianceCheckResponse,
    ComplianceFixResultResponse,
    ComplianceFixSuggestionsResponse,
    ConfigResponse,
    HealthResponse,
    MarketplaceListResponse,
    ProductAnalysisResponse,
    SEOGenerationResponse,
    UsageStats,
)
from config import Config  # noqa: E402
from src import VisionAgent  # noqa: E402
from src.ecommerce import (  # noqa: E402
    BatchProcessor,
    ComplianceFixer,
    FlorenceAnalyzer,
    ICLightRelighter,
    Outpainter,
    ProductAnalyzer,
    SEOGenerator,
)
from src.ecommerce.image_upscaler import ImageUpscaler  # noqa: E402
from src.ecommerce.marketplace_rules import list_marketplaces  # noqa: E402
from src.ecommerce.object_detector import ObjectDetector  # noqa: E402
from src.ecommerce.quality_scorer import QualityScorer  # noqa: E402
from src.ecommerce.text_detector import TextDetector  # noqa: E402
from src.ecommerce.lama_eraser import LamaEraser  # noqa: E402
from src.llm.factory import ProviderFactory  # noqa: E402
from src.utils.cost_tracker import CostTracker  # noqa: E402
from src.utils.logger import setup_logging  # noqa: E402

# Setup logging
setup_logging(Path("config/logging_config.yaml"))
logger = logging.getLogger(__name__)

# Shared state
_agent: VisionAgent | None = None
_config: Config | None = None
_cost_tracker = CostTracker()
ECOMMERCE_OPERATION_TIMEOUT_SECONDS = 180


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize shared resources on startup."""
    global _agent, _config
    _config = Config()
    _agent = VisionAgent(config=_config)
    logger.info("VisionAgent initialized (singleton)")
    yield
    logger.info("Shutting down")


app = FastAPI(
    title="Listing Intelligence API",
    description=(
        "AI-powered visual analysis for e-commerce, charts, and documents"
    ),
    version="1.0.1-beta",
    lifespan=lifespan,
)

# CORS
cors_origins = os.getenv(
    "CORS_ORIGINS", "http://localhost:5173,http://localhost:3000"
).split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in cors_origins],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Log all incoming requests."""
    start = time.time()
    response = await call_next(request)
    duration = time.time() - start
    logger.info(
        f"{request.method} {request.url.path} - "
        f"{response.status_code} ({duration:.2f}s)"
    )
    return response


async def _run_ecommerce_operation(
    operation_name: str,
    func,
    *args,
    timeout: int | None = None,
    **kwargs,
):
    """Run a blocking e-commerce operation off the event loop with timeout."""
    resolved_timeout = timeout or ECOMMERCE_OPERATION_TIMEOUT_SECONDS
    try:
        return await asyncio.wait_for(
            asyncio.to_thread(func, *args, **kwargs),
            timeout=resolved_timeout,
        )
    except asyncio.TimeoutError as exc:
        logger.error(
            "%s timed out after %ss",
            operation_name,
            resolved_timeout,
        )
        raise HTTPException(
            status_code=504,
            detail=(
                f"{operation_name} timed out after "
                f"{resolved_timeout} seconds. "
                "Check provider/model availability and try again."
            ),
        ) from exc


def get_agent() -> VisionAgent:
    """Get the singleton VisionAgent instance."""
    if _agent is None:
        raise HTTPException(status_code=503, detail="Agent not initialized")
    return _agent


def resolve_agent(
    provider: str | None = None,
    model: str | None = None,
    api_key: str | None = None,
    base_url: str | None = None,
) -> VisionAgent:
    """Return agent with optional overrides, or fallback to default."""
    if provider or model or api_key or base_url:
        overrides: dict = {}
        if provider:
            overrides["provider"] = provider
        if model:
            overrides["model"] = model
        if api_key:
            overrides["api_key"] = api_key
        if base_url:
            overrides["base_url"] = base_url
        return VisionAgent(config=Config(**overrides))
    return get_agent()


def resolve_effective_prompt(
    prompt: str,
    template_key: str | None,
) -> str:
    """Resolve a submitted prompt against configured templates."""
    effective_prompt = prompt
    if template_key and not prompt.strip():
        cfg = _config or Config()
        templates = cfg.prompts_config.get("industry_templates", {})
        template_entry = templates.get(template_key)
        if template_entry and isinstance(template_entry, dict):
            effective_prompt = template_entry.get("prompt", "")

        if not effective_prompt.strip():
            template_fallback = cfg.prompts_config.get("templates", {}).get(
                template_key, ""
            )
            if template_fallback:
                effective_prompt = template_fallback

    if effective_prompt.strip():
        return effective_prompt

    return "Analyze this content and provide detailed insights."


class EraseRequest(BaseModel):
    """Shape for erase requests if a JSON body variant is added later."""

    regions: list[list[int]]


def _unlink_temp_file(path: str | Path) -> None:
    """Best-effort cleanup for temporary files."""
    try:
        Path(path).unlink(missing_ok=True)
    except OSError:
        logger.warning("Failed to delete temporary file: %s", path)


def _save_upload_to_temp(upload: UploadFile) -> str:
    """Persist an uploaded file to a temporary path and return it."""
    suffix = f"_{upload.filename}" if upload.filename else ""
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(upload.file.read())
        return tmp.name


def _stream_pil_image(
    image: Image.Image,
    filename: str,
    extra_headers: dict[str, str] | None = None,
) -> StreamingResponse:
    """Convert a PIL image to a PNG streaming response."""
    img_byte_arr = io.BytesIO()
    image.save(img_byte_arr, format="PNG")
    img_byte_arr.seek(0)

    response_headers = {
        "Content-Disposition": f"attachment; filename={filename}",
    }
    if extra_headers:
        response_headers.update(extra_headers)
        response_headers["Access-Control-Expose-Headers"] = ", ".join(
            sorted(extra_headers.keys())
        )

    return StreamingResponse(
        img_byte_arr,
        media_type="image/png",
        headers=response_headers,
    )


def extract_public_page_text(html_content: str) -> str:
    """Extract readable text from a fetched HTML document."""
    cleaned_html = re.sub(
        (
            r"<script[\s\S]*?</script>|<style[\s\S]*?</style>|"
            r"<noscript[\s\S]*?</noscript>"
        ),
        " ",
        html_content,
        flags=re.IGNORECASE,
    )

    title_match = re.search(
        r"<title[^>]*>(.*?)</title>",
        html_content,
        flags=re.IGNORECASE | re.DOTALL,
    )
    meta_description_match = re.search(
        r'<meta[^>]+name=["\']description["\'][^>]+content=["\'](.*?)["\']',
        html_content,
        flags=re.IGNORECASE | re.DOTALL,
    )

    visible_text = re.sub(r"<[^>]+>", " ", cleaned_html)
    visible_text = html.unescape(visible_text)
    visible_text = re.sub(r"\s+", " ", visible_text).strip()

    sections: list[str] = []
    if title_match:
        title_text = html.unescape(title_match.group(1)).strip()
        sections.append(f"Title: {title_text}")
    if meta_description_match:
        meta_description = html.unescape(
            meta_description_match.group(1)
        ).strip()
        sections.append(
            f"Meta description: {meta_description}"
        )
    if visible_text:
        sections.append(f"Visible page text: {visible_text[:12000]}")

    return "\n\n".join(section for section in sections if section.strip())


def fetch_listing_text(listing_url: str) -> str:
    """Fetch and extract best-effort text from a public listing URL."""
    parsed = urlparse(listing_url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise HTTPException(status_code=400, detail="Invalid listing URL")

    try:
        response = requests.get(
            listing_url,
            timeout=12,
            headers={
                "User-Agent": (
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/123.0 Safari/537.36"
                )
            },
        )
        response.raise_for_status()
    except requests.RequestException as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to fetch listing URL: {exc}",
        ) from exc

    extracted_text = extract_public_page_text(response.text)
    if not extracted_text.strip():
        raise HTTPException(
            status_code=400,
            detail="Could not extract readable listing content from the URL",
        )

    return extracted_text


def analyze_text_content(
    agent: VisionAgent,
    task: str,
    content: str,
) -> tuple[str, dict, int]:
    """Run text-only analysis through the configured chat provider."""
    response = agent.provider.chat(
        messages=[
            {
                "role": "user",
                "content": (
                    f"{task}\n\nAnalyze this listing content:\n\n"
                    f"{content}"
                ),
            }
        ],
        temperature=agent.config.temperature,
        max_tokens=agent.config.max_tokens,
    )

    metadata = {
        "model": response.model,
        "usage": response.usage,
        "provider": agent.provider.provider_name,
        "prompt_tokens": agent.token_counter.count(task),
        **response.metadata,
    }
    total_tokens = response.usage.get("total_tokens", 0)
    return response.text, metadata, total_tokens


def build_inventory_check_analysis(
    object_payload: dict,
    text_payload: dict,
) -> str:
    """Build a deterministic object-count summary from CV signals."""
    objects = object_payload.get("objects", [])
    label_counts = Counter(obj.get("label", "unknown") for obj in objects)
    distinct_labels = len(label_counts)
    detected_objects = sum(label_counts.values())

    dominant_label = "none"
    dominant_count = 0
    avg_confidence = 0.0
    if label_counts:
        dominant_label, dominant_count = label_counts.most_common(1)[0]
        dominant_objects = [
            obj for obj in objects if obj.get("label") == dominant_label
        ]
        avg_confidence = sum(
            float(obj.get("confidence", 0.0))
            for obj in dominant_objects
        ) / max(1, len(dominant_objects))

    if detected_objects == 0:
        scene_read = (
            "No objects were confidently detected in the frame, so this "
            "image is not reliable for an object count."
        )
    elif distinct_labels == 1 and detected_objects >= 3:
        scene_read = (
            "The frame is visually consistent and dominated by a single "
            "object class."
        )
    elif distinct_labels <= 3 and detected_objects >= 2:
        scene_read = (
            "The frame contains a small set of recurring classes, which is "
            "good for quick counting and class breakdown."
        )
    else:
        scene_read = (
            "The scene is visually mixed, so counts are best treated as a "
            "best-effort object inventory of the visible frame."
        )

    detected_texts: list[str] = []
    for region in text_payload.get("regions", []):
        text_value = str(region.get("text", "")).strip()
        if text_value and text_value not in detected_texts:
            detected_texts.append(text_value)
        if len(detected_texts) == 5:
            break

    risk_flags: list[str] = []
    if object_payload.get("has_watermark"):
        risk_flags.append(
            "Watermark-like artwork was detected in the frame."
        )
    if object_payload.get("has_text_overlay"):
        risk_flags.append(
            "Overlay-style text or signage was detected as an object."
        )
    if text_payload.get("has_text"):
        risk_flags.append(
            "OCR found readable text in the scene, which often means shelf "
            "tags, promo cards, or packaging copy are present."
        )

    warnings = [
        *object_payload.get("warnings", []),
        *text_payload.get("warnings", []),
    ]
    for warning in warnings:
        if warning not in risk_flags:
            risk_flags.append(str(warning))

    lines = [
        "## Inventory Scan",
        "",
        (
            "Deterministic read built from object detection and OCR. "
            "No LLM interpretation was used."
        ),
        "",
        (
            "- **Detected objects**: "
            f"{detected_objects} object(s) across "
            f"{distinct_labels} class(es)."
        ),
        (
            (
                f"- **Top class**: {dominant_label} "
                f"({dominant_count} detection(s), avg confidence "
                f"{avg_confidence:.2f})."
            )
            if detected_objects > 0
            else "- **Top class**: No stable object class identified."
        ),
        f"- **Scene read**: {scene_read}",
        (
            f"- **Detected text**: {', '.join(detected_texts)}"
            if detected_texts
            else "- **Detected text**: No readable text found."
        ),
        "",
        "## Class Breakdown",
    ]

    if label_counts:
        for label, count in label_counts.most_common():
            lines.append(f"- **{label}**: {count}")
    else:
        lines.append("- No objects were detected.")

    lines.extend(["", "## Operational Flags"])
    if risk_flags:
        for flag in risk_flags:
            lines.append(f"- {flag}")
    else:
        lines.append(
            "- No obvious object-detection or OCR flags were detected."
        )

    return "\n".join(lines)


def build_inventory_vision_review_prompt(
    object_payload: dict,
    text_payload: dict,
    deterministic_summary: str,
) -> str:
    """Build a prompt for a vision LLM to verify CV detections."""
    structured_payload = json.dumps(
        {
            "object_detection": object_payload,
            "text_detection": text_payload,
        },
        ensure_ascii=False,
        indent=2,
    )

    return (
        "Use the image as primary evidence and the structured detection "
        "payload as supporting context. Do not invent exact counts beyond "
        "the supplied detections. If the scene visually suggests occlusion, "
        "overlap, glare, blur, crop loss, or likely undercount risk, say "
        "that explicitly.\n\n"
        "Return concise markdown with these sections:\n"
        "- Scene Summary\n"
        "- Detection Cross-Check\n"
        "- Count Confidence\n"
        "- OCR Context\n"
        "- Miss Risks\n\n"
        "Deterministic summary from CV pipeline:\n"
        f"{deterministic_summary}\n\n"
        "Structured detection payload:\n"
        f"{structured_payload}"
    )


@app.get("/")
def root():
    """Root endpoint."""
    return {
        "message": "Listing Intelligence API",
        "version": "1.0.1-beta",
        "status": "running",
    }


@app.get("/api/config", response_model=ConfigResponse)
def get_config():
    """Get current configuration."""
    config = _config or Config()
    return ConfigResponse(
        provider=config.provider,
        model=config.model,
        temperature=config.temperature,
        max_tokens=config.max_tokens,
    )


@app.post("/api/analyze", response_model=AnalysisResponse)
async def analyze_file(
    file: UploadFile = File(...),
    prompt: str = Form(""),
    template_key: str | None = Form(None),
    provider: str | None = Form(None),
    model: str | None = Form(None),
    api_key: str | None = Form(None),
    base_url: str | None = Form(None),
):
    """Analyze uploaded file."""
    try:
        suffix = Path(file.filename).suffix

        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            content = await file.read()
            tmp.write(content)
            tmp_path = Path(tmp.name)

        agent = resolve_agent(provider, model, api_key, base_url)

        effective_prompt = resolve_effective_prompt(prompt, template_key)

        if suffix.lower() == ".pdf":
            results = agent.analyze_pdf(tmp_path, task=effective_prompt)
            analysis_text = "\n\n---\n\n".join(
                [
                    f"**Page {r.metadata.get('page', i + 1)}:**\n{r.text}"
                    for i, r in enumerate(results)
                ]
            )
            metadata = results[0].metadata if results else {}
        else:
            result = agent.analyze_image(tmp_path, task=effective_prompt)
            analysis_text = result.text
            metadata = result.metadata

        # Cleanup temp file
        tmp_path.unlink(missing_ok=True)

        # Track usage
        tokens = metadata.get("usage", {}).get("total_tokens", 0)
        _cost_tracker.record(
            provider=metadata.get("provider", "unknown"),
            model=metadata.get("model", "unknown"),
            tokens=tokens,
        )

        return AnalysisResponse(
            success=True,
            filename=file.filename,
            analysis=analysis_text,
            metadata=metadata,
            timestamp=datetime.now().isoformat(),
            prompt=prompt,
            tokens_used=tokens,
        )

    except Exception as e:
        logger.error(f"Analysis failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/ecommerce/analyze-listing", response_model=AnalysisResponse)
async def analyze_listing(
    source_mode: str = Form(...),
    listing_url: str = Form(""),
    listing_text: str = Form(""),
    prompt: str = Form(""),
    template_key: str | None = Form(None),
    provider: str | None = Form(None),
    model: str | None = Form(None),
    api_key: str | None = Form(None),
    base_url: str | None = Form(None),
):
    """Analyze listing content from a URL or pasted text."""
    try:
        if source_mode not in {"url", "manual"}:
            raise HTTPException(
                status_code=400,
                detail="Unsupported listing source mode",
            )

        if source_mode == "url":
            if not listing_url.strip():
                raise HTTPException(
                    status_code=400,
                    detail="Listing URL is required",
                )
            source_content = fetch_listing_text(listing_url.strip())
            source_label = listing_url.strip()
        else:
            if not listing_text.strip():
                raise HTTPException(
                    status_code=400,
                    detail="Pasted listing content is required",
                )
            source_content = listing_text.strip()
            source_label = "manual-listing.txt"

        effective_prompt = resolve_effective_prompt(prompt, template_key)
        agent = resolve_agent(provider, model, api_key, base_url)
        analysis_text, metadata, total_tokens = analyze_text_content(
            agent,
            effective_prompt,
            source_content,
        )
        metadata["source_mode"] = source_mode
        if listing_url.strip():
            metadata["listing_url"] = listing_url.strip()

        _cost_tracker.record(
            provider=metadata.get("provider", "unknown"),
            model=metadata.get("model", "unknown"),
            tokens=total_tokens,
        )

        return AnalysisResponse(
            success=True,
            filename=source_label,
            analysis=analysis_text,
            metadata=metadata,
            timestamp=datetime.now().isoformat(),
            prompt=prompt,
            tokens_used=total_tokens,
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Listing analysis failed: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/api/ecommerce/inventory-check", response_model=AnalysisResponse)
async def inventory_check(file: UploadFile = File(...)):
    """Run a deterministic inventory scan using object detection and OCR."""
    tmp_path: str | None = None
    try:
        config = _config or Config()
        tmp_path = _save_upload_to_temp(file)

        object_detector = ObjectDetector(config)
        text_detector = TextDetector(config)

        object_result, text_result = await asyncio.gather(
            _run_ecommerce_operation(
                "Inventory object detection",
                object_detector.detect,
                tmp_path,
                timeout=90,
            ),
            _run_ecommerce_operation(
                "Inventory OCR",
                text_detector.detect,
                tmp_path,
                timeout=90,
            ),
        )

        object_payload = object_detector.to_dict(object_result)
        text_payload = text_detector.to_dict(text_result)
        deterministic_summary = build_inventory_check_analysis(
            object_payload,
            text_payload,
        )

        metadata: dict[str, object] = {
            "deterministic": True,
            "object_detection": object_payload,
            "text_detection": text_payload,
        }
        analysis_sections = [deterministic_summary]
        tokens_used = 0

        try:
            agent = get_agent()
            if agent.provider.supports_vision:
                vision_prompt = build_inventory_vision_review_prompt(
                    object_payload,
                    text_payload,
                    deterministic_summary,
                )
                vision_result = agent.analyze_image(
                    tmp_path,
                    task=vision_prompt,
                )
                vision_text = vision_result.text.strip()
                vision_tokens = int(
                    vision_result.metadata.get("usage", {}).get(
                        "total_tokens", 0
                    )
                )

                if vision_text:
                    metadata["vision_review"] = {
                        "available": True,
                        "text": vision_text,
                        "provider": vision_result.metadata.get(
                            "provider"
                        ),
                        "model": vision_result.metadata.get("model"),
                        "usage": vision_result.metadata.get("usage", {}),
                    }
                    analysis_sections.append(
                        f"## Vision Review\n\n{vision_text}"
                    )
                    tokens_used = vision_tokens
            else:
                metadata["vision_review"] = {
                    "available": False,
                    "reason": (
                        "Configured provider does not support "
                        "vision review."
                    ),
                }
        except HTTPException:
            raise
        except Exception as exc:
            logger.warning("Inventory vision review skipped: %s", exc)
            metadata["vision_review"] = {
                "available": False,
                "reason": f"Vision review unavailable: {exc}",
            }

        analysis_text = "\n\n---\n\n".join(analysis_sections)

        return AnalysisResponse(
            success=True,
            filename=file.filename,
            analysis=analysis_text,
            metadata=metadata,
            timestamp=datetime.now().isoformat(),
            prompt=None,
            tokens_used=tokens_used,
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Inventory check failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    finally:
        if tmp_path:
            _unlink_temp_file(tmp_path)


@app.get("/api/health", response_model=HealthResponse)
def health_check():
    """Health check with provider connectivity."""
    provider_connected = None
    provider_name = None

    if _agent:
        provider_name = _agent.provider.provider_name
        try:
            provider_connected = _agent.provider.verify_connection()
        except Exception:
            provider_connected = False

    return HealthResponse(
        status="healthy",
        timestamp=datetime.now().isoformat(),
        provider=provider_name,
        provider_connected=provider_connected,
    )


@app.get("/api/usage", response_model=UsageStats)
def get_usage():
    """Get token usage statistics."""
    stats = _cost_tracker.get_stats()
    return UsageStats(
        total_requests=stats["total_requests"],
        total_tokens=stats["total_tokens"],
        by_provider=stats["by_provider"],
    )


@app.get("/api/models")
def list_models(
    provider: str,
    api_key: str | None = None,
    base_url: str | None = None,
):
    """List available models for a given provider."""
    try:
        provider_cls = ProviderFactory.PROVIDERS.get(provider.lower())
        if not provider_cls:
            return {
                "provider": provider,
                "models": [],
                "error": f"Unknown provider: {provider}",
            }

        # Create a minimal provider instance just to list available models.
        kwargs: dict = {}
        if api_key:
            kwargs["api_key"] = api_key
        if base_url:
            kwargs["base_url"] = base_url

        instance = provider_cls(**kwargs)
        models = instance.list_models()

        return {"provider": provider, "models": models}

    except Exception as e:
        logger.warning(f"Failed to list models for {provider}: {e}")
        return {"provider": provider, "models": [], "error": str(e)}


# --- E-Commerce Endpoints ---


@app.get("/api/ecommerce/marketplaces", response_model=MarketplaceListResponse)
def get_marketplaces():
    """List supported marketplaces with their rules."""
    config = _config or Config()
    composition_policies = config.composition_policies_config or {}
    marketplaces = []

    for marketplace in list_marketplaces():
        marketplaces.append(
            {
                **marketplace,
                "composition_policy": composition_policies.get(
                    marketplace["id"],
                    composition_policies.get("default", {}),
                ),
            }
        )

    return {"marketplaces": marketplaces}


@app.post(
    "/api/ecommerce/analyze-product",
    response_model=ProductAnalysisResponse,
)
async def analyze_product(
    file: UploadFile = File(...),
    marketplace: str = Form("general"),
    provider: str | None = Form(None),
    model: str | None = Form(None),
    api_key: str | None = Form(None),
    base_url: str | None = Form(None),
):
    """Analyze a product photo for e-commerce optimization."""
    try:
        agent = resolve_agent(provider, model, api_key, base_url)
        analyzer = ProductAnalyzer(agent)

        suffix = Path(file.filename).suffix
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            content = await file.read()
            tmp.write(content)
            tmp_path = Path(tmp.name)

        result = analyzer.analyze_product(tmp_path, marketplace=marketplace)
        tmp_path.unlink(missing_ok=True)

        tokens = result.metadata.get("usage", {}).get("total_tokens", 0)
        _cost_tracker.record(
            provider=result.metadata.get("provider", "unknown"),
            model=result.metadata.get("model", "unknown"),
            tokens=tokens,
        )

        return {
            "success": True,
            "filename": file.filename,
            "analysis": result.text,
            "marketplace": marketplace,
            "metadata": result.metadata,
            "timestamp": datetime.now().isoformat(),
            "tokens_used": tokens,
        }

    except Exception as e:
        logger.error(f"Product analysis failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post(
    "/api/ecommerce/analyze-product-full",
    response_model=ProductAnalysisResponse,
)
async def analyze_product_full(
    file: UploadFile = File(...),
    marketplace: str = Form("general"),
    keywords: str = Form(""),
    provider: str | None = Form(None),
    model: str | None = Form(None),
    api_key: str | None = Form(None),
    base_url: str | None = Form(None),
):
    """Full product analysis + SEO listing in a single LLM call."""
    tmp_path: Path | None = None
    try:
        agent = resolve_agent(provider, model, api_key, base_url)
        analyzer = ProductAnalyzer(agent)

        suffix = Path(file.filename).suffix
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            content = await file.read()
            tmp.write(content)
            tmp_path = Path(tmp.name)

        result = await _run_ecommerce_operation(
            "Full product analysis",
            analyzer.analyze_product_full,
            tmp_path,
            marketplace=marketplace,
            keywords=keywords,
        )

        tokens = result.metadata.get("usage", {}).get("total_tokens", 0)
        _cost_tracker.record(
            provider=result.metadata.get("provider", "unknown"),
            model=result.metadata.get("model", "unknown"),
            tokens=tokens,
        )

        return {
            "success": True,
            "filename": file.filename,
            "analysis": result.text,
            "marketplace": marketplace,
            "metadata": result.metadata,
            "timestamp": datetime.now().isoformat(),
            "tokens_used": tokens,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Full product analysis failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if tmp_path is not None:
            tmp_path.unlink(missing_ok=True)


@app.post(
    "/api/ecommerce/compliance-check",
    response_model=ComplianceCheckResponse,
)
async def compliance_check(
    file: UploadFile = File(...),
    marketplace: str = Form(...),
    provider: str | None = Form(None),
    model: str | None = Form(None),
    api_key: str | None = Form(None),
    base_url: str | None = Form(None),
):
    """Check product photo compliance with marketplace rules."""
    try:
        agent = resolve_agent(provider, model, api_key, base_url)
        analyzer = ProductAnalyzer(agent)

        suffix = Path(file.filename).suffix
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            content = await file.read()
            tmp.write(content)
            tmp_path = Path(tmp.name)

        result = analyzer.check_compliance(tmp_path, marketplace=marketplace)
        tmp_path.unlink(missing_ok=True)

        tokens = result.metadata.get("usage", {}).get("total_tokens", 0)
        _cost_tracker.record(
            provider=result.metadata.get("provider", "unknown"),
            model=result.metadata.get("model", "unknown"),
            tokens=tokens,
        )

        return {
            "success": True,
            "filename": file.filename,
            "marketplace": marketplace,
            "analysis": result.text,
            "metadata": result.metadata,
            "timestamp": datetime.now().isoformat(),
            "tokens_used": tokens,
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Compliance check failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post(
    "/api/ecommerce/compliance-fix/suggestions",
    response_model=ComplianceFixSuggestionsResponse,
)
async def suggest_compliance_fixes(
    file: UploadFile = File(...),
    marketplace: str = Form(...),
):
    """Suggest deterministic image fixes for marketplace compliance."""
    tmp_path: Path | None = None
    try:
        fixer = ComplianceFixer()

        suffix = Path(file.filename).suffix
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            content = await file.read()
            tmp.write(content)
            tmp_path = Path(tmp.name)

        suggestion_data = fixer.suggest_fixes(
            tmp_path,
            marketplace=marketplace,
        )

        return {
            "success": True,
            "filename": file.filename,
            "marketplace": marketplace,
            "image_width": suggestion_data["image_width"],
            "image_height": suggestion_data["image_height"],
            "suggestions": suggestion_data["suggestions"],
            "timestamp": datetime.now().isoformat(),
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(
            f"Compliance fix suggestion generation failed: {e}",
            exc_info=True,
        )
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if tmp_path is not None:
            tmp_path.unlink(missing_ok=True)


@app.post(
    "/api/ecommerce/compliance-fix/apply",
    response_model=ComplianceFixResultResponse,
)
async def apply_compliance_fix(
    file: UploadFile = File(...),
    marketplace: str = Form(...),
    action: str = Form(...),
    transform_payload: str | None = Form(None),
    provider: str | None = Form(None),
    model: str | None = Form(None),
    api_key: str | None = Form(None),
    base_url: str | None = Form(None),
):
    """Apply a deterministic fix and return compliance before and after."""
    source_path: Path | None = None
    fixed_path: Path | None = None
    try:
        agent = resolve_agent(provider, model, api_key, base_url)
        analyzer = ProductAnalyzer(agent)
        fixer = ComplianceFixer()

        suffix = Path(file.filename).suffix
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            content = await file.read()
            tmp.write(content)
            source_path = Path(tmp.name)

        parsed_transform_payload = None
        if transform_payload:
            parsed_transform_payload = json.loads(transform_payload)

        before_result = analyzer.check_compliance(
            source_path,
            marketplace=marketplace,
        )

        fixed_image, fix_metadata = fixer.apply_fix(
            source_path,
            marketplace=marketplace,
            action=action,
            payload=parsed_transform_payload,
        )

        with tempfile.NamedTemporaryFile(delete=False, suffix=".png") as tmp:
            fixed_image.save(tmp, format="PNG")
            fixed_path = Path(tmp.name)

        after_result = analyzer.check_compliance(
            fixed_path,
            marketplace=marketplace,
        )

        before_tokens = before_result.metadata.get("usage", {}).get(
            "total_tokens", 0
        )
        after_tokens = after_result.metadata.get("usage", {}).get(
            "total_tokens", 0
        )
        total_tokens = before_tokens + after_tokens

        _cost_tracker.record(
            provider=before_result.metadata.get("provider", "unknown"),
            model=before_result.metadata.get("model", "unknown"),
            tokens=before_tokens,
        )
        _cost_tracker.record(
            provider=after_result.metadata.get("provider", "unknown"),
            model=after_result.metadata.get("model", "unknown"),
            tokens=after_tokens,
        )

        original_stem = Path(file.filename).stem or "image"
        fixed_filename = f"{original_stem}-{action}.png"

        return {
            "success": True,
            "filename": file.filename,
            "fixed_filename": fixed_filename,
            "marketplace": marketplace,
            "applied_action": action,
            "image_data_url": fixer.image_to_data_url(fixed_image),
            "before_analysis": before_result.text,
            "after_analysis": after_result.text,
            "metadata": {
                "fix": fix_metadata,
                "before": before_result.metadata,
                "after": after_result.metadata,
            },
            "timestamp": datetime.now().isoformat(),
            "tokens_used": total_tokens,
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Compliance fix failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if source_path is not None:
            source_path.unlink(missing_ok=True)
        if fixed_path is not None:
            fixed_path.unlink(missing_ok=True)


@app.post("/api/ecommerce/generate-seo", response_model=SEOGenerationResponse)
async def generate_seo(
    file: UploadFile = File(...),
    marketplace: str = Form("general"),
    keywords: str = Form(""),
    provider: str | None = Form(None),
    model: str | None = Form(None),
    api_key: str | None = Form(None),
    base_url: str | None = Form(None),
):
    """Generate SEO-optimized listing content from product image."""
    try:
        agent = resolve_agent(provider, model, api_key, base_url)
        seo = SEOGenerator(agent)

        suffix = Path(file.filename).suffix
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            content = await file.read()
            tmp.write(content)
            tmp_path = Path(tmp.name)

        result = seo.generate_listing(
            tmp_path,
            marketplace=marketplace,
            keywords=keywords,
        )
        tmp_path.unlink(missing_ok=True)

        tokens = result.metadata.get("usage", {}).get("total_tokens", 0)
        _cost_tracker.record(
            provider=result.metadata.get("provider", "unknown"),
            model=result.metadata.get("model", "unknown"),
            tokens=tokens,
        )

        return {
            "success": True,
            "filename": file.filename,
            "marketplace": marketplace,
            "seo_content": result.text,
            "metadata": result.metadata,
            "timestamp": datetime.now().isoformat(),
            "tokens_used": tokens,
        }

    except Exception as e:
        logger.error(f"SEO generation failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/ecommerce/batch-analyze", response_model=BatchAnalysisResponse)
async def batch_analyze_products(
    files: list[UploadFile] = File(...),
    marketplace: str = Form("general"),
    keywords: str = Form(""),
    provider: str | None = Form(None),
    model: str | None = Form(None),
    api_key: str | None = Form(None),
    base_url: str | None = Form(None),
):
    """Batch analyze multiple product images."""
    tmp_paths: list[tuple[str, Path]] = []
    try:
        agent = resolve_agent(provider, model, api_key, base_url)
        batch = BatchProcessor(agent)

        for f in files:
            suffix = Path(f.filename).suffix
            with tempfile.NamedTemporaryFile(
                delete=False,
                suffix=suffix,
            ) as tmp:
                content = await f.read()
                tmp.write(content)
                tmp_paths.append((f.filename, Path(tmp.name)))

        results = await _run_ecommerce_operation(
            "Batch product analysis",
            batch.process_files,
            [p for _, p in tmp_paths],
            marketplace=marketplace,
            keywords=keywords,
        )

        # Restore original filenames
        for i, (original_name, tmp_path) in enumerate(tmp_paths):
            if i < len(results):
                results[i]["filename"] = original_name

        # Track usage
        for r in results:
            if r.get("success"):
                meta = r.get("metadata", {})
                tokens = meta.get("usage", {}).get("total_tokens", 0)
                _cost_tracker.record(
                    provider=meta.get("provider", "unknown"),
                    model=meta.get("model", "unknown"),
                    tokens=tokens,
                )

        csv_data = BatchProcessor.results_to_csv(results)

        return {
            "success": True,
            "total_files": len(files),
            "processed": sum(1 for r in results if r.get("success")),
            "results": results,
            "csv_data": csv_data,
            "timestamp": datetime.now().isoformat(),
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Batch analysis failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        for _, tmp_path in tmp_paths:
            tmp_path.unlink(missing_ok=True)


@app.post("/api/ecommerce/compare", response_model=CompetitorCompareResponse)
async def compare_products(
    product_image: UploadFile = File(...),
    competitor_image: UploadFile = File(...),
    marketplace: str = Form("general"),
    provider: str | None = Form(None),
    model: str | None = Form(None),
    api_key: str | None = Form(None),
    base_url: str | None = Form(None),
):
    """Compare product photo with competitor's listing."""
    tmp_path1: Path | None = None
    tmp_path2: Path | None = None
    try:
        agent = resolve_agent(provider, model, api_key, base_url)
        analyzer = ProductAnalyzer(agent)

        suffix1 = Path(product_image.filename).suffix
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix1) as tmp1:
            content1 = await product_image.read()
            tmp1.write(content1)
            tmp_path1 = Path(tmp1.name)

        suffix2 = Path(competitor_image.filename).suffix
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix2) as tmp2:
            content2 = await competitor_image.read()
            tmp2.write(content2)
            tmp_path2 = Path(tmp2.name)

        result = await _run_ecommerce_operation(
            "Product comparison",
            analyzer.compare_with_competitor,
            tmp_path1,
            tmp_path2,
        )

        tokens = result.metadata.get("usage", {}).get("total_tokens", 0)
        _cost_tracker.record(
            provider=result.metadata.get("provider", "unknown"),
            model=result.metadata.get("model", "unknown"),
            tokens=tokens,
        )

        return {
            "success": True,
            "product_filename": product_image.filename,
            "competitor_filename": competitor_image.filename,
            "analysis": result.text,
            "marketplace": marketplace,
            "metadata": result.metadata,
            "timestamp": datetime.now().isoformat(),
            "tokens_used": tokens,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Product comparison failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if tmp_path1 is not None:
            tmp_path1.unlink(missing_ok=True)
        if tmp_path2 is not None:
            tmp_path2.unlink(missing_ok=True)


@app.post(
    "/api/ecommerce/suggest-improvements",
    response_model=AnalysisResponse,
)
async def suggest_improvements(
    file: UploadFile = File(...),
    provider: str | None = Form(None),
    model: str | None = Form(None),
    api_key: str | None = Form(None),
    base_url: str | None = Form(None),
):
    """Suggest photo improvements for better conversion."""
    try:
        agent = resolve_agent(provider, model, api_key, base_url)
        analyzer = ProductAnalyzer(agent)

        suffix = Path(file.filename).suffix
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            content = await file.read()
            tmp.write(content)
            tmp_path = Path(tmp.name)

        result = analyzer.suggest_improvements(tmp_path)
        tmp_path.unlink(missing_ok=True)

        tokens = result.metadata.get("usage", {}).get("total_tokens", 0)
        _cost_tracker.record(
            provider=result.metadata.get("provider", "unknown"),
            model=result.metadata.get("model", "unknown"),
            tokens=tokens,
        )

        return {
            "success": True,
            "filename": file.filename,
            "analysis": result.text,
            "metadata": result.metadata,
            "timestamp": datetime.now().isoformat(),
            "tokens_used": tokens,
        }

    except Exception as e:
        logger.error(f"Improvements suggestion failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post(
    "/api/ecommerce/extract-attributes",
    response_model=AttributeExtractionResponse,
)
async def extract_attributes(
    file: UploadFile = File(...),
    provider: str | None = Form(None),
    model: str | None = Form(None),
    api_key: str | None = Form(None),
    base_url: str | None = Form(None),
):
    """Extract product attributes from photo."""
    try:
        agent = resolve_agent(provider, model, api_key, base_url)
        analyzer = ProductAnalyzer(agent)

        suffix = Path(file.filename).suffix
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            content = await file.read()
            tmp.write(content)
            tmp_path = Path(tmp.name)

        result = analyzer.extract_attributes(tmp_path)
        tmp_path.unlink(missing_ok=True)

        tokens = result.metadata.get("usage", {}).get("total_tokens", 0)
        _cost_tracker.record(
            provider=result.metadata.get("provider", "unknown"),
            model=result.metadata.get("model", "unknown"),
            tokens=tokens,
        )

        return {
            "success": True,
            "filename": file.filename,
            "attributes": result.text,
            "metadata": result.metadata,
            "timestamp": datetime.now().isoformat(),
            "tokens_used": tokens,
        }

    except Exception as e:
        logger.error(f"Attribute extraction failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/image-intelligence/quality")
async def intelligence_quality(image: UploadFile = File(...)):
    """Run neural image quality scoring."""
    tmp_path: str | None = None
    try:
        config = _config or Config()
        tmp_path = _save_upload_to_temp(image)

        scorer = QualityScorer(config)
        result = scorer.score(tmp_path)
        return scorer.to_dict(result)
    except Exception as e:
        logger.error(f"Quality scoring failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if tmp_path:
            _unlink_temp_file(tmp_path)


@app.post("/api/image-intelligence/objects")
async def intelligence_objects(image: UploadFile = File(...)):
    """Run object detection for product-image diagnostics."""
    tmp_path: str | None = None
    try:
        config = _config or Config()
        tmp_path = _save_upload_to_temp(image)

        detector = ObjectDetector(config)
        result = detector.detect(tmp_path)
        return detector.to_dict(result)
    except Exception as e:
        logger.error(f"Object detection failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if tmp_path:
            _unlink_temp_file(tmp_path)


@app.post("/api/image-intelligence/text")
async def intelligence_text(image: UploadFile = File(...)):
    """Run OCR over an uploaded image."""
    tmp_path: str | None = None
    try:
        config = _config or Config()
        tmp_path = _save_upload_to_temp(image)

        detector = TextDetector(config)
        result = detector.detect(tmp_path)
        return detector.to_dict(result)
    except Exception as e:
        logger.error(f"Text detection failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if tmp_path:
            _unlink_temp_file(tmp_path)


@app.post("/api/image-intelligence/florence")
async def intelligence_florence(image: UploadFile = File(...)):
    """Run Florence-2 analysis for captioning and SEO-ready attributes."""
    tmp_path: str | None = None
    try:
        config = _config or Config()
        tmp_path = _save_upload_to_temp(image)

        analyzer = FlorenceAnalyzer(config)
        result = analyzer.analyze(tmp_path)
        return analyzer.to_dict(result)
    except Exception as e:
        logger.error(f"Florence-2 analysis failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if tmp_path:
            _unlink_temp_file(tmp_path)


@app.post("/api/image-intelligence/upscale")
async def intelligence_upscale(image: UploadFile = File(...)):
    """Check whether an uploaded image should be upscaled."""
    tmp_path: str | None = None
    try:
        config = _config or Config()
        tmp_path = _save_upload_to_temp(image)

        upscaler = ImageUpscaler(config)
        result = upscaler.should_upscale(tmp_path)
        return {"upscale_recommended": result}
    except Exception as e:
        logger.error(f"Upscale check failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if tmp_path:
            _unlink_temp_file(tmp_path)


@app.post("/api/image-intelligence/relight/apply")
async def intelligence_relight_apply(
    image: UploadFile = File(...),
    prompt: str | None = Form(None),
    light_direction: str = Form("none"),
):
    """Run IC-Light relighting and return the enhanced image."""
    tmp_path: str | None = None
    try:
        config = _config or Config()
        tmp_path = _save_upload_to_temp(image)

        relighter = ICLightRelighter(config)
        result = relighter.relight(
            tmp_path,
            prompt=prompt,
            light_direction=light_direction,
        )
        extra_headers = {
            "X-Relight-Model": result.model_id,
            "X-Relight-Mask-Source": result.mask_source,
            "X-Relight-Applied": "true" if not result.warning else "false",
        }
        if result.warning:
            extra_headers["X-Relight-Warning"] = result.warning
        return _stream_pil_image(
            result.image,
            f"relit_{image.filename}",
            extra_headers=extra_headers,
        )
    except Exception as e:
        logger.error(f"Relight apply failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if tmp_path:
            _unlink_temp_file(tmp_path)


@app.post("/api/image-intelligence/upscale/apply")
async def intelligence_upscale_apply(image: UploadFile = File(...)):
    """Actually run Real-ESRGAN upscaling and return the new image."""
    tmp_path: str | None = None
    try:
        config = _config or Config()
        tmp_path = _save_upload_to_temp(image)

        upscaler = ImageUpscaler(config)
        result = upscaler.upscale(tmp_path)
        extra_headers = {
            "X-Upscale-Model": result.model_id,
            "X-Upscale-Applied": "true" if not result.warning else "false",
        }
        if result.warning:
            extra_headers["X-Upscale-Warning"] = result.warning
        return _stream_pil_image(
            result.image,
            f"upscaled_{image.filename}",
            extra_headers=extra_headers,
        )
    except Exception as e:
        logger.error(f"Upscale apply failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if tmp_path:
            _unlink_temp_file(tmp_path)


@app.post("/api/image-intelligence/outpaint/apply")
async def intelligence_outpaint_apply(
    image: UploadFile = File(...),
    direction: str = Form("right"),
    expand_ratio: float = Form(0.25),
    prompt: str | None = Form(None),
):
    """Expand the canvas and outpaint continuation into the new region."""
    tmp_path: str | None = None
    try:
        config = _config or Config()
        tmp_path = _save_upload_to_temp(image)

        outpainter = Outpainter(config)
        result = outpainter.outpaint(
            tmp_path,
            direction=direction,
            expand_ratio=expand_ratio,
            prompt=prompt,
        )
        extra_headers = {
            "X-Outpaint-Model": result.model_id,
            "X-Outpaint-Direction": result.direction,
            "X-Outpaint-Expansion": str(result.expansion_ratio),
        }
        if result.warning:
            extra_headers["X-Outpaint-Warning"] = result.warning
        return _stream_pil_image(
            result.image,
            f"outpainted_{image.filename}",
            extra_headers=extra_headers,
        )
    except Exception as e:
        logger.error(f"Outpaint apply failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if tmp_path:
            _unlink_temp_file(tmp_path)


@app.post("/api/image-intelligence/erase")
async def intelligence_erase(
    image: UploadFile = File(...),
    regions: str = Form(...),
):
    """Erase text or watermarks using LaMa inpainting."""
    tmp_path: str | None = None
    try:
        config = _config or Config()
        parsed_regions = json.loads(regions)
        if not isinstance(parsed_regions, list):
            raise ValueError("regions must be a JSON list of bounding boxes")

        tmp_path = _save_upload_to_temp(image)

        with Image.open(tmp_path) as img:
            mask = Image.new("L", img.size, 0)
            draw = ImageDraw.Draw(mask)
            for region in parsed_regions:
                if not isinstance(region, list) or len(region) != 4:
                    raise ValueError(
                        "each region must be [x1, y1, x2, y2]"
                    )

                x1, y1, x2, y2 = region
                draw.rectangle(
                    [x1 - 10, y1 - 10, x2 + 10, y2 + 10],
                    fill=255,
                )

        eraser = LamaEraser(config)
        result = eraser.erase(tmp_path, mask)
        return _stream_pil_image(
            result.image,
            f"erased_{image.filename}",
        )
    except Exception as e:
        logger.error(f"Erase failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if tmp_path:
            _unlink_temp_file(tmp_path)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
