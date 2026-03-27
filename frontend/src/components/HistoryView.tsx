import {
  File, Clipboard, FileJson, FileSpreadsheet,
  FileText, Trash2, Clock3, Bot, Coins, Archive, Layers3,
} from 'lucide-react'
import type { HistoryItem } from '../api/types'
import {
  exportCSV,
  exportHistoryCSV,
  exportHistoryJSON,
  exportHistoryMarkdown,
  exportJSON,
  exportMarkdown,
} from '../utils/export'

function getUsageTokens(item: HistoryItem): number {
  return item.metadata.usage?.total_tokens ?? 0
}

function getAnalysisPreview(item: HistoryItem): string {
  const preview = item.analysis.replace(/\s+/g, ' ').trim()
  if (!preview) {
    return 'No saved analysis preview available.'
  }

  return preview.length > 180 ? `${preview.slice(0, 180)}...` : preview
}

function isUrlLikeFilename(value: string): boolean {
  return /^https?:\/\//i.test(value.trim())
}

function getRunTypeLabel(item: HistoryItem): string {
  const filename = item.filename.toLowerCase()

  if (filename.startsWith('http://') || filename.startsWith('https://')) {
    return 'Listing Review'
  }

  if (filename.endsWith('.pdf')) {
    return 'Document Analysis'
  }

  if (item.filename.includes(' vs ') || item.analysis.toLowerCase().includes('competitor')) {
    return 'Comparison'
  }

  if (item.analysis.toLowerCase().includes('compliance')) {
    return 'Compliance'
  }

  return 'Product Analysis'
}

function getProviderLabel(item: HistoryItem): string | null {
  const provider = typeof item.metadata.provider === 'string' ? item.metadata.provider.trim() : ''
  return provider && provider.toLowerCase() !== 'n/a' ? provider : null
}

function getModelLabel(item: HistoryItem): string | null {
  const model = typeof item.metadata.model === 'string' ? item.metadata.model.trim() : ''
  return model && model.toLowerCase() !== 'n/a' ? model : null
}

interface HistoryViewProps {
  history: HistoryItem[]
  totalTokens: number
  uniqueFiles: number
  onClear: () => void
}

export function HistoryView({ history, totalTokens, uniqueFiles, onClear }: HistoryViewProps) {
  return (
    <>
      <div className="hero-header-row hero-header-stacked">
        <span className="hero-kicker">Past runs</span>
        <h1 className="hero-title hero-title-inline">Run History</h1>
        <p className="hero-subtitle hero-subtitle-inline">Past runs and exports</p>
      </div>

      {history.length === 0 ? (
        <div className="history-empty-state">
          <div className="history-empty-icon"><Archive size={24} /></div>
          <span className="history-empty-kicker">Archive Ready</span>
          <strong>No runs saved yet</strong>
          <p>Run Product Workspace, Compliance, or Additional Tools to start building an exportable archive.</p>
          <div className="history-empty-hints">
            <div className="history-empty-hint-card">
              <span className="history-empty-hint-label">Product Workspace</span>
              <strong>Save listing runs</strong>
            </div>
            <div className="history-empty-hint-card">
              <span className="history-empty-hint-label">Compliance</span>
              <strong>Keep audit results</strong>
            </div>
            <div className="history-empty-hint-card">
              <span className="history-empty-hint-label">Exports</span>
              <strong>Build a reusable archive</strong>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="fix-session-strip history-session-strip">
            <div className="fix-session-strip-main">
              <div>
                <span className="fix-workspace-label">Archive Session</span>
                <strong>{history.length} saved runs ready for export</strong>
              </div>
            </div>

            <div className="fix-session-strip-stats">
              <div className="fix-session-pill">
                <span className="fix-workspace-label">Runs</span>
                <strong>{history.length}</strong>
              </div>
              <div className="fix-session-pill">
                <span className="fix-workspace-label">Tokens</span>
                <strong>{totalTokens.toLocaleString()}</strong>
              </div>
              <div className="fix-session-pill">
                <span className="fix-workspace-label">Files</span>
                <strong>{uniqueFiles}</strong>
              </div>
            </div>
          </div>

          <div className="export-section compact-export-section history-export-panel">
            <div className="compact-section-heading">
              <div>
                <h3>Export History</h3>
                <p>Download the full run archive or clear old entries.</p>
              </div>
            </div>
            <div className="results-actions compact-results-actions">
              <button className="action-btn" onClick={() => exportHistoryJSON(history)}><FileJson size={16} /> Export All (JSON)</button>
              <button className="action-btn" onClick={() => exportHistoryCSV(history)}><FileSpreadsheet size={16} /> Export All (CSV)</button>
              <button className="action-btn" onClick={() => exportHistoryMarkdown(history)}><FileText size={16} /> Export All (MD)</button>
              <button className="action-btn subtle-danger" onClick={onClear}><Trash2 size={16} /> Clear History</button>
            </div>
          </div>

          <div className="history-list">
            {history.map(item => {
              const providerLabel = getProviderLabel(item)
              const modelLabel = getModelLabel(item)
              const usageTokens = getUsageTokens(item)

              return (
                <div key={item.id} className="history-item">
                  <div className="history-item-header">
                    <div className="history-title-block">
                      <div className="history-entry-labels">
                        <span className="history-entry-chip"><Layers3 size={12} /> {getRunTypeLabel(item)}</span>
                      </div>
                      <span
                        className={`history-filename${isUrlLikeFilename(item.filename) ? ' history-filename-linkish' : ''}`}
                        title={item.filename}
                      >
                        <File size={16} /> {item.filename}
                      </span>
                      <div className="history-item-meta history-item-meta-compact">
                        {providerLabel && (
                          <span className="history-meta-chip"><Bot size={13} /> {providerLabel}</span>
                        )}
                        {modelLabel && (
                          <span className="history-meta-chip">{modelLabel}</span>
                        )}
                        {usageTokens > 0 && (
                          <span className="history-meta-chip"><Coins size={13} /> {usageTokens} tokens</span>
                        )}
                      </div>
                    </div>
                    <span className="history-timestamp"><Clock3 size={13} /> {new Date(item.timestamp).toLocaleString()}</span>
                  </div>
                  <div className="history-item-analysis">
                    <span className="history-analysis-label">Saved Preview</span>
                    <p>{getAnalysisPreview(item)}</p>
                  </div>
                  <div className="history-item-actions">
                    <button className="action-btn-small" onClick={() => navigator.clipboard.writeText(item.analysis)}><Clipboard size={14} /> Copy</button>
                    <button className="action-btn-small" onClick={() => exportJSON(item)}><FileJson size={14} /> JSON</button>
                    <button className="action-btn-small" onClick={() => exportCSV(item)}><FileSpreadsheet size={14} /> CSV</button>
                    <button className="action-btn-small" onClick={() => exportMarkdown(item)}><FileText size={14} /> MD</button>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </>
  )
}
