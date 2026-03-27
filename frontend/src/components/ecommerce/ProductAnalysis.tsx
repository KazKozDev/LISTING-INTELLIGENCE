import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ScanSearch, Download, File, ShoppingCart, Lightbulb, Star, Tag, Zap,
  Copy, Check, Upload, FileSpreadsheet, Package, CheckCircle, XCircle,
  List, Search, ClipboardList, GitCompareArrows, Target, ThumbsUp, ThumbsDown,
} from 'lucide-react'

import { api } from '../../api/client'
import type {
  AnalysisResult,
  BatchAnalysisResponse,
  BatchProductResult,
  CompetitorCompareResponse,
  ProductAnalysisResponse,
} from '../../api/types'
import { saveToHistory } from '../../hooks/useHistory'
import {
  useObjectUrlPreview,
  useObjectUrlPreviews,
} from '../../hooks/useObjectUrlPreviews'
import { MarkdownContent } from '../MarkdownContent'
import { MarketplaceSelector } from './MarketplaceSelector'
import {
  buildProductAnalysisCacheKey,
  getCachedBatchAnalysis,
  getCachedProductAnalysis,
  getPersistedProductAnalysisState,
  setCachedBatchAnalysis,
  setCachedProductAnalysis,
  setPersistedProductAnalysisState,
} from '../../utils/analysisCache'
import { formatFileSize } from '../../utils/analysis'
import {
  parseComparisonContent,
  parseProductAnalysisContent,
} from '../../utils/ecommerceParsing'

type ProductAnalysisMode = 'analysis' | 'compare'

export function ProductAnalysis() {
  const persistedStateRef = useRef(getPersistedProductAnalysisState())
  const persistedState = persistedStateRef.current
  const hasPersistedResult = Boolean(
    persistedState?.result || persistedState?.batchResult,
  )

  const [mode, setMode] = useState<ProductAnalysisMode>(
    persistedState?.mode ?? 'analysis',
  )
  const [files, setFiles] = useState<File[]>([])
  const [competitorFile, setCompetitorFile] = useState<File | null>(null)
  const [marketplace, setMarketplace] = useState(
    persistedState?.marketplace ?? 'general',
  )
  const [keywords, setKeywords] = useState(persistedState?.keywords ?? '')
  const [loading, setLoading] = useState(false)
  const [dragActive, setDragActive] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const compareProductInputRef = useRef<HTMLInputElement>(null)
  const competitorInputRef = useRef<HTMLInputElement>(null)

  const [result, setResult] = useState<ProductAnalysisResponse | null>(
    persistedState?.result ?? null,
  )
  const [batchResult, setBatchResult] = useState<BatchAnalysisResponse | null>(
    persistedState?.batchResult ?? null,
  )
  const [compareResult, setCompareResult] = useState<CompetitorCompareResponse | null>(null)

  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [loadedFromCache, setLoadedFromCache] = useState(false)
  const [restoredFromRefresh, setRestoredFromRefresh] = useState(hasPersistedResult)
  const previews = useObjectUrlPreviews(files)
  const competitorPreview = useObjectUrlPreview(competitorFile)

  const isCompareMode = mode === 'compare'
  const isBatchMode = !isCompareMode && files.length > 1
  const primaryFile = files[0] ?? null
  const keywordsStatus = keywords.trim() || 'Waiting for keyword direction'

  const restoreCachedResult = useCallback((
    nextFiles: File[],
    nextMarketplace: string,
    nextKeywords: string,
  ) => {
    if (nextFiles.length === 0) {
      setResult(null)
      setBatchResult(null)
      setError(null)
      setLoadedFromCache(false)
      setRestoredFromRefresh(false)
      return
    }

    const cacheKey = buildProductAnalysisCacheKey(
      nextFiles,
      nextMarketplace,
      nextKeywords,
    )

    if (nextFiles.length > 1) {
      const cachedBatch = getCachedBatchAnalysis(cacheKey)
      setBatchResult(cachedBatch)
      setResult(null)
      setError(null)
      setLoadedFromCache(Boolean(cachedBatch))
      setRestoredFromRefresh(false)
      return
    }

    const cachedResult = getCachedProductAnalysis(cacheKey)
    setResult(cachedResult)
    setBatchResult(null)
    setError(null)
    setLoadedFromCache(Boolean(cachedResult))
    setRestoredFromRefresh(false)
  }, [])

  useEffect(() => {
    setPersistedProductAnalysisState({
      mode,
      marketplace,
      keywords,
      result,
      batchResult,
    })
  }, [batchResult, keywords, marketplace, mode, result])

  const resetCompareState = useCallback(() => {
    setCompareResult(null)
    setError(null)
    setLoadedFromCache(false)
  }, [])

  const handleFiles = useCallback((fileList: File[]) => {
    const normalizedFiles = isCompareMode ? fileList.slice(0, 1) : fileList
    setFiles(normalizedFiles)
    setCopied(null)
    setCompareResult(null)
    setRestoredFromRefresh(false)

    if (isCompareMode) {
      setResult(null)
      setBatchResult(null)
      setError(null)
      setLoadedFromCache(false)
      return
    }

    restoreCachedResult(normalizedFiles, marketplace, keywords)
  }, [isCompareMode, keywords, marketplace, restoreCachedResult])

  const handleCompetitorFile = useCallback((nextFile: File) => {
    setCompetitorFile(nextFile)
    setCopied(null)
    setCompareResult(null)
    setError(null)
    setRestoredFromRefresh(false)
  }, [])

  const handleModeChange = useCallback((nextMode: ProductAnalysisMode) => {
    setMode(nextMode)
    setCopied(null)
    setError(null)
    setLoadedFromCache(false)
    setRestoredFromRefresh(false)

    if (nextMode === 'compare') {
      if (files.length > 1) {
        setFiles(files.slice(0, 1))
      }
      setResult(null)
      setBatchResult(null)
      return
    }

    setCompetitorFile(null)
    setCompareResult(null)
    restoreCachedResult(files, marketplace, keywords)
  }, [files, keywords, marketplace, restoreCachedResult])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) handleFiles(Array.from(e.target.files))
  }

  const handleDrop = useCallback((e: React.DragEvent, target: 'primary' | 'competitor' = 'primary') => {
    e.preventDefault()
    setDragActive(null)
    if (!e.dataTransfer.files) return

    const imgs = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'))
    if (imgs.length === 0) return

    if (target === 'competitor') {
      handleCompetitorFile(imgs[0])
      return
    }

    handleFiles(imgs)
  }, [handleCompetitorFile, handleFiles])

  const removeFile = (index: number) => {
    const newFiles = files.filter((_, i) => i !== index)
    setFiles(newFiles)
    setCopied(null)
    setCompareResult(null)
    setRestoredFromRefresh(false)
    if (isCompareMode) {
      setError(null)
      setLoadedFromCache(false)
      return
    }
    restoreCachedResult(newFiles, marketplace, keywords)
    if (newFiles.length <= 1) {
      setBatchResult(null)
    }
  }

  const handleMarketplaceChange = useCallback((nextMarketplace: string) => {
    setMarketplace(nextMarketplace)
    setCopied(null)
    resetCompareState()
    if (!isCompareMode) {
      restoreCachedResult(files, nextMarketplace, keywords)
    }
  }, [files, isCompareMode, keywords, resetCompareState, restoreCachedResult])

  const handleKeywordsChange = useCallback((nextKeywords: string) => {
    setKeywords(nextKeywords)
    if (!isCompareMode) {
      restoreCachedResult(files, marketplace, nextKeywords)
    }
  }, [files, isCompareMode, marketplace, restoreCachedResult])

  const handleAnalyze = async () => {
    if (isCompareMode) {
      if (!primaryFile || !competitorFile) return

      setLoading(true)
      setError(null)
      setResult(null)
      setBatchResult(null)
      setRestoredFromRefresh(false)
      try {
        const data = await api.compareProducts(primaryFile, competitorFile, marketplace)
        setCompareResult(data)
        saveToHistory({
          success: true,
          filename: `${data.product_filename} vs ${data.competitor_filename}`,
          analysis: data.analysis,
          metadata: data.metadata,
          timestamp: data.timestamp,
          tokens_used: data.tokens_used,
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Comparison failed')
      } finally {
        setLoading(false)
      }
      return
    }

    if (files.length === 0) return

    const cacheKey = buildProductAnalysisCacheKey(files, marketplace, keywords)

    if (isBatchMode) {
      const cachedBatch = getCachedBatchAnalysis(cacheKey)
      if (cachedBatch) {
        setBatchResult(cachedBatch)
        setResult(null)
        setError(null)
        setLoadedFromCache(true)
        setRestoredFromRefresh(false)
        return
      }
    } else {
      const cachedResult = getCachedProductAnalysis(cacheKey)
      if (cachedResult) {
        setResult(cachedResult)
        setBatchResult(null)
        setError(null)
        setLoadedFromCache(true)
        setRestoredFromRefresh(false)
        return
      }
    }

    setLoading(true)
    setError(null)

    if (isBatchMode) {
      try {
        const data = await api.batchAnalyzeProducts(files, marketplace, keywords)
        setBatchResult(data)
        setCachedBatchAnalysis(cacheKey, data)
        setLoadedFromCache(false)
        setRestoredFromRefresh(false)
        data.results.filter((r) => r.success).forEach((r) => {
          const historyItem: AnalysisResult = {
            success: true,
            filename: r.filename,
            analysis: r.analysis,
            metadata: r.metadata,
            timestamp: data.timestamp,
            tokens_used: r.metadata.usage?.total_tokens ?? 0,
          }
          saveToHistory(historyItem)
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Batch analysis failed')
      } finally {
        setLoading(false)
      }
      return
    }

    try {
      const data = await api.analyzeProductFull(files[0], marketplace, keywords)
      setResult(data)
      setCachedProductAnalysis(cacheKey, data)
      setLoadedFromCache(false)
      setRestoredFromRefresh(false)
      saveToHistory(data)
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

  const downloadCSV = () => {
    if (!batchResult?.csv_data) return
    const blob = new Blob([batchResult.csv_data], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `product_analysis_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const parsedResult = result ? parseProductAnalysisContent(result.analysis) : null
  const parsedSections = parsedResult?.sections ?? null
  const score = parsedResult?.score ?? null
  const seoTitle = parsedResult?.seoTitle ?? null
  const productDescription = parsedResult?.productDescription ?? null
  const bullets = parsedResult?.bulletPoints ?? []
  const listingDesc = parsedResult?.listingDescription ?? null
  const tags = parsedResult?.tags ?? []
  const backendKeywords = parsedResult?.backendKeywords ?? null
  const categorySuggestion = parsedResult?.categorySuggestion ?? null
  const attributes = parsedResult?.attributes ?? null
  const improvements = parsedResult?.improvements ?? []
  const packagingReview = parsedResult?.packagingReview ?? null
  const visualSearchSeo = parsedResult?.visualSearchSeo ?? null

  const parsedComparison = compareResult
    ? parseComparisonContent(compareResult.analysis)
    : null
  const comparisonStrengths = parsedComparison?.strengths ?? []
  const comparisonWeaknesses = parsedComparison?.weaknesses ?? []
  const comparisonEdge = parsedComparison?.competitiveEdge ?? null
  const comparisonActions = parsedComparison?.actionItems ?? []
  const hasStructuredComparison = Boolean(
    parsedComparison && Object.keys(parsedComparison.sections).length > 0,
  )

  const batchResults: BatchProductResult[] = batchResult?.results ?? []
  const batchSuccessCount = batchResults.filter((r) => r.success).length
  const batchFailCount = batchResults.filter((r) => !r.success).length
  const canAnalyze = isCompareMode
    ? Boolean(primaryFile && competitorFile)
    : files.length > 0

  return (
    <div className="product-analysis-page">
      <div className="hero-header-row product-analysis-hero">
        <span className="hero-kicker">Core workflow</span>
        <h1 className="hero-title product-analysis-hero-title">Product Workspace</h1>
        <p className="hero-subtitle product-analysis-hero-subtitle">Turn photos into listings</p>
      </div>

      <div className="listing-source-toggle product-analysis-mode-toggle" role="tablist" aria-label="Product workspace mode">
        <button
          type="button"
          className={`listing-source-button ${mode === 'analysis' ? 'active' : ''}`}
          onClick={() => handleModeChange('analysis')}
        >
          <ShoppingCart size={16} /> Core Listing
        </button>
        <button
          type="button"
          className={`listing-source-button ${mode === 'compare' ? 'active' : ''}`}
          onClick={() => handleModeChange('compare')}
        >
          <GitCompareArrows size={16} /> Compare Mode
        </button>
      </div>

      <MarketplaceSelector
        selected={marketplace}
        onSelect={handleMarketplaceChange}
        showRules={false}
        className="product-analysis-marketplace-selector"
      />

      {!isCompareMode && (
        <div className="fix-session-strip product-analysis-keywords-strip">
          <div className="fix-session-strip-main product-analysis-keywords-status">
            <div>
              <span className="fix-workspace-label">Target Keywords (optional)</span>
              <strong>{keywordsStatus}</strong>
            </div>
          </div>

          <div className="product-analysis-keywords-input-wrap">
            <input
              id="product-analysis-keywords-input"
              type="text"
              className="setting-input"
              placeholder="e.g. wireless headphones, bluetooth, noise cancelling"
              value={keywords}
              onChange={(e) => handleKeywordsChange(e.target.value)}
            />
          </div>
        </div>
      )}

      {isCompareMode ? (
        <div className="compare-grid">
          <div className="compare-col">
            <div className="compare-label">Your Product</div>
            {primaryFile && previews[0] && (
              <div className="image-preview">
                <img src={previews[0]} alt="Your product" />
                <div className="image-preview-info">
                  <span>{primaryFile.name}</span>
                  <span>{formatFileSize(primaryFile.size)}</span>
                </div>
              </div>
            )}
            <div
              className={`file-drop ${primaryFile ? 'has-file' : ''} ${dragActive === 'product' ? 'drag-active' : ''}`}
              onClick={() => compareProductInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragActive('product') }}
              onDragLeave={() => setDragActive(null)}
              onDrop={(e) => handleDrop(e, 'primary')}
            >
              <input
                ref={compareProductInputRef}
                type="file"
                accept=".png,.jpg,.jpeg,.webp"
                onChange={(e) => e.target.files && handleFiles(Array.from(e.target.files))}
                style={{ display: 'none' }}
              />
              <div className="drop-content">
                {primaryFile ? (
                  <div className="file-info">
                    <span className="drop-icon"><File /></span>
                    <span className="file-name">{primaryFile.name}</span>
                    <span className="file-size">{formatFileSize(primaryFile.size)}</span>
                  </div>
                ) : (
                  <>
                    <span className="drop-icon"><Download /></span>
                    <span className="drop-text">Your product photo</span>
                    <span className="drop-hint">PNG, JPG, WebP</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="compare-vs">VS</div>

          <div className="compare-col">
            <div className="compare-label">Competitor</div>
            {competitorFile && competitorPreview && (
              <div className="image-preview">
                <img src={competitorPreview} alt="Competitor product" />
                <div className="image-preview-info">
                  <span>{competitorFile.name}</span>
                  <span>{formatFileSize(competitorFile.size)}</span>
                </div>
              </div>
            )}
            <div
              className={`file-drop ${competitorFile ? 'has-file' : ''} ${dragActive === 'competitor' ? 'drag-active' : ''}`}
              onClick={() => competitorInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragActive('competitor') }}
              onDragLeave={() => setDragActive(null)}
              onDrop={(e) => handleDrop(e, 'competitor')}
            >
              <input
                ref={competitorInputRef}
                type="file"
                accept=".png,.jpg,.jpeg,.webp"
                onChange={(e) => e.target.files?.[0] && handleCompetitorFile(e.target.files[0])}
                style={{ display: 'none' }}
              />
              <div className="drop-content">
                {competitorFile ? (
                  <div className="file-info">
                    <span className="drop-icon"><File /></span>
                    <span className="file-name">{competitorFile.name}</span>
                    <span className="file-size">{formatFileSize(competitorFile.size)}</span>
                  </div>
                ) : (
                  <>
                    <span className="drop-icon"><Download /></span>
                    <span className="drop-text">Competitor photo</span>
                    <span className="drop-hint">PNG, JPG, WebP</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          {previews.length === 1 && (
            <div className="image-preview">
              <img src={previews[0]} alt="Product preview" />
              <div className="image-preview-info">
                <span>{files[0]?.name}</span>
                <span>{files[0] ? formatFileSize(files[0].size) : ''}</span>
              </div>
            </div>
          )}

          {previews.length > 1 && (
            <div className="thumb-grid">
              {previews.map((src, i) => (
                <div key={i} className="thumb-item" onClick={() => removeFile(i)} title="Click to remove">
                  <img src={src} alt={files[i]?.name || ''} />
                  {batchResults[i] && (
                    <div className={`thumb-status ${batchResults[i].success ? 'done' : 'fail'}`}>
                      {batchResults[i].success ? '✓' : '✗'}
                    </div>
                  )}
                  {!batchResults[i] && loading && (
                    <div className="thumb-status pending">
                      <span className="spinner" style={{ width: 8, height: 8, borderWidth: 1 }}></span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div
            className={`file-drop ${files.length > 0 ? 'has-file' : ''} ${dragActive === 'single' ? 'drag-active' : ''}`}
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragActive('single') }}
            onDragLeave={() => setDragActive(null)}
            onDrop={(e) => handleDrop(e, 'primary')}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".png,.jpg,.jpeg,.webp"
              multiple
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
            <div className="drop-content">
              {files.length > 0 ? (
                <div className="file-info">
                  <span className="drop-icon">{files.length > 1 ? <Upload /> : <File />}</span>
                  <span className="file-name">
                    {files.length === 1 ? files[0].name : `${files.length} product photos selected`}
                  </span>
                  {files.length === 1 && <span className="file-size">{formatFileSize(files[0].size)}</span>}
                </div>
              ) : (
                <>
                  <span className="drop-icon"><Download /></span>
                  <span className="drop-text">Drop product photo(s) here</span>
                  <span className="drop-hint">Single photo for full analysis, multiple for batch</span>
                </>
              )}
            </div>
          </div>
        </>
      )}

      <button className="scan-btn workspace-primary-action" onClick={handleAnalyze} disabled={loading || !canAnalyze}>
        {loading
          ? isCompareMode
            ? (<><span className="spinner"></span>Comparing listings...</>)
            : isBatchMode
              ? (<><span className="spinner"></span>Processing {files.length} files...</>)
              : (<><span className="spinner"></span>Analyzing product...</>)
          : isCompareMode
            ? (<><GitCompareArrows size={20} />Compare Listings</>)
            : isBatchMode
              ? (<><ScanSearch size={20} />Analyze {files.length} Products</>)
              : (<><ScanSearch size={20} />Analyze Product</>)}
      </button>

      {error && (
        <div className="results-panel" style={{ borderColor: '#ef4444' }}>
          <div className="results-content" style={{ color: '#ef4444' }}>{error}</div>
        </div>
      )}

      {compareResult && isCompareMode && (
        <div style={{ marginTop: '2rem' }}>
          {hasStructuredComparison && comparisonStrengths.length > 0 && (
            <div className="result-section">
              <div className="result-section-header">
                <span className="result-section-title"><ThumbsUp size={16} /> Strengths</span>
              </div>
              <ul className="improvement-list strengths-list">
                {comparisonStrengths.map((item, index) => (
                  <li key={index}>
                    <ThumbsUp size={14} />
                    <div className="list-item-markdown">
                      <MarkdownContent content={item} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {hasStructuredComparison && comparisonWeaknesses.length > 0 && (
            <div className="result-section">
              <div className="result-section-header">
                <span className="result-section-title"><ThumbsDown size={16} /> Weaknesses</span>
              </div>
              <ul className="improvement-list weaknesses-list">
                {comparisonWeaknesses.map((item, index) => (
                  <li key={index}>
                    <ThumbsDown size={14} />
                    <div className="list-item-markdown">
                      <MarkdownContent content={item} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {comparisonEdge && (
            <div className="result-section">
              <div className="result-section-header">
                <span className="result-section-title"><Target size={16} /> Competitive Edge</span>
              </div>
              <div className="result-section-body">
                <MarkdownContent content={comparisonEdge} />
              </div>
            </div>
          )}

          {comparisonActions.length > 0 && (
            <div className="result-section">
              <div className="result-section-header">
                <span className="result-section-title"><Zap size={16} /> Action Items</span>
              </div>
              <ul className="improvement-list">
                {comparisonActions.map((item, index) => (
                  <li key={index}>
                    <Zap size={14} />
                    <div className="list-item-markdown">
                      <MarkdownContent content={item} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="result-section">
            <div className="result-section-header">
              <span className="result-section-title"><GitCompareArrows size={16} /> Full Compare Report</span>
              <button className="copy-btn-small" onClick={() => copyText(compareResult.analysis, 'compare-report')}>
                {copied === 'compare-report' ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy</>}
              </button>
            </div>
            <div className="result-section-body">
              <MarkdownContent content={compareResult.analysis} />
            </div>
          </div>

          {compareResult.tokens_used > 0 && (
            <div className="tokens-badge"><Zap size={12} /> {compareResult.tokens_used} tokens</div>
          )}
        </div>
      )}

      {result && !isBatchMode && !isCompareMode && (
        <div style={{ marginTop: '2rem' }}>
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

          {seoTitle && (
            <>
              <div className="seo-card">
                <div className="seo-card-title">{seoTitle}</div>
                {listingDesc && <div className="seo-card-description">{listingDesc.substring(0, 200)}...</div>}
              </div>
              <div className="result-section">
                <div className="result-section-header">
                  <span className="result-section-title"><Tag size={16} /> SEO Title</span>
                  <button className="copy-btn-small" onClick={() => copyText(seoTitle, 'title')}>
                    {copied === 'title' ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy</>}
                  </button>
                </div>
                <div className="result-section-body" style={{ fontSize: '1rem', fontWeight: 600 }}>
                  {seoTitle}
                </div>
              </div>
            </>
          )}

          {productDescription && (
            <div className="result-section">
              <div className="result-section-header">
                <span className="result-section-title"><ShoppingCart size={16} /> Product Description</span>
                <button className="copy-btn-small" onClick={() => copyText(productDescription, 'desc')}>
                  {copied === 'desc' ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy</>}
                </button>
              </div>
              <div className="result-section-body">
                <MarkdownContent content={productDescription} />
              </div>
            </div>
          )}

          {bullets.length > 0 && (
            <div className="result-section">
              <div className="result-section-header">
                <span className="result-section-title"><List size={16} /> Bullet Points</span>
                <button className="copy-btn-small" onClick={() => copyText(bullets.join('\n'), 'bullets')}>
                  {copied === 'bullets' ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy</>}
                </button>
              </div>
              <ul className="seo-bullets">
                {bullets.map((bullet, index) => (
                  <li key={index}>
                    <div className="list-item-markdown">
                      <MarkdownContent content={bullet} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {listingDesc && (
            <div className="result-section">
              <div className="result-section-header">
                <span className="result-section-title"><ShoppingCart size={16} /> Listing Description</span>
                <button className="copy-btn-small" onClick={() => copyText(listingDesc, 'listing')}>
                  {copied === 'listing' ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy</>}
                </button>
              </div>
              <div className="result-section-body">
                <MarkdownContent content={listingDesc} />
              </div>
            </div>
          )}

          {attributes && (
            <div className="result-section">
              <div className="result-section-header">
                <span className="result-section-title"><ClipboardList size={16} /> Attributes</span>
                <button className="copy-btn-small" onClick={() => copyText(attributes, 'attrs')}>
                  {copied === 'attrs' ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy</>}
                </button>
              </div>
              <div className="result-section-body">
                <MarkdownContent content={attributes} />
              </div>
            </div>
          )}

          {packagingReview && (
            <div className="result-section">
              <div className="result-section-header">
                <span className="result-section-title"><Package size={16} /> Packaging Review</span>
                <button className="copy-btn-small" onClick={() => copyText(packagingReview, 'packaging')}>
                  {copied === 'packaging' ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy</>}
                </button>
              </div>
              <div className="result-section-body">
                <MarkdownContent content={packagingReview} />
              </div>
            </div>
          )}

          {visualSearchSeo && (
            <div className="result-section">
              <div className="result-section-header">
                <span className="result-section-title"><Search size={16} /> Visual Search SEO</span>
                <button className="copy-btn-small" onClick={() => copyText(visualSearchSeo, 'visual-search')}>
                  {copied === 'visual-search' ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy</>}
                </button>
              </div>
              <div className="result-section-body">
                <MarkdownContent content={visualSearchSeo} />
              </div>
            </div>
          )}

          {tags.length > 0 && (
            <div className="result-section">
              <div className="result-section-header">
                <span className="result-section-title"><Search size={16} /> Search Tags ({tags.length})</span>
                <button className="copy-btn-small" onClick={() => copyText(tags.join(', '), 'tags')}>
                  {copied === 'tags' ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy</>}
                </button>
              </div>
              <div className="tag-chips">
                {tags.map((tag, index) => <span key={index} className="tag-chip">{tag}</span>)}
              </div>
            </div>
          )}

          {backendKeywords && (
            <div className="result-section">
              <div className="result-section-header">
                <span className="result-section-title"><Tag size={16} /> Backend Keywords</span>
                <button className="copy-btn-small" onClick={() => copyText(backendKeywords, 'backend')}>
                  {copied === 'backend' ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy</>}
                </button>
              </div>
              <div className="result-section-body">
                <MarkdownContent content={backendKeywords} />
              </div>
            </div>
          )}

          {categorySuggestion && (
            <div className="result-section">
              <div className="result-section-header">
                <span className="result-section-title"><Package size={16} /> Category Suggestion</span>
              </div>
              <div className="result-section-body">
                <MarkdownContent content={categorySuggestion} />
              </div>
            </div>
          )}

          {improvements.length > 0 && (
            <div className="result-section">
              <div className="result-section-header">
                <span className="result-section-title"><Lightbulb size={16} /> Improvements</span>
              </div>
              <ul className="improvement-list">
                {improvements.map((item, index) => (
                  <li key={index}>
                    <Zap size={14} />
                    <div className="list-item-markdown">
                      <MarkdownContent content={item} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.tokens_used > 0 && (
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {restoredFromRefresh && (
                <div className="cache-badge">Restored after refresh</div>
              )}
              {loadedFromCache && (
                <div className="cache-badge">Loaded from cache</div>
              )}
              <div className="tokens-badge">
                <Zap size={12} /> {result.tokens_used} tokens
              </div>
            </div>
          )}

          {result.tokens_used <= 0 && loadedFromCache && (
            <div className="cache-badge">Loaded from cache</div>
          )}

          {result.tokens_used <= 0 && restoredFromRefresh && (
            <div className="cache-badge">Restored after refresh</div>
          )}

          {!parsedSections || Object.keys(parsedSections).length === 0 ? (
            <div className="results-panel">
              <div className="results-content"><MarkdownContent content={result.analysis} /></div>
            </div>
          ) : null}
        </div>
      )}

      {batchResults.length > 0 && !isCompareMode && (
        <>
          <div className="stats-grid" style={{ marginTop: '2rem' }}>
            <div className="stat-card">
              <div className="stat-label">Total</div>
              <div className="stat-value">{batchResults.length}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Successful</div>
              <div className="stat-value" style={{ WebkitTextFillColor: '#4ade80' }}>{batchSuccessCount}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Failed</div>
              <div className="stat-value" style={{ WebkitTextFillColor: batchFailCount > 0 ? '#f87171' : 'inherit' }}>{batchFailCount}</div>
            </div>
          </div>

          {batchResult?.csv_data && (
            <div className="export-section">
              <div className="results-actions">
                <button className="action-btn" onClick={downloadCSV}>
                  <FileSpreadsheet size={16} /> Download CSV Report
                </button>
              </div>
            </div>
          )}

          <div className="history-list">
            {batchResults.map((item, index) => (
              <div key={index} className="history-item">
                <div className="history-item-header">
                  <span className="history-filename">
                    {item.success ? <CheckCircle size={16} style={{ color: '#4ade80' }} /> : <XCircle size={16} style={{ color: '#f87171' }} />}
                    {item.filename}
                  </span>
                  <span className={`results-badge ${item.success ? '' : 'error'}`} style={item.success ? {} : { background: 'linear-gradient(135deg, #ef4444, #dc2626)' }}>
                    {item.success ? 'Done' : 'Failed'}
                  </span>
                </div>
                <div className="history-item-analysis">
                  {item.success
                    ? item.analysis.substring(0, 300) + (item.analysis.length > 300 ? '...' : '')
                    : item.error}
                </div>
              </div>
            ))}
          </div>

          <div className="tokens-badge" style={{ marginTop: '1rem' }}>
            <Zap size={12} /> {batchResults.length} files processed
          </div>
          {restoredFromRefresh && (
            <div className="cache-badge" style={{ marginTop: '0.5rem' }}>
              Restored after refresh
            </div>
          )}
          {loadedFromCache && (
            <div className="cache-badge" style={{ marginTop: '0.5rem' }}>Loaded from cache</div>
          )}
        </>
      )}
    </div>
  )
}
