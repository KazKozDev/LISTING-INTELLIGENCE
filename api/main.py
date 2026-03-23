"""FastAPI backend for Vision Agent Analyst."""

import asyncio
import json
import os
import logging
import tempfile
import time
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional
from datetime import datetime

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

# Add parent directory to path for imports
import sys

sys.path.insert(0, str(Path(__file__).parent.parent))

from src import VisionAgent
from config import Config
from src.utils.logger import setup_logging
from src.utils.cost_tracker import CostTracker
from api.schemas import (
    AnalysisResponse,
    ConfigResponse,
    HealthResponse,
    UsageStats,
    MarketplaceInfo,
)
from src.ecommerce import ProductAnalyzer, SEOGenerator, BatchProcessor
from src.ecommerce.marketplace_rules import list_marketplaces
from src.utils.progress import ProgressTracker

# Setup logging
setup_logging(Path("config/logging_config.yaml"))
logger = logging.getLogger(__name__)

# Shared state
_agent: Optional[VisionAgent] = None
_config: Optional[Config] = None
_cost_tracker = CostTracker()


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
    title="Vision Agent Analyst API",
    description="AI-powered visual analysis for e-commerce, charts, and documents",
    version="0.2.0",
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
        f"{request.method} {request.url.path} - {response.status_code} ({duration:.2f}s)"
    )
    return response


def get_agent() -> VisionAgent:
    """Get the singleton VisionAgent instance."""
    if _agent is None:
        raise HTTPException(status_code=503, detail="Agent not initialized")
    return _agent


@app.get("/")
def root():
    """Root endpoint."""
    return {"message": "Vision Agent Analyst API", "version": "0.2.0", "status": "running"}


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


@app.get("/api/templates")
def get_templates():
    """Get available analysis templates."""
    config = _config or Config()

    basic = [
        {
            "key": "general",
            "name": "General",
            "description": "General file analysis",
            "prompt": "Analyze this file and provide detailed insights.",
        },
        {
            "key": "chart",
            "name": "Chart Analysis",
            "description": "Analyze charts and graphs",
            "prompt": config.prompts_config.get("templates", {}).get("analyze_chart", ""),
        },
        {
            "key": "ui",
            "name": "UI Screenshot",
            "description": "Analyze UI/UX design",
            "prompt": config.prompts_config.get("templates", {}).get("analyze_ui", ""),
        },
    ]

    industry_templates = config.prompts_config.get("industry_templates", {})
    industry = [
        {
            "key": key,
            "name": value["name"],
            "description": value["description"],
            "prompt": value["prompt"],
        }
        for key, value in industry_templates.items()
    ]

    return {"basic": basic, "industry": industry}


@app.post("/api/analyze", response_model=AnalysisResponse)
async def analyze_file(
    file: UploadFile = File(...),
    prompt: str = Form(...),
    template_key: Optional[str] = Form(None),
    provider: Optional[str] = Form(None),
    model: Optional[str] = Form(None),
):
    """Analyze uploaded file."""
    try:
        suffix = Path(file.filename).suffix

        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            content = await file.read()
            tmp.write(content)
            tmp_path = Path(tmp.name)

        # Use override config or singleton agent
        if provider or model:
            config_overrides = {}
            if provider:
                config_overrides["provider"] = provider
            if model:
                config_overrides["model"] = model
            agent = VisionAgent(config=Config(**config_overrides))
        else:
            agent = get_agent()

        if suffix.lower() == ".pdf":
            results = agent.analyze_pdf(tmp_path, task=prompt)
            analysis_text = "\n\n---\n\n".join(
                [
                    f"**Page {r.metadata.get('page', i + 1)}:**\n{r.text}"
                    for i, r in enumerate(results)
                ]
            )
            metadata = results[0].metadata if results else {}
        else:
            result = agent.analyze_image(tmp_path, task=prompt)
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


# --- E-Commerce Endpoints ---


@app.get("/api/ecommerce/marketplaces")
def get_marketplaces():
    """List supported marketplaces with their rules."""
    return {"marketplaces": list_marketplaces()}


@app.post("/api/ecommerce/analyze-product")
async def analyze_product(
    file: UploadFile = File(...),
    marketplace: str = Form("general"),
):
    """Analyze a product photo for e-commerce optimization."""
    try:
        agent = get_agent()
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


@app.post("/api/ecommerce/compliance-check")
async def compliance_check(
    file: UploadFile = File(...),
    marketplace: str = Form(...),
):
    """Check product photo compliance with marketplace rules."""
    try:
        agent = get_agent()
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


@app.post("/api/ecommerce/generate-seo")
async def generate_seo(
    file: UploadFile = File(...),
    marketplace: str = Form("general"),
    keywords: str = Form(""),
):
    """Generate SEO-optimized listing content from product image."""
    try:
        agent = get_agent()
        seo = SEOGenerator(agent)

        suffix = Path(file.filename).suffix
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            content = await file.read()
            tmp.write(content)
            tmp_path = Path(tmp.name)

        result = seo.generate_listing(tmp_path, marketplace=marketplace, keywords=keywords)
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


@app.post("/api/ecommerce/batch-analyze")
async def batch_analyze_products(
    files: list[UploadFile] = File(...),
    marketplace: str = Form("general"),
):
    """Batch analyze multiple product images."""
    try:
        agent = get_agent()
        batch = BatchProcessor(agent)

        tmp_paths = []
        for f in files:
            suffix = Path(f.filename).suffix
            with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
                content = await f.read()
                tmp.write(content)
                tmp_paths.append((f.filename, Path(tmp.name)))

        results = batch.process_files(
            [p for _, p in tmp_paths],
            marketplace=marketplace,
        )

        # Restore original filenames and cleanup
        for i, (original_name, tmp_path) in enumerate(tmp_paths):
            if i < len(results):
                results[i]["filename"] = original_name
            tmp_path.unlink(missing_ok=True)

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

    except Exception as e:
        logger.error(f"Batch analysis failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/ecommerce/compare")
async def compare_products(
    product_image: UploadFile = File(...),
    competitor_image: UploadFile = File(...),
    marketplace: str = Form("general"),
):
    """Compare product photo with competitor's listing."""
    try:
        agent = get_agent()
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

        result = analyzer.compare_with_competitor(tmp_path1, tmp_path2)
        tmp_path1.unlink(missing_ok=True)
        tmp_path2.unlink(missing_ok=True)

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

    except Exception as e:
        logger.error(f"Product comparison failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/ecommerce/suggest-improvements")
async def suggest_improvements(
    file: UploadFile = File(...),
):
    """Suggest photo improvements for better conversion."""
    try:
        agent = get_agent()
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


@app.post("/api/ecommerce/extract-attributes")
async def extract_attributes(
    file: UploadFile = File(...),
):
    """Extract product attributes from photo."""
    try:
        agent = get_agent()
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


# --- WebSocket for batch progress ---

# Store active WebSocket connections by task_id
_ws_connections: dict[str, WebSocket] = {}


@app.websocket("/api/ws/batch-progress")
async def batch_progress_ws(websocket: WebSocket):
    """WebSocket endpoint for real-time batch processing progress."""
    await websocket.accept()
    task_id = str(uuid.uuid4())
    _ws_connections[task_id] = websocket

    try:
        await websocket.send_json({"type": "connected", "task_id": task_id})

        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)

            if msg.get("action") == "start_batch":
                files_data = msg.get("files", [])
                marketplace = msg.get("marketplace", "general")

                if not files_data:
                    await websocket.send_json({"type": "error", "message": "No files provided"})
                    continue

                await websocket.send_json({
                    "type": "batch_started",
                    "task_id": task_id,
                    "total": len(files_data),
                })

                # Process files are uploaded via regular HTTP; WS only monitors
                # The client sends file metadata, and we acknowledge progress
                await websocket.send_json({
                    "type": "info",
                    "message": "Use POST /api/ecommerce/batch-analyze for file uploads. "
                    "This WebSocket provides real-time progress updates.",
                })

            elif msg.get("action") == "ping":
                await websocket.send_json({"type": "pong"})

    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected: {task_id}")
    finally:
        _ws_connections.pop(task_id, None)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
