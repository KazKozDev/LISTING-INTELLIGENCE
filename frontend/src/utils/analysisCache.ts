import type {
  BatchAnalysisResponse,
  ComplianceCanvasDraft,
  ComplianceCheckResponse,
  ComplianceFixHistoryEntry,
  ComplianceFixResultResponse,
  ComplianceFixSuggestionsResponse,
  ProductAnalysisResponse,
} from '../api/types'

const CACHE_PREFIX = 'analysis-cache:'
const APP_ACTIVE_NAV_KEY = 'app-active-nav'
const COMPLIANCE_REPORT_UI_KEY = 'compliance-report-ui'
const PRODUCT_ANALYSIS_UI_KEY = 'product-analysis-ui'

const APP_NAV_IDS = [
  'ecom-product',
  'ecom-compliance',
  'ecom-fix',
  'ecom-tools',
  'history',
  'settings',
  'help',
] as const

export type AppActiveNav = typeof APP_NAV_IDS[number]

export interface ComplianceReportUiPreferences {
  issuesOpen: boolean
  recommendationsOpen: boolean
  fullReportOpen: boolean
}

export interface PersistedProductAnalysisState {
  mode: 'analysis' | 'compare'
  marketplace: string
  keywords: string
  result: ProductAnalysisResponse | null
  batchResult: BatchAnalysisResponse | null
}

function getPersistentStorage(): Storage | null {
  try {
    return localStorage
  } catch {
    return null
  }
}

function getSessionStorage(): Storage | null {
  try {
    return sessionStorage
  } catch {
    return null
  }
}

function safeRead<T>(key: string): T | null {
  const storageKey = `${CACHE_PREFIX}${key}`

  try {
    const persistentStorage = getPersistentStorage()
    const sessionStorageRef = getSessionStorage()

    const persistentValue = persistentStorage?.getItem(storageKey)
    if (persistentValue) {
      return JSON.parse(persistentValue) as T
    }

    const sessionValue = sessionStorageRef?.getItem(storageKey)
    if (!sessionValue) return null

    const parsedValue = JSON.parse(sessionValue) as T
    persistentStorage?.setItem(storageKey, sessionValue)
    sessionStorageRef?.removeItem(storageKey)
    return parsedValue
  } catch {
    return null
  }
}

function safeWrite<T>(key: string, value: T): void {
  const storageKey = `${CACHE_PREFIX}${key}`

  try {
    getPersistentStorage()?.setItem(storageKey, JSON.stringify(value))
  } catch {
    // Ignore storage failures and continue without cache.
  }
}

export function getFileSignature(file: File): string {
  return [file.name, file.size, file.lastModified, file.type].join(':')
}

export function getPersistedAppActiveNav(): AppActiveNav | null {
  const value = safeRead<string>(APP_ACTIVE_NAV_KEY)
  if (!value) {
    return null
  }

  return APP_NAV_IDS.includes(value as AppActiveNav)
    ? (value as AppActiveNav)
    : null
}

export function setPersistedAppActiveNav(value: AppActiveNav): void {
  safeWrite(APP_ACTIVE_NAV_KEY, value)
}

export function getFilesSignature(files: File[]): string {
  return files.map(getFileSignature).join('|')
}

export function buildProductAnalysisCacheKey(
  files: File[],
  marketplace: string,
  keywords: string,
): string {
  return [
    'product-analysis',
    files.length > 1 ? 'batch' : 'single',
    getFilesSignature(files),
    marketplace,
    keywords.trim(),
  ].join('::')
}

export function buildComplianceCacheKey(
  file: File,
  marketplace: string,
): string {
  return ['compliance', getFileSignature(file), marketplace].join('::')
}

export function buildComplianceFixSuggestionsCacheKey(
  file: File,
  marketplace: string,
): string {
  return ['compliance-fix', 'suggestions', getFileSignature(file), marketplace].join('::')
}

export function buildComplianceFixResultCacheKey(
  file: File,
  marketplace: string,
  action: string,
): string {
  return ['compliance-fix', 'result', getFileSignature(file), marketplace, action].join('::')
}

export function buildComplianceFixHistoryKey(
  file: File,
  marketplace: string,
): string {
  return ['compliance-fix', 'history', getFileSignature(file), marketplace].join('::')
}

export function buildComplianceFixCanvasDraftKey(
  file: File,
  marketplace: string,
): string {
  return ['compliance-fix', 'canvas-draft', getFileSignature(file), marketplace].join('::')
}

export function getCachedProductAnalysis(
  key: string,
): ProductAnalysisResponse | null {
  return safeRead<ProductAnalysisResponse>(key)
}

export function setCachedProductAnalysis(
  key: string,
  value: ProductAnalysisResponse,
): void {
  safeWrite(key, value)
}

export function getCachedBatchAnalysis(
  key: string,
): BatchAnalysisResponse | null {
  return safeRead<BatchAnalysisResponse>(key)
}

export function setCachedBatchAnalysis(
  key: string,
  value: BatchAnalysisResponse,
): void {
  safeWrite(key, value)
}

export function getPersistedProductAnalysisState(): PersistedProductAnalysisState | null {
  return safeRead<PersistedProductAnalysisState>(PRODUCT_ANALYSIS_UI_KEY)
}

export function setPersistedProductAnalysisState(
  value: PersistedProductAnalysisState,
): void {
  safeWrite(PRODUCT_ANALYSIS_UI_KEY, value)
}

export function getCachedCompliance(
  key: string,
): ComplianceCheckResponse | null {
  return safeRead<ComplianceCheckResponse>(key)
}

export function setCachedCompliance(
  key: string,
  value: ComplianceCheckResponse,
): void {
  safeWrite(key, value)
}

export function getComplianceReportUiPreferences(): ComplianceReportUiPreferences | null {
  return safeRead<ComplianceReportUiPreferences>(COMPLIANCE_REPORT_UI_KEY)
}

export function setComplianceReportUiPreferences(
  value: ComplianceReportUiPreferences,
): void {
  safeWrite(COMPLIANCE_REPORT_UI_KEY, value)
}

export function getCachedComplianceFixSuggestions(
  key: string,
): ComplianceFixSuggestionsResponse | null {
  return safeRead<ComplianceFixSuggestionsResponse>(key)
}

export function setCachedComplianceFixSuggestions(
  key: string,
  value: ComplianceFixSuggestionsResponse,
): void {
  safeWrite(key, value)
}

export function getCachedComplianceFixResult(
  key: string,
): ComplianceFixResultResponse | null {
  return safeRead<ComplianceFixResultResponse>(key)
}

export function setCachedComplianceFixResult(
  key: string,
  value: ComplianceFixResultResponse,
): void {
  safeWrite(key, value)
}

export function getComplianceFixHistory(
  key: string,
): ComplianceFixHistoryEntry[] {
  return safeRead<ComplianceFixHistoryEntry[]>(key) ?? []
}

export function getCachedComplianceFixCanvasDraft(
  key: string,
): ComplianceCanvasDraft | null {
  return safeRead<ComplianceCanvasDraft>(key)
}

export function setCachedComplianceFixCanvasDraft(
  key: string,
  value: ComplianceCanvasDraft,
): void {
  safeWrite(key, value)
}

export function upsertComplianceFixHistoryEntry(
  key: string,
  value: ComplianceFixHistoryEntry,
): ComplianceFixHistoryEntry[] {
  const history = getComplianceFixHistory(key)
  const existingIndex = history.findIndex((entry) => entry.id === value.id)

  if (existingIndex >= 0) {
    const nextHistory = [...history]
    nextHistory[existingIndex] = value
    safeWrite(key, nextHistory)
    return nextHistory
  }

  const nextHistory = [value, ...history]
  safeWrite(key, nextHistory)
  return nextHistory
}