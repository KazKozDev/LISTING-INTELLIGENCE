import type {
  AnalysisResult,
  AttributeExtractionResponse,
  BatchAnalysisResponse,
  CanvasTransformPayload,
  ComplianceCheckResponse,
  ComplianceFixResultResponse,
  ComplianceFixSuggestionsResponse,
  CompetitorCompareResponse,
  Config,
  CustomSettings,
  HealthStatus,
  MarketplaceListResponse,
  ModelListResponse,
  FlorenceResult,
  ObjectDetectionResult,
  OutpaintApplyResult,
  ProductAnalysisResponse,
  QualityResult,
  RelightApplyResult,
  SEOGenerationResponse,
  TextDetectionResult,
  UpscaleApplyResult,
  UpscaleResult,
  UsageStats,
} from './types'
import { loadCustomSettings } from '../utils/customSettings'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'
const DEFAULT_REQUEST_TIMEOUT_MS = 5 * 60 * 1000

class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), DEFAULT_REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      signal: controller.signal,
    })
    if (!response.ok) {
      const detail = await response.text()
      throw new ApiError(response.status, detail)
    }
    return response.json()
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError(
        504,
        'The request took too long and was stopped. Check provider/model availability and try again.',
      )
    }
    throw error
  } finally {
    window.clearTimeout(timeoutId)
  }
}

function applyOverrides(formData: FormData) {
  try {
    const settings: CustomSettings = loadCustomSettings()
    if (settings.provider) formData.append('provider', settings.provider)
    if (settings.model) formData.append('model', settings.model)
    if (settings.apiKey) formData.append('api_key', settings.apiKey)
    if (settings.baseUrl) formData.append('base_url', settings.baseUrl)
  } catch { /* ignore */ }
}

export const api = {
  getConfig: () => request<Config>('/config'),

  getModels: (provider: string, apiKey?: string, baseUrl?: string) => {
    const params = new URLSearchParams({ provider })
    if (apiKey) params.set('api_key', apiKey)
    if (baseUrl) params.set('base_url', baseUrl)
    return request<ModelListResponse>(
      `/models?${params.toString()}`
    )
  },

  analyze: (
    file: File,
    prompt: string,
    options?: { templateKey?: string; provider?: string; model?: string }
  ) => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('prompt', prompt)
    if (options?.templateKey) formData.append('template_key', options.templateKey)
    if (options?.provider) formData.append('provider', options.provider)
    if (options?.model) formData.append('model', options.model)
    applyOverrides(formData)
    return request<AnalysisResult>('/analyze', { method: 'POST', body: formData })
  },

  analyzeListing: (
    sourceMode: 'url' | 'manual',
    options: { listingUrl?: string; listingText?: string; prompt?: string; templateKey?: string; provider?: string; model?: string }
  ) => {
    const formData = new FormData()
    formData.append('source_mode', sourceMode)
    if (options.listingUrl) formData.append('listing_url', options.listingUrl)
    if (options.listingText) formData.append('listing_text', options.listingText)
    if (options.prompt) formData.append('prompt', options.prompt)
    if (options.templateKey) formData.append('template_key', options.templateKey)
    if (options.provider) formData.append('provider', options.provider)
    if (options.model) formData.append('model', options.model)
    applyOverrides(formData)
    return request<AnalysisResult>('/ecommerce/analyze-listing', { method: 'POST', body: formData })
  },

  getHealth: () => request<HealthStatus>('/health'),

  getUsage: () => request<UsageStats>('/usage'),

  getMarketplaces: () =>
    request<MarketplaceListResponse>('/ecommerce/marketplaces'),

  analyzeProduct: (file: File, marketplace: string = 'general') => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('marketplace', marketplace)
    applyOverrides(formData)
    return request<ProductAnalysisResponse>('/ecommerce/analyze-product', { method: 'POST', body: formData })
  },

  analyzeProductFull: (file: File, marketplace: string = 'general', keywords: string = '') => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('marketplace', marketplace)
    if (keywords) formData.append('keywords', keywords)
    applyOverrides(formData)
    return request<ProductAnalysisResponse>('/ecommerce/analyze-product-full', { method: 'POST', body: formData })
  },

  checkCompliance: (file: File, marketplace: string) => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('marketplace', marketplace)
    applyOverrides(formData)
    return request<ComplianceCheckResponse>('/ecommerce/compliance-check', { method: 'POST', body: formData })
  },

  suggestComplianceFixes: (file: File, marketplace: string) => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('marketplace', marketplace)
    return request<ComplianceFixSuggestionsResponse>('/ecommerce/compliance-fix/suggestions', { method: 'POST', body: formData })
  },

  applyComplianceFix: (
    file: File,
    marketplace: string,
    action: string,
    transformPayload?: CanvasTransformPayload,
  ) => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('marketplace', marketplace)
    formData.append('action', action)
    if (transformPayload) {
      formData.append('transform_payload', JSON.stringify(transformPayload))
    }
    applyOverrides(formData)
    return request<ComplianceFixResultResponse>('/ecommerce/compliance-fix/apply', { method: 'POST', body: formData })
  },

  generateSeo: (file: File, marketplace: string = 'general', keywords: string = '') => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('marketplace', marketplace)
    formData.append('keywords', keywords)
    applyOverrides(formData)
    return request<SEOGenerationResponse>('/ecommerce/generate-seo', { method: 'POST', body: formData })
  },

  batchAnalyzeProducts: (files: File[], marketplace: string = 'general', keywords: string = '') => {
    const formData = new FormData()
    files.forEach(f => formData.append('files', f))
    formData.append('marketplace', marketplace)
    if (keywords) formData.append('keywords', keywords)
    applyOverrides(formData)
    return request<BatchAnalysisResponse>('/ecommerce/batch-analyze', { method: 'POST', body: formData })
  },

  compareProducts: (productImage: File, competitorImage: File, marketplace: string = 'general') => {
    const formData = new FormData()
    formData.append('product_image', productImage)
    formData.append('competitor_image', competitorImage)
    formData.append('marketplace', marketplace)
    applyOverrides(formData)
    return request<CompetitorCompareResponse>('/ecommerce/compare', { method: 'POST', body: formData })
  },

  suggestImprovements: (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    applyOverrides(formData)
    return request<AnalysisResult>('/ecommerce/suggest-improvements', { method: 'POST', body: formData })
  },

  inventoryCheck: (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return request<AnalysisResult>('/ecommerce/inventory-check', { method: 'POST', body: formData })
  },

  extractAttributes: (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    applyOverrides(formData)
    return request<AttributeExtractionResponse>('/ecommerce/extract-attributes', { method: 'POST', body: formData })
  },

  qualityScore: (file: File) => {
    const formData = new FormData()
    formData.append('image', file)
    return request<QualityResult>('/image-intelligence/quality', { method: 'POST', body: formData })
  },

  objectDetection: (file: File) => {
    const formData = new FormData()
    formData.append('image', file)
    return request<ObjectDetectionResult>('/image-intelligence/objects', { method: 'POST', body: formData })
  },

  textDetection: (file: File) => {
    const formData = new FormData()
    formData.append('image', file)
    return request<TextDetectionResult>('/image-intelligence/text', { method: 'POST', body: formData })
  },

  florenceAnalyze: (file: File) => {
    const formData = new FormData()
    formData.append('image', file)
    return request<FlorenceResult>('/image-intelligence/florence', { method: 'POST', body: formData })
  },

  upscaleCheck: (file: File) => {
    const formData = new FormData()
    formData.append('image', file)
    return request<UpscaleResult>('/image-intelligence/upscale', { method: 'POST', body: formData })
  },

  icLightRelightApply: async (
    file: File,
    options?: { prompt?: string; lightDirection?: 'none' | 'left' | 'right' | 'top' | 'bottom' },
  ): Promise<RelightApplyResult> => {
    const formData = new FormData()
    formData.append('image', file)
    if (options?.prompt) formData.append('prompt', options.prompt)
    formData.append('light_direction', options?.lightDirection ?? 'none')

    const response = await fetch(`${API_URL}/image-intelligence/relight/apply`, {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      const detail = await response.text()
      throw new ApiError(response.status, detail || 'Relight failed')
    }

    return {
      blob: await response.blob(),
      modelId: response.headers.get('X-Relight-Model'),
      maskSource: response.headers.get('X-Relight-Mask-Source'),
      applied: response.headers.get('X-Relight-Applied') !== 'false',
      warning: response.headers.get('X-Relight-Warning'),
    }
  },

  outpaintApply: async (
    file: File,
    options?: {
      direction?: 'left' | 'right' | 'top' | 'bottom'
      expandRatio?: number
      prompt?: string
    },
  ): Promise<OutpaintApplyResult> => {
    const formData = new FormData()
    formData.append('image', file)
    formData.append('direction', options?.direction ?? 'right')
    formData.append('expand_ratio', String(options?.expandRatio ?? 0.25))
    if (options?.prompt) formData.append('prompt', options.prompt)

    const response = await fetch(`${API_URL}/image-intelligence/outpaint/apply`, {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      const detail = await response.text()
      throw new ApiError(response.status, detail || 'Outpaint failed')
    }

    const expansionHeader = response.headers.get('X-Outpaint-Expansion')

    return {
      blob: await response.blob(),
      modelId: response.headers.get('X-Outpaint-Model'),
      direction: response.headers.get('X-Outpaint-Direction'),
      expansion: expansionHeader ? Number(expansionHeader) : null,
      warning: response.headers.get('X-Outpaint-Warning'),
    }
  },

  upscaleApply: async (file: File): Promise<UpscaleApplyResult> => {
    const formData = new FormData()
    formData.append('image', file)
    const response = await fetch(`${API_URL}/image-intelligence/upscale/apply`, {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      const detail = await response.text()
      throw new ApiError(response.status, detail || 'Upscale failed')
    }

    return {
      blob: await response.blob(),
      modelId: response.headers.get('X-Upscale-Model'),
      applied: response.headers.get('X-Upscale-Applied') !== 'false',
      warning: response.headers.get('X-Upscale-Warning'),
    }
  },

  textEraseApply: (file: File, regions: number[][]): Promise<Blob> => {
    const formData = new FormData()
    formData.append('image', file)
    formData.append('regions', JSON.stringify(regions))

    return fetch('http://localhost:8000/api/image-intelligence/erase', {
      method: 'POST',
      body: formData,
    }).then(res => {
      if (!res.ok) throw new Error('Erase failed')
      return res.blob()
    })
  },
}

export { API_URL, ApiError }
