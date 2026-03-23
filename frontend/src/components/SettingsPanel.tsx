import { Settings } from 'lucide-react'
import type { Config } from '../api/types'

interface SettingsPanelProps {
  config: Config | null
  customSettings: { provider: string; model: string }
  onSettingsChange: (settings: { provider: string; model: string }) => void
}

export function SettingsPanel({ config, customSettings, onSettingsChange }: SettingsPanelProps) {
  return (
    <>
      <div className="hero-header-row">
        <div className="hero-icon-inline"><Settings /></div>
        <div className="hero-text-col">
          <h1 className="hero-title">Settings</h1>
          <p className="hero-subtitle">Configure your Vision Agent preferences</p>
        </div>
      </div>

      <div className="settings-panel">
        <div className="setting-item">
          <label>Provider</label>
          <select
            className="setting-input"
            value={customSettings.provider}
            onChange={(e) => onSettingsChange({ ...customSettings, provider: e.target.value })}
          >
            <option value="">Default ({config?.provider})</option>
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
            <option value="google">Google Gemini</option>
            <option value="ollama">Ollama (Local)</option>
          </select>
        </div>
        <div className="setting-item">
          <label>Model Name</label>
          <input
            type="text"
            className="setting-input"
            placeholder={config?.model || 'e.g., gpt-4o, llama3'}
            value={customSettings.model}
            onChange={(e) => onSettingsChange({ ...customSettings, model: e.target.value })}
          />
        </div>
        <div className="setting-info">
          Leave blank to use default settings from <code>.env</code> file.
          <br />Supported providers: openai, anthropic, google, ollama, azure
        </div>
      </div>
    </>
  )
}
