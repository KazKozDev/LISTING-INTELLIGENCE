import type { CustomSettings } from '../api/types'

const CUSTOM_SETTINGS_KEY = 'customSettings'

export const DEFAULT_BASE_URL_BY_PROVIDER: Record<string, string> = {
  ollama: 'http://localhost:11434',
  openai: 'https://api.openai.com/v1',
  grok: 'https://api.x.ai/v1',
  groq: 'https://api.groq.com/openai/v1',
  anthropic: 'https://api.anthropic.com',
  google: 'https://generativelanguage.googleapis.com',
  azure: 'https://your-resource.openai.azure.com',
}

export const defaultCustomSettings: CustomSettings = {
  provider: '',
  model: '',
  apiKey: '',
  baseUrl: '',
}

export function getDefaultBaseUrl(provider: string): string {
  return DEFAULT_BASE_URL_BY_PROVIDER[provider] ?? ''
}

function normalizeBaseUrl(provider: string, baseUrl: string): string {
  const trimmedBaseUrl = baseUrl.trim()

  if (!provider) {
    return trimmedBaseUrl
  }

  const providerDefaultBaseUrl = getDefaultBaseUrl(provider)
  if (!trimmedBaseUrl) {
    return providerDefaultBaseUrl
  }

  const knownDefaultUrls = new Set(Object.values(DEFAULT_BASE_URL_BY_PROVIDER))
  if (
    knownDefaultUrls.has(trimmedBaseUrl)
    && trimmedBaseUrl !== providerDefaultBaseUrl
  ) {
    return providerDefaultBaseUrl
  }

  return trimmedBaseUrl
}

export function loadCustomSettings(): CustomSettings {
  try {
    const saved = localStorage.getItem(CUSTOM_SETTINGS_KEY)
    if (!saved) return defaultCustomSettings

    const parsed = JSON.parse(saved) as Partial<CustomSettings>
    const provider = parsed.provider ?? ''
    return {
      provider,
      model: parsed.model ?? '',
      apiKey: parsed.apiKey ?? '',
      baseUrl: normalizeBaseUrl(provider, parsed.baseUrl ?? ''),
    }
  } catch {
    return defaultCustomSettings
  }
}

export function saveCustomSettings(settings: CustomSettings): void {
  localStorage.setItem(CUSTOM_SETTINGS_KEY, JSON.stringify(settings))
}