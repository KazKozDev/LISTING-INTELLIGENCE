import { FileSpreadsheet, Download, Check } from 'lucide-react'
import { useState } from 'react'

interface ExportCSVProps {
  csvData: string | null
  filename?: string
  label?: string
  resultCount?: number
}

export function ExportCSV({ csvData, filename, label, resultCount }: ExportCSVProps) {
  const [downloaded, setDownloaded] = useState(false)

  if (!csvData) return null

  const handleDownload = () => {
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename || `export_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    setDownloaded(true)
    setTimeout(() => setDownloaded(false), 2000)
  }

  return (
    <div className="export-csv-section">
      <div className="export-csv-info">
        <FileSpreadsheet size={18} />
        <div className="export-csv-text">
          <span className="export-csv-label">{label || 'CSV Report Ready'}</span>
          {resultCount !== undefined && (
            <span className="export-csv-count">{resultCount} records</span>
          )}
        </div>
      </div>
      <button className="export-csv-btn" onClick={handleDownload}>
        {downloaded
          ? <><Check size={14} /> Downloaded</>
          : <><Download size={14} /> Download CSV</>
        }
      </button>
    </div>
  )
}
