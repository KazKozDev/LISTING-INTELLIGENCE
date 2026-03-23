import { useState, useEffect, useRef, useCallback } from 'react'

interface BatchProgress {
  current: number
  total: number
  filename: string
  percent: number
  status: string
}

interface UseWebSocketOptions {
  onProgress?: (progress: BatchProgress) => void
  onComplete?: () => void
  onError?: (error: string) => void
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const [connected, setConnected] = useState(false)
  const [taskId, setTaskId] = useState<string | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const connect = useCallback(() => {
    const wsUrl = (import.meta.env.VITE_API_URL || 'http://localhost:8000/api')
      .replace(/^http/, 'ws')
      .replace(/\/api$/, '/api/ws/batch-progress')

    const ws = new WebSocket(wsUrl)

    ws.onopen = () => {
      setConnected(true)
    }

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)

      switch (data.type) {
        case 'connected':
          setTaskId(data.task_id)
          break
        case 'progress':
          options.onProgress?.(data)
          break
        case 'batch_completed':
          options.onComplete?.()
          break
        case 'error':
          options.onError?.(data.message || 'Unknown error')
          break
      }
    }

    ws.onclose = () => {
      setConnected(false)
      wsRef.current = null
      // Auto-reconnect after 3 seconds
      reconnectTimerRef.current = setTimeout(connect, 3000)
    }

    ws.onerror = () => {
      ws.close()
    }

    wsRef.current = ws
  }, [options.onProgress, options.onComplete, options.onError])

  const disconnect = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current)
    }
    wsRef.current?.close()
    wsRef.current = null
    setConnected(false)
  }, [])

  const send = useCallback((data: Record<string, unknown>) => {
    wsRef.current?.send(JSON.stringify(data))
  }, [])

  useEffect(() => {
    return () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current)
      }
      wsRef.current?.close()
    }
  }, [])

  return { connected, taskId, connect, disconnect, send }
}
