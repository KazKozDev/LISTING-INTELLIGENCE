import { useState, useCallback } from 'react'
import { api } from '../api/client'

interface ProductAnalysisState {
  loading: boolean
  error: string | null
  result: {
    analysis: string
    tokens_used: number
    marketplace: string
  } | null
}

export function useProductAnalysis() {
  const [state, setState] = useState<ProductAnalysisState>({
    loading: false,
    error: null,
    result: null,
  })

  const analyzeProduct = useCallback(async (file: File, marketplace: string = 'general') => {
    setState({ loading: true, error: null, result: null })
    try {
      const data = await api.analyzeProduct(file, marketplace)
      const result = {
        analysis: data.analysis,
        tokens_used: data.tokens_used,
        marketplace: data.marketplace,
      }
      setState({ loading: false, error: null, result })
      return result
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Analysis failed'
      setState({ loading: false, error: msg, result: null })
      return null
    }
  }, [])

  const checkCompliance = useCallback(async (file: File, marketplace: string) => {
    setState({ loading: true, error: null, result: null })
    try {
      const data = await api.checkCompliance(file, marketplace)
      const result = {
        analysis: data.analysis,
        tokens_used: data.tokens_used,
        marketplace: data.marketplace,
      }
      setState({ loading: false, error: null, result })
      return result
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Compliance check failed'
      setState({ loading: false, error: msg, result: null })
      return null
    }
  }, [])

  const generateSeo = useCallback(async (file: File, marketplace: string = 'general', keywords: string = '') => {
    setState({ loading: true, error: null, result: null })
    try {
      const data = await api.generateSeo(file, marketplace, keywords)
      const result = {
        analysis: data.seo_content,
        tokens_used: data.tokens_used,
        marketplace: data.marketplace,
      }
      setState({ loading: false, error: null, result })
      return result
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'SEO generation failed'
      setState({ loading: false, error: msg, result: null })
      return null
    }
  }, [])

  const suggestImprovements = useCallback(async (file: File) => {
    setState({ loading: true, error: null, result: null })
    try {
      const data = await api.suggestImprovements(file)
      const result = {
        analysis: data.analysis,
        tokens_used: data.tokens_used,
        marketplace: 'general',
      }
      setState({ loading: false, error: null, result })
      return result
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Improvements suggestion failed'
      setState({ loading: false, error: msg, result: null })
      return null
    }
  }, [])

  const compareProducts = useCallback(async (productFile: File, competitorFile: File, marketplace: string = 'general') => {
    setState({ loading: true, error: null, result: null })
    try {
      const data = await api.compareProducts(productFile, competitorFile, marketplace)
      const result = {
        analysis: data.analysis,
        tokens_used: data.tokens_used,
        marketplace: data.marketplace,
      }
      setState({ loading: false, error: null, result })
      return result
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Comparison failed'
      setState({ loading: false, error: msg, result: null })
      return null
    }
  }, [])

  const reset = useCallback(() => {
    setState({ loading: false, error: null, result: null })
  }, [])

  return {
    ...state,
    analyzeProduct,
    checkCompliance,
    generateSeo,
    suggestImprovements,
    compareProducts,
    reset,
  }
}
