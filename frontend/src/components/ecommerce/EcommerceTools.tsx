import { useState, useCallback, useRef } from 'react'
import {
  ScanSearch, Download, File, DollarSign,
  MessageSquare, ClipboardList, Zap, Copy, Check, Target, Search, BadgePercent,
} from 'lucide-react'
import { api } from '../../api/client'
import type {
  AnalysisResult,
  DetectedObject,
  InventoryCheckMetadata,
  ObjectDetectionResult,
  TextDetectionResult,
  TextRegion,
} from '../../api/types'
import { saveToHistory } from '../../hooks/useHistory'
import { useObjectUrlPreview } from '../../hooks/useObjectUrlPreviews'
import { MarkdownContent } from '../MarkdownContent'
import { formatFileSize } from '../../utils/analysis'

type ToolResponse = AnalysisResult
type ToolInputMode = 'image' | 'listing'
type ListingSourceMode = 'url' | 'manual'

interface Tool {
  id: string
  name: string
  description: string
  icon: React.ComponentType<{ size?: number }>
  templateKey?: string
  inputMode: ToolInputMode
}

interface InventoryBox {
  id: string
  label: string
  bbox: number[]
  kind: 'object' | 'text'
  confidence?: number
}

function isInventoryMetadata(metadata: AnalysisResult['metadata']): metadata is InventoryCheckMetadata {
  return Boolean(
    metadata
    && typeof metadata === 'object'
    && 'object_detection' in metadata
    && 'text_detection' in metadata,
  )
}

function getInventoryMetadata(result: ToolResponse | null): InventoryCheckMetadata | null {
  if (!result || !isInventoryMetadata(result.metadata)) return null
  return result.metadata
}

function getDetectedObjects(objectDetection?: ObjectDetectionResult): DetectedObject[] {
  return objectDetection?.objects ?? []
}

function getObjectMix(objects: DetectedObject[]): Array<{ label: string; count: number; avgConfidence: number }> {
  const byLabel = new Map<string, { count: number; confidenceSum: number }>()

  objects.forEach((object) => {
    const current = byLabel.get(object.label) ?? { count: 0, confidenceSum: 0 }
    current.count += 1
    current.confidenceSum += object.confidence
    byLabel.set(object.label, current)
  })

  return Array.from(byLabel.entries())
    .map(([label, value]) => ({
      label,
      count: value.count,
      avgConfidence: value.confidenceSum / Math.max(1, value.count),
    }))
    .sort((left, right) => right.count - left.count)
}

function getTopObjectMix(objectMix: Array<{ label: string; count: number; avgConfidence: number }>) {
  return objectMix.slice(0, 6)
}

function getInventoryBoxes(
  objectDetection?: ObjectDetectionResult,
  textDetection?: TextDetectionResult,
): InventoryBox[] {
  const objectBoxes = getDetectedObjects(objectDetection).map((object, index) => ({
    id: `object-${object.label}-${index}`,
    label: object.label,
    bbox: object.bbox,
    kind: 'object' as const,
    confidence: object.confidence,
  }))
  const textBoxes = (textDetection?.regions ?? []).map((region: TextRegion, index) => ({
    id: `text-${index}`,
    label: region.text || 'text',
    bbox: region.bbox,
    kind: 'text' as const,
    confidence: region.confidence,
  }))

  return [...objectBoxes, ...textBoxes]
}

const TOOLS: Tool[] = [
  {
    id: 'competitor-insights',
    name: 'Competitor Insights',
    description: 'See the angle',
    icon: Target,
    templateKey: 'ecommerce_competitor_insights',
    inputMode: 'listing',
  },
  {
    id: 'keyword-gap',
    name: 'Keyword Gap',
    description: 'Find missing demand',
    icon: Search,
    templateKey: 'ecommerce_keyword_gap',
    inputMode: 'listing',
  },
  {
    id: 'usp-extractor',
    name: 'USP Extractor',
    description: 'Surface ownable claims',
    icon: BadgePercent,
    templateKey: 'ecommerce_usp_extractor',
    inputMode: 'listing',
  },
  {
    id: 'pricing',
    name: 'Pricing Analysis',
    description: 'Read value signals',
    icon: DollarSign,
    templateKey: 'ecommerce_price',
    inputMode: 'listing',
  },
  {
    id: 'sentiment',
    name: 'Review Sentiment',
    description: 'Hear buyer patterns',
    icon: MessageSquare,
    templateKey: 'ecommerce_sentiment',
    inputMode: 'listing',
  },
  {
    id: 'inventory',
    name: 'Object Scan',
    description: 'Detect every object',
    icon: ClipboardList,
    inputMode: 'image',
  },
]

export function EcommerceTools() {
  const [selectedTool, setSelectedTool] = useState(TOOLS[0])
  const [file, setFile] = useState<File | null>(null)
  const [listingSourceMode, setListingSourceMode] = useState<ListingSourceMode>('url')
  const [listingUrl, setListingUrl] = useState('')
  const [listingText, setListingText] = useState('')
  const [dragActive, setDragActive] = useState<string | null>(null)
  const singleInputRef = useRef<HTMLInputElement>(null)

  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ToolResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [previewImageSize, setPreviewImageSize] = useState<{ width: number; height: number } | null>(null)
  const preview = useObjectUrlPreview(file)

  const handleFile = useCallback((f: File) => {
    setFile(f)
    setResult(null)
    setError(null)
    setPreviewImageSize(null)
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) handleFile(e.target.files[0])
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(null)
    if (e.dataTransfer.files?.[0]) {
      handleFile(e.dataTransfer.files[0])
    }
  }, [handleFile])

  const handleAnalyze = async () => {
    setLoading(true)
    setError(null)
    try {
      let response: ToolResponse | null = null

      if (selectedTool.id === 'inventory') {
        if (!file) return
        response = await api.inventoryCheck(file)
      } else if (selectedTool.inputMode === 'listing' && selectedTool.templateKey) {
        response = await api.analyzeListing(listingSourceMode, {
          listingUrl,
          listingText,
          templateKey: selectedTool.templateKey,
        })
      } else if (selectedTool.templateKey) {
        if (!file) return
        response = await api.analyze(file, '', { templateKey: selectedTool.templateKey })
      }

      setResult(response)
      if (response) {
        const analysisResponse = response as AnalysisResult
        const historyFilename = selectedTool.inputMode === 'listing'
          ? analysisResponse.filename
          : file?.name ?? analysisResponse.filename

        saveToHistory({
          success: true,
          filename: historyFilename,
          analysis: analysisResponse.analysis,
          metadata: analysisResponse.metadata,
          timestamp: analysisResponse.timestamp,
          tokens_used: analysisResponse.tokens_used,
        })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed')
    } finally {
      setLoading(false)
    }
  }

  const resultText = result?.analysis ?? null
  const tokensUsed = result?.tokens_used ?? 0
  const isListingTool = selectedTool.inputMode === 'listing'
  const inventoryMetadata = selectedTool.id === 'inventory' ? getInventoryMetadata(result) : null
  const inventoryObjectDetection = inventoryMetadata?.object_detection
  const inventoryTextDetection = inventoryMetadata?.text_detection
  const detectedObjects = getDetectedObjects(inventoryObjectDetection)
  const objectMix = getObjectMix(detectedObjects)
  const topObjectMix = getTopObjectMix(objectMix)
  const maxObjectMixCount = topObjectMix[0]?.count ?? 0
  const inventoryBoxes = getInventoryBoxes(inventoryObjectDetection, inventoryTextDetection)
  const inventoryFlags = Array.from(new Set([
    ...(inventoryObjectDetection?.warnings ?? []),
    ...(inventoryTextDetection?.warnings ?? []),
  ]))
  const inventoryVisionReview = inventoryMetadata?.vision_review
  const inventoryTextSamples = (inventoryTextDetection?.regions ?? [])
    .map((region) => region.text.trim())
    .filter(Boolean)
    .slice(0, 6)
  const canAnalyze = isListingTool
      ? (listingSourceMode === 'url' ? Boolean(listingUrl.trim()) : Boolean(listingText.trim()))
      : Boolean(file)

  return (
    <>
      <div className="hero-header-row hero-header-stacked">
        <span className="hero-kicker">Focused analyses</span>
        <h1 className="hero-title hero-title-inline">Additional Tools</h1>
        <p className="hero-subtitle hero-subtitle-inline">Extra checks for listings</p>
      </div>

      {/* Tools Grid */}
      <div className="tools-grid">
        {TOOLS.map(tool => {
          const IconComp = tool.icon
          return (
            <div
              key={tool.id}
              className={`tool-card ${selectedTool.id === tool.id ? 'active' : ''}`}
              onClick={() => {
                setSelectedTool(tool)
                setResult(null)
                setError(null)
              }}
            >
              <div className="tool-card-icon"><IconComp size={17} /></div>
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
        <div className="selected-tool-banner-main">
          {(() => { const IC = selectedTool.icon; return <IC size={18} /> })()}
          <div className="selected-tool-banner-copy">
            <span className="fix-workspace-label">Active Tool</span>
            <strong>{selectedTool.name}</strong>
          </div>
        </div>
        {selectedTool.id === 'inventory' && (
          <span className="selected-tool-pill">YOLO + OCR</span>
        )}
      </div>

      {isListingTool && (
        <div className="listing-tool-panel">
          <div className="listing-source-toggle" role="tablist" aria-label="Listing input mode">
            <button
              type="button"
              className={`listing-source-button ${listingSourceMode === 'url' ? 'active' : ''}`}
              onClick={() => setListingSourceMode('url')}
            >
              Try Parse by Link
            </button>
            <button
              type="button"
              className={`listing-source-button ${listingSourceMode === 'manual' ? 'active' : ''}`}
              onClick={() => setListingSourceMode('manual')}
            >
              Paste Manually
            </button>
          </div>

          {listingSourceMode === 'url' ? (
            <div className="listing-input-card">
              <div className="listing-input-title">Public product URL</div>
              <div className="listing-input-note">Pull a public listing when the page is readable.</div>
              <input
                type="url"
                className="setting-input"
                placeholder="https://marketplace.example.com/product/..."
                value={listingUrl}
                onChange={(event) => setListingUrl(event.target.value)}
              />
            </div>
          ) : (
            <div className="listing-input-card">
              <div className="listing-input-title">Paste card content manually</div>
              <div className="listing-input-note">Paste the core listing copy when parsing falls short.</div>
              <textarea
                className="setting-input listing-textarea"
                placeholder="Paste the listing title, price, bullets, seller notes, and customer reviews here..."
                value={listingText}
                onChange={(event) => setListingText(event.target.value)}
                rows={10}
              />
            </div>
          )}
        </div>
      )}

      {isListingTool ? null : (
        /* ===== SINGLE UPLOAD ===== */
        <>
          {preview && (
            <div className="image-preview">
              <div className="image-preview-stage">
                <img
                  src={preview}
                  alt="Product preview"
                  onLoad={(event) => {
                    setPreviewImageSize({
                      width: event.currentTarget.naturalWidth,
                      height: event.currentTarget.naturalHeight,
                    })
                  }}
                />
                {selectedTool.id === 'inventory' && inventoryBoxes.length > 0 && previewImageSize && (
                  <div className="inventory-preview-overlay" aria-hidden="true">
                    {inventoryBoxes.map((box) => {
                      const [x1, y1, x2, y2] = box.bbox
                      const left = (x1 / previewImageSize.width) * 100
                      const top = (y1 / previewImageSize.height) * 100
                      const width = ((x2 - x1) / previewImageSize.width) * 100
                      const height = ((y2 - y1) / previewImageSize.height) * 100

                      return (
                        <div
                          key={box.id}
                          className={`inventory-box inventory-box-${box.kind}`}
                          style={{ left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%` }}
                        >
                          <span className="inventory-box-label">{box.label}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
              <div className="image-preview-info">
                <span>{file?.name}</span>
                <span>{file ? formatFileSize(file.size) : ''}</span>
              </div>
              {selectedTool.id === 'inventory' && inventoryBoxes.length > 0 && (
                <div className="inventory-overlay-legend">
                  <span className="inventory-legend-chip inventory-legend-chip-object">Objects</span>
                  <span className="inventory-legend-chip inventory-legend-chip-text">OCR Text</span>
                </div>
              )}
            </div>
          )}

          <div
            className={`file-drop ${file ? 'has-file' : ''} ${dragActive === 'single' ? 'drag-active' : ''}`}
            onClick={() => singleInputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragActive('single') }}
            onDragLeave={() => setDragActive(null)}
            onDrop={handleDrop}
          >
            <input ref={singleInputRef} type="file" accept=".png,.jpg,.jpeg,.webp" onChange={handleFileChange} style={{ display: 'none' }} />
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
                  <span className="drop-text">{selectedTool.id === 'inventory' ? 'Drop scene photo here' : 'Drop product photo here'}</span>
                  <span className="drop-hint">PNG, JPG, WebP</span>
                </>
              )}
            </div>
          </div>
        </>
      )}

      <button className="scan-btn workspace-primary-action" onClick={handleAnalyze} disabled={!canAnalyze || loading}>
        {loading
          ? (<><span className="spinner"></span>Running {selectedTool.name}...</>)
          : (<><ScanSearch size={20} />{selectedTool.name}</>)}
      </button>

      {error && (
        <div className="results-panel" style={{ borderColor: '#ef4444' }}>
          <div className="results-content" style={{ color: '#ef4444' }}>{error}</div>
        </div>
      )}

      {resultText && (
        <div style={{ marginTop: '2rem' }}>
          {selectedTool.id === 'inventory' && inventoryMetadata ? (
            <>
              <div className="inventory-summary-grid">
                <div className="inventory-summary-card">
                  <span className="inventory-summary-label">Detected Objects</span>
                  <strong className="inventory-summary-value">{detectedObjects.length}</strong>
                  <span className="inventory-summary-note">Every visible detection in frame</span>
                </div>
                <div className="inventory-summary-card">
                  <span className="inventory-summary-label">Object Classes</span>
                  <strong className="inventory-summary-value">{objectMix.length}</strong>
                  <span className="inventory-summary-note">Distinct labels found by the model</span>
                </div>
                <div className="inventory-summary-card">
                  <span className="inventory-summary-label">OCR Reads</span>
                  <strong className="inventory-summary-value">{inventoryTextDetection?.total_text_regions ?? 0}</strong>
                  <span className="inventory-summary-note">Readable text extracted from frame</span>
                </div>
                <div className="inventory-summary-card">
                  <span className="inventory-summary-label">Scene Flags</span>
                  <strong className="inventory-summary-value">{inventoryFlags.length}</strong>
                  <span className="inventory-summary-note">Detection or OCR caveats surfaced</span>
                </div>
              </div>

              <div className="result-section inventory-chart-card">
                <div className="result-section-header">
                  <span className="result-section-title">
                    <Target size={16} />
                    Object Mix
                  </span>
                </div>
                {topObjectMix.length > 0 ? (
                  <div className="inventory-bar-chart" aria-label="Object distribution chart">
                    {topObjectMix.map((entry) => {
                      const width = maxObjectMixCount > 0
                        ? Math.max(12, Math.round((entry.count / maxObjectMixCount) * 100))
                        : 0

                      return (
                        <div key={entry.label} className="inventory-bar-row">
                          <div className="inventory-bar-meta">
                            <span className="inventory-bar-label">{entry.label}</span>
                            <span className="inventory-bar-value">{entry.count}</span>
                          </div>
                          <div className="inventory-bar-track" aria-hidden="true">
                            <div className="inventory-bar-fill" style={{ width: `${width}%` }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="inventory-empty-state">No object distribution is available for this frame.</div>
                )}
                <div className="inventory-footnote">
                  Top detected classes by count. This chart is generated directly from YOLO detections.
                </div>
              </div>

              <div className="inventory-detail-grid">
                <div className="result-section inventory-detail-card">
                  <div className="result-section-header">
                    <span className="result-section-title">
                      <ClipboardList size={16} />
                      Detection Breakdown
                    </span>
                  </div>
                  <div className="inventory-detail-list">
                    {objectMix.length > 0 ? objectMix.map((entry) => (
                      <div key={entry.label} className="inventory-detail-item">
                        <div>
                          <strong>{entry.label}</strong>
                          <span>{entry.count} detection{entry.count === 1 ? '' : 's'}</span>
                        </div>
                        <span>{Math.round(entry.avgConfidence * 100)}% conf</span>
                      </div>
                    )) : (
                      <div className="inventory-empty-state">No object detections found in this frame.</div>
                    )}
                  </div>
                </div>

                <div className="result-section inventory-detail-card">
                  <div className="result-section-header">
                    <span className="result-section-title">
                      <MessageSquare size={16} />
                      OCR Text
                    </span>
                  </div>
                  {inventoryTextSamples.length > 0 ? (
                    <div className="inventory-chip-list">
                      {inventoryTextSamples.map((textSample, index) => (
                        <span key={`${textSample}-${index}`} className="inventory-text-chip">{textSample}</span>
                      ))}
                    </div>
                  ) : (
                    <div className="inventory-empty-state">No readable text detected.</div>
                  )}
                  {typeof inventoryTextDetection?.text_coverage_ratio === 'number' && (
                    <div className="inventory-footnote">
                      Text covers {Math.round(inventoryTextDetection.text_coverage_ratio * 100)}% of the image area.
                    </div>
                  )}
                </div>

                <div className="result-section inventory-detail-card">
                  <div className="result-section-header">
                    <span className="result-section-title">
                      <Target size={16} />
                      Model Notes
                    </span>
                  </div>
                  <div className="inventory-flag-list">
                    {inventoryFlags.length > 0 ? inventoryFlags.map((flag, index) => (
                      <div key={`${flag}-${index}`} className="inventory-flag-item">{flag}</div>
                    )) : (
                      <div className="inventory-empty-state">No major detection issues were flagged.</div>
                    )}
                  </div>
                </div>
              </div>

              {inventoryVisionReview?.text && (
                <div className="result-section inventory-detail-card">
                  <div className="result-section-header">
                    <span className="result-section-title">
                      <ScanSearch size={16} />
                      Vision Review
                    </span>
                    <div className="fix-stage-status-row">
                      {inventoryVisionReview.provider && (
                        <div className="cache-badge">{inventoryVisionReview.provider}</div>
                      )}
                      {inventoryVisionReview.model && (
                        <div className="cache-badge">{inventoryVisionReview.model}</div>
                      )}
                    </div>
                  </div>
                  <div className="result-section-body">
                    <MarkdownContent content={inventoryVisionReview.text} />
                  </div>
                </div>
              )}

              {!inventoryVisionReview?.text && inventoryVisionReview?.reason && (
                <div className="inventory-footnote">{inventoryVisionReview.reason}</div>
              )}
            </>
          ) : null}

          <div className="result-section">
            <div className="result-section-header">
              <span className="result-section-title">
                {(() => { const IC = selectedTool.icon; return <IC size={16} /> })()}
                {`${selectedTool.name} Results`}
              </span>
              <button className="copy-btn-small" onClick={() => {
                navigator.clipboard.writeText(resultText)
                setCopied(true)
                setTimeout(() => setCopied(false), 1500)
              }}>
                {copied ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy</>}
              </button>
            </div>
            <div className="result-section-body">
              {selectedTool.id === 'inventory' && inventoryMetadata
                ? <div className="inventory-footnote">This view is driven by model detections and OCR, not LLM guesswork. The narrative summary remains available for copy and export.</div>
                : <MarkdownContent content={resultText} />}
            </div>
          </div>

          {tokensUsed > 0 && (
            <div className="tokens-badge"><Zap size={12} /> {tokensUsed} tokens</div>
          )}
        </div>
      )}
    </>
  )
}
