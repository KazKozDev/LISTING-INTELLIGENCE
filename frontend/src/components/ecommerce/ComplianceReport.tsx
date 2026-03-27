import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { ArrowRight, ChevronDown, ScanSearch, Download, File, ShieldCheck, ShieldX, CheckCircle, XCircle, AlertTriangle, Info, Copy, Check, Zap, WandSparkles } from 'lucide-react'
import { api } from '../../api/client'
import type { ComplianceCheckResponse, ComplianceFinding, ProductContext } from '../../api/types'
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
  onOpenFixStudio?: (file: File, marketplace: string, productContext?: ProductContext) => void
}

function buildProductContextCacheToken(productContext?: ProductContext) {
  if (!productContext) {
    return 'no-context'
  }

  return JSON.stringify({
    title: productContext.title.trim(),
    category: productContext.category.trim(),
    attributes: productContext.attributes.trim(),
    referenceImageName: productContext.referenceImage?.name ?? productContext.referenceImageName ?? '',
  })
}

function buildOverlayRects(findings: ComplianceFinding[]) {
  return findings
    .map((finding) => {
      const bbox = finding.evidence?.bbox
      const measured = finding.evidence?.measured ?? {}
      const imageWidth = Number(measured.image_width)
      const imageHeight = Number(measured.image_height)

      if (!bbox || bbox.length !== 4 || !imageWidth || !imageHeight) {
        return null
      }

      const [x1, y1, x2, y2] = bbox
      return {
        key: `${finding.source}:${finding.code}`,
        label: finding.label,
        severity: finding.severity,
        left: `${(x1 / imageWidth) * 100}%`,
        top: `${(y1 / imageHeight) * 100}%`,
        width: `${((x2 - x1) / imageWidth) * 100}%`,
        height: `${((y2 - y1) / imageHeight) * 100}%`,
      }
    })
    .filter((value): value is NonNullable<typeof value> => Boolean(value))
}

function renderFindingEvidence(finding: ComplianceFinding) {
  const measuredEntries = Object.entries(finding.evidence?.measured ?? {})
  const excerpts = finding.evidence?.excerpts ?? []

  return (
    <div className="compliance-finding-evidence">
      <div className="compliance-finding-meta">
        <span className={`history-meta-chip finding-source-chip source-${finding.source}`}>Source: {finding.source}</span>
        {finding.verification_tier && (
          <span className={`history-meta-chip finding-tier-chip tier-${finding.verification_tier}`}>{finding.verification_tier.replace(/_/g, ' ')}</span>
        )}
        {typeof finding.confidence === 'number' && (
          <span className="history-meta-chip">Confidence: {Math.round(finding.confidence * 100)}%</span>
        )}
        {finding.evidence?.bbox?.length === 4 && (
          <span className="history-meta-chip">BBox: {finding.evidence.bbox.join(', ')}</span>
        )}
      </div>
      {measuredEntries.length > 0 && (
        <div className="compliance-finding-detail">
          <span className="fix-workspace-label">Measured</span>
          <span>{measuredEntries.map(([key, value]) => `${key}: ${String(value)}`).join(' · ')}</span>
        </div>
      )}
      {excerpts.length > 0 && (
        <div className="compliance-finding-detail">
          <span className="fix-workspace-label">Excerpts</span>
          <span>{excerpts.join(' · ')}</span>
        </div>
      )}
      {finding.evidence?.warning && (
        <div className="compliance-finding-detail">
          <span className="fix-workspace-label">Detector Note</span>
          <span>{finding.evidence.warning}</span>
        </div>
      )}
    </div>
  )
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
  const [productTitle, setProductTitle] = useState('')
  const [productCategory, setProductCategory] = useState('')
  const [productAttributes, setProductAttributes] = useState('')
  const [referenceImage, setReferenceImage] = useState<File | null>(null)
  const [loadedFromCache, setLoadedFromCache] = useState(false)
  const [isFullReportOpen, setIsFullReportOpen] = useState(persistedUiPreferences?.fullReportOpen ?? false)
  const [isIssuesOpen, setIsIssuesOpen] = useState(persistedUiPreferences?.issuesOpen ?? true)
  const [isRecommendationsOpen, setIsRecommendationsOpen] = useState(persistedUiPreferences?.recommendationsOpen ?? true)
  const inputRef = useRef<HTMLInputElement>(null)
  const referenceInputRef = useRef<HTMLInputElement>(null)
  const preview = useObjectUrlPreview(file)
  const auditSessionLabel = file?.name ?? 'Waiting for product image'
  const productContext = useMemo<ProductContext | undefined>(() => {
    const title = productTitle.trim()
    const category = productCategory.trim()
    const attributes = productAttributes.trim()
    const referenceImageName = referenceImage?.name ?? null

    if (!title && !category && !attributes && !referenceImageName) {
      return undefined
    }

    return {
      title,
      category,
      attributes,
      referenceImage,
      referenceImageName,
    }
  }, [productAttributes, productCategory, productTitle, referenceImage])
  const complianceCacheKey = useMemo(
    () => (file && marketplace !== 'general'
      ? `${buildComplianceCacheKey(file, marketplace)}::${buildProductContextCacheToken(productContext)}`
      : null),
    [file, marketplace, productContext],
  )

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
    nextProductContext?: ProductContext,
  ) => {
    if (!nextFile || nextMarketplace === 'general') {
      setResult(null)
      setError(null)
      setLoadedFromCache(false)
      return
    }

    const cachedResult = getCachedCompliance(
      `${buildComplianceCacheKey(nextFile, nextMarketplace)}::${buildProductContextCacheToken(nextProductContext)}`
    )

    setResult(cachedResult)
    setError(null)
    setLoadedFromCache(Boolean(cachedResult))
  }, [])

  const handleFile = useCallback((f: File) => {
    setFile(f)
    setCopied(false)
    restoreCachedResult(f, marketplace, productContext)
  }, [marketplace, productContext, restoreCachedResult])

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

    const cacheKey = complianceCacheKey
    const cachedResult = cacheKey ? getCachedCompliance(cacheKey) : null
    if (cachedResult) {
      setResult(cachedResult)
      setError(null)
      setLoadedFromCache(true)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const data = await api.checkCompliance(file, marketplace, productContext)
      setResult(data)
      if (cacheKey) {
        setCachedCompliance(cacheKey, data)
      }
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
    restoreCachedResult(file, nextMarketplace, productContext)
  }, [file, productContext, restoreCachedResult])

  useEffect(() => {
    restoreCachedResult(file, marketplace, productContext)
  }, [file, marketplace, productContext, restoreCachedResult])

  const parsed = result ? parseCompliance(result.analysis) : null
  const structuredFindings = result?.findings ?? []
  const overlayRects = buildOverlayRects(structuredFindings)

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

        <div className="compliance-context-panel">
          <div className="compliance-context-grid">
            <label className="compliance-context-field">
              <span className="fix-workspace-label">Product Title</span>
              <input
                className="setting-input"
                type="text"
                value={productTitle}
                onChange={(event) => setProductTitle(event.target.value)}
                placeholder="Optional title or SKU naming"
              />
            </label>

            <label className="compliance-context-field">
              <span className="fix-workspace-label">Category Profile</span>
              <input
                className="setting-input"
                type="text"
                value={productCategory}
                onChange={(event) => setProductCategory(event.target.value)}
                placeholder="electronics, fashion, beauty..."
              />
            </label>
          </div>

          <label className="compliance-context-field">
            <span className="fix-workspace-label">Attributes</span>
            <textarea
              className="setting-input compliance-context-textarea"
              value={productAttributes}
              onChange={(event) => setProductAttributes(event.target.value)}
              placeholder="Color, variant, pack count, model, condition, allowed accessories..."
            />
          </label>

          <div className="compliance-context-reference">
            <div>
              <span className="fix-workspace-label">Reference Image</span>
              <strong>{referenceImage?.name ?? 'Optional catalog or official reference image'}</strong>
            </div>
            <button
              type="button"
              className="secondary-btn compliance-context-action"
              onClick={() => referenceInputRef.current?.click()}
            >
              {referenceImage ? 'Replace Reference' : 'Add Reference'}
            </button>
            <input
              ref={referenceInputRef}
              type="file"
              accept=".png,.jpg,.jpeg,.webp"
              onChange={(event) => setReferenceImage(event.target.files?.[0] ?? null)}
              style={{ display: 'none' }}
            />
          </div>
        </div>

        {preview && (
          <div className="image-preview">
            <div className="image-preview-stage">
              <img src={preview} alt="Product preview" />
              {overlayRects.length > 0 && (
                <div className="verification-overlay">
                  {overlayRects.map((rect) => (
                    <div
                      key={rect.key}
                      className={`verification-box severity-${rect.severity}`}
                      style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }}
                      title={rect.label}
                    >
                      <span>{rect.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
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
        {loading ? (<><span className="spinner"></span>Running assessment...</>) : (<><ScanSearch size={20} />Run Assessment</>)}
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
                ? <><CheckCircle size={22} /> Assessment suggests alignment with {result.marketplace} requirements</>
                : <><ShieldX size={22} /> Assessment flags likely issues against {result.marketplace} requirements</>
              }
            </div>
          )}

          <div className="compliance-summary-grid">
            <div className="compliance-decision-card compliance-decision-card-wide">
              <span className="compliance-decision-label">Assessment</span>
              <strong>
                {parsed.status === 'pass' && 'Likely ready for review'}
                {parsed.status === 'fail' && 'Likely needs correction'}
                {parsed.status === 'unknown' && 'Review report manually'}
              </strong>
              <span className="compliance-decision-note">
                {parsed.issues.length} analysis findings · {parsed.recommendations.length} suggested actions
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
              <span className="compliance-decision-note">Critical, warning, and info findings in the current assessment.</span>
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
                  onClick={() => onOpenFixStudio(file, marketplace, productContext)}
                >
                  <WandSparkles size={15} />Open in Fix Studio<ArrowRight size={15} />
                </button>
              </div>
            )}
          </div>

          <div className="compliance-detail-grid">
            {structuredFindings.length > 0 && (
              <div className="result-section compliance-detail-section compliance-detail-section-wide">
                <div className="result-section-header">
                  <span className="result-section-title"><ShieldCheck size={16} /> Verification Signals</span>
                  <span className="compliance-report-toggle-meta">
                    <span className="compliance-section-counter">{structuredFindings.length}</span>
                  </span>
                </div>
                <div className="fix-rail-note-block">
                  <span className="fix-workspace-label">Verifier Scope</span>
                  <span className="fix-rail-note">
                    Rule, OCR, detector, and quality signals rerun on the current image. Category-specific requirements may still need manual review.
                  </span>
                </div>
                <div data-testid="verified-findings-body">
                  {structuredFindings.map((finding) => (
                    <div key={`${finding.source}-${finding.code}`} className="issue-item issue-item-verified">
                      {severityIcon(finding.severity)}
                      <div className="issue-text">
                        <strong>{finding.label}</strong>
                        <p>{finding.summary}</p>
                        {renderFindingEvidence(finding)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

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
                  <span className="compliance-report-hint">Expanded report keeps the original model analysis text intact.</span>
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
