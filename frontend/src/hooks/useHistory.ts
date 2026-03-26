import { useCallback, useEffect, useState } from 'react'
import type { AnalysisResult, HistoryItem } from '../api/types'
import { appendHistoryItem, clearHistoryItems, loadHistoryItems } from '../utils/historyStorage'

function getUsageTokens(result: AnalysisResult | HistoryItem): number {
  return result.metadata.usage?.total_tokens ?? 0
}

/** Standalone save — callable from any component without the hook */
export function saveToHistory(result: AnalysisResult) {
  const item: HistoryItem = {
    ...result,
    id: Date.now().toString() + Math.random().toString(36),
  }

  void appendHistoryItem(item)
}

export function useHistory() {
  const [history, setHistory] = useState<HistoryItem[]>([])

  useEffect(() => {
    let isMounted = true

    void loadHistoryItems().then((items) => {
      if (isMounted) {
        setHistory(items)
      }
    })

    return () => {
      isMounted = false
    }
  }, [])

  const addToHistory = useCallback((result: AnalysisResult) => {
    const item: HistoryItem = {
      ...result,
      id: Date.now().toString() + Math.random().toString(36),
    }
    setHistory((prev) => [item, ...prev])
    void appendHistoryItem(item)
  }, [])

  const clearHistory = useCallback(() => {
    setHistory([])
    void clearHistoryItems()
  }, [])

  const totalTokens = history.reduce(
    (acc, item) => acc + getUsageTokens(item),
    0
  )

  const uniqueFiles = new Set(history.map((item) => item.filename)).size

  return { history, addToHistory, clearHistory, totalTokens, uniqueFiles }
}
