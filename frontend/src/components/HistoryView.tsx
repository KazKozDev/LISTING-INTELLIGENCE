import {
  History, File, Clipboard, FileJson, FileSpreadsheet,
  FileText, Trash2,
} from 'lucide-react'
import type { HistoryItem } from '../api/types'
import { exportJSON, exportCSV, exportMarkdown } from './ResultsPanel'

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function dateSlug() {
  return new Date().toISOString().slice(0, 10)
}

interface HistoryViewProps {
  history: HistoryItem[]
  totalTokens: number
  uniqueFiles: number
  onClear: () => void
}

export function HistoryView({ history, totalTokens, uniqueFiles, onClear }: HistoryViewProps) {
  const exportAllJSON = () => {
    const blob = new Blob([JSON.stringify(history, null, 2)], { type: 'application/json' })
    downloadBlob(blob, `all_analyses_${dateSlug()}.json`)
  }

  const exportAllCSV = () => {
    let csv = 'Filename,Timestamp,Task,Analysis,Model,Provider,Tokens\n'
    history.forEach(item => {
      const safe = (s: string) => (s || '').replace(/"/g, '""')
      csv += `"${item.filename}","${item.timestamp}","${safe(item.prompt || '')}","${safe(item.analysis)}","${item.metadata.model || ''}","${item.metadata.provider || ''}","${(item.metadata.usage as { total_tokens?: number })?.total_tokens || 0}"\n`
    })
    downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `all_analyses_${dateSlug()}.csv`)
  }

  const exportAllMarkdown = () => {
    let md = `# Combined Analysis Report\n*Generated:* ${new Date().toLocaleString()}\n*Total Files:* ${history.length}\n\n`
    history.forEach((item, i) => {
      md += `---\n## ${i + 1}. ${item.filename}\n\n*Date:* ${new Date(item.timestamp).toLocaleString()}\n*Task:* ${item.prompt || 'N/A'}\n\n${item.analysis}\n\n`
    })
    downloadBlob(new Blob([md], { type: 'text/markdown;charset=utf-8;' }), `all_analyses_${dateSlug()}.md`)
  }

  return (
    <>
      <div className="hero-header-row">
        <div className="hero-icon-inline"><History /></div>
        <div className="hero-text-col">
          <h1 className="hero-title">Analysis History</h1>
          <p className="hero-subtitle">View and export your analysis history</p>
        </div>
      </div>

      {history.length === 0 ? (
        <div className="empty-state"><p>No analysis history yet. Start by analyzing some files.</p></div>
      ) : (
        <>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-label">Total Analyses</div>
              <div className="stat-value">{history.length}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Total Tokens</div>
              <div className="stat-value">{totalTokens.toLocaleString()}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Unique Files</div>
              <div className="stat-value">{uniqueFiles}</div>
            </div>
          </div>

          <div className="export-section">
            <h3>Export All Results</h3>
            <div className="results-actions">
              <button className="action-btn" onClick={exportAllJSON}><FileJson size={16} /> Export All (JSON)</button>
              <button className="action-btn" onClick={exportAllCSV}><FileSpreadsheet size={16} /> Export All (CSV)</button>
              <button className="action-btn" onClick={exportAllMarkdown}><FileText size={16} /> Export All (MD)</button>
              <button className="action-btn danger" onClick={onClear}><Trash2 size={16} /> Clear History</button>
            </div>
          </div>

          <div className="history-list">
            {history.map(item => (
              <div key={item.id} className="history-item">
                <div className="history-item-header">
                  <span className="history-filename"><File size={16} /> {item.filename}</span>
                  <span className="history-timestamp">{new Date(item.timestamp).toLocaleString()}</span>
                </div>
                <div className="history-item-meta">
                  <span>Provider: {String(item.metadata.provider || 'N/A')}</span>
                  <span>Model: {String(item.metadata.model || 'N/A')}</span>
                  <span>Tokens: {String((item.metadata.usage as { total_tokens?: number })?.total_tokens || 0)}</span>
                </div>
                <div className="history-item-analysis">{item.analysis.substring(0, 200)}...</div>
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
