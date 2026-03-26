export interface Config {
  provider: string
  model: string
  temperature?: number
  max_tokens?: number
}

export interface CustomSettings {
  provider: string
  model: string
  apiKey: string
  baseUrl: string
}

export interface TokenUsage {
  total_tokens?: number
  prompt_tokens?: number
  completion_tokens?: number
}

export interface AnalysisMetadata {
  provider?: string
  model?: string
  usage?: TokenUsage
  [key: string]: unknown
}

export interface ComplianceFixAiMetadata {
  model?: string | null
  mask_source?: string
  fallback_used?: boolean
  fallback_reason?: string | null
  coverage_ratio?: number
  fill_ratio?: number
  target_class?: string
  image_usage?: ImageUsage
  policy_id?: string
  bounds?: {
    left: number
    top: number
    right: number
    bottom: number
  }
  target?: {
    width: number
    height: number
  }
  rendered_object?: {
    width: number
    height: number
  }
  alpha_threshold?: number
}

export type ImageUsage = 'main_image' | 'gallery_image'

export interface AnalysisResult {
  success: boolean
  filename: string
  analysis: string
  metadata: AnalysisMetadata
  timestamp: string
  prompt?: string
  tokens_used: number
}

export interface HistoryItem extends AnalysisResult {
  id: string
}

export interface UsageStats {
  total_requests: number
  total_tokens: number
  by_provider: Record<string, { requests: number; tokens: number }>
}

export interface HealthStatus {
  status: string
  timestamp: string
  provider?: string
  provider_connected?: boolean
}

export interface ModelListResponse {
  provider: string
  models: string[]
  error?: string
}

// E-Commerce types
export interface ProductAnalysisResponse extends AnalysisResult {
  marketplace: string
  tokens_used: number
}

export interface ComplianceCheckResponse extends AnalysisResult {
  marketplace: string
  tokens_used: number
}

export interface ComplianceFixSuggestion {
  id: string
  title: string
  description: string
  action: string
  automated: boolean
  priority: string
}

export type CanvasPreset = 'recommended' | 'minimum'

export interface ComplianceCanvasDraft {
  preset: CanvasPreset
  zoom: number
  offset_x: number
  offset_y: number
}

export interface CanvasTransformPayload {
  target_width: number
  target_height: number
  zoom: number
  offset_x: number
  offset_y: number
  background: string
  image_usage?: ImageUsage
}

export interface ComplianceFixSuggestionsResponse {
  success: boolean
  filename: string
  marketplace: string
  image_width: number
  image_height: number
  suggestions: ComplianceFixSuggestion[]
  timestamp: string
}

export interface ComplianceFixResultResponse {
  success: boolean
  filename: string
  fixed_filename: string
  marketplace: string
  applied_action: string
  image_data_url: string
  before_analysis: string
  after_analysis: string
  metadata: AnalysisMetadata
  timestamp: string
  tokens_used: number
}

export interface ComplianceFixHistoryEntry {
  id: string
  action: string
  title: string
  result: ComplianceFixResultResponse
}

export interface ComplianceFixStudioLaunchState {
  id: number
  file: File
  marketplace: string
  source: 'compliance'
}

export interface SEOGenerationResponse {
  success: boolean
  filename: string
  marketplace: string
  seo_content: string
  metadata: AnalysisMetadata
  timestamp: string
  tokens_used: number
}

export interface CompetitorCompareResponse {
  success: boolean
  product_filename: string
  competitor_filename: string
  analysis: string
  marketplace: string
  metadata: AnalysisMetadata
  timestamp: string
  tokens_used: number
}

export interface BatchProductResult {
  filename: string
  analysis: string
  success: boolean
  metadata: AnalysisMetadata
  error?: string
}

export interface BatchAnalysisResponse {
  success: boolean
  total_files: number
  processed: number
  results: BatchProductResult[]
  csv_data: string
  timestamp: string
}

export interface AttributeExtractionResponse {
  success: boolean
  filename: string
  attributes: string
  metadata: AnalysisMetadata
  timestamp: string
  tokens_used: number
}

export interface MarketplaceInfo {
  id: string
  name: string
  min_image_width: number
  min_image_height: number
  recommended_image_width?: number
  recommended_image_height?: number
  max_file_size_mb: number
  required_background: string
  aspect_ratio?: string
  allowed_formats: string[]
  forbidden_elements: string[]
  main_image_rules: string[]
  recommendations: string[]
  composition_policy?: Record<ImageUsage, {
    minimum_fill_ratio: number
    recommended_fill_ratio: number
  }>
  sources: Array<{ label: string; url: string }>
  notes?: string
}

export interface MarketplaceListResponse {
  marketplaces: MarketplaceInfo[]
}

// Backward-compatible aliases for older component code.
export type ProductAnalysisResult = ProductAnalysisResponse
export type ComplianceResult = ComplianceCheckResponse

export interface DetectedObject {
  label: string
  confidence: number
  bbox: number[]
  area_ratio: number
}

export interface TextRegion {
  text: string
  confidence: number
  bbox: number[]
  area_ratio: number
}

export interface ObjectDetectionResult {
  total_count: number
  has_watermark: boolean
  has_text_overlay: boolean
  warnings: string[]
  objects: DetectedObject[]
  error?: string
}

export interface TextDetectionResult {
  total_text_regions: number
  has_text: boolean
  combined_text: string
  text_coverage_ratio: number
  warnings: string[]
  regions: TextRegion[]
  error?: string
}

export interface VisionReviewMetadata {
  available?: boolean
  text?: string
  provider?: string
  model?: string
  usage?: TokenUsage
  reason?: string
}

export interface InventoryCheckMetadata extends AnalysisMetadata {
  deterministic?: boolean
  object_detection?: ObjectDetectionResult
  text_detection?: TextDetectionResult
  vision_review?: VisionReviewMetadata
}

export interface QualityResult {
  score: number
  score_normalized: number
  rating: string
  model_id: string
  warning?: string
  error?: string
}

export interface FlorenceResult {
  caption: string
  seo_title: string
  attributes: string[]
  detected_text: string
  model_id: string
  task_prompt: string
  raw_output?: string
  warning?: string
}

export interface UpscaleResult {
  upscale_recommended: boolean
  error?: string
}

export interface UpscaleApplyResult {
  blob: Blob
  modelId: string | null
  applied: boolean
  warning: string | null
}

export interface RelightApplyResult {
  blob: Blob
  modelId: string | null
  maskSource: string | null
  applied: boolean
  warning: string | null
}

export interface OutpaintApplyResult {
  blob: Blob
  modelId: string | null
  direction: string | null
  expansion: number | null
  warning: string | null
}
