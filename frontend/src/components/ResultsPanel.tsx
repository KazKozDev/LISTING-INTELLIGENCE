import type { AnalysisResult } from '../api/types'

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function dateSlug() {
  return new Date().toISOString().slice(0, 10)
}

export function exportJSON(data: AnalysisResult) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  downloadBlob(blob, `analysis_${data.filename}_${dateSlug()}.json`)
}

export function exportCSV(data: AnalysisResult) {
  const safe = (s: string) => (s || '').replace(/"/g, '""')
  const csv = `Filename,Timestamp,Task,Analysis,Model,Provider,Tokens\n"${data.filename}","${data.timestamp}","${safe(data.prompt || '')}","${safe(data.analysis)}","${data.metadata.model || ''}","${data.metadata.provider || ''}","${(data.metadata.usage as { total_tokens?: number })?.total_tokens || 0}"`
  downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `analysis_${data.filename}_${dateSlug()}.csv`)
}

export function exportMarkdown(data: AnalysisResult) {
  const md = `# Analysis Report: ${data.filename}\n\n## Summary\n*Date:* ${new Date(data.timestamp).toLocaleString()}\n*Task:* ${data.prompt || 'N/A'}\n*Model:* ${data.metadata.model || 'N/A'}\n*Provider:* ${data.metadata.provider || 'N/A'}\n\n## Analysis\n${data.analysis}\n`
  downloadBlob(new Blob([md], { type: 'text/markdown;charset=utf-8;' }), `analysis_${data.filename}_${dateSlug()}.md`)
}
