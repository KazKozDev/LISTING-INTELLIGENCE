import { useState, useCallback } from 'react'
import { api } from '../api/client'

interface BatchResult {
  filename: string
  analysis: string
  success: boolean
  error?: string
}

interface BulkUploadState {
  files: File[]
  previews: string[]
  loading: boolean
  progress: { current: number; total: number }
  results: BatchResult[]
  csvData: string | null
  error: string | null
}

export function useBulkUpload() {
  const [state, setState] = useState<BulkUploadState>({
    files: [],
    previews: [],
    loading: false,
    progress: { current: 0, total: 0 },
    results: [],
    csvData: null,
    error: null,
  })

  const setFiles = useCallback((fileList: File[]) => {
    setState(prev => ({
      ...prev,
      files: fileList,
      previews: fileList.map(f => URL.createObjectURL(f)),
      results: [],
      csvData: null,
      error: null,
    }))
  }, [])

  const removeFile = useCallback((index: number) => {
    setState(prev => {
      const newFiles = prev.files.filter((_, i) => i !== index)
      return {
        ...prev,
        files: newFiles,
        previews: newFiles.map(f => URL.createObjectURL(f)),
      }
    })
  }, [])

  const analyze = useCallback(async (marketplace: string = 'general') => {
    setState(prev => {
      if (prev.files.length === 0) return prev
      return {
        ...prev,
        loading: true,
        error: null,
        progress: { current: 0, total: prev.files.length },
      }
    })

    // Start simulated progress
    const interval = setInterval(() => {
      setState(prev => ({
        ...prev,
        progress: {
          ...prev.progress,
          current: Math.min(prev.progress.current + 1, prev.progress.total - 1),
        },
      }))
    }, 2000)

    try {
      const currentFiles = state.files
      const data = await api.batchAnalyzeProducts(currentFiles, marketplace)
      clearInterval(interval)
      setState(prev => ({
        ...prev,
        loading: false,
        progress: { current: currentFiles.length, total: currentFiles.length },
        results: data.results,
        csvData: data.csv_data,
      }))
    } catch (err) {
      clearInterval(interval)
      setState(prev => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : 'Batch analysis failed',
      }))
    }
  }, [state.files])

  const downloadCSV = useCallback(() => {
    if (!state.csvData) return
    const blob = new Blob([state.csvData], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `product_analysis_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [state.csvData])

  const reset = useCallback(() => {
    setState({
      files: [],
      previews: [],
      loading: false,
      progress: { current: 0, total: 0 },
      results: [],
      csvData: null,
      error: null,
    })
  }, [])

  const successCount = state.results.filter(r => r.success).length
  const failCount = state.results.filter(r => !r.success).length

  return {
    ...state,
    successCount,
    failCount,
    setFiles,
    removeFile,
    analyze,
    downloadCSV,
    reset,
  }
}
