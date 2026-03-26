import {
  File, Clipboard, FileJson, FileSpreadsheet,
  FileText, Trash2, Clock3, Bot, Coins,
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
        <div className="empty-state"><p>No run history yet. Start by running one of the listing or compliance workflows.</p></div>
      ) : (
        <>
          <div className="stats-grid compact-stats-grid">
            <div className="stat-card compact-stat-card">
              <div className="stat-label">Total Runs</div>
              <div className="stat-value">{history.length}</div>
            </div>
            <div className="stat-card compact-stat-card">
              <div className="stat-label">Total Tokens</div>
              <div className="stat-value">{totalTokens.toLocaleString()}</div>
            </div>
            <div className="stat-card compact-stat-card">
              <div className="stat-label">Unique Files</div>
              <div className="stat-value">{uniqueFiles}</div>
            </div>
          </div>

          <div className="export-section compact-export-section">
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
            {history.map(item => (
              <div key={item.id} className="history-item">
                <div className="history-item-header">
                  <div className="history-title-block">
                    <span
                      className={`history-filename${isUrlLikeFilename(item.filename) ? ' history-filename-linkish' : ''}`}
                      title={item.filename}
                    >
                      <File size={16} /> {item.filename}
                    </span>
                    <div className="history-item-meta history-item-meta-compact">
                      <span className="history-meta-chip"><Bot size={13} /> {String(item.metadata.provider || 'N/A')}</span>
                      <span className="history-meta-chip">{String(item.metadata.model || 'N/A')}</span>
                      <span className="history-meta-chip"><Coins size={13} /> {String(getUsageTokens(item))} tokens</span>
                    </div>
                  </div>
                  <span className="history-timestamp"><Clock3 size={13} /> {new Date(item.timestamp).toLocaleString()}</span>
                </div>
                <div className="history-item-analysis">{getAnalysisPreview(item)}</div>
                <div className="history-item-actions">
                  <button className="action-btn-small" onClick={() => navigator.clipboard.writeText(item.analysis)}><Clipboard size={14} /> Copy</button>
                  <button className="action-btn-small" onClick={() => exportJSON(item)}><FileJson size={14} /> JSON</button>
                  <button className="action-btn-small" onClick={() => exportCSV(item)}><FileSpreadsheet size={14} /> CSV</button>
                  <button className="action-btn-small" onClick={() => exportMarkdown(item)}><FileText size={14} /> MD</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  )
}
