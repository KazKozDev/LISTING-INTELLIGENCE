import { useState, useCallback } from 'react'
import { ScanSearch, Cloud, File, ShieldCheck, ShieldX, CheckCircle, XCircle, AlertTriangle, Info, Star, Copy, Check, Zap } from 'lucide-react'
import { api } from '../../api/client'
import { saveToHistory } from '../../hooks/useHistory'
import { MarketplaceSelector } from './MarketplaceSelector'

function formatFileSize(bytes: number) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function parseCompliance(text: string) {
  const isPassing = /compliance\s*status[:\s]*pass/i.test(text) || /\bPASS\b/.test(text)
  const isFailing = /compliance\s*status[:\s]*fail/i.test(text) || /\bFAIL\b/.test(text)
  const status: 'pass' | 'fail' | 'unknown' = isPassing ? 'pass' : isFailing ? 'fail' : 'unknown'

  const scoreMatch = text.match(/(?:overall\s*score|score)[:\s]*(\d+(?:\.\d+)?)\s*(?:\/\s*10|out of 10)/i)
  const score = scoreMatch ? parseFloat(scoreMatch[1]) : null

  const issues: Array<{ severity: 'critical' | 'warning' | 'info'; text: string }> = []
  const recommendations: string[] = []

  const lines = text.split('\n')
  let section = ''

  for (const line of lines) {
    const lower = line.toLowerCase()
    if (lower.includes('issues found') || lower.includes('issue')) {
      section = 'issues'
      continue
    }
    if (lower.includes('recommendation')) {
      section = 'recommendations'
      continue
    }
    if (lower.includes('overall score') || lower.includes('compliance status')) {
      section = ''
      continue
    }

    const cleaned = line.replace(/^[-•*\d.)\s]+/, '').trim()
    if (!cleaned || cleaned.length < 3) continue

    if (section === 'issues') {
      let severity: 'critical' | 'warning' | 'info' = 'info'
      if (/critical/i.test(cleaned)) severity = 'critical'
      else if (/warning/i.test(cleaned)) severity = 'warning'
      issues.push({ severity, text: cleaned })
    } else if (section === 'recommendations') {
      recommendations.push(cleaned)
    }
  }

  return { status, score, issues, recommendations }
}

export function ComplianceReport() {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [marketplace, setMarketplace] = useState('wildberries')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ analysis: string; marketplace: string; tokens_used: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleFile = useCallback((f: File) => {
    setFile(f)
    setResult(null)
    setError(null)
    setPreview(URL.createObjectURL(f))
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) handleFile(e.target.files[0])
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
    if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0])
  }, [handleFile])

  const handleCheck = async () => {
    if (!file || marketplace === 'general') return
    setLoading(true)
    setError(null)
    try {
      const data = await api.checkCompliance(file, marketplace)
      setResult({ analysis: data.analysis, marketplace: data.marketplace, tokens_used: data.tokens_used })
      saveToHistory({ success: true, filename: data.filename, analysis: data.analysis, metadata: data.metadata, timestamp: data.timestamp, tokens_used: data.tokens_used })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Compliance check failed')
    } finally {
      setLoading(false)
    }
  }

  const parsed = result ? parseCompliance(result.analysis) : null

  const severityIcon = (s: string) => {
    switch (s) {
      case 'critical': return <XCircle size={15} className="issue-icon critical" />
      case 'warning': return <AlertTriangle size={15} className="issue-icon warning" />
      default: return <Info size={15} className="issue-icon info" />
    }
  }

  return (
    <>
      <div className="hero-header-row">
        <div className="hero-icon-inline"><ShieldCheck /></div>
        <div className="hero-text-col">
          <h1 className="hero-title">Compliance Check</h1>
          <p className="hero-subtitle">Verify product photos meet marketplace requirements</p>
        </div>
      </div>

      <MarketplaceSelector selected={marketplace} onSelect={setMarketplace} />
      {marketplace === 'general' && (
        <div className="setting-info">Select a specific marketplace to check compliance requirements.</div>
      )}

      {preview && (
        <div className="image-preview">
          <img src={preview} alt="Product preview" />
          <div className="image-preview-info">
            <span>{file?.name}</span>
            <span>{file ? formatFileSize(file.size) : ''}</span>
          </div>
        </div>
      )}

      <div
        className={`file-drop ${file ? 'has-file' : ''} ${dragActive ? 'drag-active' : ''}`}
        onClick={() => document.getElementById('compliance-input')?.click()}
        onDragOver={e => { e.preventDefault(); setDragActive(true) }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
      >
        <input id="compliance-input" type="file" accept=".png,.jpg,.jpeg,.webp" onChange={handleFileChange} style={{ display: 'none' }} />
        <div className="drop-content">
          {file ? (
            <div className="file-info">
              <span className="drop-icon"><File /></span>
              <span className="file-name">{file.name}</span>
              <span className="file-size">{formatFileSize(file.size)}</span>
            </div>
          ) : (
            <>
              <span className="drop-icon"><Cloud /></span>
              <span className="drop-text">Drop product photo here</span>
              <span className="drop-hint">PNG, JPG, WebP</span>
            </>
          )}
        </div>
      </div>

      <button className="scan-btn" onClick={handleCheck} disabled={!file || loading || marketplace === 'general'}>
        {loading ? (<><span className="spinner"></span>Checking compliance...</>) : (<><ScanSearch size={20} />Check Compliance</>)}
      </button>

      {error && (
        <div className="results-panel" style={{ borderColor: '#ef4444' }}>
          <div className="results-content" style={{ color: '#ef4444' }}>{error}</div>
        </div>
      )}

      {result && parsed && (
        <div style={{ marginTop: '2rem' }}>
          {/* Pass/Fail Banner */}
          {parsed.status !== 'unknown' && (
            <div className={`compliance-banner ${parsed.status}`}>
              {parsed.status === 'pass'
                ? <><CheckCircle size={22} /> Compliant with {result.marketplace} requirements</>
                : <><ShieldX size={22} /> Does not meet {result.marketplace} requirements</>
              }
            </div>
          )}

          {/* Overall Score */}
          {parsed.score !== null && (
            <div className="result-section">
              <div className="quality-bar-wrap">
                <div className="quality-bar-header">
                  <span className="quality-bar-label"><Star size={14} /> Overall Score</span>
                  <span className="quality-bar-score">{parsed.score}/10</span>
                </div>
                <div className="quality-bar">
                  <div
                    className={`quality-bar-fill ${parsed.score >= 7 ? 'score-high' : parsed.score >= 4 ? 'score-mid' : 'score-low'}`}
                    style={{ width: `${parsed.score * 10}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Issues */}
          {parsed.issues.length > 0 && (
            <div className="result-section">
              <div className="result-section-header">
                <span className="result-section-title"><AlertTriangle size={16} /> Issues Found ({parsed.issues.length})</span>
              </div>
              {parsed.issues.map((issue, i) => (
                <div key={i} className="issue-item">
                  {severityIcon(issue.severity)}
                  <span>{issue.text}</span>
                </div>
              ))}
            </div>
          )}

          {/* Recommendations */}
          {parsed.recommendations.length > 0 && (
            <div className="result-section">
              <div className="result-section-header">
                <span className="result-section-title"><CheckCircle size={16} /> Recommendations</span>
              </div>
              <ul className="improvement-list">
                {parsed.recommendations.map((rec, i) => (
                  <li key={i}><Zap size={14} /> {rec}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Full report copy */}
          <div className="result-section">
            <div className="result-section-header">
              <span className="result-section-title"><ShieldCheck size={16} /> Full Report</span>
              <button className="copy-btn-small" onClick={() => {
                navigator.clipboard.writeText(result.analysis)
                setCopied(true)
                setTimeout(() => setCopied(false), 1500)
              }}>
                {copied ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy</>}
              </button>
            </div>
            <div className="result-section-body" style={{ whiteSpace: 'pre-wrap' }}>{result.analysis}</div>
          </div>

          {result.tokens_used > 0 && (
            <div className="tokens-badge"><Zap size={12} /> {result.tokens_used} tokens</div>
          )}
        </div>
      )}
    </>
  )
}
