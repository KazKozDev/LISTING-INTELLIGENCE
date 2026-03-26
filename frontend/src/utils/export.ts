import type { AnalysisResult, HistoryItem } from '../api/types'

function getUsageTokens(result: AnalysisResult | HistoryItem): number {
  return result.metadata.usage?.total_tokens ?? 0
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

function dateSlug() {
  return new Date().toISOString().slice(0, 10)
}

function safeCsv(value: string) {
  return (value || '').replace(/"/g, '""')
}

export function exportJSON(data: AnalysisResult) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  downloadBlob(blob, `analysis_${data.filename}_${dateSlug()}.json`)
}

export function exportCSV(data: AnalysisResult) {
  const csv = `Filename,Timestamp,Task,Analysis,Model,Provider,Tokens\n"${data.filename}","${data.timestamp}","${safeCsv(data.prompt || '')}","${safeCsv(data.analysis)}","${data.metadata.model || ''}","${data.metadata.provider || ''}","${getUsageTokens(data)}"`
  downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `analysis_${data.filename}_${dateSlug()}.csv`)
}

export function exportMarkdown(data: AnalysisResult) {
  const md = `# Analysis Report: ${data.filename}\n\n## Summary\n*Date:* ${new Date(data.timestamp).toLocaleString()}\n*Task:* ${data.prompt || 'N/A'}\n*Model:* ${data.metadata.model || 'N/A'}\n*Provider:* ${data.metadata.provider || 'N/A'}\n\n## Analysis\n${data.analysis}\n`
  downloadBlob(new Blob([md], { type: 'text/markdown;charset=utf-8;' }), `analysis_${data.filename}_${dateSlug()}.md`)
}

export function exportHistoryJSON(history: HistoryItem[]) {
  const blob = new Blob([JSON.stringify(history, null, 2)], { type: 'application/json' })
  downloadBlob(blob, `all_analyses_${dateSlug()}.json`)
}

export function exportHistoryCSV(history: HistoryItem[]) {
  let csv = 'Filename,Timestamp,Task,Analysis,Model,Provider,Tokens\n'
  history.forEach((item) => {
    csv += `"${item.filename}","${item.timestamp}","${safeCsv(item.prompt || '')}","${safeCsv(item.analysis)}","${item.metadata.model || ''}","${item.metadata.provider || ''}","${getUsageTokens(item)}"\n`
  })
  downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `all_analyses_${dateSlug()}.csv`)
}

export function exportHistoryMarkdown(history: HistoryItem[]) {
  let md = `# Combined Analysis Report\n*Generated:* ${new Date().toLocaleString()}\n*Total Files:* ${history.length}\n\n`
  history.forEach((item, index) => {
    md += `---\n## ${index + 1}. ${item.filename}\n\n*Date:* ${new Date(item.timestamp).toLocaleString()}\n*Task:* ${item.prompt || 'N/A'}\n\n${item.analysis}\n\n`
  })
  downloadBlob(new Blob([md], { type: 'text/markdown;charset=utf-8;' }), `all_analyses_${dateSlug()}.md`)
}
