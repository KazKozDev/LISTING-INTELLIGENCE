import { useState, useCallback } from 'react'
import { ScanSearch, Cloud, File, ShoppingCart, Lightbulb, Star, Tag, Zap, Copy, Check } from 'lucide-react'
import { api } from '../../api/client'
import { MarketplaceSelector } from './MarketplaceSelector'

function formatFileSize(bytes: number) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function parseAnalysis(text: string) {
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

function extractScore(text: string): number | null {
  const m = text.match(/(\d+(?:\.\d+)?)\s*(?:\/\s*10|out of 10)/i)
  return m ? parseFloat(m[1]) : null
}

function extractTags(text: string): string[] {
  const tags: string[] = []
  for (const line of text.split('\n')) {
    const cleaned = line.replace(/^[-•*\d.)\s]+/, '').trim()
    if (cleaned.length > 1 && cleaned.length < 60) {
      cleaned.split(/[,;]/).forEach(t => {
        const tag = t.trim().replace(/^["']|["']$/g, '')
        if (tag.length > 1) tags.push(tag)
      })
    }
  }
  return tags.slice(0, 20)
}

function extractList(text: string): string[] {
  return text.split('\n')
    .map(l => l.replace(/^[-•*\d.)\s]+/, '').trim())
    .filter(l => l.length > 3)
}

export function ProductAnalysis() {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [marketplace, setMarketplace] = useState('general')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ analysis: string; tokens_used: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

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

  const handleAnalyze = async () => {
    if (!file) return
    setLoading(true)
    setError(null)
    try {
      const data = await api.analyzeProduct(file, marketplace)
      setResult({ analysis: data.analysis, tokens_used: data.tokens_used })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed')
    } finally {
      setLoading(false)
    }
  }

  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 1500)
  }

  const parsed = result ? parseAnalysis(result.analysis) : null
  const qualityKey = parsed ? Object.keys(parsed).find(k => k.includes('quality') || k.includes('score')) : null
  const score = qualityKey && parsed ? extractScore(parsed[qualityKey]) : null
  const tagsKey = parsed ? Object.keys(parsed).find(k => k.includes('tag') || k.includes('keyword')) : null
  const tags = tagsKey && parsed ? extractTags(parsed[tagsKey]) : []
  const improvKey = parsed ? Object.keys(parsed).find(k => k.includes('improv') || k.includes('suggest') || k.includes('recommend')) : null
  const improvements = improvKey && parsed ? extractList(parsed[improvKey]) : []
  const descKey = parsed ? Object.keys(parsed).find(k => k.includes('description') || k.includes('product')) : null
  const titleKey = parsed ? Object.keys(parsed).find(k => k.includes('seo title') || k.includes('title')) : null

  return (
    <>
      <div className="hero-header-row">
        <div className="hero-icon-inline"><ShoppingCart /></div>
        <div className="hero-text-col">
          <h1 className="hero-title">Product Analysis</h1>
          <p className="hero-subtitle">AI-powered product photo optimization for e-commerce</p>
        </div>
      </div>

      <MarketplaceSelector selected={marketplace} onSelect={setMarketplace} />

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
        onClick={() => document.getElementById('product-input')?.click()}
        onDragOver={e => { e.preventDefault(); setDragActive(true) }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
      >
        <input id="product-input" type="file" accept=".png,.jpg,.jpeg,.webp" onChange={handleFileChange} style={{ display: 'none' }} />
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

      <button className="scan-btn" onClick={handleAnalyze} disabled={!file || loading}>
        {loading ? (<><span className="spinner"></span>Analyzing product...</>) : (<><ScanSearch size={20} />Analyze Product</>)}
      </button>

      {error && (
        <div className="results-panel" style={{ borderColor: '#ef4444' }}>
          <div className="results-content" style={{ color: '#ef4444' }}>{error}</div>
        </div>
      )}

      {result && (
        <div style={{ marginTop: '2rem' }}>
          {/* Quality Score */}
          {score !== null && (
            <div className="result-section">
              <div className="quality-bar-wrap">
                <div className="quality-bar-header">
                  <span className="quality-bar-label"><Star size={14} /> Photo Quality Score</span>
                  <span className="quality-bar-score">{score}/10</span>
                </div>
                <div className="quality-bar">
                  <div
                    className={`quality-bar-fill ${score >= 7 ? 'score-high' : score >= 4 ? 'score-mid' : 'score-low'}`}
                    style={{ width: `${score * 10}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* SEO Title */}
          {titleKey && parsed && (
            <div className="result-section">
              <div className="result-section-header">
                <span className="result-section-title"><Tag size={16} /> SEO Title</span>
                <button className="copy-btn-small" onClick={() => copyText(parsed[titleKey], 'title')}>
                  {copied === 'title' ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy</>}
                </button>
              </div>
              <div className="result-section-body" style={{ fontSize: '1rem', fontWeight: 600 }}>
                {parsed[titleKey]}
              </div>
            </div>
          )}

          {/* Description */}
          {descKey && parsed && (
            <div className="result-section">
              <div className="result-section-header">
                <span className="result-section-title"><ShoppingCart size={16} /> Description</span>
                <button className="copy-btn-small" onClick={() => copyText(parsed[descKey], 'desc')}>
                  {copied === 'desc' ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy</>}
                </button>
              </div>
              <div className="result-section-body">{parsed[descKey]}</div>
            </div>
          )}

          {/* Tags */}
          {tags.length > 0 && (
            <div className="result-section">
              <div className="result-section-header">
                <span className="result-section-title"><Tag size={16} /> SEO Tags</span>
                <button className="copy-btn-small" onClick={() => copyText(tags.join(', '), 'tags')}>
                  {copied === 'tags' ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy</>}
                </button>
              </div>
              <div className="tag-chips">
                {tags.map((tag, i) => <span key={i} className="tag-chip">{tag}</span>)}
              </div>
            </div>
          )}

          {/* Improvements */}
          {improvements.length > 0 && (
            <div className="result-section">
              <div className="result-section-header">
                <span className="result-section-title"><Lightbulb size={16} /> Improvements</span>
              </div>
              <ul className="improvement-list">
                {improvements.map((item, i) => (
                  <li key={i}><Zap size={14} /> {item}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Tokens */}
          {result.tokens_used > 0 && (
            <div className="tokens-badge">
              <Zap size={12} /> {result.tokens_used} tokens
            </div>
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
