import { Loader2, CheckCircle, XCircle } from 'lucide-react'

interface BatchProgressProps {
  current: number
  total: number
  loading: boolean
  label?: string
  results?: Array<{ success: boolean }>
}

export function BatchProgress({ current, total, loading, label, results }: BatchProgressProps) {
  if (!loading && total === 0) return null

  const percent = total > 0 ? Math.round((current / total) * 100) : 0
  const successCount = results?.filter(r => r.success).length ?? 0
  const failCount = results?.filter(r => !r.success).length ?? 0

  return (
    <div className="batch-progress">
      <div className="batch-progress-header">
        <span>{label || (loading ? 'Processing files...' : 'Complete')}</span>
        <span>
          {current}/{total}
          {!loading && results && results.length > 0 && (
            <span style={{ marginLeft: '0.5rem' }}>
              {successCount > 0 && (
                <span style={{ color: '#4ade80', marginRight: '0.4rem' }}>
                  <CheckCircle size={12} style={{ verticalAlign: 'middle' }} /> {successCount}
                </span>
              )}
              {failCount > 0 && (
                <span style={{ color: '#f87171' }}>
                  <XCircle size={12} style={{ verticalAlign: 'middle' }} /> {failCount}
                </span>
              )}
            </span>
          )}
        </span>
      </div>
      <div className="batch-progress-bar">
        <div
          className="batch-progress-fill"
          style={{ width: `${percent}%` }}
        />
      </div>
      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.4rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          <Loader2 size={12} className="spinner" />
          {percent}% complete
        </div>
      )}
    </div>
  )
}
