import { useState, useCallback } from 'react'
import { ScanSearch, Cloud, File, Tag, Copy, Check, Zap, ShoppingCart, List, Search } from 'lucide-react'
import { api } from '../../api/client'
import { MarketplaceSelector } from './MarketplaceSelector'

function formatFileSize(bytes: number) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function parseSEO(text: string) {
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

function extractBullets(text: string): string[] {
  return text.split('\n')
    .map(l => l.replace(/^[-•*\d.)\s]+/, '').trim())
    .filter(l => l.length > 5)
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

export function SEOPreview() {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [marketplace, setMarketplace] = useState('general')
  const [keywords, setKeywords] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ seo_content: string; tokens_used: number } | null>(null)
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

  const handleGenerate = async () => {
    if (!file) return
    setLoading(true)
    setError(null)
    try {
      const data = await api.generateSeo(file, marketplace, keywords)
      setResult({ seo_content: data.seo_content, tokens_used: data.tokens_used })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'SEO generation failed')
    } finally {
      setLoading(false)
    }
  }

  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 1500)
  }

  const parsed = result ? parseSEO(result.seo_content) : null
  const titleKey = parsed ? Object.keys(parsed).find(k => k.includes('title')) : null
  const bulletsKey = parsed ? Object.keys(parsed).find(k => k.includes('bullet')) : null
  const descKey = parsed ? Object.keys(parsed).find(k => k.includes('description')) : null
  const tagsKey = parsed ? Object.keys(parsed).find(k => k.includes('tag') || k.includes('keyword') || k.includes('search')) : null
  const backendKey = parsed ? Object.keys(parsed).find(k => k.includes('backend')) : null
  const categoryKey = parsed ? Object.keys(parsed).find(k => k.includes('category')) : null

  const seoTitle = titleKey && parsed ? parsed[titleKey].split('\n')[0].trim() : null
  const bullets = bulletsKey && parsed ? extractBullets(parsed[bulletsKey]) : []
  const description = descKey && parsed ? parsed[descKey] : null
  const tags = tagsKey && parsed ? extractTags(parsed[tagsKey]) : []
  const backendKw = backendKey && parsed ? parsed[backendKey] : null

  return (
    <>
      <div className="hero-header-row">
        <div className="hero-icon-inline"><Tag /></div>
        <div className="hero-text-col">
          <h1 className="hero-title">SEO Generator</h1>
          <p className="hero-subtitle">Generate optimized titles, descriptions, and tags</p>
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
        onClick={() => document.getElementById('seo-input')?.click()}
        onDragOver={e => { e.preventDefault(); setDragActive(true) }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
      >
        <input id="seo-input" type="file" accept=".png,.jpg,.jpeg,.webp" onChange={handleFileChange} style={{ display: 'none' }} />
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

      <div className="settings-panel" style={{ marginBottom: '1rem' }}>
        <div className="setting-item">
          <label>Target Keywords (optional)</label>
          <input
            type="text"
            className="setting-input"
            placeholder="e.g. wireless headphones, bluetooth, noise cancelling"
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
          />
        </div>
      </div>

      <button className="scan-btn" onClick={handleGenerate} disabled={!file || loading}>
        {loading ? (<><span className="spinner"></span>Generating SEO...</>) : (<><ScanSearch size={20} />Generate SEO Content</>)}
      </button>

      {error && (
        <div className="results-panel" style={{ borderColor: '#ef4444' }}>
          <div className="results-content" style={{ color: '#ef4444' }}>{error}</div>
        </div>
      )}

      {result && (
        <div style={{ marginTop: '2rem' }}>
          {/* Marketplace Card Preview */}
          {seoTitle && (
            <div className="seo-card">
              <div className="seo-card-title">{seoTitle}</div>
              <div className="seo-card-url">www.marketplace.com/product/...</div>
              {description && <div className="seo-card-description">{description.substring(0, 200)}...</div>}
            </div>
          )}

          {/* Bullet Points */}
          {bullets.length > 0 && (
            <div className="result-section">
              <div className="result-section-header">
                <span className="result-section-title"><List size={16} /> Bullet Points</span>
                <button className="copy-btn-small" onClick={() => copyText(bullets.join('\n'), 'bullets')}>
                  {copied === 'bullets' ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy</>}
                </button>
              </div>
              <ul className="seo-bullets">
                {bullets.map((b, i) => <li key={i}>{b}</li>)}
              </ul>
            </div>
          )}

          {/* Full Description */}
          {description && (
            <div className="result-section">
              <div className="result-section-header">
                <span className="result-section-title"><ShoppingCart size={16} /> Product Description</span>
                <button className="copy-btn-small" onClick={() => copyText(description, 'desc')}>
                  {copied === 'desc' ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy</>}
                </button>
              </div>
              <div className="result-section-body">{description}</div>
            </div>
          )}

          {/* Tags */}
          {tags.length > 0 && (
            <div className="result-section">
              <div className="result-section-header">
                <span className="result-section-title"><Search size={16} /> Search Tags ({tags.length})</span>
                <button className="copy-btn-small" onClick={() => copyText(tags.join(', '), 'tags')}>
                  {copied === 'tags' ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy</>}
                </button>
              </div>
              <div className="tag-chips">
                {tags.map((tag, i) => <span key={i} className="tag-chip">{tag}</span>)}
              </div>
            </div>
          )}

          {/* Backend Keywords */}
          {backendKw && (
            <div className="result-section">
              <div className="result-section-header">
                <span className="result-section-title"><Tag size={16} /> Backend Keywords</span>
                <button className="copy-btn-small" onClick={() => copyText(backendKw, 'backend')}>
                  {copied === 'backend' ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy</>}
                </button>
              </div>
              <div className="result-section-body">{backendKw}</div>
            </div>
          )}

          {/* Category */}
          {categoryKey && parsed && (
            <div className="result-section">
              <div className="result-section-header">
                <span className="result-section-title"><Tag size={16} /> Category Suggestion</span>
              </div>
              <div className="result-section-body">{parsed[categoryKey]}</div>
            </div>
          )}

          {result.tokens_used > 0 && (
            <div className="tokens-badge"><Zap size={12} /> {result.tokens_used} tokens</div>
          )}

          {/* Raw fallback */}
          {!parsed || Object.keys(parsed).length === 0 ? (
            <div className="results-panel">
              <div className="results-content">{result.seo_content}</div>
            </div>
          ) : null}
        </div>
      )}
    </>
  )
}
