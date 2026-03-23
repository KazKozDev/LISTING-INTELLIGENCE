import { useState, useCallback } from 'react'
import type { AnalysisResult, HistoryItem } from '../api/types'

const STORAGE_KEY = 'analysisHistory'

function loadHistory(): HistoryItem[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? JSON.parse(saved) : []
  } catch {
    return []
  }
}

/** Standalone save — callable from any component without the hook */
export function saveToHistory(result: AnalysisResult) {
  const item: HistoryItem = {
    ...result,
    id: Date.now().toString() + Math.random().toString(36),
  }
  const prev = loadHistory()
  localStorage.setItem(STORAGE_KEY, JSON.stringify([item, ...prev]))
}

export function useHistory() {
  const [history, setHistory] = useState<HistoryItem[]>(loadHistory)

  const addToHistory = useCallback((result: AnalysisResult) => {
    const item: HistoryItem = {
      ...result,
      id: Date.now().toString() + Math.random().toString(36),
    }
    setHistory((prev) => {
      const updated = [item, ...prev]
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
      return updated
    })
  }, [])

  const clearHistory = useCallback(() => {
    setHistory([])
    localStorage.removeItem(STORAGE_KEY)
  }, [])

  const totalTokens = history.reduce(
    (acc, item) =>
      acc + ((item.metadata.usage as { total_tokens?: number })?.total_tokens || 0),
    0
  )

  const uniqueFiles = new Set(history.map((item) => item.filename)).size

  return { history, addToHistory, clearHistory, totalTokens, uniqueFiles }
}
