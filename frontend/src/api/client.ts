import type { Config, AnalysisResult, UsageStats, HealthStatus, MarketplaceInfo } from './types'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'

class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, options)
  if (!response.ok) {
    const detail = await response.text()
    throw new ApiError(response.status, detail)
  }
  return response.json()
}

function applyOverrides(formData: FormData) {
  try {
    const saved = localStorage.getItem('customSettings')
    if (!saved) return
    const settings = JSON.parse(saved)
    if (settings.provider) formData.append('provider', settings.provider)
    if (settings.model) formData.append('model', settings.model)
    if (settings.apiKey) formData.append('api_key', settings.apiKey)
  } catch { /* ignore */ }
}

export const api = {
  getConfig: () => request<Config>('/config'),

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

  getHealth: () => request<HealthStatus>('/health'),

  getUsage: () => request<UsageStats>('/usage'),

  getMarketplaces: () =>
    request<{ marketplaces: MarketplaceInfo[] }>('/ecommerce/marketplaces'),

  analyzeProduct: (file: File, marketplace: string = 'general') => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('marketplace', marketplace)
    applyOverrides(formData)
    return request<{
      success: boolean; filename: string; analysis: string; marketplace: string
      metadata: Record<string, unknown>; timestamp: string; tokens_used: number
    }>('/ecommerce/analyze-product', { method: 'POST', body: formData })
  },

  checkCompliance: (file: File, marketplace: string) => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('marketplace', marketplace)
    applyOverrides(formData)
    return request<{
      success: boolean; filename: string; marketplace: string; analysis: string
      metadata: Record<string, unknown>; timestamp: string; tokens_used: number
    }>('/ecommerce/compliance-check', { method: 'POST', body: formData })
  },

  generateSeo: (file: File, marketplace: string = 'general', keywords: string = '') => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('marketplace', marketplace)
    formData.append('keywords', keywords)
    applyOverrides(formData)
    return request<{
      success: boolean; filename: string; marketplace: string; seo_content: string
      metadata: Record<string, unknown>; timestamp: string; tokens_used: number
    }>('/ecommerce/generate-seo', { method: 'POST', body: formData })
  },

  batchAnalyzeProducts: (files: File[], marketplace: string = 'general') => {
    const formData = new FormData()
    files.forEach(f => formData.append('files', f))
    formData.append('marketplace', marketplace)
    applyOverrides(formData)
    return request<{
      success: boolean; total_files: number; processed: number
      results: Array<{ filename: string; analysis: string; success: boolean; error?: string; metadata: Record<string, unknown> }>
      csv_data: string; timestamp: string
    }>('/ecommerce/batch-analyze', { method: 'POST', body: formData })
  },

  compareProducts: (productImage: File, competitorImage: File, marketplace: string = 'general') => {
    const formData = new FormData()
    formData.append('product_image', productImage)
    formData.append('competitor_image', competitorImage)
    formData.append('marketplace', marketplace)
    applyOverrides(formData)
    return request<{
      success: boolean; product_filename: string; competitor_filename: string; analysis: string
      marketplace: string; metadata: Record<string, unknown>; timestamp: string; tokens_used: number
    }>('/ecommerce/compare', { method: 'POST', body: formData })
  },

  suggestImprovements: (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    applyOverrides(formData)
    return request<{
      success: boolean; filename: string; analysis: string
      metadata: Record<string, unknown>; timestamp: string; tokens_used: number
    }>('/ecommerce/suggest-improvements', { method: 'POST', body: formData })
  },

  extractAttributes: (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    applyOverrides(formData)
    return request<{
      success: boolean; filename: string; attributes: string
      metadata: Record<string, unknown>; timestamp: string; tokens_used: number
    }>('/ecommerce/extract-attributes', { method: 'POST', body: formData })
  },
}

export { API_URL, ApiError }
