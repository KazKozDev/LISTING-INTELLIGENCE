import { Cloud, Upload, File } from 'lucide-react'

function formatFileSize(bytes: number) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

interface FileUploadProps {
  mode: 'single' | 'batch'
  file: File | null
  files: File[]
  onFileChange: (file: File) => void
  onFilesChange: (files: File[]) => void
}

export function FileUpload({ mode, file, files, onFileChange, onFilesChange }: FileUploadProps) {
  const handleSingleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) onFileChange(e.target.files[0])
  }

  const handleBatchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) onFilesChange(Array.from(e.target.files))
  }

  if (mode === 'single') {
    return (
      <div
        className={`file-drop ${file ? 'has-file' : ''}`}
        onClick={() => document.getElementById('file-input')?.click()}
      >
        <input
          id="file-input"
          type="file"
          accept=".png,.jpg,.jpeg,.pdf,.gif,.bmp,.webp"
          onChange={handleSingleChange}
          style={{ display: 'none' }}
        />
        <div className="drop-content">
          {file ? (
            <div className="file-info">
              <span className="drop-icon"><File /></span>
              <span className="file-name">{file.name}</span>
              <span className="file-size">{formatFileSize(file.size)}</span>
            </div>
          ) : (
            <>
              <span className="drop-icon"><Cloud /></span>
              <span className="drop-text">Drop your file here</span>
              <span className="drop-hint">PNG, JPG, PDF, GIF, WebP</span>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div
      className="file-drop"
      onClick={() => document.getElementById('batch-input')?.click()}
    >
      <input
        id="batch-input"
        type="file"
        accept=".png,.jpg,.jpeg,.pdf,.gif,.bmp,.webp"
        multiple
        onChange={handleBatchChange}
        style={{ display: 'none' }}
      />
      <div className="drop-content">
        {files.length > 0 ? (
          <div className="file-info">
            <span className="drop-icon"><Upload /></span>
            <span className="file-name">{files.length} files selected</span>
          </div>
        ) : (
          <>
            <span className="drop-icon"><Upload /></span>
            <span className="drop-text">Drop multiple files here</span>
            <span className="drop-hint">Select multiple files for batch processing</span>
          </>
        )}
      </div>
    </div>
  )
}
