import { useState, useEffect } from 'react'
import {
  ScanSearch,
  BarChart3,
  Palette,
  FileText,
  ShoppingCart,
  Wallet,
  Building2,
  History,
  Cloud,
  File,
  Clipboard,
  Eye,
  Settings,
  HelpCircle,
  Upload,
  Trash2,
  FileJson,
  FileSpreadsheet,
  Plus,
} from 'lucide-react'
import './App.css'
import './splash.css'

interface Template {
  key: string
  name: string
  description: string
  prompt: string
}

interface Config {
  provider: string
  model: string
}

interface AnalysisResult {
  success: boolean
  filename: string
  analysis: string
  metadata: Record<string, unknown>
  timestamp: string
  prompt?: string
}

interface HistoryItem extends AnalysisResult {
  id: string
}

const API_URL = 'http://localhost:8000/api'

const navItems = [
  { id: 'analyze', icon: ScanSearch, label: 'Smart Analyze' },
  { id: 'chart', icon: BarChart3, label: 'Charts' },
  { id: 'ui', icon: Palette, label: 'UI Review' },
  { id: 'documents', icon: FileText, label: 'Documents' },
  { id: 'ecommerce', icon: ShoppingCart, label: 'E-commerce' },
  { id: 'finance', icon: Wallet, label: 'Finance' },
  { id: 'medical', icon: Building2, label: 'Medical' },
  { id: 'history', icon: History, label: 'History' },
  { id: 'settings', icon: Settings, label: 'Settings' },
  { id: 'help', icon: HelpCircle, label: 'Help' },
]

function App() {
  const [config, setConfig] = useState<Config | null>(null)
  const [templates, setTemplates] = useState<{ basic: Template[]; industry: Template[] }>({ basic: [], industry: [] })
  const [activeNav, setActiveNav] = useState('analyze')
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [files, setFiles] = useState<File[]>([])
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 })

  const [showSplash, setShowSplash] = useState(true)
  const [analysisMode, setAnalysisMode] = useState<'single' | 'batch'>('single')
  const [activeHelpSection, setActiveHelpSection] = useState<'general' | 'templates' | 'export'>('general')
  const [customSettings, setCustomSettings] = useState({ provider: '', model: '' })

  useEffect(() => {
    // Simulate initialization time or "scan" time
    const timer = setTimeout(() => {
      setShowSplash(false)
    }, 3500) // 3.5 seconds splash screen
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    const matchingTemplates = getTemplatesByCategory(activeNav)
    if (matchingTemplates.length > 0) {
      setSelectedTemplate(matchingTemplates[0])
    }
  }, [activeNav, templates])

  useEffect(() => {
    fetch(`${API_URL}/config`)
      .then(res => res.json())
      .then(setConfig)
      .catch(console.error)

    fetch(`${API_URL}/templates`)
      .then(res => res.json())
      .then(data => {
        setTemplates(data)
        if (data.basic.length > 0 && activeNav === 'analyze') {
          setSelectedTemplate(data.basic[0])
        }
      })
      .catch(console.error)

    // Load history from localStorage
    const savedHistory = localStorage.getItem('analysisHistory')
    if (savedHistory) {
      setHistory(JSON.parse(savedHistory))
    }
  }, [])

  const saveToHistory = (analysisResult: AnalysisResult) => {
    const historyItem: HistoryItem = {
      ...analysisResult,
      id: Date.now().toString() + Math.random().toString(36)
    }
    const newHistory = [historyItem, ...history]
    setHistory(newHistory)
    localStorage.setItem('analysisHistory', JSON.stringify(newHistory))
  }

  const clearHistory = () => {
    setHistory([])
    localStorage.removeItem('analysisHistory')
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
      setResult(null)
    }
  }

  const handleFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files))
    }
  }

  const handleAddTemplate = (category: string) => {
    // Placeholder for adding a new template
    const name = prompt(`Enter name for new ${category} template:`)
    if (name) {
      // TODO: Implement backend persistence
      alert(`New template "${name}" created for ${category} category! (Persistence not implemented yet)`)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  const handleAnalyze = async () => {
    if (!file || !selectedTemplate) return

    setLoading(true)
    setResult(null)

    const formData = new FormData()
    formData.append('file', file)
    formData.append('prompt', selectedTemplate.prompt)
    formData.append('template_key', selectedTemplate.key)

    if (customSettings.provider) formData.append('provider', customSettings.provider)
    if (customSettings.model) formData.append('model', customSettings.model)

    try {
      const response = await fetch(`${API_URL}/analyze`, {
        method: 'POST',
        body: formData,
      })

      if (response.ok) {
        const data = await response.json()
        setResult(data)
        saveToHistory(data)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleBatchAnalyze = async () => {
    if (files.length === 0 || !selectedTemplate) return

    setLoading(true)
    setBatchProgress({ current: 0, total: files.length })

    for (let i = 0; i < files.length; i++) {
      const formData = new FormData()
      formData.append('file', files[i])
      formData.append('prompt', selectedTemplate.prompt)
      formData.append('template_key', selectedTemplate.key)

      if (customSettings.provider) formData.append('provider', customSettings.provider)
      if (customSettings.model) formData.append('model', customSettings.model)

      try {
        const response = await fetch(`${API_URL}/analyze`, {
          method: 'POST',
          body: formData,
        })

        if (response.ok) {
          const data = await response.json()
          saveToHistory(data)
        }
      } catch (err) {
        console.error(err)
      }

      setBatchProgress({ current: i + 1, total: files.length })
    }

    setLoading(false)
    setBatchProgress({ current: 0, total: 0 })
    setFiles([])
  }

  const exportJSON = (data: AnalysisResult) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `analysis_${data.filename}_${new Date().toISOString().slice(0, 10)}.json`
    a.click()
  }

  const exportCSV = (data: AnalysisResult) => {
    // properly escape double quotes for CSV format by doubling them
    const safeAnalysis = (data.analysis || '').replace(/"/g, '""')
    const safePrompt = (data.prompt || '').replace(/"/g, '""')

    const csv = `Filename,Timestamp,Task,Analysis,Model,Provider,Tokens\n"${data.filename}","${data.timestamp}","${safePrompt}","${safeAnalysis}","${data.metadata.model || ''}","${data.metadata.provider || ''}","${(data.metadata.usage as { total_tokens?: number })?.total_tokens || 0}"`
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `analysis_${data.filename}_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
  }

  const exportAllJSON = () => {
    const blob = new Blob([JSON.stringify(history, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `all_analyses_${new Date().toISOString().slice(0, 10)}.json`
    a.click()
  }

  const exportAllCSV = () => {
    let csv = 'Filename,Timestamp,Task,Analysis,Model,Provider,Tokens\n'
    history.forEach(item => {
      // properly escape double quotes for CSV format by doubling them
      const safeAnalysis = (item.analysis || '').replace(/"/g, '""')
      const safePrompt = (item.prompt || '').replace(/"/g, '""')
      csv += `"${item.filename}","${item.timestamp}","${safePrompt}","${safeAnalysis}","${item.metadata.model || ''}","${item.metadata.provider || ''}","${(item.metadata.usage as { total_tokens?: number })?.total_tokens || 0}"\n`
    })
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `all_analyses_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
  }

  const exportMarkdown = (data: AnalysisResult) => {
    const md = `# Analysis Report: ${data.filename}

## Report Summary
*Date:* ${new Date(data.timestamp).toLocaleString()}
*Task:* ${data.prompt || 'N/A'}
*Model:* ${data.metadata.model || 'N/A'}
*Provider:* ${data.metadata.provider || 'N/A'}
*Tokens:* ${(data.metadata.usage as { total_tokens?: number })?.total_tokens || 0}

## Detailed Analysis
${data.analysis}
`
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `analysis_${data.filename}_${new Date().toISOString().slice(0, 10)}.md`
    a.click()
  }

  const exportAllMarkdown = () => {
    let md = `# Combined Analysis Report
*Generated:* ${new Date().toLocaleString()}
*Total Files:* ${history.length}

`
    history.forEach((item, index) => {
      md += `---
## ${index + 1}. ${item.filename}

### Report Summary
*Date:* ${new Date(item.timestamp).toLocaleString()}
*Task:* ${item.prompt || 'N/A'}
*Model:* ${item.metadata.model || 'N/A'}

### Analysis
${item.analysis}

`
    })
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `all_analyses_${new Date().toISOString().slice(0, 10)}.md`
    a.click()
  }



  // Icon mapping for specific templates
  const getTemplateIcon = (key: string) => {
    if (key.includes('chart')) return BarChart3
    if (key.includes('ui')) return Palette
    if (key.includes('contract') || key.includes('policy')) return FileText
    if (key.includes('invoice') || key.includes('tax')) return FileSpreadsheet
    if (key.includes('resume')) return ScanSearch
    if (key.includes('medical')) return Building2
    if (key.includes('ecommerce')) return ShoppingCart
    if (key.includes('finance')) return Wallet
    return File
  }

  const getTemplatesByCategory = (category: string) => {
    switch (category) {
      case 'chart':
        return templates.industry.filter(t => t.key.startsWith('chart_'))
      case 'ui':
        return templates.industry.filter(t => t.key.startsWith('ui_'))
      case 'ecommerce':
        return templates.industry.filter(t => t.key.startsWith('ecommerce_'))
      case 'finance':
        // Include both new 'finance_' and specific 'doc_invoice' if backend hasn't updated yet
        return templates.industry.filter(t => t.key.startsWith('finance_') || t.key === 'doc_invoice')
      case 'medical':
        return templates.industry.filter(t => t.key.startsWith('medical_'))
      case 'documents':
        // Exclude invoice from documents as it belongs in finance now
        return templates.industry.filter(t => t.key.startsWith('doc_') && t.key !== 'doc_invoice')
      default:
        return templates.basic.filter(t => t.key === 'general')
    }
  }

  const renderSectionContent = () => {
    switch (activeNav) {
      case 'analyze':
      case 'chart':
      case 'ui':
      case 'documents':
      case 'ecommerce':
      case 'finance':
      case 'medical': {
        const currentNav = navItems.find(item => item.id === activeNav)
        const title = activeNav === 'analyze' ? 'Vision Agent Analyst' : currentNav?.label
        const subtitle = activeNav === 'analyze'
          ? 'Drop a file for AI-powered visual analysis'
          : `Specialized analysis for ${currentNav?.label.toLowerCase()}`

        return (
          <>
            <div className="hero-header-row">
              <div className="hero-icon-inline">
                {activeNav === 'analyze' ? <Eye /> : (currentNav?.icon && <currentNav.icon />)}
              </div>
              <div className="hero-text-col">
                <h1 className="hero-title">{title}</h1>
                <p className="hero-subtitle">
                  {subtitle}
                </p>
              </div>
            </div>


            <div className="template-selector">
              <div className="template-label">Available Templates</div>
              <div className="template-chips">
                {getTemplatesByCategory(activeNav).map(template => {
                  const Icon = getTemplateIcon(template.key)
                  return (
                    <div
                      key={template.key}
                      className={`template-chip ${selectedTemplate?.key === template.key ? 'active' : ''}`}
                      onClick={() => {
                        setSelectedTemplate(template)
                        // Optional: Switch context if user manually selects a different template type?
                        // For now we just update the template, keeping the activeNav as is.
                      }}
                    >
                      <Icon size={14} style={{ marginRight: '6px' }} />
                      {template.name}
                    </div>
                  )
                })}
                <div
                  className="template-chip add-new"
                  onClick={() => handleAddTemplate(activeNav)}
                >
                  <Plus size={14} style={{ marginRight: '6px' }} />
                  New Template
                </div>
              </div>
            </div>

            <div className="mode-switcher">
              <button
                className={`mode-btn ${analysisMode === 'single' ? 'active' : ''}`}
                onClick={() => setAnalysisMode('single')}
              >
                Single File
              </button>
              <button
                className={`mode-btn ${analysisMode === 'batch' ? 'active' : ''}`}
                onClick={() => setAnalysisMode('batch')}
              >
                Batch Analysis
              </button>
            </div>

            {analysisMode === 'single' ? (
              <div
                className={`file-drop ${file ? 'has-file' : ''}`}
                onClick={() => document.getElementById('file-input')?.click()}
              >
                <input
                  id="file-input"
                  type="file"
                  accept=".png,.jpg,.jpeg,.pdf,.gif,.bmp,.webp"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                />
                <div className="drop-content">
                  {file ? (
                    <div className="file-info">
                      <span className="drop-icon">
                        <File />
                      </span>
                      <span className="file-name">{file.name}</span>
                      <span className="file-size">{formatFileSize(file.size)}</span>
                    </div>
                  ) : (
                    <>
                      <span className="drop-icon">
                        <Cloud />
                      </span>
                      <span className="drop-text">Drop your file here</span>
                      <span className="drop-hint">PNG • JPG • PDF • GIF • WebP</span>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div
                className="file-drop"
                onClick={() => document.getElementById('batch-input')?.click()}
              >
                <input
                  id="batch-input"
                  type="file"
                  accept=".png,.jpg,.jpeg,.pdf,.gif,.bmp,.webp"
                  multiple
                  onChange={handleFilesChange}
                  style={{ display: 'none' }}
                />
                <div className="drop-content">
                  {files.length > 0 ? (
                    <div className="file-info">
                      <span className="drop-icon">
                        <Upload />
                      </span>
                      <span className="file-name">{files.length} files selected</span>
                    </div>
                  ) : (
                    <>
                      <span className="drop-icon">
                        <Upload />
                      </span>
                      <span className="drop-text">Drop multiple files here</span>
                      <span className="drop-hint">Select multiple files for batch processing</span>
                    </>
                  )}
                </div>
              </div>
            )}

            {selectedTemplate && (
              <div className="template-display">
                <div className="template-display-label">Active Template: {selectedTemplate.name}</div>
                {selectedTemplate.prompt}
              </div>
            )}

            {analysisMode === 'single' ? (
              <button
                className="scan-btn"
                onClick={handleAnalyze}
                disabled={!file || loading}
              >
                {loading ? (
                  <>
                    <span className="spinner"></span>
                    Analyzing...
                  </>
                ) : (
                  <>
                    <ScanSearch size={20} />
                    Analyze
                  </>
                )}
              </button>
            ) : (
              <button
                className="scan-btn"
                onClick={handleBatchAnalyze}
                disabled={loading || files.length === 0}
              >
                {loading ? (
                  <>
                    <span className="spinner"></span>
                    Processing {batchProgress.current}/{batchProgress.total}...
                  </>
                ) : (
                  <>
                    <ScanSearch size={20} />
                    Analyze Batch ({files.length} files)
                  </>
                )}
              </button>
            )}


            {result && (
              <div className="results-panel">
                <div className="results-header">
                  <span className="results-title">
                    <File size={18} />
                    {result.filename}
                  </span>
                  <span className="results-badge">Complete</span>
                </div>
                <div className="results-content">
                  {result.analysis}
                </div>
                <div className="results-actions">
                  <button
                    className="action-btn"
                    onClick={() => navigator.clipboard.writeText(result.analysis)}
                  >
                    <Clipboard size={16} />
                    Copy
                  </button>
                  <button
                    className="action-btn"
                    onClick={() => exportJSON(result)}
                  >
                    <FileJson size={16} />
                    JSON
                  </button>
                  <button
                    className="action-btn"
                    onClick={() => exportCSV(result)}
                  >
                    <FileSpreadsheet size={16} />
                    CSV
                  </button>
                  <button
                    className="action-btn"
                    onClick={() => exportMarkdown(result)}
                  >
                    <FileText size={16} />
                    Markdown
                  </button>
                </div>
              </div>
            )}


          </>
        )
      }

      case 'history': {
        const totalTokens = history.reduce((acc, item) => {
          return acc + ((item.metadata.usage as { total_tokens?: number })?.total_tokens || 0)
        }, 0)
        const uniqueFiles = new Set(history.map(item => item.filename)).size

        return (
          <>
            <div className="hero-header-row">
              <div className="hero-icon-inline">
                <History />
              </div>
              <div className="hero-text-col">
                <h1 className="hero-title">Analysis History</h1>
                <p className="hero-subtitle">
                  View and export your analysis history
                </p>
              </div>
            </div>

            {history.length === 0 ? (
              <div className="empty-state">
                <p>No analysis history yet. Start by analyzing some files.</p>
              </div>
            ) : (
              <>
                <div className="stats-grid">
                  <div className="stat-card">
                    <div className="stat-label">Total Analyses</div>
                    <div className="stat-value">{history.length}</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">Total Tokens</div>
                    <div className="stat-value">{totalTokens.toLocaleString()}</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">Unique Files</div>
                    <div className="stat-value">{uniqueFiles}</div>
                  </div>
                </div>

                <div className="export-section">
                  <h3>Export All Results</h3>
                  <div className="results-actions">
                    <button className="action-btn" onClick={exportAllJSON}>
                      <FileJson size={16} />
                      Export All (JSON)
                    </button>
                    <button className="action-btn" onClick={exportAllCSV}>
                      <FileSpreadsheet size={16} />
                      Export All (CSV)
                    </button>
                    <button className="action-btn" onClick={exportAllMarkdown}>
                      <FileText size={16} />
                      Export All (MD)
                    </button>
                    <button className="action-btn danger" onClick={clearHistory}>
                      <Trash2 size={16} />
                      Clear History
                    </button>
                  </div>
                </div>

                <div className="history-list">
                  {history.map(item => (
                    <div key={item.id} className="history-item">
                      <div className="history-item-header">
                        <span className="history-filename">
                          <File size={16} />
                          {item.filename}
                        </span>
                        <span className="history-timestamp">
                          {new Date(item.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <div className="history-item-meta">
                        <span>Provider: {String(item.metadata.provider || 'N/A')}</span>
                        <span>Model: {String(item.metadata.model || 'N/A')}</span>
                        <span>Tokens: {String((item.metadata.usage as { total_tokens?: number })?.total_tokens || 0)}</span>
                      </div>
                      <div className="history-item-analysis">
                        {item.analysis.substring(0, 200)}...
                      </div>
                      <div className="history-item-actions">
                        <button
                          className="action-btn-small"
                          onClick={() => navigator.clipboard.writeText(item.analysis)}
                        >
                          <Clipboard size={14} />
                          Copy
                        </button>
                        <button
                          className="action-btn-small"
                          onClick={() => exportJSON(item)}
                        >
                          <FileJson size={14} />
                          JSON
                        </button>
                        <button
                          className="action-btn-small"
                          onClick={() => exportCSV(item)}
                        >
                          <FileSpreadsheet size={14} />
                          CSV
                        </button>
                        <button
                          className="action-btn-small"
                          onClick={() => exportMarkdown(item)}
                        >
                          <FileText size={14} />
                          MD
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )
      }

      case 'settings':
        return (
          <>
            <div className="hero-header-row">
              <div className="hero-icon-inline">
                <Settings />
              </div>
              <div className="hero-text-col">
                <h1 className="hero-title">Settings</h1>
                <p className="hero-subtitle">
                  Configure your Vision Agent preferences
                </p>
              </div>
            </div>

            <div className="settings-panel">
              <div className="setting-item">
                <label>Provider</label>
                <select
                  className="setting-input"
                  value={customSettings.provider}
                  onChange={(e) => setCustomSettings({ ...customSettings, provider: e.target.value })}
                >
                  <option value="">Default ({config?.provider})</option>
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic</option>
                  <option value="google">Google Gemini</option>
                  <option value="ollama">Ollama (Local)</option>
                </select>
              </div>
              <div className="setting-item">
                <label>Model Name</label>
                <input
                  type="text"
                  className="setting-input"
                  placeholder={config?.model || 'e.g., gpt-4o, llama3'}
                  value={customSettings.model}
                  onChange={(e) => setCustomSettings({ ...customSettings, model: e.target.value })}
                />
              </div>
              <div className="setting-info">
                Leave blank to use default settings from <code>.env</code> file.
                <br />Supported providers: openai, anthropic, google, ollama, azure
              </div>
            </div>
          </>
        )

      case 'help':
        return (
          <>
            <div className="hero-header-row">
              <div className="hero-icon-inline">
                <HelpCircle />
              </div>
              <div className="hero-text-col">
                <h1 className="hero-title">Help & Documentation</h1>
                <p className="hero-subtitle">
                  Learn how to use Vision Agent effectively
                </p>
              </div>
            </div>

            <div className="mode-switcher">
              <button
                className={`mode-btn ${activeHelpSection === 'general' ? 'active' : ''}`}
                onClick={() => setActiveHelpSection('general')}
              >
                General
              </button>
              <button
                className={`mode-btn ${activeHelpSection === 'templates' ? 'active' : ''}`}
                onClick={() => setActiveHelpSection('templates')}
              >
                Templates
              </button>
              <button
                className={`mode-btn ${activeHelpSection === 'export' ? 'active' : ''}`}
                onClick={() => setActiveHelpSection('export')}
              >
                Export
              </button>
            </div>

            <div className="help-content">
              {activeHelpSection === 'general' && (
                <>
                  <div className="help-section">
                    <h3>Getting Started</h3>
                    <p>
                      Vision Agent Analyst is a multimodal analysis tool that uses AI to analyze images, charts, UI screenshots, and documents.
                    </p>
                  </div>

                  <div className="help-section">
                    <h3>Supported File Types</h3>
                    <ul>
                      <li>Images: PNG, JPG, JPEG, GIF, BMP, WebP</li>
                      <li>Documents: PDF</li>
                    </ul>
                  </div>
                </>
              )}

              {activeHelpSection === 'export' && (
                <div className="help-section">
                  <h3>Export Formats</h3>
                  <ul>
                    <li><strong>JSON</strong> - Full structured data with metadata</li>
                    <li><strong>CSV</strong> - Spreadsheet-compatible format</li>
                    <li><strong>PDF</strong> - Professional report format (available for batch exports)</li>
                  </ul>
                </div>
              )}

              {activeHelpSection === 'templates' && (
                <>
                  <div className="help-section">
                    <h3>Analysis Templates</h3>
                    <p>Choose from specialized templates for different use cases:</p>
                    <ul>
                      <li><strong>General</strong> - Basic file analysis</li>
                      <li><strong>Chart Analysis</strong> - Data visualization insights</li>
                      <li><strong>UI Screenshot</strong> - UI/UX feedback</li>
                      <li><strong>E-commerce</strong> - Product analysis</li>
                      <li><strong>Finance</strong> - Financial chart analysis</li>
                      <li><strong>Medical</strong> - Medical image description</li>
                      <li><strong>Real Estate</strong> - Floor plan evaluation</li>
                      <li><strong>Marketing</strong> - Creative analysis</li>
                      <li><strong>Logistics</strong> - Document processing</li>
                      <li><strong>Education</strong> - Learning material analysis</li>
                    </ul>
                  </div>

                  <div className="help-section">
                    <h3>Why Use Templates?</h3>
                    <p>Templates are pre-written, specialized instructions that guide the AI. Here is how they impact the result:</p>
                    <ul>
                      <li>
                        <strong>Focus of Attention</strong> - Without a template, the AI simply "describes the image." With a template, it seeks specific details. For instance, in the <strong>Finance</strong> template, it looks for numbers, dates, and totals, whereas the <strong>UI/UX</strong> template focuses on colors, spacing, and usability.
                      </li>
                      <li>
                        <strong>Response Structure</strong> - Templates often require the AI to return the response in a specific format (e.g., JSON for invoices or a checklist for audits). This makes the result predictable and easy to use.
                      </li>
                      <li>
                        <strong>Time Efficiency</strong> - You don't need to write a long prompt like "Please analyze this chart, highlight trends, find anomalies..." every time. You simply select the template, and the AI knows exactly what to do.
                      </li>
                      <li>
                        <strong>Role Playing</strong> - A template switches the AI's "role." It can respond as a strict accountant, a creative designer, or an attentive medical professional depending on the category.
                      </li>
                    </ul>
                    <p style={{ marginTop: '1rem', fontStyle: 'italic', borderLeft: '3px solid var(--accent-orange)', paddingLeft: '1rem' }}>
                      <strong>In simple terms:</strong> A template is a pair of "glasses" through which the AI views your file. Putting on "accountant glasses" reveals numbers; "designer glasses" reveal style.
                    </p>
                  </div>
                </>
              )}
            </div>
          </>
        )

      default:
        return null
    }
  }

  return (
    <div className="app">

      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <div className="logo-icon">
              <Eye />
            </div>
            <span className="logo-text">Vision Agent</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navItems.map(item => {
            const IconComponent = item.icon
            return (
              <div
                key={item.id}
                className={`nav-item ${activeNav === item.id ? 'active' : ''}`}
                onClick={() => setActiveNav(item.id)}
              >
                <span className="nav-icon">
                  <IconComponent />
                </span>
                <span>{item.label}</span>
              </div>
            )
          })}
        </nav>

        <div className="sidebar-footer">
          {config && (
            <div className="provider-info">
              Connected to <span className="provider-name">{config.provider}</span>
              <br />
              {config.model}
            </div>
          )}
        </div>
      </aside>

      <main className="main-content">
        {/* Startup Splash - Absolute over main content */}
        <div className={`splash-screen ${!showSplash ? 'hidden' : ''}`}>
          <div className="splash-logo-container">
            <div className="splash-ring"></div>
            <div className="splash-ring"></div>
            <div className="splash-ring"></div>
            <div className="splash-core">
              <ScanSearch size={40} />
            </div>
          </div>
          <div className="splash-text">Vision Agent</div>
          <div className="splash-subtext">Initializing Core Systems...</div>
        </div>

        {/* Processing Splash - Absolute over main content */}
        <div className={`splash-screen ${loading ? '' : 'hidden'}`}>
          <div className="splash-logo-container">
            <div className="splash-ring"></div>
            <div className="splash-ring"></div>
            <div className="splash-ring"></div>
            <div className="splash-core">
              <ScanSearch size={40} />
            </div>
          </div>
          <div className="splash-text">
            {batchProgress.total > 0 ? 'Batch Processing' : 'Analyzing'}
          </div>
          <div className="splash-subtext">
            {batchProgress.total > 0
              ? `Processing file ${batchProgress.current} of ${batchProgress.total}`
              : 'AI is examining your content...'}
          </div>
        </div>
        <div className="content-wrapper">
          {renderSectionContent()}
        </div>


      </main>
    </div>
  )
}

export default App
