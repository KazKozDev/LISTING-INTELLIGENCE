import { useState, useCallback, useEffect, useRef } from 'react'
import { ArrowRight, ChevronDown, ScanSearch, Download, File, ShieldCheck, ShieldX, CheckCircle, XCircle, AlertTriangle, Info, Copy, Check, Zap, WandSparkles } from 'lucide-react'
import { api } from '../../api/client'
import type { ComplianceCheckResponse } from '../../api/types'
import { saveToHistory } from '../../hooks/useHistory'
import { useObjectUrlPreview } from '../../hooks/useObjectUrlPreviews'
import { MarkdownContent } from '../MarkdownContent'
import { MarketplaceSelector } from './MarketplaceSelector'
import {
  buildComplianceCacheKey,
  getCachedCompliance,
  getComplianceReportUiPreferences,
  setComplianceReportUiPreferences,
  setCachedCompliance,
} from '../../utils/analysisCache'
import { formatFileSize, parseCompliance } from '../../utils/analysis'

interface ComplianceReportProps {
  onOpenFixStudio?: (file: File, marketplace: string) => void
}

export function ComplianceReport({ onOpenFixStudio }: ComplianceReportProps) {
  const persistedUiPreferences = getComplianceReportUiPreferences()
  const [file, setFile] = useState<File | null>(null)
  const [marketplace, setMarketplace] = useState('allegro')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ComplianceCheckResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [copied, setCopied] = useState(false)
  const [loadedFromCache, setLoadedFromCache] = useState(false)
  const [isFullReportOpen, setIsFullReportOpen] = useState(persistedUiPreferences?.fullReportOpen ?? false)
  const [isIssuesOpen, setIsIssuesOpen] = useState(persistedUiPreferences?.issuesOpen ?? true)
  const [isRecommendationsOpen, setIsRecommendationsOpen] = useState(persistedUiPreferences?.recommendationsOpen ?? true)
  const inputRef = useRef<HTMLInputElement>(null)
  const preview = useObjectUrlPreview(file)
  const auditSessionLabel = file?.name ?? 'Waiting for product image'

  useEffect(() => {
    setIsFullReportOpen((currentValue) => currentValue)
  }, [result?.timestamp, result?.filename, result?.marketplace])

  useEffect(() => {
    setComplianceReportUiPreferences({
      issuesOpen: isIssuesOpen,
      recommendationsOpen: isRecommendationsOpen,
      fullReportOpen: isFullReportOpen,
    })
  }, [isFullReportOpen, isIssuesOpen, isRecommendationsOpen])

  const restoreCachedResult = useCallback((
    nextFile: File | null,
    nextMarketplace: string,
  ) => {
    if (!nextFile || nextMarketplace === 'general') {
      setResult(null)
      setError(null)
      setLoadedFromCache(false)
      return
    }

    const cachedResult = getCachedCompliance(
      buildComplianceCacheKey(nextFile, nextMarketplace)
    )

    setResult(cachedResult)
    setError(null)
    setLoadedFromCache(Boolean(cachedResult))
  }, [])

  const handleFile = useCallback((f: File) => {
    setFile(f)
    setCopied(false)
    restoreCachedResult(f, marketplace)
  }, [marketplace, restoreCachedResult])

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

    const cacheKey = buildComplianceCacheKey(file, marketplace)
    const cachedResult = getCachedCompliance(cacheKey)
    if (cachedResult) {
      setResult(cachedResult)
      setError(null)
      setLoadedFromCache(true)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const data = await api.checkCompliance(file, marketplace)
      setResult(data)
      setCachedCompliance(cacheKey, data)
      setLoadedFromCache(false)
      saveToHistory(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Compliance check failed')
    } finally {
      setLoading(false)
    }
  }

  const handleMarketplaceChange = useCallback((nextMarketplace: string) => {
    setMarketplace(nextMarketplace)
    setCopied(false)
    restoreCachedResult(file, nextMarketplace)
  }, [file, restoreCachedResult])

  const parsed = result ? parseCompliance(result.analysis) : null

  const severityIcon = (s: string) => {
    switch (s) {
      case 'critical': return <XCircle size={15} className="issue-icon critical" />
      case 'warning': return <AlertTriangle size={15} className="issue-icon warning" />
      default: return <Info size={15} className="issue-icon info" />
    }
  }

  return (
    <div className="section-compliance section-compliance-report">
      <div className="hero-header-row compliance-report-hero">
        <span className="hero-kicker">Marketplace rules</span>
        <h1 className="hero-title hero-title-inline">Compliance Check</h1>
        <p className="hero-subtitle hero-subtitle-inline">Audit images for marketplace rules</p>
        <div className="compliance-report-marketplace-wrap">
          <MarketplaceSelector
            selected={marketplace}
            onSelect={handleMarketplaceChange}
            className="compliance-report-marketplace-selector"
          />
        </div>
      </div>

      <div className="compliance-intake-panel">
        <div className="compliance-intake-copy">
          <div>
            <span className="fix-workspace-label">Audit Session</span>
            <strong>{auditSessionLabel}</strong>
          </div>
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
          onClick={() => inputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragActive(true) }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
        >
          <input ref={inputRef} type="file" accept=".png,.jpg,.jpeg,.webp" onChange={handleFileChange} style={{ display: 'none' }} />
          <div className="drop-content">
            {file ? (
              <div className="file-info">
                <span className="drop-icon"><File /></span>
                <span className="file-name">{file.name}</span>
                <span className="file-size">{formatFileSize(file.size)}</span>
              </div>
            ) : (
              <>
                <span className="drop-icon"><Download /></span>
                <span className="drop-text">Drop product photo here</span>
                <span className="drop-hint">PNG, JPG, WebP</span>
              </>
            )}
          </div>
        </div>
      </div>

      <button className="scan-btn workspace-primary-action compliance-primary-action" onClick={handleCheck} disabled={!file || loading || marketplace === 'general'}>
        {loading ? (<><span className="spinner"></span>Checking compliance...</>) : (<><ScanSearch size={20} />Check Compliance</>)}
      </button>

      {error && (
        <div className="results-panel" style={{ borderColor: '#ef4444' }}>
          <div className="results-content" style={{ color: '#ef4444' }}>{error}</div>
        </div>
      )}

      {result && parsed && (
        <div className="compliance-report-stack">
          {/* Pass/Fail Banner */}
          {parsed.status !== 'unknown' && (
            <div className={`compliance-banner ${parsed.status}`}>
              {parsed.status === 'pass'
                ? <><CheckCircle size={22} /> Compliant with {result.marketplace} requirements</>
                : <><ShieldX size={22} /> Does not meet {result.marketplace} requirements</>
              }
            </div>
          )}

          <div className="compliance-summary-grid">
            <div className="compliance-decision-card compliance-decision-card-wide">
              <span className="compliance-decision-label">Assessment</span>
              <strong>
                {parsed.status === 'pass' && 'Ready for upload'}
                {parsed.status === 'fail' && 'Needs correction'}
                {parsed.status === 'unknown' && 'Review report manually'}
              </strong>
              <span className="compliance-decision-note">
                {parsed.issues.length} issues found · {parsed.recommendations.length} suggested actions
              </span>
            </div>

            {parsed.score !== null && (
              <div className="compliance-decision-card compliance-stat-card">
                <span className="compliance-decision-label">Score</span>
                <strong>{parsed.score}/10</strong>
                <div className="quality-bar-wrap compact">
                  <div className="quality-bar">
                    <div
                      className={`quality-bar-fill ${parsed.score >= 7 ? 'score-high' : parsed.score >= 4 ? 'score-mid' : 'score-low'}`}
                      style={{ width: `${parsed.score * 10}%` }}
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="compliance-decision-card compliance-stat-card">
              <span className="compliance-decision-label">Issues</span>
              <strong>{parsed.issues.length}</strong>
              <span className="compliance-decision-note">Critical, warning, and info findings in the current audit.</span>
            </div>

            <div className="compliance-decision-card compliance-stat-card">
              <span className="compliance-decision-label">Recommendations</span>
              <strong>{parsed.recommendations.length}</strong>
              <span className="compliance-decision-note">Actionable guidance produced from the report.</span>
            </div>

            {parsed.status === 'fail' && file && marketplace !== 'general' && onOpenFixStudio && (
              <div className="compliance-decision-card compliance-decision-action compliance-decision-card-wide">
                <span className="compliance-decision-label">Next Step</span>
                <strong>Open Fix Studio</strong>
                <span className="compliance-decision-note">
                  Continue with the same file and marketplace in the correction workspace.
                </span>
                <button
                  className="secondary-btn compliance-open-fix-btn"
                  data-testid="open-fix-studio-button"
                  onClick={() => onOpenFixStudio(file, marketplace)}
                >
                  <WandSparkles size={15} />Open in Fix Studio<ArrowRight size={15} />
                </button>
              </div>
            )}
          </div>

          <div className="compliance-detail-grid">
            {/* Issues */}
            {parsed.issues.length > 0 && (
              <div className="result-section compliance-detail-section">
                <button
                  className="compliance-section-toggle"
                  data-testid="issues-toggle"
                  onClick={() => setIsIssuesOpen((currentValue) => !currentValue)}
                  aria-expanded={isIssuesOpen}
                >
                  <span className="result-section-title"><AlertTriangle size={16} /> Issues Found</span>
                  <span className="compliance-section-toggle-meta">
                    <span className="compliance-section-counter">{parsed.issues.length}</span>
                    <ChevronDown size={16} className={`compliance-report-toggle-icon ${isIssuesOpen ? 'open' : ''}`} />
                  </span>
                </button>
                {isIssuesOpen && (
                  <div data-testid="issues-body">
                    {parsed.issues.map((issue, i) => (
                      <div key={i} className="issue-item">
                        {severityIcon(issue.severity)}
                        <div className="issue-text">
                          <MarkdownContent content={issue.text} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Recommendations */}
            {parsed.recommendations.length > 0 && (
              <div className="result-section compliance-detail-section">
                <button
                  className="compliance-section-toggle"
                  data-testid="recommendations-toggle"
                  onClick={() => setIsRecommendationsOpen((currentValue) => !currentValue)}
                  aria-expanded={isRecommendationsOpen}
                >
                  <span className="result-section-title"><CheckCircle size={16} /> Recommendations</span>
                  <span className="compliance-section-toggle-meta">
                    <span className="compliance-section-counter">{parsed.recommendations.length}</span>
                    <ChevronDown size={16} className={`compliance-report-toggle-icon ${isRecommendationsOpen ? 'open' : ''}`} />
                  </span>
                </button>
                {isRecommendationsOpen && (
                  <div data-testid="recommendations-body">
                    <ul className="improvement-list">
                      {parsed.recommendations.map((rec, i) => (
                        <li key={i}>
                          <Zap size={14} />
                          <div className="list-item-markdown">
                            <MarkdownContent content={rec} />
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Full report copy */}
          <div className="result-section compliance-report-full">
            <button
              className="compliance-report-toggle"
              data-testid="full-report-toggle"
              onClick={() => setIsFullReportOpen((currentValue) => !currentValue)}
              aria-expanded={isFullReportOpen}
            >
              <span className="result-section-title"><ShieldCheck size={16} /> Full Report</span>
              <span className="compliance-report-toggle-meta">
                <span>{isFullReportOpen ? 'Hide raw analysis' : 'Show raw analysis'}</span>
                <ChevronDown size={16} className={`compliance-report-toggle-icon ${isFullReportOpen ? 'open' : ''}`} />
              </span>
            </button>
            {isFullReportOpen && (
              <div data-testid="full-report-body">
                <div className="result-section-header compliance-report-actions">
                  <span className="compliance-report-hint">Expanded report keeps the original analysis text intact.</span>
                  <button className="copy-btn-small" onClick={() => {
                    navigator.clipboard.writeText(result.analysis)
                    setCopied(true)
                    setTimeout(() => setCopied(false), 1500)
                  }}>
                    {copied ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy</>}
                  </button>
                </div>
                <div className="result-section-body">
                  <MarkdownContent content={result.analysis} />
                </div>
              </div>
            )}
          </div>

          {result.tokens_used > 0 && (
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {loadedFromCache && (
                <div className="cache-badge">Loaded from cache</div>
              )}
              <div className="tokens-badge"><Zap size={12} /> {result.tokens_used} tokens</div>
            </div>
          )}

          {result.tokens_used <= 0 && loadedFromCache && (
            <div className="cache-badge">Loaded from cache</div>
          )}
        </div>
      )}
    </div>
  )
}
