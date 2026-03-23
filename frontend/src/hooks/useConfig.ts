import { useState, useEffect } from 'react'
import { api } from '../api/client'
import type { Config } from '../api/types'

export function useConfig() {
  const [config, setConfig] = useState<Config | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.getConfig()
      .then(setConfig)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  return { config, loading, error }
}
