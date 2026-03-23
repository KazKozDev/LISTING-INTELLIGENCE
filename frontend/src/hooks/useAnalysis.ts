import { useState, useCallback } from 'react'
import { api } from '../api/client'
import type { AnalysisResult, Template } from '../api/types'

interface AnalysisOptions {
  provider?: string
  model?: string
}

export function useAnalysis(onComplete?: (result: AnalysisResult) => void) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 })

  const analyzeSingle = useCallback(
    async (file: File, template: Template, options?: AnalysisOptions) => {
      setLoading(true)
      setResult(null)
      try {
        const data = await api.analyze(file, template.prompt, {
          templateKey: template.key,
          provider: options?.provider,
          model: options?.model,
        })
        setResult(data)
        onComplete?.(data)
        return data
      } catch (err) {
        console.error('Analysis failed:', err)
        return null
      } finally {
        setLoading(false)
      }
    },
    [onComplete]
  )

  const analyzeBatch = useCallback(
    async (files: File[], template: Template, options?: AnalysisOptions) => {
      setLoading(true)
      setBatchProgress({ current: 0, total: files.length })

      for (let i = 0; i < files.length; i++) {
        try {
          const data = await api.analyze(files[i], template.prompt, {
            templateKey: template.key,
            provider: options?.provider,
            model: options?.model,
          })
          onComplete?.(data)
        } catch (err) {
          console.error(`Batch item ${i} failed:`, err)
        }
        setBatchProgress({ current: i + 1, total: files.length })
      }

      setLoading(false)
      setBatchProgress({ current: 0, total: 0 })
    },
    [onComplete]
  )

  return { loading, result, batchProgress, analyzeSingle, analyzeBatch, setResult }
}
