export interface Config {
  provider: string
  model: string
  temperature?: number
  max_tokens?: number
}

export interface AnalysisResult {
  success: boolean
  filename: string
  analysis: string
  metadata: Record<string, unknown>
  timestamp: string
  prompt?: string
  tokens_used?: number
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

// E-Commerce types
export interface ProductAnalysisResult {
  success: boolean
  filename: string
  description: string
  seo_title: string
  seo_tags: string[]
  quality_score: number
  attributes: Record<string, string>
  improvements: string[]
  raw_analysis: string
  metadata: Record<string, unknown>
  timestamp: string
}

export interface ComplianceResult {
  success: boolean
  filename: string
  marketplace: string
  is_compliant: boolean
  issues: string[]
  recommendations: string[]
}

export interface MarketplaceInfo {
  id: string
  name: string
  min_image_width: number
  min_image_height: number
  max_file_size_mb: number
  required_background: string
  forbidden_elements: string[]
}
