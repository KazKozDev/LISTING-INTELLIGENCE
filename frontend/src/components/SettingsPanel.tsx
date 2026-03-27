import { useState, useEffect, useRef, useCallback } from 'react'
import { CheckCircle, XCircle, Activity, ChevronDown, Loader2, Gauge, KeyRound, Server } from 'lucide-react'
import type { Config, CustomSettings, HealthStatus, UsageStats } from '../api/types'
import { api } from '../api/client'
import { getDefaultBaseUrl } from '../utils/customSettings'

const FALLBACK_MODELS_BY_PROVIDER: Record<string, string[]> = {
  openai: ['gpt-4o', 'gpt-4.1', 'gpt-4.1-mini', 'gpt-4o-mini'],
  groq: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'],
  anthropic: ['claude-sonnet-4-20250514', 'claude-haiku-4-20250414', 'claude-3-5-sonnet-20241022'],
  google: ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-1.0-pro-vision'],
}

const PROVIDERS_REQUIRING_API_KEY = new Set([
  'openai',
  'grok',
  'groq',
  'anthropic',
  'google',
  'azure',
])

const PROVIDERS_SUPPORTING_BASE_URL = new Set([
  'ollama',
  'openai',
  'grok',
  'groq',
  'anthropic',
  'google',
  'azure',
])

interface SettingsPanelProps {
  config: Config | null
  customSettings: CustomSettings
  onSettingsChange: (settings: CustomSettings) => void
}

const FIX_STUDIO_MODEL_STACK = [
  {
    area: 'Compliance Re-checks',
    model: 'active-provider-model',
    role: 'Active provider and model used to compare the source image with the repaired result before export.',
  },
  {
    area: 'Foreground Masking',
    model: 'ZhengPeng7/BiRefNet / RMBG family',
    role: 'Extracts the product mask for auto-center and relight flows.',
  },
  {
    area: 'Object Detection',
    model: 'yolo11n.pt',
    role: 'Finds watermark-like objects and overlay artifacts before cleanup.',
  },
  {
    area: 'Text Detection',
    model: 'EasyOCR',
    role: 'Detects text regions that are passed into the cleanup stage.',
  },
  {
    area: 'Visual Analysis Assist',
    model: 'microsoft/Florence-2-base',
    role: 'Provides local captioning and OCR support inside the shared image-intelligence stack.',
  },
  {
    area: 'Inpainting Cleanup',
    model: 'LaMa',
    role: 'Removes detected text, watermarks, and small artifacts.',
  },
  {
    area: 'Studio Relight',
    model: 'IC-Light + Stable Diffusion v1.5',
    role: 'Rebuilds cleaner studio lighting and soft contact shadows.',
  },
  {
    area: 'Generative Expand',
    model: 'runwayml/stable-diffusion-inpainting',
    role: 'Extends the canvas in Fix Studio and fills the new area with outpainting.',
  },
  {
    area: 'Neural Upscale',
    model: 'RealESRGAN_x4plus',
    role: 'Upscales low-resolution images before export when needed.',
  },
] as const

export function SettingsPanel({ config, customSettings, onSettingsChange }: SettingsPanelProps) {
  const [health, setHealth] = useState<HealthStatus | null>(null)
  const [usage, setUsage] = useState<UsageStats | null>(null)
  const [loadingHealth, setLoadingHealth] = useState(false)

  // Model dropdown state
  const [modelList, setModelList] = useState<string[]>([])
  const [modelsLoading, setModelsLoading] = useState(false)
  const [modelsError, setModelsError] = useState('')
  const [showModels, setShowModels] = useState(false)
  const [modelFilter, setModelFilter] = useState('')
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 0 })
  const modelCache = useRef<Record<string, string[]>>({})
  const dropdownRef = useRef<HTMLDivElement>(null)
  const fieldRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchStatus()
  }, [])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowModels(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const fetchStatus = async () => {
    setLoadingHealth(true)
    try {
      const [h, u] = await Promise.all([api.getHealth(), api.getUsage()])
      setHealth(h)
      setUsage(u)
    } catch {
      // silent — show as disconnected
    } finally {
      setLoadingHealth(false)
    }
  }

  const defaultProvider = config?.provider || 'ollama'
  const requestProvider = customSettings.provider || defaultProvider
  const requestModel = customSettings.model || config?.model || 'Default model'
  const connectionProvider = health?.provider || defaultProvider
  const providerOverrideActive = Boolean(customSettings.provider)
  const modelOverrideActive = Boolean(customSettings.model)
  const trimmedApiKey = customSettings.apiKey.trim()
  const trimmedBaseUrl = customSettings.baseUrl.trim()
  const providerNeedsApiKey = PROVIDERS_REQUIRING_API_KEY.has(requestProvider)
  const providerSupportsBaseUrl = PROVIDERS_SUPPORTING_BASE_URL.has(requestProvider)
  const defaultBaseUrl = getDefaultBaseUrl(requestProvider)

  const fetchModels = useCallback(async () => {
    const fallbackModels = FALLBACK_MODELS_BY_PROVIDER[requestProvider] || []

    // Use cache if available
    const cacheKey = `${requestProvider}:${trimmedApiKey}:${trimmedBaseUrl}`
    if (modelCache.current[cacheKey]) {
      setModelList(modelCache.current[cacheKey])
      setModelsError('')
      return
    }

    setModelsLoading(true)
    setModelsError('')
    try {
      const res = await api.getModels(
        requestProvider,
        trimmedApiKey || undefined,
        trimmedBaseUrl || undefined,
      )
      const liveModels = res.models || []

      if (liveModels.length > 0) {
        modelCache.current[cacheKey] = liveModels
        setModelList(liveModels)
      } else {
        setModelList(fallbackModels)
      }

      if (res.error) {
        setModelsError(res.error)
      } else if (liveModels.length === 0 && fallbackModels.length > 0) {
        setModelsError('Using fallback model list until live models are available.')
      }
    } catch {
      setModelsError(
        fallbackModels.length > 0
          ? 'Failed to load live models. Showing fallback list.'
          : 'Failed to load models'
      )
      setModelList(fallbackModels)
    } finally {
      setModelsLoading(false)
    }
  }, [requestProvider, trimmedApiKey, trimmedBaseUrl])

  useEffect(() => {
    const fallbackModels = FALLBACK_MODELS_BY_PROVIDER[requestProvider] || []

    if (providerNeedsApiKey && !trimmedApiKey) {
      setModelList(fallbackModels)
      setModelsError('Enter API key to load models.')
      return
    }

    if (fallbackModels.length > 0) {
      setModelList(fallbackModels)
    }

    void fetchModels()
  }, [requestProvider, trimmedApiKey, trimmedBaseUrl, providerNeedsApiKey, fetchModels])

  const handleModelFieldClick = () => {
    if (fieldRef.current) {
      const rect = fieldRef.current.getBoundingClientRect()
      setDropdownPos({ top: rect.bottom + 4, left: rect.left, width: rect.width })
    }
    setShowModels(true)
    setModelFilter('')
    fetchModels()
  }

  const selectModel = (model: string) => {
    onSettingsChange({ ...customSettings, model })
    setShowModels(false)
  }

  const handleProviderChange = (provider: string) => {
    onSettingsChange({
      ...customSettings,
      provider,
      baseUrl: provider ? getDefaultBaseUrl(provider) : '',
    })
  }

  // Reset model cache when provider changes
  useEffect(() => {
    setModelList(FALLBACK_MODELS_BY_PROVIDER[requestProvider] || [])
    setShowModels(false)
  }, [customSettings.provider, requestProvider])

  const connectionState = loadingHealth ? 'Checking' : health?.provider_connected ? 'Connected' : 'Disconnected'
  const refreshLabel = health ? 'Refresh' : 'Retry'

  return (
    <>
      <div className="hero-header-row hero-header-stacked">
        <span className="hero-kicker">System controls</span>
        <h1 className="hero-title hero-title-inline">Settings</h1>
        <p className="hero-subtitle hero-subtitle-inline">Configure models and providers</p>
      </div>

      <div className="settings-overview-grid">
        <div className="settings-summary-card status-card">
          <div className="settings-summary-label">Connection</div>
          <div className="settings-summary-value status-value-row">
            {loadingHealth ? (
              <Loader2 size={16} className="spinning settings-status-icon pending" />
            ) : health?.provider_connected ? (
              <CheckCircle size={16} className="settings-status-icon ok" />
            ) : (
              <XCircle size={16} className="settings-status-icon error" />
            )}
            <span>{connectionState}</span>
          </div>
          <div className="settings-summary-note">Health check via {connectionProvider}</div>
        </div>

        <div className="settings-summary-card">
          <div className="settings-summary-label">Request Provider</div>
          <div className="settings-summary-value">{requestProvider}</div>
          <div className="settings-summary-note">
            {providerOverrideActive ? 'Override active for new requests' : `Using backend default (${defaultProvider})`}
          </div>
        </div>

        <div className="settings-summary-card">
          <div className="settings-summary-label">Request Model</div>
          <div className="settings-summary-value truncate-value">{requestModel}</div>
          <div className="settings-summary-note">
            {modelOverrideActive ? 'Override active for new requests' : 'Using backend default model'}
          </div>
        </div>

        <div className="settings-summary-card">
          <div className="settings-summary-label">Requests</div>
          <div className="settings-summary-value">{usage?.total_requests ?? '—'}</div>
          <div className="settings-summary-note">{usage ? `${usage.total_tokens.toLocaleString()} total tokens` : 'Usage not loaded yet'}</div>
        </div>
      </div>

      <div className="settings-panel compact-settings-panel settings-panel-wide settings-primary-panel">
        <div className="settings-panel-header">
          <div>
            <h3>Request Overrides</h3>
            <p>Set provider and model overrides for future analyses.</p>
            <p className="settings-inline-note">
              Vision model required.
            </p>
          </div>
          <div className="settings-panel-badge accent">Primary</div>
        </div>

        <div className="settings-form-grid">
          <div className="setting-field-group">
            <label>Provider</label>
            <select
              className="setting-input"
              value={customSettings.provider}
              onChange={(e) => handleProviderChange(e.target.value)}
            >
              <option value="">Default ({config?.provider})</option>
              <option value="ollama">Ollama (Local)</option>
              <option value="openai">OpenAI</option>
              <option value="grok">xAI Grok</option>
              <option value="groq">Groq</option>
              <option value="anthropic">Anthropic</option>
              <option value="google">Google Gemini</option>
              <option value="azure">Azure OpenAI</option>
            </select>
          </div>

          {customSettings.provider && customSettings.provider !== 'ollama' && (
            <div className="setting-field-group setting-field-group-wide">
              <label>API Key</label>
              <div className="settings-input-with-icon">
                <KeyRound size={14} />
                <input
                  type="password"
                  className="setting-input"
                  placeholder="sk-..."
                  value={customSettings.apiKey}
                  onChange={(e) => onSettingsChange({ ...customSettings, apiKey: e.target.value })}
                />
              </div>
            </div>
          )}

          {providerSupportsBaseUrl && (
            <div className="setting-field-group setting-field-group-wide">
              <label>Base URL</label>
              <div className="settings-input-with-icon">
                <Server size={14} />
                <input
                  type="text"
                  className="setting-input"
                  placeholder={defaultBaseUrl || 'https://api.example.com'}
                  value={customSettings.baseUrl}
                  onChange={(e) => onSettingsChange({ ...customSettings, baseUrl: e.target.value })}
                />
              </div>
            </div>
          )}

          <div className="setting-field-group">
            <label>Model</label>
            <div className="model-select-wrapper" ref={dropdownRef}>
              <div className="model-select-field" ref={fieldRef} onClick={handleModelFieldClick}>
                <input
                  type="text"
                  className="model-select-input"
                  placeholder={providerNeedsApiKey && !trimmedApiKey ? 'Enter API key to load models...' : (config?.model || 'Click to load models...')}
                  value={showModels ? modelFilter : customSettings.model}
                  onChange={(e) => {
                    if (showModels) {
                      setModelFilter(e.target.value)
                    } else {
                      onSettingsChange({ ...customSettings, model: e.target.value })
                    }
                  }}
                  onFocus={handleModelFieldClick}
                />
                {modelsLoading ? (
                  <Loader2 size={14} className="model-select-icon spinning" />
                ) : (
                  <ChevronDown size={14} className="model-select-icon" />
                )}
              </div>
              {showModels && (
                <div
                  className="model-dropdown"
                  style={{ top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width }}
                >
                  {modelsLoading ? (
                    <div className="model-dropdown-item model-dropdown-info">Loading models...</div>
                  ) : modelsError && modelList.length === 0 ? (
                    <div className="model-dropdown-item model-dropdown-error">{modelsError}</div>
                  ) : modelList.length === 0 ? (
                    <div className="model-dropdown-item model-dropdown-info">No models found</div>
                  ) : (
                    modelList
                      .filter(m => !modelFilter || m.toLowerCase().includes(modelFilter.toLowerCase()))
                      .map(m => (
                        <div
                          key={m}
                          className={`model-dropdown-item${customSettings.model === m ? ' selected' : ''}`}
                          onClick={() => selectModel(m)}
                        >
                          {m}
                        </div>
                      ))
                  )}
                </div>
              )}
            </div>
            {modelsError && (
              <div className="settings-field-note">{modelsError}</div>
            )}
          </div>
        </div>

        <div className="setting-info compact-setting-info">
          Leave blank to use backend defaults. Health status can still show the default provider even when a request override is selected here.
        </div>
      </div>

      <div className="settings-layout-grid">
        <div className="settings-panel compact-settings-panel">
          <div className="settings-panel-header">
            <div>
              <h3>System Status</h3>
              <p>Quick health and backend reachability check.</p>
            </div>
            <button className="settings-refresh-btn" onClick={fetchStatus}>{refreshLabel}</button>
          </div>

          <div className="settings-stack">
            <div className="settings-row-card">
              <div className="settings-row-copy">
                <span className="settings-row-label"><Server size={14} /> Backend</span>
                <span className="settings-row-value">{health ? `${connectionState} with ${connectionProvider}` : 'Unable to reach backend'}</span>
              </div>
            </div>

            <div className="settings-row-card">
              <div className="settings-row-copy">
                <span className="settings-row-label"><Gauge size={14} /> Usage Snapshot</span>
                <span className="settings-row-value">
                  {usage ? `${usage.total_requests} requests / ${usage.total_tokens.toLocaleString()} tokens` : 'Usage will appear after the first request'}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="settings-panel compact-settings-panel">
          <div className="settings-panel-header">
            <div>
              <h3>Default Configuration</h3>
              <p>Base values loaded from backend config and environment.</p>
            </div>
            <div className="settings-panel-badge">Read-only</div>
          </div>

          <div className="settings-stack">
            <div className="settings-row-card split">
              <div className="settings-row-copy">
                <span className="settings-row-label">Provider</span>
                <span className="settings-row-value monospace-value">{config?.provider || '—'}</span>
              </div>
              <div className="settings-row-copy">
                <span className="settings-row-label">Model</span>
                <span className="settings-row-value monospace-value">{config?.model || '—'}</span>
              </div>
            </div>

            <div className="settings-row-card split">
              <div className="settings-row-copy">
                <span className="settings-row-label">Temperature</span>
                <span className="settings-row-value">{config?.temperature ?? '—'}</span>
              </div>
              <div className="settings-row-copy">
                <span className="settings-row-label">Max Tokens</span>
                <span className="settings-row-value">{config?.max_tokens ?? '—'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {usage && (
        <div className="settings-panel compact-settings-panel settings-panel-wide settings-panel-usage">
          <div className="settings-panel-header">
            <div>
              <h3><Activity size={15} /> Usage Stats</h3>
              <p>Track request volume and token consumption by provider.</p>
            </div>
          </div>

          <div className="settings-usage-grid">
            <div className="settings-row-card">
              <div className="settings-row-copy">
                <span className="settings-row-label">Total Requests</span>
                <span className="settings-row-value">{usage.total_requests}</span>
              </div>
            </div>
            <div className="settings-row-card">
              <div className="settings-row-copy">
                <span className="settings-row-label">Total Tokens</span>
                <span className="settings-row-value">{usage.total_tokens.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {Object.entries(usage.by_provider).length > 0 && (
            <div className="settings-provider-usage-list">
              {Object.entries(usage.by_provider).map(([provider, stats]) => (
                <div key={provider} className="settings-provider-usage-card">
                  <span className="settings-provider-name">{provider}</span>
                  <span className="settings-provider-stats">{stats.requests} req</span>
                  <span className="settings-provider-stats">{stats.tokens.toLocaleString()} tokens</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="settings-panel compact-settings-panel settings-panel-wide settings-panel-reference">
          <div className="settings-panel-header">
            <div>
              <h3>Fix Studio Neural Stack</h3>
              <p>Reference stack used behind Fix Studio.</p>
            </div>
            <div className="settings-panel-badge">Reference</div>
          </div>

          <div className="settings-stack">
            {FIX_STUDIO_MODEL_STACK.map((entry) => (
              <div key={entry.area} className="settings-row-card split">
                <div className="settings-row-copy">
                  <span className="settings-row-label">{entry.area}</span>
                  <span className={`settings-row-value ${entry.model === 'active-provider-model' ? 'monospace-value settings-row-value-soft' : 'settings-row-value-soft'}`}>
                    {entry.model === 'active-provider-model'
                      ? `${requestProvider} / ${requestModel}`
                      : entry.model}
                  </span>
                </div>
                <div className="settings-row-copy">
                  <span className="settings-row-label">Role</span>
                  <span className="settings-row-value settings-row-value-soft">{entry.role}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="setting-info compact-setting-info">
            Fix Studio combines the active vision model for compliance review with local image models for masking, cleanup, relight, expansion, and upscale steps.
          </div>
      </div>
    </>
  )
}
