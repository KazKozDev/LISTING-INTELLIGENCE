import { useState, useEffect } from 'react'
import { api } from '../api/client'
import type { Config, Template } from '../api/types'

export function useConfig() {
  const [config, setConfig] = useState<Config | null>(null)
  const [templates, setTemplates] = useState<{ basic: Template[]; industry: Template[] }>({
    basic: [],
    industry: [],
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([api.getConfig(), api.getTemplates()])
      .then(([configData, templatesData]) => {
        setConfig(configData)
        setTemplates(templatesData)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  return { config, templates, loading, error }
}
