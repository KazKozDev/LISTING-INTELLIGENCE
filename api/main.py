"""FastAPI backend for Vision Agent Analyst."""

import os
import tempfile
import json
from pathlib import Path
from typing import Optional, List
from datetime import datetime

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

# Add parent directory to path for imports
import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from src import VisionAgent
from config import Config
from src.utils.logger import setup_logging

# Setup logging
setup_logging(Path("config/logging_config.yaml"))

app = FastAPI(
    title="Vision Agent Analyst API",
    description="Multimodal analysis for charts, UI screenshots, and documents",
    version="1.0.0"
)

# CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class AnalysisResponse(BaseModel):
    """Analysis result response."""
    success: bool
    filename: str
    analysis: str
    metadata: dict
    timestamp: str
    prompt: Optional[str] = None


class ConfigResponse(BaseModel):
    """Configuration response."""
    provider: str
    model: str
    temperature: float
    max_tokens: int


class TemplateResponse(BaseModel):
    """Template response."""
    key: str
    name: str
    description: str
    prompt: str


@app.get("/")
def root():
    """Root endpoint."""
    return {"message": "Vision Agent Analyst API", "status": "running"}


@app.get("/api/config", response_model=ConfigResponse)
def get_config():
    """Get current configuration."""
    config = Config()
    return ConfigResponse(
        provider=config.provider,
        model=config.model,
        temperature=config.temperature,
        max_tokens=config.max_tokens
    )


@app.get("/api/templates")
def get_templates():
    """Get available analysis templates."""
    config = Config()
    
    # Basic templates
    basic = [
        {"key": "general", "name": "General", "description": "General file analysis", "prompt": "Analyze this file and provide detailed insights."},
        {"key": "chart", "name": "Chart Analysis", "description": "Analyze charts and graphs", "prompt": config.prompts_config.get("templates", {}).get("analyze_chart", "")},
        {"key": "ui", "name": "UI Screenshot", "description": "Analyze UI/UX design", "prompt": config.prompts_config.get("templates", {}).get("analyze_ui", "")},
    ]
    
    # Industry templates
    industry_templates = config.prompts_config.get("industry_templates", {})
    industry = [
        {
            "key": key,
            "name": value["name"],
            "description": value["description"],
            "prompt": value["prompt"]
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
    model: Optional[str] = Form(None)
):
    """Analyze uploaded file."""
    try:
        # Save uploaded file temporarily
        suffix = Path(file.filename).suffix
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            content = await file.read()
            tmp.write(content)
            tmp_path = Path(tmp.name)
        
        # Create config with overrides if provided
        config_overrides = {}
        if provider:
            config_overrides["provider"] = provider
        if model:
            config_overrides["model"] = model
            
        # Create custom config if needed, otherwise use defaults
        # Note: We need to load other defaults from env, so we instantiate Config
        # passing the overrides to the constructor if any
        if config_overrides:
            # We need to get default values for other fields first? 
            # Config is a dataclass, so passing kwargs overrides defaults/env vars loaded in field definitions?
            # Wait, field defaults like os.getenv(...) are evaluated at definition time.
            # So simple instantiation with kwargs works.
            agent_config = Config(**config_overrides)
        else:
            agent_config = None # VisionAgent will create default Config

        # Create agent and analyze
        agent = VisionAgent(config=agent_config)
        
        if suffix.lower() == ".pdf":
            results = agent.analyze_pdf(tmp_path, task=prompt)
            # Combine PDF results
            analysis_text = "\n\n---\n\n".join([f"**Page {r.metadata.get('page', i+1)}:**\n{r.text}" for i, r in enumerate(results)])
            metadata = results[0].metadata if results else {}
        else:
            result = agent.analyze_image(tmp_path, task=prompt)
            analysis_text = result.text
            metadata = result.metadata
        
        # Cleanup
        tmp_path.unlink()
        
        return AnalysisResponse(
            success=True,
            filename=file.filename,
            analysis=analysis_text,
            metadata=metadata,
            timestamp=datetime.now().isoformat(),
            prompt=prompt
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/health")
def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
