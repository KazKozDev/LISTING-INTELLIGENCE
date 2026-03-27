import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowRight,
  ChevronDown,
  CheckCircle,
  Download as DownloadIcon,
  Download,
  File as FileIcon,
  Move,
  RotateCw,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  TriangleAlert,
  Zap,
} from 'lucide-react'

import { api } from '../../api/client'
import type {
  AnalysisResult,
  CanvasPreset,
  ComplianceFinding,
  ComplianceCanvasDraft,
  ComplianceFixAiMetadata,
  ComplianceFixStudioLaunchState,
  CanvasTransformPayload,
  ComplianceFixHistoryEntry,
  ComplianceFixResultResponse,
  ComplianceFixSuggestion,
  ComplianceFixSuggestionsResponse,
  ImageUsage,
  MarketplaceInfo,
  ProductContext,
  UpscaleResult,
} from '../../api/types'
import { saveToHistory } from '../../hooks/useHistory'
import { useObjectUrlPreview } from '../../hooks/useObjectUrlPreviews'
import {
  buildComplianceDeltaSummary,
  buildVerificationDeltaSummary,
  formatFileSize,
  rankComplianceDelta,
  rankVerificationDelta,
} from '../../utils/analysis'
import {
  buildComplianceFixCanvasDraftKey,
  buildComplianceFixHistoryKey,
  buildComplianceFixResultCacheKey,
  buildComplianceFixSuggestionsCacheKey,
  getCachedComplianceFixCanvasDraft,
  getComplianceFixHistory,
  getCachedComplianceFixResult,
  getCachedComplianceFixSuggestions,
  setCachedComplianceFixCanvasDraft,
  setCachedComplianceFixResult,
  upsertComplianceFixHistoryEntry,
} from '../../utils/analysisCache'
import { MarketplaceSelector } from './MarketplaceSelector'
import { MarkdownContent } from '../MarkdownContent'

const MANUAL_ACTIONS: ComplianceFixSuggestion[] = [
  {
    id: 'manual-auto-center-ai',
    title: 'Auto Center',
    description: 'Extract the product foreground and place it on a centered white marketplace canvas.',
    action: 'auto_center_ai',
    automated: true,
    priority: 'high',
  },
  {
    id: 'manual-recheck',
    title: 'Recheck Only',
    description: 'Run the compliance check again without changing pixels.',
    action: 'recheck_only',
    automated: false,
    priority: 'low',
  },
]

const PRIORITY_ORDER: Record<string, number> = {
  high: 0,
  medium: 1,
  low: 2,
}

const PRIMARY_LANE_ACTIONS = ['auto_center_ai'] as const

const CANVAS_OVERSHOOT_LIMIT = 24
const CANVAS_RESISTANCE_FACTOR = 0.22
const MAX_CANVAS_UNDO_STEPS = 20
const MIN_CANVAS_VISIBLE_OVERLAP = 48
const AUTO_CANVAS_EXPORT_DEBOUNCE_MS = 500

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

type CanvasCompositionSnapshot = {
  preset: CanvasPreset
  zoom: number
  offset: {
    x: number
    y: number
  }
}

type SelectedResultSource = 'latest-applied' | 'history' | null
type FixStudioStepId = 'compose' | 'compare' | 'export'

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function applyEdgeResistance(value: number, min: number, max: number): number {
  if (value < min) {
    return min - Math.min((min - value) * CANVAS_RESISTANCE_FACTOR, CANVAS_OVERSHOOT_LIMIT)
  }

  if (value > max) {
    return max + Math.min((value - max) * CANVAS_RESISTANCE_FACTOR, CANVAS_OVERSHOOT_LIMIT)
  }

  return value
}

function buildHistoryEntryId(
  result: ComplianceFixResultResponse,
): string {
  const fixMetadata = result.metadata.fix
  const payload = fixMetadata && typeof fixMetadata === 'object'
    ? (fixMetadata as Record<string, unknown>).payload
    : null
  const payloadKey = payload ? JSON.stringify(payload) : 'no-payload'
  return `${result.applied_action}::${result.timestamp}::${payloadKey}`
}

function buildHistoryTitle(
  entry: ComplianceFixHistoryEntry,
  fallbackTitle: string,
  sequence: number,
): string {
  const fixMetadata = entry.result.metadata.fix
  const payload = fixMetadata && typeof fixMetadata === 'object'
    ? fixMetadata as Record<string, unknown>
    : null
  const transformPayload = payload?.payload && typeof payload.payload === 'object'
    ? payload.payload as Record<string, unknown>
    : null

  if (entry.action === 'canvas_transform' || entry.action === 'auto_center_ai') {
    const targetWidth = transformPayload?.target_width
    const targetHeight = transformPayload?.target_height
    const zoom = transformPayload?.zoom
    const sizeLabel =
      typeof targetWidth === 'number' && typeof targetHeight === 'number'
        ? `${targetWidth}x${targetHeight}`
        : 'custom'
    const zoomLabel =
      entry.action === 'canvas_transform' && typeof zoom === 'number'
        ? ` · ${zoom.toFixed(2)}x`
        : ''
    return `${fallbackTitle} #${sequence} · ${sizeLabel}${zoomLabel}`
  }

  return sequence > 1 ? `${fallbackTitle} #${sequence}` : fallbackTitle
}

function getAiMetadata(
  result: ComplianceFixResultResponse | null,
): ComplianceFixAiMetadata | null {
  if (!result) {
    return null
  }

  const fixMetadata = result.metadata.fix
  if (!fixMetadata || typeof fixMetadata !== 'object') {
    return null
  }

  const ai = (fixMetadata as Record<string, unknown>).ai
  if (!ai || typeof ai !== 'object') {
    return null
  }

  return ai as ComplianceFixAiMetadata
}

function getDefaultCanvasSnapshot(): CanvasCompositionSnapshot {
  return {
    preset: 'recommended',
    zoom: 1,
    offset: { x: 0, y: 0 },
  }
}

function getAllowedCanvasOffset(
  stageSize: { width: number; height: number },
  zoom: number,
): {
  minX: number
  maxX: number
  minY: number
  maxY: number
} {
  const scaledWidth = stageSize.width * zoom
  const scaledHeight = stageSize.height * zoom
  const minVisibleWidth = Math.min(
    Math.max(stageSize.width * 0.14, MIN_CANVAS_VISIBLE_OVERLAP),
    stageSize.width * 0.45,
  )
  const minVisibleHeight = Math.min(
    Math.max(stageSize.height * 0.14, MIN_CANVAS_VISIBLE_OVERLAP),
    stageSize.height * 0.45,
  )
  const minX = minVisibleWidth - scaledWidth
  const maxX = stageSize.width - minVisibleWidth
  const minY = minVisibleHeight - scaledHeight
  const maxY = stageSize.height - minVisibleHeight

  return { minX, maxX, minY, maxY }
}

async function dataUrlToFile(dataUrl: string, filename: string): Promise<File> {
  const response = await fetch(dataUrl)
  const blob = await response.blob()
  return new File([blob], filename, { type: blob.type || 'image/png' })
}

async function buildWorkspaceFileFromResult(
  result: ComplianceFixResultResponse,
): Promise<File | null> {
  if (result.applied_action === 'recheck_only') {
    return null
  }

  return dataUrlToFile(result.image_data_url, result.fixed_filename)
}

function clampCanvasOffset(
  offset: { x: number; y: number },
  stageSize: { width: number; height: number },
  zoom: number,
): { x: number; y: number } {
  const allowedOffset = getAllowedCanvasOffset(stageSize, zoom)
  return {
    x: clamp(offset.x, allowedOffset.minX, allowedOffset.maxX),
    y: clamp(offset.y, allowedOffset.minY, allowedOffset.maxY),
  }
}

function canvasSnapshotsEqual(
  left: CanvasCompositionSnapshot,
  right: CanvasCompositionSnapshot,
): boolean {
  return (
    left.preset === right.preset
    && left.zoom === right.zoom
    && left.offset.x === right.offset.x
    && left.offset.y === right.offset.y
  )
}

function getFixDeltaSeverity(issue: string): 'critical' | 'warning' | 'info' | null {
  const match = issue.match(/^\s*\*\*(critical|warning|info)\*\*:/i)
  return match ? match[1].toLowerCase() as 'critical' | 'warning' | 'info' : null
}

function renderFixDeltaIssues(issues: string[]) {
  return (
    <ul className="improvement-list">
      {issues.map((issue) => {
        const severity = getFixDeltaSeverity(issue)

        return (
          <li
            key={issue}
            className={severity ? `fix-delta-issue severity-${severity}` : 'fix-delta-issue'}
          >
            <div className="list-item-markdown">
              <MarkdownContent content={issue} />
            </div>
          </li>
        )
      })}
    </ul>
  )
}

function renderVerificationFindings(findings: ComplianceFinding[]) {
  return (
    <ul className="improvement-list">
      {findings.map((finding) => (
        <li
          key={`${finding.source}:${finding.code}`}
          className={`fix-delta-issue severity-${finding.severity === 'critical' ? 'critical' : finding.severity === 'warning' ? 'warning' : 'info'}`}
        >
          <div className="list-item-markdown verification-finding-content">
            <MarkdownContent
              content={`**${finding.severity.charAt(0).toUpperCase()}${finding.severity.slice(1)}**: ${finding.summary}`}
            />
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
              {finding.evidence?.measured && Object.keys(finding.evidence.measured).length > 0 && (
                <div className="compliance-finding-detail">
                  <span className="fix-workspace-label">Measured</span>
                  <span>{Object.entries(finding.evidence.measured).map(([key, value]) => `${key}: ${String(value)}`).join(' · ')}</span>
                </div>
              )}
              {finding.evidence?.excerpts && finding.evidence.excerpts.length > 0 && (
                <div className="compliance-finding-detail">
                  <span className="fix-workspace-label">Excerpts</span>
                  <span>{finding.evidence.excerpts.join(' · ')}</span>
                </div>
              )}
              {finding.evidence?.warning && (
                <div className="compliance-finding-detail">
                  <span className="fix-workspace-label">Detector Note</span>
                  <span>{finding.evidence.warning}</span>
                </div>
              )}
            </div>
          </div>
        </li>
      ))}
    </ul>
  )
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

interface ComplianceFixStudioProps {
  launchState?: ComplianceFixStudioLaunchState | null
}

export function ComplianceFixStudio({ launchState = null }: ComplianceFixStudioProps) {
  const [file, setFile] = useState<File | null>(null)
  const [workspaceFile, setWorkspaceFile] = useState<File | null>(null)
  const [marketplace, setMarketplace] = useState('allegro')
  const [productContext, setProductContext] = useState<ProductContext | undefined>(undefined)
  const [imageUsage, setImageUsage] = useState<ImageUsage>('main_image')
  const [marketplaces, setMarketplaces] = useState<MarketplaceInfo[]>([])
  const [dragActive, setDragActive] = useState(false)
  const [applyingAction, setApplyingAction] = useState<string | null>(null)
  const [suggestionsResult, setSuggestionsResult] = useState<ComplianceFixSuggestionsResponse | null>(null)
  const [fixResult, setFixResult] = useState<ComplianceFixResultResponse | null>(null)
  const [fixHistoryEntries, setFixHistoryEntries] = useState<ComplianceFixHistoryEntry[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loadedFixFromCache, setLoadedFixFromCache] = useState(false)
  const [upscaleResult, setUpscaleResult] = useState<UpscaleResult | null>(null)
  const [runningUpscale, setRunningUpscale] = useState(false)
  const [applyingUpscale, setApplyingUpscale] = useState(false)
  const [applyingRelight, setApplyingRelight] = useState(false)
  const [relightStatus, setRelightStatus] = useState<{
    modelId: string | null
    maskSource: string | null
    applied: boolean
    warning: string | null
  } | null>(null)
  const [applyingCleanup, setApplyingCleanup] = useState(false)
  const [cleanupStatus, setCleanupStatus] = useState<{
    removedRegions: number
    sources: string[]
    warning: string | null
  } | null>(null)
  const [applyingOutpaint, setApplyingOutpaint] = useState(false)
  const [outpaintDirection, setOutpaintDirection] = useState<
    'left' | 'right' | 'top' | 'bottom'
  >('right')
  const [outpaintExpansion, setOutpaintExpansion] = useState(0.25)
  const [outpaintStatus, setOutpaintStatus] = useState<{
    modelId: string | null
    direction: string | null
    expansion: number | null
    warning: string | null
  } | null>(null)
  const [selectedHistoryEntryId, setSelectedHistoryEntryId] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const referenceInputRef = useRef<HTMLInputElement>(null)
  const canvasStageRef = useRef<HTMLDivElement>(null)
  const preview = useObjectUrlPreview(file)
  const workspacePreview = useObjectUrlPreview(workspaceFile)
  const [canvasZoom, setCanvasZoom] = useState(1)
  const [canvasOffset, setCanvasOffset] = useState({ x: 0, y: 0 })
  const [canvasPreset, setCanvasPreset] = useState<CanvasPreset>('recommended')
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false)
  const [canvasStageSize, setCanvasStageSize] = useState({ width: 680, height: 680 })
  const [canvasSnapbackActive, setCanvasSnapbackActive] = useState(false)
  const [canvasEdgeResistanceActive, setCanvasEdgeResistanceActive] = useState(false)
  const [canvasUndoStack, setCanvasUndoStack] = useState<CanvasCompositionSnapshot[]>([])
  const [canvasRedoStack, setCanvasRedoStack] = useState<CanvasCompositionSnapshot[]>([])
  const [canvasDraftHydrated, setCanvasDraftHydrated] = useState(false)
  const [selectedResultSource, setSelectedResultSource] = useState<SelectedResultSource>(null)
  const [activeStepId, setActiveStepId] = useState<FixStudioStepId>('compose')
  const [approvedExportEntryId, setApprovedExportEntryId] = useState<string | null>(null)
  const dragOriginRef = useRef({
    startX: 0,
    startY: 0,
    startOffsetX: 0,
    startOffsetY: 0,
    snapshotRecorded: false,
  })
  const canvasSnapbackTimerRef = useRef<number | null>(null)
  const autoCanvasExportTimerRef = useRef<number | null>(null)
  const autoCanvasExportRequestIdRef = useRef(0)
  const lastAutoCanvasPayloadKeyRef = useRef<string | null>(null)
  const activeStepIdRef = useRef<FixStudioStepId>('compose')
  const canvasUndoStackRef = useRef<CanvasCompositionSnapshot[]>([])
  const canvasRedoStackRef = useRef<CanvasCompositionSnapshot[]>([])
  const workspaceFileRef = useRef<File | null>(null)
  const restoredCanvasDraftKeyRef = useRef<string | null>(null)
  const lastLaunchIdRef = useRef<number | null>(null)
  const filmstripRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    workspaceFileRef.current = workspaceFile
  }, [workspaceFile])

  useEffect(() => {
    canvasUndoStackRef.current = canvasUndoStack
  }, [canvasUndoStack])

  useEffect(() => {
    canvasRedoStackRef.current = canvasRedoStack
  }, [canvasRedoStack])

  useEffect(() => {
    activeStepIdRef.current = activeStepId
  }, [activeStepId])

  useEffect(() => {
    let active = true

    api.getMarketplaces()
      .then((response) => {
        if (!active) return
        setMarketplaces(response.marketplaces)
      })
      .catch(() => {
        if (!active) return
        setMarketplaces([])
      })

    return () => {
      active = false
    }
  }, [])

  const activeMarketplace = useMemo(
    () => marketplaces.find((entry) => entry.id === marketplace) ?? null,
    [marketplace, marketplaces],
  )

  const canvasTarget = useMemo(() => {
    if (!activeMarketplace) {
      return { width: 1200, height: 1200 }
    }

    if (canvasPreset === 'minimum') {
      return {
        width: activeMarketplace.min_image_width,
        height: activeMarketplace.min_image_height,
      }
    }

    return {
      width: activeMarketplace.recommended_image_width ?? activeMarketplace.min_image_width,
      height: activeMarketplace.recommended_image_height ?? activeMarketplace.min_image_height,
    }
  }, [activeMarketplace, canvasPreset])

  const currentPolicyLabel = useMemo(() => {
    const compositionPolicy = activeMarketplace?.composition_policy
    const usagePolicy = compositionPolicy?.[imageUsage] ?? compositionPolicy?.main_image
    if (!usagePolicy) {
      return null
    }

    const targetClass = canvasPreset === 'minimum' ? 'minimum' : 'recommended'
    const fillRatio = targetClass === 'minimum'
      ? usagePolicy.minimum_fill_ratio
      : usagePolicy.recommended_fill_ratio
    const usageLabel = imageUsage === 'gallery_image' ? 'Gallery image' : 'Main image'

    return `${usageLabel} · ${targetClass} · ${fillRatio.toFixed(2)} fill`
  }, [activeMarketplace, canvasPreset, imageUsage])

  useEffect(() => {
    const element = canvasStageRef.current
    if (!element || typeof ResizeObserver === 'undefined') {
      return
    }

    const updateSize = () => {
      const rect = element.getBoundingClientRect()
      if (rect.width > 0 && rect.height > 0) {
        setCanvasStageSize({ width: rect.width, height: rect.height })
      }
    }

    updateSize()
    const observer = new ResizeObserver(() => updateSize())
    observer.observe(element)

    return () => {
      observer.disconnect()
    }
  }, [canvasTarget.height, canvasTarget.width])

  const canvasBounds = useMemo(() => {
    return getAllowedCanvasOffset(canvasStageSize, canvasZoom)
  }, [canvasStageSize, canvasZoom])

  const allowedCanvasOffset = canvasBounds

  const canvasDraftKey = useMemo(
    () => (file && marketplace !== 'general'
      ? buildComplianceFixCanvasDraftKey(file, marketplace)
      : null),
    [file, marketplace],
  )
  const productContextCacheToken = useMemo(
    () => buildProductContextCacheToken(productContext),
    [productContext],
  )
  const productContextSummary = useMemo(() => {
    if (!productContext) {
      return 'No context loaded'
    }

    return productContext.category
      || productContext.title
      || productContext.referenceImage?.name
      || productContext.referenceImageName
      || 'Context loaded'
  }, [productContext])

  const updateProductContext = useCallback((patch: Partial<ProductContext>) => {
    setProductContext((currentValue) => {
      const nextValue: ProductContext = {
        title: patch.title ?? currentValue?.title ?? '',
        category: patch.category ?? currentValue?.category ?? '',
        attributes: patch.attributes ?? currentValue?.attributes ?? '',
        referenceImage: patch.referenceImage !== undefined ? patch.referenceImage : currentValue?.referenceImage ?? null,
        referenceImageName: patch.referenceImageName !== undefined
          ? patch.referenceImageName
          : currentValue?.referenceImageName ?? null,
      }

      if (
        !nextValue.title.trim()
        && !nextValue.category.trim()
        && !nextValue.attributes.trim()
        && !nextValue.referenceImage
        && !nextValue.referenceImageName
      ) {
        return undefined
      }

      return nextValue
    })
  }, [])

  const getCanvasSnapshot = useCallback((): CanvasCompositionSnapshot => ({
    preset: canvasPreset,
    zoom: canvasZoom,
    offset: canvasOffset,
  }), [canvasOffset, canvasPreset, canvasZoom])

  const clearSnapbackTimer = useCallback(() => {
    if (canvasSnapbackTimerRef.current !== null) {
      window.clearTimeout(canvasSnapbackTimerRef.current)
      canvasSnapbackTimerRef.current = null
    }
  }, [])

  const clearAutoCanvasExportTimer = useCallback(() => {
    if (autoCanvasExportTimerRef.current !== null) {
      window.clearTimeout(autoCanvasExportTimerRef.current)
      autoCanvasExportTimerRef.current = null
    }
  }, [])

  const cancelPendingAutoCanvasExport = useCallback(() => {
    clearAutoCanvasExportTimer()
    autoCanvasExportRequestIdRef.current += 1
    lastAutoCanvasPayloadKeyRef.current = null
  }, [clearAutoCanvasExportTimer])

  const applyCanvasSnapshot = useCallback((snapshot: CanvasCompositionSnapshot) => {
    clearSnapbackTimer()
    clearAutoCanvasExportTimer()
    setCanvasPreset(snapshot.preset)
    setCanvasZoom(snapshot.zoom)
    setCanvasOffset(clampCanvasOffset(snapshot.offset, canvasStageSize, snapshot.zoom))
    setIsDraggingCanvas(false)
    setCanvasSnapbackActive(false)
    setCanvasEdgeResistanceActive(false)
  }, [canvasStageSize, clearAutoCanvasExportTimer, clearSnapbackTimer])

  const pushCanvasUndoSnapshot = useCallback((snapshot: CanvasCompositionSnapshot) => {
    setCanvasUndoStack((currentStack) => {
      if (currentStack[0] && canvasSnapshotsEqual(currentStack[0], snapshot)) {
        return currentStack
      }

      return [snapshot, ...currentStack].slice(0, MAX_CANVAS_UNDO_STEPS)
    })
  }, [])

  const rememberCanvasStateForUndo = useCallback(() => {
    setCanvasRedoStack([])
    pushCanvasUndoSnapshot(getCanvasSnapshot())
  }, [getCanvasSnapshot, pushCanvasUndoSnapshot])

  const scheduleSnapbackReset = useCallback(() => {
    clearSnapbackTimer()
    setCanvasSnapbackActive(true)
    canvasSnapbackTimerRef.current = window.setTimeout(() => {
      setCanvasSnapbackActive(false)
      canvasSnapbackTimerRef.current = null
    }, 220)
  }, [clearSnapbackTimer])

  const resetCanvasState = useCallback(() => {
    setCanvasUndoStack([])
    setCanvasRedoStack([])
    applyCanvasSnapshot(getDefaultCanvasSnapshot())
  }, [applyCanvasSnapshot])

  useEffect(() => {
    return () => {
      clearSnapbackTimer()
      clearAutoCanvasExportTimer()
    }
  }, [clearAutoCanvasExportTimer, clearSnapbackTimer])

  useEffect(() => {
    restoredCanvasDraftKeyRef.current = null
    setCanvasDraftHydrated(false)
    clearAutoCanvasExportTimer()
    autoCanvasExportRequestIdRef.current += 1
    lastAutoCanvasPayloadKeyRef.current = null
  }, [canvasDraftKey])

  useEffect(() => {
    if (!canvasDraftKey) {
      return
    }

    if (canvasStageSize.width <= 0 || canvasStageSize.height <= 0) {
      return
    }

    if (restoredCanvasDraftKeyRef.current === canvasDraftKey) {
      return
    }

    const cachedDraft = getCachedComplianceFixCanvasDraft(canvasDraftKey)
    if (cachedDraft) {
      const restoredSnapshot: CanvasCompositionSnapshot = {
        preset: cachedDraft.preset,
        zoom: cachedDraft.zoom,
        offset: {
          x: cachedDraft.offset_x * canvasStageSize.width,
          y: cachedDraft.offset_y * canvasStageSize.height,
        },
      }
      applyCanvasSnapshot(restoredSnapshot)
    }

    setCanvasUndoStack([])
    setCanvasRedoStack([])
    restoredCanvasDraftKeyRef.current = canvasDraftKey
    setCanvasDraftHydrated(true)
  }, [applyCanvasSnapshot, canvasDraftKey, canvasStageSize.height, canvasStageSize.width])

  useEffect(() => {
    if (!canvasDraftKey || !canvasDraftHydrated || isDraggingCanvas) {
      return
    }

    const normalizedOffset = {
      x: canvasStageSize.width > 0 ? canvasOffset.x / canvasStageSize.width : 0,
      y: canvasStageSize.height > 0 ? canvasOffset.y / canvasStageSize.height : 0,
    }

    const draft: ComplianceCanvasDraft = {
      preset: canvasPreset,
      zoom: canvasZoom,
      offset_x: normalizedOffset.x,
      offset_y: normalizedOffset.y,
    }

    setCachedComplianceFixCanvasDraft(canvasDraftKey, draft)
  }, [
    canvasDraftHydrated,
    canvasDraftKey,
    canvasOffset.x,
    canvasOffset.y,
    canvasPreset,
    canvasStageSize.height,
    canvasStageSize.width,
    canvasZoom,
    isDraggingCanvas,
  ])

  useEffect(() => {
    setCanvasOffset((currentOffset) => {
      const clampedOffset = clampCanvasOffset(currentOffset, canvasStageSize, canvasZoom)
      if (clampedOffset.x === currentOffset.x && clampedOffset.y === currentOffset.y) {
        return currentOffset
      }

      return clampedOffset
    })
  }, [canvasStageSize, canvasZoom])

  const persistHistoryEntry = useCallback((
    nextFile: File,
    nextMarketplace: string,
    title: string,
    result: ComplianceFixResultResponse,
  ) => {
    const nextHistory = upsertComplianceFixHistoryEntry(
      `${buildComplianceFixHistoryKey(nextFile, nextMarketplace)}::${productContextCacheToken}`,
      {
        id: buildHistoryEntryId(result),
        action: result.applied_action,
        title,
        result,
      },
    )
    setFixHistoryEntries(nextHistory)
  }, [productContextCacheToken])

  const restoreCachedSuggestions = useCallback((
    nextFile: File | null,
    nextMarketplace: string,
    nextProductContext?: ProductContext,
  ) => {
    if (!nextFile || nextMarketplace === 'general') {
      setSuggestionsResult(null)
      setFixResult(null)
      setFixHistoryEntries([])
      setSelectedResultSource(null)
      setLoadedFixFromCache(false)
      setSelectedHistoryEntryId(null)
      setApprovedExportEntryId(null)
      setError(null)
      resetCanvasState()
      return
    }

    const cachedSuggestions = getCachedComplianceFixSuggestions(
      `${buildComplianceFixSuggestionsCacheKey(nextFile, nextMarketplace)}::${buildProductContextCacheToken(nextProductContext)}`,
    )

    setSuggestionsResult(cachedSuggestions)
    setFixResult(null)
    setFixHistoryEntries(
      getComplianceFixHistory(
        `${buildComplianceFixHistoryKey(nextFile, nextMarketplace)}::${buildProductContextCacheToken(nextProductContext)}`,
      ),
    )
    setSelectedResultSource(null)
    setLoadedFixFromCache(false)
    setSelectedHistoryEntryId(null)
    setApprovedExportEntryId(null)
    setError(null)
    resetCanvasState()
  }, [resetCanvasState])

  const resetWorkflow = useCallback((
    nextFile: File | null,
    nextMarketplace?: string,
    nextProductContext?: ProductContext,
  ) => {
    cancelPendingAutoCanvasExport()
    setFile(nextFile)
    setWorkspaceFile(nextFile)
    workspaceFileRef.current = nextFile
    setProductContext(nextProductContext)
    setUpscaleResult(null)
    setRelightStatus(null)
    setCleanupStatus(null)
    setOutpaintStatus(null)
    setActiveStepId('compose')
    const targetMarketplace = nextMarketplace ?? marketplace
    if (nextMarketplace) {
      setMarketplace(nextMarketplace)
    }
    restoreCachedSuggestions(nextFile, targetMarketplace, nextProductContext)
  }, [cancelPendingAutoCanvasExport, marketplace, restoreCachedSuggestions])

  useEffect(() => {
    if (!launchState || lastLaunchIdRef.current === launchState.id) {
      return
    }

    lastLaunchIdRef.current = launchState.id
    resetWorkflow(launchState.file, launchState.marketplace, launchState.productContext)
  }, [launchState, resetWorkflow])

  useEffect(() => {
    if (!file || marketplace === 'general') {
      return
    }

    restoreCachedSuggestions(file, marketplace, productContext)
  }, [file, marketplace, productContext, restoreCachedSuggestions])

  const handleFile = useCallback((nextFile: File) => {
    resetWorkflow(nextFile, undefined, productContext)
  }, [productContext, resetWorkflow])

  const handleApplyUpscale = async () => {
    const processingFile = workspaceFileRef.current ?? file
    if (!processingFile) return
    cancelPendingAutoCanvasExport()
    setApplyingUpscale(true)
    setError(null)
    setRunningUpscale(true)
    try {
      const result = await api.upscaleApply(processingFile)
      if (!result.applied) {
        setError(result.warning ?? 'Upscale model unavailable')
        return
      }
      const fileName = `upscaled_${processingFile.name.replace(/\.[^/.]+$/, "")}.png`
      const newFile = new File([result.blob], fileName, { type: 'image/png' })
      setWorkspaceFile(newFile)
      workspaceFileRef.current = newFile
      setUpscaleResult(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error applying upscale')
    } finally {
      setApplyingUpscale(false)
      setRunningUpscale(false)
    }
  }

  const handleCheckUpscale = useCallback(async () => {
    const target = workspaceFileRef.current ?? file
    if (!target) return

    cancelPendingAutoCanvasExport()
    setRunningUpscale(true)
    setError(null)
    try {
      setUpscaleResult(await api.upscaleCheck(target))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upscale check failed')
    } finally {
      setRunningUpscale(false)
    }
  }, [cancelPendingAutoCanvasExport, file])

  const handleApplyRelight = async () => {
    const processingFile = workspaceFileRef.current ?? file
    if (!processingFile) return
    setApplyingRelight(true)
    setError(null)
    try {
      const result = await api.icLightRelightApply(processingFile, {
        lightDirection: 'none',
      })
      if (result.applied) {
        const fileName = `relit_${processingFile.name.replace(/\.[^/.]+$/, "")}.png`
        const newFile = new File([result.blob], fileName, { type: 'image/png' })
        setWorkspaceFile(newFile)
        workspaceFileRef.current = newFile
      }
      setRelightStatus({
        modelId: result.modelId,
        maskSource: result.maskSource,
        applied: result.applied,
        warning: result.warning,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error applying relight')
    } finally {
      setApplyingRelight(false)
    }
  }

  const handleApplyOutpaint = async () => {
    const processingFile = workspaceFileRef.current ?? file
    if (!processingFile) return

    setApplyingOutpaint(true)
    setError(null)

    try {
      const result = await api.outpaintApply(processingFile, {
        direction: outpaintDirection,
        expandRatio: outpaintExpansion,
      })
      const fileName = `outpainted_${processingFile.name.replace(/\.[^/.]+$/, '')}.png`
      const newFile = new File([result.blob], fileName, { type: 'image/png' })
      setWorkspaceFile(newFile)
      workspaceFileRef.current = newFile
      setOutpaintStatus({
        modelId: result.modelId,
        direction: result.direction,
        expansion: result.expansion,
        warning: result.warning,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error applying outpaint')
    } finally {
      setApplyingOutpaint(false)
    }
  }

  const handleApplyLamaCleanup = async () => {
    const processingFile = workspaceFileRef.current ?? file
    if (!processingFile) return
    setApplyingCleanup(true)
    setError(null)
    setCleanupStatus(null)

    try {
      const [textDetection, objectDetection] = await Promise.all([
        api.textDetection(processingFile),
        api.objectDetection(processingFile),
      ])

      const removableObjectLabels = new Set([
        'logo',
        'watermark',
        'stamp',
        'seal',
        'badge',
        'label',
        'sign',
        'banner',
        'caption',
        'text',
      ])

      const textBoxes = textDetection.regions.map((region) => region.bbox)
      const objectBoxes = objectDetection.objects
        .filter((object) => removableObjectLabels.has(object.label))
        .map((object) => object.bbox)

      const uniqueRegions = Array.from(
        new Map(
          [...textBoxes, ...objectBoxes].map((bbox) => [bbox.join(':'), bbox]),
        ).values(),
      )

      const warnings = [
        ...textDetection.warnings,
        ...objectDetection.warnings,
      ]

      if (uniqueRegions.length === 0) {
        setCleanupStatus({
          removedRegions: 0,
          sources: [],
          warning: 'LaMa cleanup did not find text, watermarks, or removable overlay artifacts in the current image.',
        })
        return
      }

      const blob = await api.textEraseApply(processingFile, uniqueRegions)
      const fileName = `erased_${processingFile.name.replace(/\.[^/.]+$/, "")}.png`
      const newFile = new File([blob], fileName, { type: 'image/png' })
      setWorkspaceFile(newFile)
      workspaceFileRef.current = newFile
      setCleanupStatus({
        removedRegions: uniqueRegions.length,
        sources: [
          ...(textBoxes.length > 0 ? ['text'] : []),
          ...(objectBoxes.length > 0 ? ['watermarks/artifacts'] : []),
        ],
        warning: warnings.length > 0 ? warnings.join(' ') : null,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error applying LaMa cleanup')
    } finally {
      setApplyingCleanup(false)
    }
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
    if (e.dataTransfer.files?.[0]) {
      handleFile(e.dataTransfer.files[0])
    }
  }, [handleFile])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      handleFile(e.target.files[0])
    }
  }

  const handleMarketplaceChange = useCallback((nextMarketplace: string) => {
    if (file) {
      resetWorkflow(file, nextMarketplace, productContext)
      return
    }
    setMarketplace(nextMarketplace)
    setSuggestionsResult(null)
    setFixResult(null)
    setError(null)
  }, [file, productContext, resetWorkflow])



  const executeFix = useCallback(async (
    suggestion: ComplianceFixSuggestion,
    options?: {
      transformPayload?: CanvasTransformPayload
      preserveWorkspaceFile?: boolean
      shouldApplyResult?: (result: ComplianceFixResultResponse) => boolean
    },
  ) => {
    const processingFile = workspaceFileRef.current ?? file
    if (!processingFile || !file || marketplace === 'general') {
      return null
    }

    const actionKey = options?.transformPayload
      ? `${suggestion.action}:${JSON.stringify(options.transformPayload)}`
      : suggestion.action

    const cacheKey = buildComplianceFixResultCacheKey(
      processingFile,
      marketplace,
      actionKey,
    ) + `::${productContextCacheToken}`
    const cachedResult = getCachedComplianceFixResult(cacheKey)
    if (cachedResult) {
      if (options?.shouldApplyResult && !options.shouldApplyResult(cachedResult)) {
        return cachedResult
      }

      setFixResult(cachedResult)
      setLoadedFixFromCache(true)
      setSelectedHistoryEntryId(buildHistoryEntryId(cachedResult))
      setSelectedResultSource('latest-applied')
      persistHistoryEntry(file, marketplace, suggestion.title, cachedResult)
      if (!options?.preserveWorkspaceFile) {
        const nextWorkspaceFile = await buildWorkspaceFileFromResult(cachedResult)
        if (nextWorkspaceFile) {
          setWorkspaceFile(nextWorkspaceFile)
          workspaceFileRef.current = nextWorkspaceFile
        }
      }
      setActiveStepId('compose')
      return cachedResult
    }

    const data = await api.applyComplianceFix(
      processingFile,
      marketplace,
      suggestion.action,
      options?.transformPayload,
      productContext,
    )
    setCachedComplianceFixResult(cacheKey, data)
    if (options?.shouldApplyResult && !options.shouldApplyResult(data)) {
      return data
    }

    setFixResult(data)
    setLoadedFixFromCache(false)
    setSelectedHistoryEntryId(buildHistoryEntryId(data))
    setSelectedResultSource('latest-applied')
    persistHistoryEntry(file, marketplace, suggestion.title, data)
    if (!options?.preserveWorkspaceFile) {
      const nextWorkspaceFile = await buildWorkspaceFileFromResult(data)
      if (nextWorkspaceFile) {
        setWorkspaceFile(nextWorkspaceFile)
        workspaceFileRef.current = nextWorkspaceFile
      }
    }
    setActiveStepId('compose')

    const historyItem: AnalysisResult = {
      success: true,
      filename: data.fixed_filename,
      analysis: data.after_analysis,
      metadata: data.metadata,
      timestamp: data.timestamp,
      tokens_used: data.tokens_used,
    }
    saveToHistory(historyItem)

    return data
  }, [file, marketplace, persistHistoryEntry, productContext, productContextCacheToken])

  const applyFix = async (suggestion: ComplianceFixSuggestion) => {
    if (!(workspaceFileRef.current ?? file) || marketplace === 'general') {
      return
    }

    setApplyingAction(suggestion.action)
    setError(null)

    try {
      const transformPayload = suggestion.action === 'auto_center_ai'
        ? {
            target_width: canvasTarget.width,
            target_height: canvasTarget.height,
            zoom: 1,
            offset_x: 0,
            offset_y: 0,
            background: 'white',
            image_usage: imageUsage,
          }
        : undefined

      await executeFix(suggestion, transformPayload ? { transformPayload } : undefined)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply fix')
    } finally {
      setApplyingAction(null)
    }
  }

  const handleCanvasPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!preview) {
      return
    }

    rememberCanvasStateForUndo()
    clearSnapbackTimer()
    setCanvasSnapbackActive(false)
    setIsDraggingCanvas(true)
    dragOriginRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      startOffsetX: canvasOffset.x,
      startOffsetY: canvasOffset.y,
      snapshotRecorded: false,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handleCanvasPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingCanvas) {
      return
    }

    const unclampedX = dragOriginRef.current.startOffsetX + (event.clientX - dragOriginRef.current.startX)
    const unclampedY = dragOriginRef.current.startOffsetY + (event.clientY - dragOriginRef.current.startY)
    if (
      !dragOriginRef.current.snapshotRecorded
      && (unclampedX !== dragOriginRef.current.startOffsetX || unclampedY !== dragOriginRef.current.startOffsetY)
    ) {
      rememberCanvasStateForUndo()
      dragOriginRef.current.snapshotRecorded = true
    }
    const resistedX = applyEdgeResistance(
      unclampedX,
      allowedCanvasOffset.minX,
      allowedCanvasOffset.maxX,
    )
    const resistedY = applyEdgeResistance(
      unclampedY,
      allowedCanvasOffset.minY,
      allowedCanvasOffset.maxY,
    )
    setCanvasEdgeResistanceActive(
      resistedX !== unclampedX || resistedY !== unclampedY,
    )
    setCanvasOffset({
      x: resistedX,
      y: resistedY,
    })
  }

  const handleCanvasPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingCanvas) {
      return
    }

    setIsDraggingCanvas(false)
    const clampedX = clamp(
      canvasOffset.x,
      allowedCanvasOffset.minX,
      allowedCanvasOffset.maxX,
    )
    const clampedY = clamp(
      canvasOffset.y,
      allowedCanvasOffset.minY,
      allowedCanvasOffset.maxY,
    )
    const needsSnapback = clampedX !== canvasOffset.x || clampedY !== canvasOffset.y
    if (needsSnapback) {
      setCanvasOffset({ x: clampedX, y: clampedY })
      scheduleSnapbackReset()
    }
    setCanvasEdgeResistanceActive(false)
    event.currentTarget.releasePointerCapture(event.pointerId)
  }

  const handleCanvasKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const key = event.key
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(key)) {
      return
    }

    event.preventDefault()
    const step = event.shiftKey ? 32 : 12
    rememberCanvasStateForUndo()
    clearSnapbackTimer()
    setCanvasSnapbackActive(false)
    setCanvasEdgeResistanceActive(false)

    setCanvasOffset((currentOffset) => {
      let nextX = currentOffset.x
      let nextY = currentOffset.y

      if (key === 'ArrowLeft') nextX -= step
      if (key === 'ArrowRight') nextX += step
      if (key === 'ArrowUp') nextY -= step
      if (key === 'ArrowDown') nextY += step

      return {
        x: clamp(nextX, allowedCanvasOffset.minX, allowedCanvasOffset.maxX),
        y: clamp(nextY, allowedCanvasOffset.minY, allowedCanvasOffset.maxY),
      }
    })
  }

  const buildCanvasTransformPayload = useCallback((): CanvasTransformPayload | null => {
    if (!(workspaceFileRef.current ?? file) || marketplace === 'general') {
      return null
    }

    if (canvasStageSize.width <= 0 || canvasStageSize.height <= 0) {
      return null
    }

    return {
      target_width: canvasTarget.width,
      target_height: canvasTarget.height,
      zoom: canvasZoom,
      offset_x: canvasOffset.x / canvasStageSize.width,
      offset_y: canvasOffset.y / canvasStageSize.height,
      background: 'white',
    }
  }, [canvasOffset.x, canvasOffset.y, canvasStageSize.height, canvasStageSize.width, canvasTarget.height, canvasTarget.width, canvasZoom, file, marketplace])

  const applyCanvasTransform = useCallback(async (
    mode: 'auto' | 'manual' = 'manual',
    payloadOverride?: CanvasTransformPayload,
    requestId?: number,
  ) => {
    const transformPayload = payloadOverride ?? buildCanvasTransformPayload()
    if (!transformPayload) {
      return null
    }

    const payloadKey = JSON.stringify(transformPayload)
    let didApplyResult = false

    if (mode === 'manual') {
      clearAutoCanvasExportTimer()
      autoCanvasExportRequestIdRef.current += 1
    }

    setApplyingAction('canvas_transform')
    setError(null)
    try {
      const result = await executeFix(
        {
          id: 'canvas-transform',
          title: 'Canvas Export',
          description: 'Manual crop and centered export',
          action: 'canvas_transform',
          automated: true,
          priority: 'high',
        },
        {
          transformPayload,
          preserveWorkspaceFile: true,
          shouldApplyResult: () => {
            const shouldApply = mode === 'manual'
              || (
                requestId === autoCanvasExportRequestIdRef.current
                && activeStepIdRef.current === 'compose'
              )

            if (shouldApply) {
              didApplyResult = true
            }

            return shouldApply
          },
        },
      )
      if (didApplyResult) {
        lastAutoCanvasPayloadKeyRef.current = payloadKey
      }
      return didApplyResult ? result : null
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export canvas')
      return null
    } finally {
      setApplyingAction(null)
    }
  }, [buildCanvasTransformPayload, clearAutoCanvasExportTimer, executeFix])

  const canvasTransformPayload = useMemo(
    () => buildCanvasTransformPayload(),
    [buildCanvasTransformPayload],
  )

  const canvasTransformSourceKey = useMemo(() => {
    const sourceFile = workspaceFile ?? file
    if (!sourceFile) {
      return null
    }

    return [
      sourceFile.name,
      sourceFile.size,
      sourceFile.lastModified,
      sourceFile.type,
    ].join(':')
  }, [file, workspaceFile])

  const canvasTransformPayloadKey = useMemo(
    () => (
      canvasTransformPayload && canvasTransformSourceKey
        ? JSON.stringify({ source: canvasTransformSourceKey, payload: canvasTransformPayload })
        : null
    ),
    [canvasTransformPayload, canvasTransformSourceKey],
  )

  useEffect(() => {
    if (!canvasTransformPayloadKey) {
      clearAutoCanvasExportTimer()
      lastAutoCanvasPayloadKeyRef.current = null
      return
    }

    autoCanvasExportRequestIdRef.current += 1
  }, [canvasTransformPayloadKey, clearAutoCanvasExportTimer])

  useEffect(() => {
    if (
      !canvasDraftHydrated
      || !canvasTransformPayload
      || !canvasTransformPayloadKey
      || isDraggingCanvas
      || applyingAction !== null
      || activeStepId !== 'compose'
      || marketplace === 'general'
    ) {
      clearAutoCanvasExportTimer()
      return
    }

    if (lastAutoCanvasPayloadKeyRef.current === canvasTransformPayloadKey) {
      clearAutoCanvasExportTimer()
      return
    }

    const requestId = autoCanvasExportRequestIdRef.current
    clearAutoCanvasExportTimer()
    autoCanvasExportTimerRef.current = window.setTimeout(() => {
      autoCanvasExportTimerRef.current = null
      void applyCanvasTransform('auto', canvasTransformPayload, requestId)
    }, AUTO_CANVAS_EXPORT_DEBOUNCE_MS)

    return clearAutoCanvasExportTimer
  }, [
    activeStepId,
    applyCanvasTransform,
    canvasDraftHydrated,
    canvasTransformPayload,
    canvasTransformPayloadKey,
    clearAutoCanvasExportTimer,
    isDraggingCanvas,
    marketplace,
    applyingAction,
  ])

  const undoCanvasChange = () => {
    const previousSnapshot = canvasUndoStackRef.current[0]
    if (!previousSnapshot) {
      return
    }

    const currentSnapshot = getCanvasSnapshot()

    setCanvasUndoStack((currentStack) => currentStack.slice(1))
    setCanvasRedoStack((currentStack) => {
      if (currentStack[0] && canvasSnapshotsEqual(currentStack[0], currentSnapshot)) {
        return currentStack
      }

      return [currentSnapshot, ...currentStack].slice(0, MAX_CANVAS_UNDO_STEPS)
    })
    applyCanvasSnapshot(previousSnapshot)
  }

  const redoCanvasChange = () => {
    const nextSnapshot = canvasRedoStackRef.current[0]
    if (!nextSnapshot) {
      return
    }

    const currentSnapshot = getCanvasSnapshot()

    setCanvasRedoStack((currentStack) => currentStack.slice(1))
    setCanvasUndoStack((currentStack) => {
      if (currentStack[0] && canvasSnapshotsEqual(currentStack[0], currentSnapshot)) {
        return currentStack
      }

      return [currentSnapshot, ...currentStack].slice(0, MAX_CANVAS_UNDO_STEPS)
    })
    applyCanvasSnapshot(nextSnapshot)
  }

  const handleCanvasPresetChange = (nextPreset: CanvasPreset) => {
    if (nextPreset === canvasPreset) {
      return
    }

    rememberCanvasStateForUndo()
    setCanvasPreset(nextPreset)
  }

  const handleCanvasZoomChange = (nextZoom: number) => {
    if (nextZoom === canvasZoom) {
      return
    }

    rememberCanvasStateForUndo()
    clearSnapbackTimer()
    setCanvasSnapbackActive(false)
    setCanvasEdgeResistanceActive(false)
    setCanvasZoom(nextZoom)
  }

  const handleCanvasReset = () => {
    const defaultSnapshot = getDefaultCanvasSnapshot()
    const currentSnapshot = getCanvasSnapshot()

    if (canvasSnapshotsEqual(currentSnapshot, defaultSnapshot)) {
      return
    }

    pushCanvasUndoSnapshot(currentSnapshot)
    applyCanvasSnapshot(defaultSnapshot)
  }

  const handleCanvasRecenter = () => {
    const currentSnapshot = getCanvasSnapshot()
    const centeredSnapshot: CanvasCompositionSnapshot = {
      ...currentSnapshot,
      offset: { x: 0, y: 0 },
    }

    if (canvasSnapshotsEqual(currentSnapshot, centeredSnapshot)) {
      return
    }

    pushCanvasUndoSnapshot(currentSnapshot)
    applyCanvasSnapshot(centeredSnapshot)
  }



  const downloadFixedImage = () => {
    if (!fixResult) {
      return
    }

    const link = document.createElement('a')
    link.href = fixResult.image_data_url
    link.download = fixResult.fixed_filename
    link.click()
  }

  const downloadResultImage = useCallback((result: ComplianceFixResultResponse | null) => {
    if (!result) {
      return
    }

    const link = document.createElement('a')
    link.href = result.image_data_url
    link.download = result.fixed_filename
    link.click()
  }, [])

  const downloadOriginalImage = useCallback(() => {
    if (!preview || !file) {
      return
    }

    const extension = file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.')) : '.png'
    const basename = file.name.replace(/\.[^.]+$/, '')
    const link = document.createElement('a')
    link.href = preview
    link.download = `${basename}-original${extension}`
    link.click()
  }, [file, preview])

  const deltaSummary = fixResult
    ? buildComplianceDeltaSummary(
      fixResult.before_analysis,
      fixResult.after_analysis,
    )
    : null
  const verificationDeltaSummary = fixResult
    && fixResult.before_findings
    && fixResult.after_findings
    && (fixResult.before_findings.length > 0 || fixResult.after_findings.length > 0)
    ? buildVerificationDeltaSummary(
      fixResult.before_findings,
      fixResult.after_findings,
    )
    : null

  const visibleSuggestions = useMemo(
    () => suggestionsResult?.suggestions ?? [],
    [suggestionsResult],
  )

  const manualActions = useMemo(
    () => MANUAL_ACTIONS.filter(
      (manualAction) => !visibleSuggestions.some(
        (suggestion) => suggestion.action === manualAction.action,
      ),
    ),
    [visibleSuggestions],
  )

  const actionCatalog = useMemo(() => {
    const catalog = new Map<string, ComplianceFixSuggestion>()

    for (const suggestion of visibleSuggestions) {
      catalog.set(suggestion.action, suggestion)
    }

    for (const suggestion of MANUAL_ACTIONS) {
      if (!catalog.has(suggestion.action)) {
        catalog.set(suggestion.action, suggestion)
      }
    }

    return Array.from(catalog.values())
  }, [visibleSuggestions])

  const unifiedActionCards = useMemo(() => {
    return [
      ...visibleSuggestions.map((suggestion) => ({
        ...suggestion,
        source: 'ai' as const,
      })),
      ...manualActions.map((suggestion) => ({
        ...suggestion,
        source: 'manual' as const,
      })),
    ].sort((left, right) => {
      if (left.source !== right.source) {
        return left.source === 'ai' ? -1 : 1
      }

      const priorityDelta = (PRIORITY_ORDER[left.priority] ?? 99) - (PRIORITY_ORDER[right.priority] ?? 99)
      if (priorityDelta !== 0) {
        return priorityDelta
      }

      return left.title.localeCompare(right.title)
    })
  }, [manualActions, visibleSuggestions])

  const primaryActionCards = useMemo(() => {
    return PRIMARY_LANE_ACTIONS
      .map((action) => unifiedActionCards.find((suggestion) => suggestion.action === action))
      .filter((suggestion): suggestion is (typeof unifiedActionCards)[number] => Boolean(suggestion))
  }, [unifiedActionCards])



  const fixHistory = useMemo(() => {
    const actionCounts = new Map<string, number>()

    return fixHistoryEntries
      .map((entry) => {
        const suggestion = actionCatalog.find((candidate) => candidate.action === entry.action)
        const nextCount = (actionCounts.get(entry.action) ?? 0) + 1
        actionCounts.set(entry.action, nextCount)
        const ranking = rankComplianceDelta(
          buildComplianceDeltaSummary(
            entry.result.before_analysis,
            entry.result.after_analysis,
          ),
        )
        const verificationSummary =
          entry.result.before_findings && entry.result.after_findings
            ? buildVerificationDeltaSummary(entry.result.before_findings, entry.result.after_findings)
            : null
        const verificationRanking = verificationSummary
          ? rankVerificationDelta(verificationSummary)
          : null

        return {
          id: entry.id,
          action: entry.action,
          title: buildHistoryTitle(
            entry,
            suggestion?.title ?? entry.title,
            nextCount,
          ),
          result: entry.result,
          summary: ranking.summary,
          score: verificationRanking?.score ?? ranking.score,
        }
      })
      .sort((left, right) => right.score - left.score)
  }, [actionCatalog, fixHistoryEntries])

  const bestFix = fixHistory[0] ?? null
  const workspaceStateLabel = suggestionsResult
    ? 'Fix options loaded'
    : file
      ? 'Ready to edit'
      : 'Waiting for source image'
  const selectedResultRanking = deltaSummary
    ? verificationDeltaSummary
      ? rankVerificationDelta(verificationDeltaSummary)
      : rankComplianceDelta(deltaSummary)
    : null
  const selectedResultScore = fixResult && deltaSummary
    ? selectedResultRanking?.score ?? null
    : null
  const selectedResultRemainingIssues = fixResult && (verificationDeltaSummary || deltaSummary)
    ? verificationDeltaSummary?.remainingIssues ?? deltaSummary?.remainingIssues ?? null
    : null
  const beforeOverlayRects = useMemo(
    () => buildOverlayRects(fixResult?.before_findings ?? []),
    [fixResult?.before_findings],
  )
  const afterOverlayRects = useMemo(
    () => buildOverlayRects(fixResult?.after_findings ?? []),
    [fixResult?.after_findings],
  )
  const selectedResultSourceLabel =
    selectedResultSource === 'history'
      ? 'Selected from history'
      : selectedResultSource === 'latest-applied'
        ? 'Latest applied'
        : 'No pinned result'
  const selectedExportEntryId = selectedHistoryEntryId ?? (fixResult ? buildHistoryEntryId(fixResult) : null)
  const selectedExportEntry = selectedExportEntryId
    ? fixHistory.find((entry) => entry.id === selectedExportEntryId) ?? null
    : null
  const selectedExportResult = selectedExportEntry?.result ?? fixResult
  const approvedExportEntry = approvedExportEntryId
    ? fixHistory.find((entry) => entry.id === approvedExportEntryId) ?? null
    : null
  const isSelectedVariantApproved = Boolean(selectedExportEntryId && approvedExportEntryId === selectedExportEntryId)
  const selectedAiMetadata = getAiMetadata(fixResult)
  const selectedFillRatioLabel =
    typeof selectedAiMetadata?.fill_ratio === 'number'
      ? selectedAiMetadata.fill_ratio.toFixed(2)
      : 'n/a'
  const selectedTargetClassLabel = selectedAiMetadata?.target_class ?? 'n/a'
  const selectedImageUsageLabel = selectedAiMetadata?.image_usage ?? 'n/a'
  const selectedMaskSourceLabel = selectedAiMetadata?.mask_source ?? 'n/a'
  const selectedFallbackUsed = Boolean(selectedAiMetadata?.fallback_used)
  const selectedFallbackReason = selectedAiMetadata?.fallback_reason
    ?? 'Hugging Face foreground extraction did not produce a usable mask, so Studio composed the full image instead.'
  const studioReady = Boolean(file && marketplace !== 'general')
  const studioBusy = applyingAction !== null
  const canvasControlsBusy = applyingAction !== null && applyingAction !== 'canvas_transform'
  const toolActionsBusy = applyingAction !== null && applyingAction !== 'canvas_transform'

  const canExportCanvas = studioReady && !studioBusy
  const canResetToOriginal = Boolean(file && workspaceFile && workspaceFile !== file && !studioBusy)
  const canOpenCompare = Boolean(fixResult)
  const canOpenExport = Boolean(selectedExportResult || canExportCanvas)

  const resetToOriginal = useCallback(() => {
    if (!file) {
      return
    }

    resetWorkflow(file, marketplace, productContext)
  }, [file, marketplace, productContext, resetWorkflow])

  useEffect(() => {
    if (!studioReady && activeStepId !== 'compose') {
      setActiveStepId('compose')
      return
    }

    if (!fixResult && (activeStepId === 'compare' || activeStepId === 'export')) {
      setActiveStepId('compose')
    }
  }, [activeStepId, fixResult, studioReady])

  const selectHistoryEntry = useCallback(async (entryId: string) => {
    const historyEntry = fixHistory.find((entry) => entry.id === entryId)
    if (!historyEntry) {
      return
    }

    const nextWorkspaceFile = await buildWorkspaceFileFromResult(historyEntry.result)
    setFixResult(historyEntry.result)
    setSelectedHistoryEntryId(entryId)
    setSelectedResultSource('history')
    setLoadedFixFromCache(true)
    if (nextWorkspaceFile) {
      setWorkspaceFile(nextWorkspaceFile)
      workspaceFileRef.current = nextWorkspaceFile
    }
    setActiveStepId('compose')
  }, [fixHistory])

  const scrollFilmstripEntryIntoView = useCallback((entryId: string) => {
    const target = filmstripRef.current?.querySelector<HTMLElement>(`[data-history-entry-id="${entryId}"]`)
    target?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  }, [])

  const handleFilmstripKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (fixHistory.length === 0) {
      return
    }

    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
      return
    }

    event.preventDefault()

    const currentIndex = Math.max(
      0,
      fixHistory.findIndex((entry) => entry.id === selectedExportEntryId),
    )

    let nextIndex = currentIndex
    if (event.key === 'ArrowRight') {
      nextIndex = Math.min(currentIndex + 1, fixHistory.length - 1)
    }
    if (event.key === 'ArrowLeft') {
      nextIndex = Math.max(currentIndex - 1, 0)
    }
    if (event.key === 'Home') {
      nextIndex = 0
    }
    if (event.key === 'End') {
      nextIndex = fixHistory.length - 1
    }

    const nextEntry = fixHistory[nextIndex]
    if (!nextEntry) {
      return
    }

    void selectHistoryEntry(nextEntry.id)
    window.requestAnimationFrame(() => {
      scrollFilmstripEntryIntoView(nextEntry.id)
    })
  }, [fixHistory, scrollFilmstripEntryIntoView, selectHistoryEntry, selectedExportEntryId])

  const markSelectedVariantApproved = useCallback(() => {
    if (!selectedExportEntryId) {
      return
    }

    setApprovedExportEntryId(selectedExportEntryId)
  }, [selectedExportEntryId])

  const approveAndDownloadSelected = useCallback(() => {
    if (!selectedExportEntryId) {
      return
    }

    setApprovedExportEntryId(selectedExportEntryId)
    setActiveStepId('export')
    downloadResultImage(selectedExportResult)
  }, [downloadResultImage, selectedExportEntryId, selectedExportResult])

  const handleOpenExport = useCallback(async () => {
    if (selectedExportResult) {
      setActiveStepId('export')
      return
    }

    const exportResult = await applyCanvasTransform()
    if (exportResult) {
      setActiveStepId('export')
    }
  }, [selectedExportResult])

  useEffect(() => {
    if (!approvedExportEntryId) {
      return
    }

    if (!fixHistory.some((entry) => entry.id === approvedExportEntryId)) {
      setApprovedExportEntryId(null)
    }
  }, [approvedExportEntryId, fixHistory])

  return (
    <div className="section-compliance section-fix-studio">
      <div className="hero-header-row fix-studio-hero">
        <span className="hero-kicker">Image operations</span>
        <h1 className="hero-title hero-title-inline">Fix Studio</h1>
        <p className="hero-subtitle hero-subtitle-inline">
          AI-powered image correction
        </p>
        <div className="fix-studio-marketplace-wrap">
          <MarketplaceSelector
            selected={marketplace}
            onSelect={handleMarketplaceChange}
            selectedImageUsage={imageUsage}
            selectedTargetClass={canvasPreset === 'minimum' ? 'minimum' : 'recommended'}
            policyLabel={currentPolicyLabel}
            className="marketplace-selector-compact fix-studio-marketplace-selector"
          />
        </div>
      </div>

      <div className="fix-session-strip">
        <div className="fix-session-strip-main">
          <div>
            <span className="fix-workspace-label">Studio Session</span>
            <strong>{workspaceStateLabel}</strong>
          </div>
        </div>

        <div className="fix-session-strip-stats">
          <div className="fix-session-pill">
            <span className="fix-workspace-label">Canvas</span>
            <strong>{canvasTarget.width} x {canvasTarget.height}</strong>
          </div>
          <div className="fix-session-pill">
            <span className="fix-workspace-label">Policy</span>
            <strong>{currentPolicyLabel ?? 'No policy loaded'}</strong>
          </div>
          <div className="fix-session-pill">
            <span className="fix-workspace-label">Best Signal</span>
            <strong>{bestFix ? `${bestFix.title} · ${bestFix.score}` : 'No variants yet'}</strong>
          </div>
          <div className="fix-session-pill">
            <span className="fix-workspace-label">Context</span>
            <strong>{productContextSummary}</strong>
          </div>
        </div>
      </div>

      <div className="compliance-context-panel">
        <div className="compliance-context-grid">
          <label className="compliance-context-field">
            <span className="fix-workspace-label">Product Title</span>
            <input
              className="setting-input"
              type="text"
              value={productContext?.title ?? ''}
              onChange={(event) => updateProductContext({ title: event.target.value })}
              placeholder="Optional title or SKU naming"
            />
          </label>

          <label className="compliance-context-field">
            <span className="fix-workspace-label">Category Profile</span>
            <input
              className="setting-input"
              type="text"
              value={productContext?.category ?? ''}
              onChange={(event) => updateProductContext({ category: event.target.value })}
              placeholder="electronics, fashion, beauty..."
            />
          </label>
        </div>

        <label className="compliance-context-field">
          <span className="fix-workspace-label">Attributes</span>
          <textarea
            className="setting-input compliance-context-textarea"
            value={productContext?.attributes ?? ''}
            onChange={(event) => updateProductContext({ attributes: event.target.value })}
            placeholder="Color, variant, pack count, model, condition, allowed accessories..."
          />
        </label>

        <div className="compliance-context-reference">
          <div>
            <span className="fix-workspace-label">Reference Image</span>
            <strong>
              {productContext?.referenceImage?.name
                ?? productContext?.referenceImageName
                ?? 'Optional catalog or official reference image'}
            </strong>
          </div>
          <button
            type="button"
            className="secondary-btn compliance-context-action"
            onClick={() => referenceInputRef.current?.click()}
          >
            {productContext?.referenceImage || productContext?.referenceImageName
              ? 'Replace Reference'
              : 'Add Reference'}
          </button>
          <input
            ref={referenceInputRef}
            type="file"
            accept=".png,.jpg,.jpeg,.webp"
            onChange={(event) => {
              const nextReferenceImage = event.target.files?.[0] ?? null
              updateProductContext({
                referenceImage: nextReferenceImage,
                referenceImageName: nextReferenceImage?.name ?? null,
              })
            }}
            style={{ display: 'none' }}
          />
        </div>
      </div>

      <div className="fix-studio-shell">
        <div className="fix-studio-main">
          <div className="result-section fix-studio-stage-panel fix-step-section expanded">
                <div className="fix-step-body fix-stage-primary">
              {!studioReady && (
                <div className="fix-intake-strip">
                  <div className="fix-intake-card">
                    <span className="fix-workspace-label">Start Point</span>
                    <strong>Upload a source image or open from Compliance.</strong>
                  </div>
                  <div className="fix-intake-card">
                    <span className="fix-workspace-label">Goal</span>
                    <strong>Compose, correct, compare, then export one approved variant.</strong>
                  </div>
                </div>
              )}

              <div
                className={`file-drop fix-studio-drop ${file ? 'has-file' : ''} ${dragActive ? 'drag-active' : ''}`}
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragActive(true) }}
                onDragLeave={() => setDragActive(false)}
                onDrop={handleDrop}
              >
                <input
                  ref={inputRef}
                  type="file"
                  accept=".png,.jpg,.jpeg,.webp"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                />
                <div className="drop-content">
                  {file ? (
                    <div className="file-info fix-studio-file-info">
                      <span className="drop-icon"><FileIcon /></span>
                      <div className="fix-studio-file-copy">
                        <span className="file-name">{file.name}</span>
                        <div className="fix-studio-file-meta">
                          <span>{formatFileSize(file.size)}</span>
                          <span>{activeMarketplace?.name ?? marketplace}</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <span className="drop-icon"><DownloadIcon /></span>
                      <span className="drop-text">Drop a marketplace image here to start composition</span>
                      <span className="drop-hint">PNG, JPG, WebP</span>
                    </>
                  )}
                </div>
              </div>

              {error && (
                <div className="results-panel" style={{ borderColor: '#ef4444' }}>
                  <div className="results-content" style={{ color: '#ef4444' }}>{error}</div>
                </div>
              )}

              {studioReady && (
                <>
                  <div className="fix-workspace-grid">
                    <div className="fix-workspace-canvas-column">
                      <div className="fix-toolbar-compact" aria-label="Composition toolbar">
                        <div className="fix-toolbar-compact-main">
                          <div className="fix-toolbar-control-group">
                            <select
                              data-testid="canvas-preset"
                              className="setting-input"
                              value={canvasPreset}
                              onChange={(event) => handleCanvasPresetChange(event.target.value as CanvasPreset)}
                            >
                              <option value="recommended">Recommended</option>
                              <option value="minimum">Minimum</option>
                            </select>
                          </div>

                          <div className="fix-toolbar-control-group fix-toolbar-control-group-source" data-testid="image-usage-control">
                            <select
                              data-testid="image-usage-select"
                              className="setting-input"
                              value={imageUsage}
                              onChange={(event) => setImageUsage(event.target.value as ImageUsage)}
                              disabled={studioBusy}
                            >
                              <option value="main_image">Main Photo</option>
                              <option value="gallery_image">Gallery Photo</option>
                            </select>
                          </div>

                          <div className="fix-toolbar-control-group fix-toolbar-control-group-actions">
                            <div className="fix-toolbar-inline-actions">
                              <button
                                className="secondary-btn"
                                data-testid="undo-canvas-button"
                                onClick={undoCanvasChange}
                                disabled={canvasUndoStack.length === 0 || canvasControlsBusy}
                              >
                                <RotateCcw size={15} />Undo
                              </button>
                              <button
                                className="secondary-btn"
                                data-testid="redo-canvas-button"
                                onClick={redoCanvasChange}
                                disabled={canvasRedoStack.length === 0 || canvasControlsBusy}
                              >
                                <RotateCw size={15} />Redo
                              </button>
                              <button
                                className="secondary-btn"
                                onClick={handleCanvasRecenter}
                                disabled={!studioReady || canvasControlsBusy}
                                title="Recenter canvas"
                              >
                                <Move size={15} />Center
                              </button>
                            </div>
                          </div>
                        </div>

                      </div>

                      <div className="canvas-stage-wrap canvas-stage-wrap-expanded">
                        <div
                          ref={canvasStageRef}
                          data-testid="canvas-stage"
                          className={`canvas-stage ${isDraggingCanvas ? 'dragging' : ''} ${canvasSnapbackActive ? 'snapback' : ''} ${canvasEdgeResistanceActive ? 'edge-hit' : ''}`}
                          style={{ aspectRatio: `${canvasTarget.width} / ${canvasTarget.height}` }}
                          tabIndex={0}
                          role="application"
                          aria-label="Canvas stage"
                          onPointerDown={handleCanvasPointerDown}
                          onPointerMove={handleCanvasPointerMove}
                          onPointerUp={handleCanvasPointerUp}
                          onPointerLeave={handleCanvasPointerUp}
                          onKeyDown={handleCanvasKeyDown}
                        >
                          {(workspacePreview ?? preview) && (
                            <img
                              className="canvas-stage-image"
                              src={workspacePreview ?? preview ?? undefined}
                              alt="Canvas stage preview"
                              style={{
                                transform: `translate(${canvasOffset.x}px, ${canvasOffset.y}px) scale(${canvasZoom})`,
                                transition: isDraggingCanvas
                                  ? 'none'
                                  : canvasSnapbackActive
                                    ? 'transform 180ms cubic-bezier(0.22, 1, 0.36, 1)'
                                    : 'transform 120ms ease-out',
                              }}
                            />
                          )}
                          <div className="canvas-crop-overlay">
                            <div className="canvas-crop-label">
                              {canvasTarget.width} x {canvasTarget.height}
                            </div>
                          </div>
                          <div className="canvas-zoom-overlay">
                            <div className="canvas-zoom-overlay-header">
                              <span className="fix-workspace-label">Zoom</span>
                              <strong>{canvasZoom.toFixed(2)}x</strong>
                            </div>
                            <input
                              data-testid="canvas-zoom-slider"
                              type="range"
                              min="1"
                              max="2.5"
                              step="0.05"
                              value={canvasZoom}
                              onChange={(event) => handleCanvasZoomChange(Number(event.target.value))}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="fix-stage-summary-cluster">
                        <div className="fix-canvas-statusbar">
                          <div className="fix-canvas-statusbar-copy">
                            <strong>{selectedExportEntry?.title ?? (fixResult ? fixResult.applied_action : 'Compose a variant')}</strong>
                            <div className="fix-canvas-statusbar-meta">
                              <span className="fix-rail-note">{currentPolicyLabel ?? 'No composition policy available for this marketplace yet.'}</span>
                            </div>
                          </div>

                          <div className="fix-canvas-statusbar-actions">
                            <button
                              className="secondary-btn"
                              data-testid="reset-canvas-button"
                              onClick={handleCanvasReset}
                              disabled={!studioReady || canvasControlsBusy}
                            >
                              <RefreshCw size={15} />Reset
                            </button>
                            <button
                              className="secondary-btn"
                              data-testid="open-compare-button"
                              onClick={() => setActiveStepId('compare')}
                              disabled={!canOpenCompare}
                            >
                              <CheckCircle size={15} />Compare
                            </button>
                            <button
                              className="scan-btn fix-stage-export-btn"
                              data-testid="open-export-button"
                              onClick={() => {
                                void handleOpenExport()
                              }}
                              disabled={!canOpenExport}
                            >
                              <Download size={15} />Export
                            </button>
                          </div>
                        </div>
                      </div>

                      {(verificationDeltaSummary || deltaSummary) && (((verificationDeltaSummary?.removedFindings.length ?? 0) > 0) || ((verificationDeltaSummary?.addedFindings.length ?? 0) > 0) || ((deltaSummary?.resolvedIssues.length ?? 0) > 0) || ((deltaSummary?.newIssues.length ?? 0) > 0)) && (
                        <div className="fix-issue-delta-panel fix-issue-delta-panel-stage">
                          <div className="fix-rail-note-block">
                            <span className="fix-workspace-label">{verificationDeltaSummary ? 'Verification Diff' : 'Analysis Diff'}</span>
                            <span className="fix-rail-note">
                              {verificationDeltaSummary
                                ? 'These entries come from structured rule, OCR, detector, and quality checks rerun after the edit.'
                                : 'These entries reflect changes in the analysis text, not a separate visual verification pass.'}
                            </span>
                          </div>
                          {verificationDeltaSummary
                            ? verificationDeltaSummary.removedFindings.length > 0 && (
                              <div className="fix-delta-list success-list">
                                <div className="fix-delta-title"><CheckCircle size={14} /> Removed In Verification</div>
                                {renderVerificationFindings(verificationDeltaSummary.removedFindings)}
                              </div>
                            )
                            : deltaSummary && deltaSummary.resolvedIssues.length > 0 && (
                            <div className="fix-delta-list success-list">
                              <div className="fix-delta-title"><CheckCircle size={14} /> Removed From Analysis</div>
                              {renderFixDeltaIssues(deltaSummary.resolvedIssues)}
                            </div>
                          )}

                          {verificationDeltaSummary
                            ? verificationDeltaSummary.addedFindings.length > 0 && (
                              <div className="fix-delta-list warning-list">
                                <div className="fix-delta-title"><TriangleAlert size={14} /> Added In Verification</div>
                                {renderVerificationFindings(verificationDeltaSummary.addedFindings)}
                              </div>
                            )
                            : deltaSummary && deltaSummary.newIssues.length > 0 && (
                            <div className="fix-delta-list warning-list">
                              <div className="fix-delta-title"><TriangleAlert size={14} /> Added To Analysis</div>
                              {renderFixDeltaIssues(deltaSummary.newIssues)}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="fix-workspace-tools-column fix-run-simplified">
                      <div className="fix-step-card fix-action-catalog-card">
                        <div className="result-section-header fix-step-card-header fix-tool-rack-panel-header">
                          <span className="result-section-title">
                            Neural Tools
                          </span>
                        </div>

                        <div className="fix-tool-rack-list">
                          {primaryActionCards.map((suggestion) => {
                            const isAiTool = suggestion.source === 'ai'
                            return (
                              <div
                                key={`${suggestion.source}-${suggestion.id}`}
                                className={`fix-tool-rack-item ${isAiTool ? 'ai' : 'manual'}`}
                              >
                                <div className="fix-tool-rack-main">
                                  <div className="fix-tool-rack-copy">
                                    <div className="fix-tool-rack-title-row">
                                      <div className="fix-suggestion-title">{suggestion.title}</div>
                                    </div>
                                    <p className="fix-tool-rack-subtitle">{suggestion.description}</p>
                                  </div>
                                </div>
                                <div className="fix-tool-rack-actions">
                                  <button
                                    type="button"
                                    className="scan-btn"
                                    onClick={() => applyFix(suggestion)}
                                    disabled={toolActionsBusy}
                                  >
                                    {applyingAction === suggestion.action
                                      ? <><span className="spinner"></span>Applying...</>
                                      : <>Run</>}
                                  </button>
                                </div>
                              </div>
                            )
                          })}

                          <div className={`fix-tool-rack-item ai ${cleanupStatus ? 'has-status' : ''}`}>
                            <div className="fix-tool-rack-main">
                              <div className="fix-tool-rack-copy">
                                <div className="fix-tool-rack-title-row">
                                  <div className="fix-suggestion-title">{cleanupStatus?.removedRegions ? 'Text & marks removed' : cleanupStatus ? 'Text & marks scan complete' : 'Remove Text & Marks'}</div>
                                </div>
                                <p className="fix-tool-rack-subtitle">
                                  {cleanupStatus
                                    ? cleanupStatus.removedRegions > 0
                                      ? `Removed ${cleanupStatus.removedRegions} region(s) from ${cleanupStatus.sources.join(' + ')}.`
                                      : 'No text, watermarks, or removable overlay artifacts were detected.'
                                    : 'Remove text, watermarks, and small overlay trash inline with the current workspace image.'}
                                </p>
                                {cleanupStatus?.warning && (
                                  <div className="fix-tool-inline-note warning">
                                    <span>{cleanupStatus.warning}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="fix-tool-rack-actions">
                              <button
                                type="button"
                                className={cleanupStatus ? 'secondary-btn' : 'scan-btn'}
                                onClick={handleApplyLamaCleanup}
                                disabled={!file || applyingCleanup || toolActionsBusy}
                              >
                                {applyingCleanup ? <><span className="spinner"></span>Cleaning...</> : <>{cleanupStatus ? 'Apply Again' : 'Apply'}</>}
                              </button>
                            </div>
                          </div>

                          <div className={`fix-tool-rack-item ai ${relightStatus ? 'has-status' : ''}`}>
                            <div className="fix-tool-rack-main">
                              <div className="fix-tool-rack-copy">
                                <div className="fix-tool-rack-title-row">
                                  <div className="fix-suggestion-title">{relightStatus ? (relightStatus.applied ? 'Product relit' : 'Relight unavailable') : 'Relight Product'}</div>
                                </div>
                                <p className="fix-tool-rack-subtitle">
                                  {relightStatus
                                    ? `${relightStatus.modelId ? `Model: ${relightStatus.modelId}. ` : 'IC-Light pipeline attempted. '}${relightStatus.maskSource ? `Mask: ${relightStatus.maskSource}. ` : ''}${!relightStatus.applied ? 'Workspace image was not changed.' : ''}`
                                    : 'Rebuild soft studio lighting and a cleaner shadow pass for the current workspace image.'}
                                </p>
                                {relightStatus?.warning && (
                                  <div className="fix-tool-inline-note warning">
                                    <span>{relightStatus.warning}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="fix-tool-rack-actions">
                              <button
                                type="button"
                                className={relightStatus ? 'secondary-btn' : 'scan-btn'}
                                onClick={handleApplyRelight}
                                disabled={!file || applyingRelight || toolActionsBusy}
                              >
                                {applyingRelight ? <><span className="spinner"></span>Relighting...</> : <>{relightStatus ? 'Apply Again' : 'Apply'}</>}
                              </button>
                            </div>
                          </div>

                          <div className="fix-tool-rack-item ai has-controls">
                            <div className="fix-tool-rack-main">
                              <div className="fix-tool-rack-copy">
                                <div className="fix-tool-rack-title-row">
                                  <div className="fix-suggestion-title">{outpaintStatus ? 'Canvas expanded' : 'Expand Canvas'}</div>
                                </div>
                                <p className="fix-tool-rack-subtitle">Extend the crop and generate a seamless continuation for the new canvas area.</p>
                                <div className="fix-tool-rack-inline-controls with-action">
                                  <label className="fix-tool-option">
                                    <span>Direction</span>
                                    <select
                                      className="setting-input"
                                      value={outpaintDirection}
                                      onChange={(event) => setOutpaintDirection(event.target.value as 'left' | 'right' | 'top' | 'bottom')}
                                      disabled={!file || applyingOutpaint || toolActionsBusy}
                                    >
                                      <option value="right">Right</option>
                                      <option value="left">Left</option>
                                      <option value="top">Top</option>
                                      <option value="bottom">Bottom</option>
                                    </select>
                                  </label>
                                  <div className="fix-tool-rack-inline-action-slot">
                                    <button
                                      type="button"
                                      className="scan-btn"
                                      onClick={handleApplyOutpaint}
                                      disabled={!file || applyingOutpaint || toolActionsBusy}
                                    >
                                      {applyingOutpaint
                                        ? <><span className="spinner"></span>Expanding...</>
                                        : <>{outpaintStatus ? 'Apply Again' : 'Apply'}</>}
                                    </button>
                                  </div>
                                  <label className="fix-tool-option fix-tool-option-range">
                                    <span>Expansion</span>
                                    <input
                                      className="fix-tool-range"
                                      type="range"
                                      min="0.15"
                                      max="0.4"
                                      step="0.05"
                                      value={outpaintExpansion}
                                      onChange={(event) => setOutpaintExpansion(Number(event.target.value))}
                                      disabled={!file || applyingOutpaint || toolActionsBusy}
                                    />
                                    <span className="fix-tool-range-value">
                                      {Math.round(outpaintExpansion * 100)}%
                                    </span>
                                  </label>
                                </div>
                                {outpaintStatus && (
                                  <p className="fix-tool-rack-subtitle meta">
                                    {outpaintStatus.modelId ? `Model: ${outpaintStatus.modelId}. ` : ''}
                                    {outpaintStatus.direction ? `Direction: ${outpaintStatus.direction}. ` : ''}
                                    {outpaintStatus.expansion ? `Expansion: ${Math.round(outpaintStatus.expansion * 100)}%.` : ''}
                                  </p>
                                )}
                                {outpaintStatus?.warning && (
                                  <div className="fix-tool-inline-note warning">
                                    <span>{outpaintStatus.warning}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className={`fix-tool-rack-item manual ${upscaleResult ? 'has-status' : ''}`}>
                            {!upscaleResult ? (
                              <>
                                <div className="fix-tool-rack-main">
                                  <div className="fix-tool-rack-copy">
                                    <div className="fix-tool-rack-title-row">
                                      <div className="fix-suggestion-title">Upscale Resolution</div>
                                    </div>
                                    <p className="fix-tool-rack-subtitle">Check whether the image needs neural upscaling and boost it when needed.</p>
                                  </div>
                                </div>
                                <div className="fix-tool-rack-actions">
                                  <button
                                    type="button"
                                    className="scan-btn"
                                    onClick={() => {
                                      void handleCheckUpscale()
                                    }}
                                    disabled={!file || runningUpscale || toolActionsBusy}
                                  >
                                    {runningUpscale ? <><span className="spinner"></span>Checking...</> : <>Check</>}
                                  </button>
                                </div>
                              </>
                            ) : (
                              <>
                                <div className="fix-tool-rack-main">
                                  <div className="fix-tool-rack-copy">
                                    <div className="fix-tool-rack-title-row">
                                      <div className="fix-suggestion-title">
                                        {upscaleResult.upscale_recommended ? 'Low resolution detected' : 'Resolution OK'}
                                      </div>
                                    </div>
                                    <p className="fix-tool-rack-subtitle">
                                      {upscaleResult.upscale_recommended
                                        ? 'Image is below 800px. Real-ESRGAN upscaling recommended for marketplace quality.'
                                        : 'Image resolution is sufficient. Real-ESRGAN upscaling is not needed.'}
                                    </p>
                                  </div>
                                </div>
                                <div className="fix-tool-rack-actions">
                                  {upscaleResult.upscale_recommended && (
                                    <button
                                      type="button"
                                      className="secondary-btn"
                                      onClick={handleApplyUpscale}
                                      disabled={applyingUpscale || toolActionsBusy}
                                    >
                                      {applyingUpscale ? <><span className="spinner"></span>Upscaling...</> : <>Apply Upscale</>}
                                    </button>
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="fix-tool-rack-footer">
                          <button
                            className="secondary-btn"
                            data-testid="reset-to-original-button"
                            onClick={resetToOriginal}
                            disabled={!canResetToOriginal}
                          >
                            <RefreshCw size={15} />Revert AI Edits
                          </button>
                        </div>
                      </div>

                    </div>
                  </div>
                </>
              )}
              </div>
          </div>

          {fixResult && (
            <div className={`result-section fix-studio-section fix-step-section ${activeStepId === 'compare' ? 'expanded' : ''}`}>
              <button
                type="button"
                className={`result-section-header fix-step-header fix-step-toggle ${activeStepId === 'compare' ? 'expanded' : ''}`}
                onClick={() => setActiveStepId('compare')}
                aria-expanded={activeStepId === 'compare'}
              >
                <div className="fix-step-heading-group">
                  <span className="result-section-title"><CheckCircle size={16} /> Compare</span>
                  <span className="fix-step-summary">
                    Review the analysis diff, compare the visual result, and confirm the selected export baseline before exporting.
                  </span>
                </div>
                <div className="fix-step-toggle-side">
                  <div className="fix-stage-status-row">
                    {loadedFixFromCache && <div className="cache-badge">Loaded from cache</div>}
                    <div className="cache-badge">{fixResult.applied_action}</div>
                    <div className="tokens-badge">{verificationDeltaSummary ? 'Verified findings' : 'Issues in analysis'} {selectedResultRemainingIssues ?? 'n/a'}</div>
                    <div className="tokens-badge">Analysis score {selectedResultScore ?? 'n/a'}</div>
                  </div>
                  <span className="fix-step-chevron"><ChevronDown size={18} /></span>
                </div>
              </button>

              {activeStepId === 'compare' && (
                <div className="fix-step-body">
                  {deltaSummary && (
                    <>
                      <div className="fix-meta-grid delta-summary-grid">
                        <div className={`fix-meta-card delta-card trend-${deltaSummary.trend}`}>
                          <span className="fix-meta-label">Result</span>
                          <strong>
                            {deltaSummary.trend === 'improved' && 'Improved'}
                            {deltaSummary.trend === 'regressed' && 'Regressed'}
                            {deltaSummary.trend === 'unchanged' && 'No material change'}
                          </strong>
                        </div>
                        <div className="fix-meta-card delta-card">
                          <span className="fix-meta-label">Status</span>
                          <strong>{deltaSummary.beforeStatus} to {deltaSummary.afterStatus}</strong>
                        </div>
                        <div className="fix-meta-card delta-card">
                          <span className="fix-meta-label">Score Delta</span>
                          <strong>
                            {deltaSummary.scoreDelta === null
                              ? 'n/a'
                              : `${deltaSummary.scoreDelta > 0 ? '+' : ''}${deltaSummary.scoreDelta}`}
                          </strong>
                        </div>
                        <div className="fix-meta-card delta-card">
                          <span className="fix-meta-label">Issues</span>
                          <strong>
                            {verificationDeltaSummary
                              ? `${verificationDeltaSummary.removedFindings.length} removed in verification, ${verificationDeltaSummary.remainingIssues} remaining`
                              : `${deltaSummary.resolvedIssues.length} removed from analysis, ${deltaSummary.remainingIssues} remaining`}
                          </strong>
                        </div>
                      </div>

                      {(((verificationDeltaSummary?.removedFindings.length ?? 0) > 0) || ((verificationDeltaSummary?.addedFindings.length ?? 0) > 0) || deltaSummary.resolvedIssues.length > 0 || deltaSummary.newIssues.length > 0) && (
                        <div className="fix-analysis-grid delta-detail-grid">
                          <div className="fix-rail-note-block" style={{ gridColumn: '1 / -1' }}>
                            <span className="fix-workspace-label">{verificationDeltaSummary ? 'Verification Diff' : 'Analysis Diff'}</span>
                            <span className="fix-rail-note">
                              {verificationDeltaSummary
                                ? 'These entries come from structured rule, OCR, detector, and quality checks rerun after the edit.'
                                : 'These entries come from before/after analysis text changes, not a separate visual verification pass.'}
                            </span>
                          </div>
                          {verificationDeltaSummary
                            ? verificationDeltaSummary.removedFindings.length > 0 && (
                              <div className="fix-delta-list success-list">
                                <div className="fix-delta-title"><CheckCircle size={14} /> Removed In Verification</div>
                                {renderVerificationFindings(verificationDeltaSummary.removedFindings)}
                              </div>
                            )
                            : deltaSummary.resolvedIssues.length > 0 && (
                            <div className="fix-delta-list success-list">
                              <div className="fix-delta-title"><CheckCircle size={14} /> Removed From Analysis</div>
                              {renderFixDeltaIssues(deltaSummary.resolvedIssues)}
                            </div>
                          )}

                          {verificationDeltaSummary
                            ? verificationDeltaSummary.addedFindings.length > 0 && (
                              <div className="fix-delta-list warning-list">
                                <div className="fix-delta-title"><TriangleAlert size={14} /> Added In Verification</div>
                                {renderVerificationFindings(verificationDeltaSummary.addedFindings)}
                              </div>
                            )
                            : deltaSummary.newIssues.length > 0 && (
                            <div className="fix-delta-list warning-list">
                              <div className="fix-delta-title"><TriangleAlert size={14} /> Added To Analysis</div>
                              {renderFixDeltaIssues(deltaSummary.newIssues)}
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}

                  <div className="fix-compare-grid">
                    <div className="fix-compare-card">
                      <div className="fix-compare-label">Original</div>
                      {preview && (
                        <div className="verification-image-stage">
                          <img className="fix-compare-image" src={preview} alt="Original product" />
                          {beforeOverlayRects.length > 0 && (
                            <div className="verification-overlay">
                              {beforeOverlayRects.map((rect) => (
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
                      )}
                    </div>

                    <div className="fix-compare-arrow">
                      <ArrowRight size={20} />
                    </div>

                    <div className="fix-compare-card">
                      <div className="fix-compare-label">Fixed</div>
                      <div className="verification-image-stage">
                        <img className="fix-compare-image" src={fixResult.image_data_url} alt="Fixed product" />
                        {afterOverlayRects.length > 0 && (
                          <div className="verification-overlay">
                            {afterOverlayRects.map((rect) => (
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
                    </div>
                  </div>

                  <div className="fix-compare-badges">
                    <div className={`fix-workspace-chip fix-result-source-chip ${selectedResultSource === 'history' ? 'history' : selectedResultSource === 'latest-applied' ? 'latest' : 'empty'}`}>
                      {selectedResultSourceLabel}
                    </div>
                    <div className="cache-badge">Applied step: {fixResult.applied_action}</div>
                    <div className="cache-badge">Critical in analysis: {deltaSummary?.criticalIssuesAfter ?? 'n/a'}</div>
                    {selectedAiMetadata && (
                      <>
                        <div className="cache-badge">Fallback: {selectedFallbackUsed ? 'Yes' : 'No'}</div>
                        <div className="cache-badge">Fill ratio: {selectedFillRatioLabel}</div>
                        <div className="cache-badge">Target class: {selectedTargetClassLabel}</div>
                        <div className="cache-badge">Usage: {selectedImageUsageLabel}</div>
                        <div className="cache-badge">Mask: {selectedMaskSourceLabel}</div>
                      </>
                    )}
                    {fixResult.tokens_used > 0 && (
                      <div className="tokens-badge"><Zap size={12} /> {fixResult.tokens_used} tokens</div>
                    )}
                  </div>

                  <div className="fix-analysis-grid">
                    {selectedAiMetadata && selectedFallbackUsed && (
                      <div className="results-panel" style={{ borderColor: '#f59e0b', gridColumn: '1 / -1' }}>
                        <div className="results-content" style={{ color: '#92400e' }}>
                          <strong><TriangleAlert size={14} style={{ marginRight: 6, verticalAlign: 'text-bottom' }} />AI fallback used.</strong> {selectedFallbackReason}
                        </div>
                      </div>
                    )}

                    <div className="fix-step-card">
                      <div className="result-section-header fix-step-card-header">
                        <span className="result-section-title"><ShieldCheck size={16} /> Before Compliance</span>
                      </div>
                      <div className="result-section-body">
                        <MarkdownContent content={fixResult.before_analysis} />
                      </div>
                    </div>

                    <div className="fix-step-card">
                      <div className="result-section-header fix-step-card-header">
                        <span className="result-section-title"><ShieldCheck size={16} /> After Compliance</span>
                      </div>
                      <div className="result-section-body">
                        <MarkdownContent content={fixResult.after_analysis} />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {fixResult && (
            <div className={`result-section fix-studio-section fix-step-section ${activeStepId === 'export' ? 'expanded' : ''}`}>
              <button
                type="button"
                className={`result-section-header fix-step-header fix-step-toggle ${activeStepId === 'export' ? 'expanded' : ''}`}
                onClick={() => setActiveStepId('export')}
                aria-expanded={activeStepId === 'export'}
              >
                <div className="fix-step-heading-group">
                  <span className="result-section-title"><Download size={16} /> Export</span>
                  <span className="fix-step-summary">
                    Promote one variant to the large selected state, browse the horizontal filmstrip, and export the version you want to ship.
                  </span>
                </div>
                <div className="fix-step-toggle-side">
                  <div className="fix-stage-status-row">
                    {bestFix && <div className="cache-badge">Top-ranked variant: {bestFix.title}</div>}
                    <div className="tokens-badge">Selected for export {approvedExportEntry ? 'Yes' : 'No'}</div>
                  </div>
                  <span className="fix-step-chevron"><ChevronDown size={18} /></span>
                </div>
              </button>

              {activeStepId === 'export' && (
                <div className="fix-step-body">
                  <div className="fix-export-grid">
                    <div className="fix-export-hero">
                      <div className="fix-export-hero-header">
                        <div>
                          <span className="fix-workspace-label">Selected Variant</span>
                          <strong data-testid="selected-export-title">{selectedExportEntry?.title ?? fixResult.applied_action}</strong>
                        </div>
                        <div className="history-score-badge">{selectedExportEntry?.score ?? selectedResultScore ?? 'n/a'}</div>
                      </div>

                      <div className="verification-image-stage">
                        <img
                          className="fix-export-preview-image"
                          src={fixResult.image_data_url}
                          alt={fixResult.fixed_filename}
                        />
                        {afterOverlayRects.length > 0 && (
                          <div className="verification-overlay">
                            {afterOverlayRects.map((rect) => (
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

                      <div className="history-entry-labels">
                        <span className="history-entry-chip">{fixResult.applied_action}</span>
                        <span className="history-entry-chip">
                          {new Date(fixResult.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </span>
                        <span className="history-entry-chip">{selectedResultSourceLabel}</span>
                      </div>

                      <div className="history-card-actions">
                        <button className="secondary-btn fix-action-btn" onClick={downloadFixedImage}>
                          <Download size={15} />Download Fixed Image
                        </button>
                      </div>
                    </div>

                    <div className="fix-export-sidebar">
                      <div className="fix-step-card fix-export-approval-card">
                        <div className="result-section-header fix-step-card-header">
                          <span className="result-section-title"><CheckCircle size={16} /> Approval Panel</span>
                        </div>

                        <div className={`fix-approval-status ${isSelectedVariantApproved ? 'approved' : selectedExportEntryId === bestFix?.id ? 'recommended' : approvedExportEntry ? 'approved-other' : 'pending'}`}>
                          <span className="fix-workspace-label">Export Selection</span>
                          <strong>
                            {isSelectedVariantApproved
                              ? 'Selected variant marked for export'
                              : selectedExportEntryId === bestFix?.id
                                ? 'Selected variant is the top-ranked candidate'
                                : approvedExportEntry
                                  ? `Current export selection: ${approvedExportEntry.title}`
                                  : 'No export selection yet'}
                          </strong>
                          <span className="fix-rail-note">
                            {isSelectedVariantApproved
                              ? 'Primary export will use this selected version.'
                              : 'Mark the selected variant for export when you are comfortable with the analysis summary and visual framing.'}
                          </span>
                        </div>

                        <div className="fix-export-primary-actions">
                          <button
                            className="scan-btn fix-export-primary-button"
                            onClick={approveAndDownloadSelected}
                            disabled={!selectedExportResult}
                          >
                            <Download size={18} />Mark and Download Selected
                          </button>
                        </div>

                        <div className="fix-export-secondary-actions">
                          <button
                            className="secondary-btn"
                            onClick={markSelectedVariantApproved}
                            disabled={!selectedExportEntryId || isSelectedVariantApproved}
                          >
                            <CheckCircle size={15} />{isSelectedVariantApproved ? 'Marked for Export' : 'Mark Selected for Export'}
                          </button>
                          <button
                            className="secondary-btn"
                            onClick={() => downloadResultImage(selectedExportResult)}
                            disabled={!selectedExportResult}
                          >
                            <Download size={15} />Download Selected Variant
                          </button>
                          <button
                            className="secondary-btn"
                            onClick={downloadOriginalImage}
                            disabled={!preview || !file}
                          >
                            <FileIcon size={15} />Download Original Reference
                          </button>
                        </div>
                      </div>

                      <div className="fix-step-card fix-export-details-card">
                        <div className="result-section-header fix-step-card-header">
                          <span className="result-section-title"><ShieldCheck size={16} /> Export Details</span>
                        </div>
                        <div className="fix-export-detail-grid">
                          <div className="fix-rail-stat">
                            <span className="fix-workspace-label">{verificationDeltaSummary ? 'Remaining Findings' : 'Remaining Issues'}</span>
                            <strong>{selectedResultRemainingIssues ?? 'n/a'}</strong>
                          </div>
                          <div className="fix-rail-stat">
                            <span className="fix-workspace-label">Fill Ratio</span>
                            <strong>{selectedFillRatioLabel}</strong>
                          </div>
                          <div className="fix-rail-stat">
                            <span className="fix-workspace-label">Target Class</span>
                            <strong>{selectedTargetClassLabel}</strong>
                          </div>
                          <div className="fix-rail-stat">
                            <span className="fix-workspace-label">Usage</span>
                            <strong>{selectedImageUsageLabel}</strong>
                          </div>
                          <div className="fix-rail-stat">
                            <span className="fix-workspace-label">Mask</span>
                            <strong>{selectedMaskSourceLabel}</strong>
                          </div>
                          <div className="fix-rail-stat">
                            <span className="fix-workspace-label">Fallback</span>
                            <strong>{selectedFallbackUsed ? 'Yes' : 'No'}</strong>
                          </div>
                          <div className="fix-rail-stat">
                            <span className="fix-workspace-label">Tokens</span>
                            <strong>{fixResult.tokens_used > 0 ? fixResult.tokens_used : 'n/a'}</strong>
                          </div>
                        </div>
                        {selectedAiMetadata && selectedFallbackUsed && (
                          <div className="fix-approval-status pending" style={{ marginTop: 16 }}>
                            <span className="fix-workspace-label">AI Fallback Reason</span>
                            <strong>{selectedFallbackReason}</strong>
                            <span className="fix-rail-note">
                              Studio used the full image bounds because the Hugging Face photo model did not return a usable foreground mask.
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {fixHistory.length > 0 && (
                    <div className="fix-history-filmstrip-wrap">
                      <div className="fix-history-filmstrip-header">
                        <span className="fix-workspace-label">Variant Filmstrip</span>
                        <span className="fix-rail-note">Pick a card to promote it into the large export preview. Use Left/Right, Home, and End when the strip is focused.</span>
                      </div>

                      <div
                        ref={filmstripRef}
                        className="fix-history-filmstrip"
                        data-testid="fix-history-filmstrip"
                        tabIndex={0}
                        role="listbox"
                        aria-label="Fix variant filmstrip"
                        onKeyDown={handleFilmstripKeyDown}
                      >
                        {fixHistory.map((entry, index) => {
                          const isSelected = selectedExportEntryId === entry.id

                          return (
                            <div
                              key={entry.id}
                              id={`fix-history-entry-${entry.id}`}
                              data-history-entry-id={entry.id}
                              data-testid="fix-history-card"
                              className={`fix-filmstrip-card ${isSelected ? 'selected' : ''} ${index === 0 ? 'best' : ''}`}
                              role="option"
                              aria-selected={isSelected}
                              onClick={() => selectHistoryEntry(entry.id)}
                            >
                              <div className="fix-filmstrip-card-top">
                                <span className="history-entry-chip">{index === 0 ? 'Best observed' : 'Variant'}</span>
                                <span className="history-score-badge">{entry.score}</span>
                              </div>
                              <img
                                className="fix-filmstrip-image"
                                src={entry.result.image_data_url}
                                alt={entry.result.fixed_filename}
                              />
                              <div className="fix-filmstrip-copy">
                                <strong>{entry.title}</strong>
                                <span>{entry.action}</span>
                                <span>{entry.summary.afterStatus} · critical {entry.summary.criticalIssuesAfter}</span>
                                <span>delta {entry.summary.scoreDelta === null ? 'n/a' : entry.summary.scoreDelta}</span>
                              </div>

                              <div className="history-card-actions">
                                <button
                                  className="secondary-btn fix-action-btn"
                                  data-testid="view-history-result-button"
                                  onClick={() => selectHistoryEntry(entry.id)}
                                >
                                  <RefreshCw size={15} />View Result
                                </button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
