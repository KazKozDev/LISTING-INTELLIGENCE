import { useState, useCallback } from 'react'
import { ScanSearch, Cloud, File, GitCompareArrows, ThumbsUp, ThumbsDown, Target, Zap, Copy, Check } from 'lucide-react'
import { api } from '../../api/client'
import { saveToHistory } from '../../hooks/useHistory'
import { MarketplaceSelector } from './MarketplaceSelector'

function formatFileSize(bytes: number) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function parseComparison(text: string) {
  const sections: Record<string, string> = {}
  const lines = text.split('\n')
  let currentKey = ''
  let currentContent: string[] = []

  for (const line of lines) {
    const headerMatch = line.match(/^\*{0,2}(\d+\.\s*)?(.+?):\*{0,2}\s*(.*)$/)
    if (headerMatch && !line.startsWith(' ') && !line.startsWith('\t')) {
      if (currentKey) sections[currentKey] = currentContent.join('\n').trim()
      currentKey = headerMatch[2].trim().toLowerCase()
      currentContent = headerMatch[3] ? [headerMatch[3]] : []
    } else {
      currentContent.push(line)
    }
  }
  if (currentKey) sections[currentKey] = currentContent.join('\n').trim()
  return sections
}

function extractList(text: string): string[] {
  return text.split('\n')
    .map(l => l.replace(/^[-\u2022*\d.)\s]+/, '').trim())
    .filter(l => l.length > 3)
}

export function CompetitorCompare() {
  const [productFile, setProductFile] = useState<File | null>(null)
  const [competitorFile, setCompetitorFile] = useState<File | null>(null)
  const [productPreview, setProductPreview] = useState<string | null>(null)
  const [competitorPreview, setCompetitorPreview] = useState<string | null>(null)
  const [marketplace, setMarketplace] = useState('general')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ analysis: string; tokens_used: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState<'product' | 'competitor' | null>(null)
  const [copied, setCopied] = useState(false)

  const handleProductFile = useCallback((f: File) => {
    setProductFile(f)
    setResult(null)
    setError(null)
    setProductPreview(URL.createObjectURL(f))
  }, [])

  const handleCompetitorFile = useCallback((f: File) => {
    setCompetitorFile(f)
    setResult(null)
    setError(null)
    setCompetitorPreview(URL.createObjectURL(f))
  }, [])

  const handleDrop = useCallback((e: React.DragEvent, target: 'product' | 'competitor') => {
    e.preventDefault()
    setDragActive(null)
    if (e.dataTransfer.files?.[0]) {
      if (target === 'product') handleProductFile(e.dataTransfer.files[0])
      else handleCompetitorFile(e.dataTransfer.files[0])
    }
  }, [handleProductFile, handleCompetitorFile])

  const handleCompare = async () => {
    if (!productFile || !competitorFile) return
    setLoading(true)
    setError(null)
    try {
      const data = await api.compareProducts(productFile, competitorFile, marketplace)
      setResult({ analysis: data.analysis, tokens_used: data.tokens_used })
      saveToHistory({ success: true, filename: `${data.product_filename} vs ${data.competitor_filename}`, analysis: data.analysis, metadata: data.metadata, timestamp: data.timestamp, tokens_used: data.tokens_used })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Comparison failed')
    } finally {
      setLoading(false)
    }
  }

  const parsed = result ? parseComparison(result.analysis) : null
  const strengthsKey = parsed ? Object.keys(parsed).find(k => k.includes('strength')) : null
  const weaknessesKey = parsed ? Object.keys(parsed).find(k => k.includes('weakness')) : null
  const edgeKey = parsed ? Object.keys(parsed).find(k => k.includes('edge') || k.includes('differentiat')) : null
  const actionsKey = parsed ? Object.keys(parsed).find(k => k.includes('action') || k.includes('recommend')) : null

  const strengths = strengthsKey && parsed ? extractList(parsed[strengthsKey]) : []
  const weaknesses = weaknessesKey && parsed ? extractList(parsed[weaknessesKey]) : []
  const edge = edgeKey && parsed ? parsed[edgeKey] : null
  const actions = actionsKey && parsed ? extractList(parsed[actionsKey]) : []

  return (
    <>
      <div className="hero-header-row">
        <div className="hero-icon-inline"><GitCompareArrows /></div>
        <div className="hero-text-col">
          <h1 className="hero-title">Competitor Compare</h1>
          <p className="hero-subtitle">Side-by-side analysis of your product vs competitor</p>
        </div>
      </div>

      <MarketplaceSelector selected={marketplace} onSelect={setMarketplace} showRules={false} />

      {/* Side-by-side upload */}
      <div className="compare-grid">
        {/* Product Image */}
        <div className="compare-col">
          <div className="compare-label">Your Product</div>
          {productPreview && (
            <div className="image-preview">
              <img src={productPreview} alt="Your product" />
              <div className="image-preview-info">
                <span>{productFile?.name}</span>
                <span>{productFile ? formatFileSize(productFile.size) : ''}</span>
              </div>
            </div>
          )}
          <div
            className={`file-drop ${productFile ? 'has-file' : ''} ${dragActive === 'product' ? 'drag-active' : ''}`}
            onClick={() => document.getElementById('compare-product-input')?.click()}
            onDragOver={e => { e.preventDefault(); setDragActive('product') }}
            onDragLeave={() => setDragActive(null)}
            onDrop={e => handleDrop(e, 'product')}
          >
            <input
              id="compare-product-input"
              type="file"
              accept=".png,.jpg,.jpeg,.webp"
              onChange={e => e.target.files?.[0] && handleProductFile(e.target.files[0])}
              style={{ display: 'none' }}
            />
            <div className="drop-content">
              {productFile ? (
                <div className="file-info">
                  <span className="drop-icon"><File /></span>
                  <span className="file-name">{productFile.name}</span>
                </div>
              ) : (
                <>
                  <span className="drop-icon"><Cloud /></span>
                  <span className="drop-text">Your product photo</span>
                  <span className="drop-hint">PNG, JPG, WebP</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* VS divider */}
        <div className="compare-vs">VS</div>

        {/* Competitor Image */}
        <div className="compare-col">
          <div className="compare-label">Competitor</div>
          {competitorPreview && (
            <div className="image-preview">
              <img src={competitorPreview} alt="Competitor product" />
              <div className="image-preview-info">
                <span>{competitorFile?.name}</span>
                <span>{competitorFile ? formatFileSize(competitorFile.size) : ''}</span>
              </div>
            </div>
          )}
          <div
            className={`file-drop ${competitorFile ? 'has-file' : ''} ${dragActive === 'competitor' ? 'drag-active' : ''}`}
            onClick={() => document.getElementById('compare-competitor-input')?.click()}
            onDragOver={e => { e.preventDefault(); setDragActive('competitor') }}
            onDragLeave={() => setDragActive(null)}
            onDrop={e => handleDrop(e, 'competitor')}
          >
            <input
              id="compare-competitor-input"
              type="file"
              accept=".png,.jpg,.jpeg,.webp"
              onChange={e => e.target.files?.[0] && handleCompetitorFile(e.target.files[0])}
              style={{ display: 'none' }}
            />
            <div className="drop-content">
              {competitorFile ? (
                <div className="file-info">
                  <span className="drop-icon"><File /></span>
                  <span className="file-name">{competitorFile.name}</span>
                </div>
              ) : (
                <>
                  <span className="drop-icon"><Cloud /></span>
                  <span className="drop-text">Competitor photo</span>
                  <span className="drop-hint">PNG, JPG, WebP</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <button className="scan-btn" onClick={handleCompare} disabled={!productFile || !competitorFile || loading}>
        {loading
          ? (<><span className="spinner"></span>Comparing...</>)
          : (<><ScanSearch size={20} />Compare Products</>)}
      </button>

      {error && (
        <div className="results-panel" style={{ borderColor: '#ef4444' }}>
          <div className="results-content" style={{ color: '#ef4444' }}>{error}</div>
        </div>
      )}

      {result && (
        <div style={{ marginTop: '2rem' }}>
          {/* Strengths */}
          {strengths.length > 0 && (
            <div className="result-section">
              <div className="result-section-header">
                <span className="result-section-title"><ThumbsUp size={16} /> Strengths</span>
              </div>
              <ul className="improvement-list strengths-list">
                {strengths.map((s, i) => <li key={i}><ThumbsUp size={14} /> {s}</li>)}
              </ul>
            </div>
          )}

          {/* Weaknesses */}
          {weaknesses.length > 0 && (
            <div className="result-section">
              <div className="result-section-header">
                <span className="result-section-title"><ThumbsDown size={16} /> Weaknesses</span>
              </div>
              <ul className="improvement-list weaknesses-list">
                {weaknesses.map((w, i) => <li key={i}><ThumbsDown size={14} /> {w}</li>)}
              </ul>
            </div>
          )}

          {/* Competitive Edge */}
          {edge && (
            <div className="result-section">
              <div className="result-section-header">
                <span className="result-section-title"><Target size={16} /> Competitive Edge</span>
              </div>
              <div className="result-section-body">{edge}</div>
            </div>
          )}

          {/* Action Items */}
          {actions.length > 0 && (
            <div className="result-section">
              <div className="result-section-header">
                <span className="result-section-title"><Zap size={16} /> Action Items</span>
              </div>
              <ul className="improvement-list">
                {actions.map((a, i) => <li key={i}><Zap size={14} /> {a}</li>)}
              </ul>
            </div>
          )}

          {/* Full Report */}
          <div className="result-section">
            <div className="result-section-header">
              <span className="result-section-title"><GitCompareArrows size={16} /> Full Report</span>
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

          {/* Raw fallback */}
          {!parsed || Object.keys(parsed).length === 0 ? (
            <div className="results-panel">
              <div className="results-content">{result.analysis}</div>
            </div>
          ) : null}
        </div>
      )}
    </>
  )
}
