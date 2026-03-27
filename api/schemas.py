"""Pydantic models for API request/response validation."""

from typing import Any

from pydantic import BaseModel, Field

# --- Response Models ---


class AnalysisResponse(BaseModel):
    """Analysis result response."""

    success: bool
    filename: str
    analysis: str
    metadata: dict[str, Any] = Field(default_factory=dict)
    timestamp: str
    prompt: str | None = None
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
    provider: str | None = None
    provider_connected: bool | None = None


class UsageStats(BaseModel):
    """Token usage statistics."""

    total_requests: int = 0
    total_tokens: int = 0
    by_provider: dict[str, dict[str, int]] = Field(default_factory=dict)


class ErrorResponse(BaseModel):
    """Error response."""

    detail: str
    error_type: str = "unknown"


# --- E-Commerce Models (Phase 5) ---


class ProductAnalysisResponse(BaseModel):
    """Product photo analysis response."""

    success: bool
    filename: str
    analysis: str
    marketplace: str = "general"
    metadata: dict[str, Any] = Field(default_factory=dict)
    timestamp: str
    tokens_used: int = 0


class ComplianceCheckResponse(BaseModel):
    """Marketplace compliance check response."""

    success: bool
    filename: str
    marketplace: str
    analysis: str
    findings: list["ComplianceFinding"] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)
    timestamp: str
    tokens_used: int = 0


class ProductContext(BaseModel):
    """Optional catalog context for stronger marketplace verification."""

    title: str = ""
    category: str = ""
    attributes: str = ""
    reference_image_filename: str | None = None


class SEOGenerationResponse(BaseModel):
    """SEO generation response."""

    success: bool
    filename: str
    marketplace: str = "general"
    seo_content: str
    metadata: dict[str, Any] = Field(default_factory=dict)
    timestamp: str
    tokens_used: int = 0


class CompetitorCompareResponse(BaseModel):
    """Competitor comparison response."""

    success: bool
    product_filename: str
    competitor_filename: str
    analysis: str
    marketplace: str = "general"
    metadata: dict[str, Any] = Field(default_factory=dict)
    timestamp: str
    tokens_used: int = 0


class BatchProductResult(BaseModel):
    """Single item in batch product analysis."""

    filename: str
    analysis: str = ""
    success: bool
    metadata: dict[str, Any] = Field(default_factory=dict)
    error: str | None = None


class BatchAnalysisResponse(BaseModel):
    """Batch analysis response."""

    success: bool
    total_files: int
    processed: int
    results: list[BatchProductResult] = Field(default_factory=list)
    csv_data: str = ""
    timestamp: str


class AttributeExtractionResponse(BaseModel):
    """Attribute extraction response."""

    success: bool
    filename: str
    attributes: str
    metadata: dict[str, Any] = Field(default_factory=dict)
    timestamp: str
    tokens_used: int = 0


class MarketplaceSource(BaseModel):
    """Source document for marketplace rules."""

    label: str
    url: str


class MarketplaceInfo(BaseModel):
    """Marketplace information."""

    id: str
    name: str
    min_image_width: int
    min_image_height: int
    recommended_image_width: int | None = None
    recommended_image_height: int | None = None
    max_file_size_mb: float
    required_background: str
    aspect_ratio: str | None = None
    allowed_formats: list[str] = Field(default_factory=list)
    forbidden_elements: list[str] = Field(default_factory=list)
    main_image_rules: list[str] = Field(default_factory=list)
    recommendations: list[str] = Field(default_factory=list)
    composition_policy: dict[str, dict[str, float]] = Field(default_factory=dict)
    sources: list[MarketplaceSource] = Field(default_factory=list)
    notes: str | None = None


class MarketplaceListResponse(BaseModel):
    """Marketplace list response."""

    marketplaces: list[MarketplaceInfo] = Field(default_factory=list)


class ComplianceFixSuggestion(BaseModel):
    """Suggested deterministic action for improving compliance."""

    id: str
    title: str
    description: str
    action: str
    automated: bool = True
    priority: str = "medium"


class CanvasTransformPayload(BaseModel):
    """Canvas export settings for lightweight manual adjustments."""

    target_width: int
    target_height: int
    zoom: float = 1.0
    offset_x: float = 0.0
    offset_y: float = 0.0
    background: str = "white"


class ComplianceFixSuggestionsResponse(BaseModel):
    """Available fixes for a compliance image."""

    success: bool
    filename: str
    marketplace: str
    image_width: int
    image_height: int
    suggestions: list[ComplianceFixSuggestion] = Field(default_factory=list)
    timestamp: str


class ComplianceFixResultResponse(BaseModel):
    """Image produced by a compliance fix action."""

    success: bool
    filename: str
    fixed_filename: str
    marketplace: str
    applied_action: str
    image_data_url: str
    before_analysis: str = ""
    after_analysis: str = ""
    before_findings: list["ComplianceFinding"] = Field(default_factory=list)
    after_findings: list["ComplianceFinding"] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)
    timestamp: str
    tokens_used: int = 0


class ComplianceFindingEvidence(BaseModel):
    """Structured evidence attached to a verification finding."""

    bbox: list[int] | None = None
    measured: dict[str, Any] = Field(default_factory=dict)
    excerpts: list[str] = Field(default_factory=list)
    warning: str | None = None


class ComplianceFinding(BaseModel):
    """Structured marketplace finding from rule-based or detector-based checks."""

    code: str
    label: str
    severity: str
    summary: str
    source: str
    verification_tier: str = "model_assessed"
    confidence: float | None = None
    evidence: ComplianceFindingEvidence = Field(default_factory=ComplianceFindingEvidence)


ComplianceCheckResponse.model_rebuild()
ComplianceFixResultResponse.model_rebuild()
