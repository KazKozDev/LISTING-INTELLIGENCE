import { useState, useCallback } from 'react'
import {
  ScanSearch, Cloud, File, Wrench, Lightbulb, Star, DollarSign,
  MessageSquare, BoxIcon, Search, ClipboardList, Zap, Copy, Check
} from 'lucide-react'
import { api } from '../../api/client'

function formatFileSize(bytes: number) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

const TOOLS = [
  {
    id: 'improvements',
    name: 'Photo Improvements',
    description: 'AI suggestions to boost conversion rates',
    icon: Lightbulb,
    apiMethod: 'suggestImprovements' as const,
  },
  {
    id: 'attributes',
    name: 'Extract Attributes',
    description: 'Auto-detect product characteristics from photo',
    icon: ClipboardList,
    apiMethod: 'extractAttributes' as const,
  },
  {
    id: 'listing',
    name: 'Listing Audit',
    description: 'Optimize title, images, and description for conversion',
    icon: Star,
    templateKey: 'ecommerce_listing',
  },
  {
    id: 'pricing',
    name: 'Pricing Analysis',
    description: 'Compare pricing strategies and value propositions',
    icon: DollarSign,
    templateKey: 'ecommerce_price',
  },
  {
    id: 'sentiment',
    name: 'Review Sentiment',
    description: 'Analyze customer reviews and feedback themes',
    icon: MessageSquare,
    templateKey: 'ecommerce_sentiment',
  },
  {
    id: 'packaging',
    name: 'Packaging Critique',
    description: 'Evaluate shelf appeal and unboxing experience',
    icon: BoxIcon,
    templateKey: 'ecommerce_packaging',
  },
  {
    id: 'visual_search',
    name: 'Visual Search SEO',
    description: 'Optimize images for Google/Pinterest Lens',
    icon: Search,
    templateKey: 'ecommerce_search',
  },
  {
    id: 'inventory',
    name: 'Inventory Check',
    description: 'Estimate stock levels and shelf arrangement',
    icon: ClipboardList,
    templateKey: 'ecommerce_inventory',
  },
]

export function EcommerceTools() {
  const [selectedTool, setSelectedTool] = useState(TOOLS[0])
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [tokensUsed, setTokensUsed] = useState(0)
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

  const handleAnalyze = async () => {
    if (!file) return
    setLoading(true)
    setError(null)
    try {
      if (selectedTool.id === 'improvements') {
        const data = await api.suggestImprovements(file)
        setResult(data.analysis)
        setTokensUsed(data.tokens_used)
      } else if (selectedTool.id === 'attributes') {
        const data = await api.extractAttributes(file)
        setResult(data.attributes)
        setTokensUsed(data.tokens_used)
      } else if ('templateKey' in selectedTool && selectedTool.templateKey) {
        // Use generic analyze endpoint with the template
        const data = await api.analyze(file, '', { templateKey: selectedTool.templateKey })
        setResult(data.analysis)
        setTokensUsed(data.tokens_used || 0)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="hero-header-row">
        <div className="hero-icon-inline"><Wrench /></div>
        <div className="hero-text-col">
          <h1 className="hero-title">E-Commerce Tools</h1>
          <p className="hero-subtitle">Specialized analysis tools for online retail</p>
        </div>
      </div>

      {/* Tools Grid */}
      <div className="tools-grid">
        {TOOLS.map(tool => {
          const IconComp = tool.icon
          return (
            <div
              key={tool.id}
              className={`tool-card ${selectedTool.id === tool.id ? 'active' : ''}`}
              onClick={() => { setSelectedTool(tool); setResult(null); setError(null) }}
            >
              <div className="tool-card-icon"><IconComp size={20} /></div>
              <div className="tool-card-info">
                <div className="tool-card-name">{tool.name}</div>
                <div className="tool-card-desc">{tool.description}</div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Selected Tool Info */}
      <div className="selected-tool-banner">
        {(() => { const IC = selectedTool.icon; return <IC size={18} /> })()}
        <span>{selectedTool.name}</span>
        <span className="selected-tool-desc">— {selectedTool.description}</span>
      </div>

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
        onClick={() => document.getElementById('tools-input')?.click()}
        onDragOver={e => { e.preventDefault(); setDragActive(true) }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
      >
        <input id="tools-input" type="file" accept=".png,.jpg,.jpeg,.webp" onChange={handleFileChange} style={{ display: 'none' }} />
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
        {loading
          ? (<><span className="spinner"></span>Running {selectedTool.name}...</>)
          : (<><ScanSearch size={20} />{selectedTool.name}</>)}
      </button>

      {error && (
        <div className="results-panel" style={{ borderColor: '#ef4444' }}>
          <div className="results-content" style={{ color: '#ef4444' }}>{error}</div>
        </div>
      )}

      {result && (
        <div style={{ marginTop: '2rem' }}>
          <div className="result-section">
            <div className="result-section-header">
              <span className="result-section-title">
                {(() => { const IC = selectedTool.icon; return <IC size={16} /> })()}
                {selectedTool.name} Results
              </span>
              <button className="copy-btn-small" onClick={() => {
                navigator.clipboard.writeText(result)
                setCopied(true)
                setTimeout(() => setCopied(false), 1500)
              }}>
                {copied ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy</>}
              </button>
            </div>
            <div className="result-section-body" style={{ whiteSpace: 'pre-wrap' }}>{result}</div>
          </div>

          {tokensUsed > 0 && (
            <div className="tokens-badge"><Zap size={12} /> {tokensUsed} tokens</div>
          )}
        </div>
      )}
    </>
  )
}
