"""Pydantic models for API request/response validation."""

from datetime import datetime
from typing import Optional, Dict, Any, List

from pydantic import BaseModel, Field


# --- Response Models ---


class AnalysisResponse(BaseModel):
    """Analysis result response."""

    success: bool
    filename: str
    analysis: str
    metadata: Dict[str, Any] = Field(default_factory=dict)
    timestamp: str
    prompt: Optional[str] = None
    tokens_used: int = 0


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


class HealthResponse(BaseModel):
    """Health check response."""

    status: str
    timestamp: str
    provider: Optional[str] = None
    provider_connected: Optional[bool] = None


class UsageStats(BaseModel):
    """Token usage statistics."""

    total_requests: int = 0
    total_tokens: int = 0
    by_provider: Dict[str, Dict[str, int]] = Field(default_factory=dict)


class ErrorResponse(BaseModel):
    """Error response."""

    detail: str
    error_type: str = "unknown"


# --- E-Commerce Models (Phase 5) ---


class ProductAnalysisResponse(BaseModel):
    """Product photo analysis response."""

    success: bool
    filename: str
    description: str
    seo_title: str = ""
    seo_tags: List[str] = Field(default_factory=list)
    quality_score: float = 0.0
    attributes: Dict[str, str] = Field(default_factory=dict)
    improvements: List[str] = Field(default_factory=list)
    raw_analysis: str = ""
    metadata: Dict[str, Any] = Field(default_factory=dict)
    timestamp: str = ""


class ComplianceCheckResponse(BaseModel):
    """Marketplace compliance check response."""

    success: bool
    filename: str
    marketplace: str
    is_compliant: bool
    issues: List[str] = Field(default_factory=list)
    recommendations: List[str] = Field(default_factory=list)
    raw_analysis: str = ""
    metadata: Dict[str, Any] = Field(default_factory=dict)


class CompetitorCompareResponse(BaseModel):
    """Competitor comparison response."""

    success: bool
    product_filename: str
    competitor_filename: str
    comparison: str
    advantages: List[str] = Field(default_factory=list)
    disadvantages: List[str] = Field(default_factory=list)
    recommendations: List[str] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)


class BatchProductResult(BaseModel):
    """Single item in batch product analysis."""

    filename: str
    description: str
    seo_title: str = ""
    seo_tags: List[str] = Field(default_factory=list)
    quality_score: float = 0.0
    error: Optional[str] = None


class BatchAnalysisResponse(BaseModel):
    """Batch analysis response."""

    success: bool
    total_files: int
    processed: int
    results: List[BatchProductResult] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)


class MarketplaceInfo(BaseModel):
    """Marketplace information."""

    id: str
    name: str
    min_image_width: int
    min_image_height: int
    max_file_size_mb: float
    required_background: str
    forbidden_elements: List[str] = Field(default_factory=list)
