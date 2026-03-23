import { useState, useCallback, useRef } from 'react'
import { ScanSearch, Upload, FileSpreadsheet, Package, CheckCircle, XCircle, Zap } from 'lucide-react'
import { api } from '../../api/client'
import { saveToHistory } from '../../hooks/useHistory'
import { MarketplaceSelector } from './MarketplaceSelector'

interface BatchResult {
  filename: string
  analysis: string
  success: boolean
  error?: string
}

export function BulkUpload() {
  const [files, setFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [marketplace, setMarketplace] = useState('general')
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [results, setResults] = useState<BatchResult[]>([])
  const [csvData, setCsvData] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFiles = useCallback((fileList: File[]) => {
    setFiles(fileList)
    setResults([])
    setCsvData(null)
    setError(null)
    setPreviews(fileList.map(f => URL.createObjectURL(f)))
  }, [])

  const handleFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) handleFiles(Array.from(e.target.files))
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
    if (e.dataTransfer.files) {
      const imgs = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'))
      if (imgs.length > 0) handleFiles(imgs)
    }
  }, [handleFiles])

  const handleBatchAnalyze = async () => {
    if (files.length === 0) return
    setLoading(true)
    setError(null)
    setProgress({ current: 0, total: files.length })

    // Simulate progress since backend doesn't stream
    const interval = setInterval(() => {
      setProgress(p => ({
        ...p,
        current: Math.min(p.current + 1, p.total - 1),
      }))
    }, 2000)

    try {
      const data = await api.batchAnalyzeProducts(files, marketplace)
      clearInterval(interval)
      setProgress({ current: files.length, total: files.length })
      setResults(data.results)
      setCsvData(data.csv_data)
      data.results.filter(r => r.success).forEach(r => {
        saveToHistory({ success: true, filename: r.filename, analysis: r.analysis, metadata: r.metadata, timestamp: data.timestamp, tokens_used: 0 })
      })
    } catch (err) {
      clearInterval(interval)
      setError(err instanceof Error ? err.message : 'Batch analysis failed')
    } finally {
      setLoading(false)
    }
  }

  const downloadCSV = () => {
    if (!csvData) return
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `product_analysis_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const removeFile = (index: number) => {
    const newFiles = files.filter((_, i) => i !== index)
    setFiles(newFiles)
    setPreviews(newFiles.map(f => URL.createObjectURL(f)))
  }

  const successCount = results.filter(r => r.success).length
  const failCount = results.filter(r => !r.success).length

  return (
    <>
      <div className="hero-header-row">
        <div className="hero-icon-inline"><Package /></div>
        <div className="hero-text-col">
          <h1 className="hero-title">Bulk Product Analysis</h1>
          <p className="hero-subtitle">Analyze multiple product photos at once</p>
        </div>
      </div>

      <MarketplaceSelector selected={marketplace} onSelect={setMarketplace} />

      {/* Thumbnail Grid */}
      {previews.length > 0 && (
        <div className="thumb-grid">
          {previews.map((src, i) => (
            <div key={i} className="thumb-item" onClick={() => removeFile(i)} title="Click to remove">
              <img src={src} alt={files[i]?.name || ''} />
              {results[i] && (
                <div className={`thumb-status ${results[i].success ? 'done' : 'fail'}`}>
                  {results[i].success ? '✓' : '✗'}
                </div>
              )}
              {!results[i] && loading && progress.current >= i && (
                <div className="thumb-status pending">
                  <span className="spinner" style={{ width: 8, height: 8, borderWidth: 1 }}></span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div
        className={`file-drop ${files.length > 0 ? 'has-file' : ''} ${dragActive ? 'drag-active' : ''}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragActive(true) }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
      >
        <input ref={inputRef} type="file" accept=".png,.jpg,.jpeg,.webp" multiple onChange={handleFilesChange} style={{ display: 'none' }} />
        <div className="drop-content">
          {files.length > 0 ? (
            <div className="file-info">
              <span className="drop-icon"><Upload /></span>
              <span className="file-name">{files.length} product photos selected</span>
            </div>
          ) : (
            <>
              <span className="drop-icon"><Upload /></span>
              <span className="drop-text">Drop multiple product photos</span>
              <span className="drop-hint">Select multiple images for batch processing</span>
            </>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      {loading && progress.total > 0 && (
        <div className="batch-progress">
          <div className="batch-progress-header">
            <span>Processing files...</span>
            <span>{progress.current}/{progress.total}</span>
          </div>
          <div className="batch-progress-bar">
            <div className="batch-progress-fill" style={{ width: `${(progress.current / progress.total) * 100}%` }} />
          </div>
        </div>
      )}

      <button className="scan-btn" onClick={handleBatchAnalyze} disabled={loading || files.length === 0}>
        {loading
          ? (<><span className="spinner"></span>Processing {progress.current}/{progress.total}...</>)
          : (<><ScanSearch size={20} />Analyze {files.length} Products</>)}
      </button>

      {error && (
        <div className="results-panel" style={{ borderColor: '#ef4444' }}>
          <div className="results-content" style={{ color: '#ef4444' }}>{error}</div>
        </div>
      )}

      {results.length > 0 && (
        <>
          {/* Stats */}
          <div className="stats-grid" style={{ marginTop: '2rem' }}>
            <div className="stat-card">
              <div className="stat-label">Total</div>
              <div className="stat-value">{results.length}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Successful</div>
              <div className="stat-value" style={{ WebkitTextFillColor: '#4ade80' }}>{successCount}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Failed</div>
              <div className="stat-value" style={{ WebkitTextFillColor: failCount > 0 ? '#f87171' : 'inherit' }}>{failCount}</div>
            </div>
          </div>

          {/* CSV Export */}
          {csvData && (
            <div className="export-section">
              <div className="results-actions">
                <button className="action-btn" onClick={downloadCSV}>
                  <FileSpreadsheet size={16} /> Download CSV Report
                </button>
              </div>
            </div>
          )}

          {/* Results List */}
          <div className="history-list">
            {results.map((r, i) => (
              <div key={i} className="history-item">
                <div className="history-item-header">
                  <span className="history-filename">
                    {r.success ? <CheckCircle size={16} style={{ color: '#4ade80' }} /> : <XCircle size={16} style={{ color: '#f87171' }} />}
                    {r.filename}
                  </span>
                  <span className={`results-badge ${r.success ? '' : 'error'}`} style={r.success ? {} : { background: 'linear-gradient(135deg, #ef4444, #dc2626)' }}>
                    {r.success ? 'Done' : 'Failed'}
                  </span>
                </div>
                <div className="history-item-analysis">
                  {r.success ? r.analysis.substring(0, 300) + (r.analysis.length > 300 ? '...' : '') : r.error}
                </div>
              </div>
            ))}
          </div>

          {/* Tokens */}
          <div className="tokens-badge" style={{ marginTop: '1rem' }}>
            <Zap size={12} /> {results.length} files processed
          </div>
        </>
      )}
    </>
  )
}
