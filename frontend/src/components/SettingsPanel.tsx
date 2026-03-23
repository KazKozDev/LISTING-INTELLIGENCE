import { useState, useEffect } from 'react'
import { Settings, CheckCircle, XCircle, Activity } from 'lucide-react'
import type { Config, HealthStatus, UsageStats } from '../api/types'
import { api } from '../api/client'

interface SettingsPanelProps {
  config: Config | null
  customSettings: { provider: string; model: string; apiKey: string }
  onSettingsChange: (settings: { provider: string; model: string; apiKey: string }) => void
}

export function SettingsPanel({ config, customSettings, onSettingsChange }: SettingsPanelProps) {
  const [health, setHealth] = useState<HealthStatus | null>(null)
  const [usage, setUsage] = useState<UsageStats | null>(null)
  const [loadingHealth, setLoadingHealth] = useState(false)

  useEffect(() => {
    fetchStatus()
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

  return (
    <>
      <div className="hero-header-row">
        <div className="hero-icon-inline"><Settings /></div>
        <div className="hero-text-col">
          <h1 className="hero-title">Settings</h1>
          <p className="hero-subtitle">Provider configuration and usage stats</p>
        </div>
      </div>

      {/* Connection Status */}
      <div className="settings-panel">
        <div className="setting-item" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          {loadingHealth ? (
            <span style={{ color: 'var(--text-muted)' }}>Checking connection...</span>
          ) : health ? (
            <>
              {health.provider_connected ? (
                <CheckCircle size={16} style={{ color: '#4ade80' }} />
              ) : (
                <XCircle size={16} style={{ color: '#f87171' }} />
              )}
              <span>
                {health.provider_connected ? 'Connected' : 'Disconnected'} — {health.provider || config?.provider}
              </span>
              <button
                onClick={fetchStatus}
                style={{
                  marginLeft: 'auto', background: 'none', border: '1px solid var(--border)',
                  borderRadius: '6px', padding: '0.3rem 0.6rem', cursor: 'pointer',
                  color: 'var(--text-secondary)', fontSize: '0.75rem',
                }}
              >
                Refresh
              </button>
            </>
          ) : (
            <>
              <XCircle size={16} style={{ color: '#f87171' }} />
              <span>Unable to reach backend</span>
              <button
                onClick={fetchStatus}
                style={{
                  marginLeft: 'auto', background: 'none', border: '1px solid var(--border)',
                  borderRadius: '6px', padding: '0.3rem 0.6rem', cursor: 'pointer',
                  color: 'var(--text-secondary)', fontSize: '0.75rem',
                }}
              >
                Retry
              </button>
            </>
          )}
        </div>
      </div>

      {/* Current Config */}
      <div className="settings-panel" style={{ marginTop: '1rem' }}>
        <h3 style={{ margin: '0 0 0.8rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Current Configuration</h3>
        <div className="setting-item">
          <label>Provider</label>
          <span className="setting-value">{config?.provider || '—'}</span>
        </div>
        <div className="setting-item">
          <label>Model</label>
          <span className="setting-value">{config?.model || '—'}</span>
        </div>
        <div className="setting-item">
          <label>Temperature</label>
          <span className="setting-value">{config?.temperature ?? '—'}</span>
        </div>
        <div className="setting-item">
          <label>Max Tokens</label>
          <span className="setting-value">{config?.max_tokens ?? '—'}</span>
        </div>
      </div>

      {/* Override */}
      <div className="settings-panel" style={{ marginTop: '1rem' }}>
        <h3 style={{ margin: '0 0 0.8rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Override</h3>
        <div className="setting-item">
          <label>Provider</label>
          <select
            className="setting-input"
            value={customSettings.provider}
            onChange={(e) => onSettingsChange({ ...customSettings, provider: e.target.value })}
          >
            <option value="">Default ({config?.provider})</option>
            <option value="ollama">Ollama (Local)</option>
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
            <option value="google">Google Gemini</option>
            <option value="azure">Azure OpenAI</option>
          </select>
        </div>
        <div className="setting-item">
          <label>Model Name</label>
          <input
            type="text"
            className="setting-input"
            placeholder={config?.model || 'e.g., gpt-4o, qwen3-vl:8b'}
            value={customSettings.model}
            onChange={(e) => onSettingsChange({ ...customSettings, model: e.target.value })}
          />
        </div>
        {customSettings.provider && customSettings.provider !== 'ollama' && (
          <div className="setting-item">
            <label>API Key</label>
            <input
              type="password"
              className="setting-input"
              placeholder="sk-..."
              value={customSettings.apiKey}
              onChange={(e) => onSettingsChange({ ...customSettings, apiKey: e.target.value })}
            />
          </div>
        )}
        <div className="setting-info">
          Leave blank to use defaults from <code>.env</code>. Overrides apply to all analysis requests.
        </div>
      </div>

      {/* Usage Stats */}
      {usage && (
        <div className="settings-panel" style={{ marginTop: '1rem' }}>
          <h3 style={{ margin: '0 0 0.8rem', fontSize: '0.9rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Activity size={14} /> Usage Stats
          </h3>
          <div className="setting-item">
            <label>Total Requests</label>
            <span className="setting-value">{usage.total_requests}</span>
          </div>
          <div className="setting-item">
            <label>Total Tokens</label>
            <span className="setting-value">{usage.total_tokens.toLocaleString()}</span>
          </div>
          {Object.entries(usage.by_provider).length > 0 && (
            <div style={{ marginTop: '0.5rem' }}>
              {Object.entries(usage.by_provider).map(([provider, stats]) => (
                <div key={provider} className="setting-item" style={{ paddingLeft: '1rem' }}>
                  <label>{provider}</label>
                  <span className="setting-value">{stats.requests} req / {stats.tokens.toLocaleString()} tokens</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  )
}
