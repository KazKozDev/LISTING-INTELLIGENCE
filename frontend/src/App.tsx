import { useState, useEffect, useMemo } from 'react'
import { ScanSearch, Eye } from 'lucide-react'
import './App.css'
import './splash.css'

import { Sidebar } from './components/Sidebar'
import { FileUpload } from './components/FileUpload'
import { TemplateSelector } from './components/TemplateSelector'
import { ResultsPanel } from './components/ResultsPanel'
import { HistoryView } from './components/HistoryView'
import { SettingsPanel } from './components/SettingsPanel'
import { HelpSection } from './components/HelpSection'
import { ErrorBoundary } from './components/ErrorBoundary'
import { ProductAnalysis } from './components/ecommerce/ProductAnalysis'
import { ComplianceReport } from './components/ecommerce/ComplianceReport'
import { SEOPreview } from './components/ecommerce/SEOPreview'
import { BulkUpload } from './components/ecommerce/BulkUpload'
import { CompetitorCompare } from './components/ecommerce/CompetitorCompare'
import { EcommerceTools } from './components/ecommerce/EcommerceTools'
import { useConfig } from './hooks/useConfig'
import { useHistory } from './hooks/useHistory'
import { useAnalysis } from './hooks/useAnalysis'
import type { Template } from './api/types'

function getTemplatesByCategory(
  templates: { basic: Template[]; industry: Template[] },
  category: string,
): Template[] {
  if (category === 'analyze') {
    return templates.basic.filter(t => t.key === 'general')
  }
  return templates.basic.filter(t => t.key === 'general')
}

function App() {
  const [activeNav, setActiveNav] = useState('analyze')
  const [showSplash, setShowSplash] = useState(true)
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [files, setFiles] = useState<File[]>([])
  const [analysisMode, setAnalysisMode] = useState<'single' | 'batch'>('single')
  const [customSettings, setCustomSettings] = useState({ provider: '', model: '' })

  const { config, templates } = useConfig()
  const { history, addToHistory, clearHistory, totalTokens, uniqueFiles } = useHistory()
  const { loading, result, batchProgress, analyzeSingle, analyzeBatch } = useAnalysis(addToHistory)

  const filteredTemplates = useMemo(
    () => getTemplatesByCategory(templates, activeNav),
    [templates, activeNav],
  )

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 3500)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (filteredTemplates.length > 0) {
      setSelectedTemplate(filteredTemplates[0])
    }
  }, [activeNav, filteredTemplates.length])

  const handleAnalyze = () => {
    if (!file || !selectedTemplate) return
    const opts = customSettings.provider || customSettings.model
      ? { provider: customSettings.provider || undefined, model: customSettings.model || undefined }
      : undefined
    analyzeSingle(file, selectedTemplate, opts)
  }

  const handleBatchAnalyze = () => {
    if (files.length === 0 || !selectedTemplate) return
    const opts = customSettings.provider || customSettings.model
      ? { provider: customSettings.provider || undefined, model: customSettings.model || undefined }
      : undefined
    analyzeBatch(files, selectedTemplate, opts)
  }

  const renderContent = () => {
    if (activeNav === 'analyze') {
      return (
        <>
          <div className="hero-header-row">
            <div className="hero-icon-inline"><Eye /></div>
            <div className="hero-text-col">
              <h1 className="hero-title">Vision Agent Analyst</h1>
              <p className="hero-subtitle">Drop a file for AI-powered visual analysis</p>
            </div>
          </div>

          <TemplateSelector
            templates={filteredTemplates}
            selected={selectedTemplate}
            onSelect={setSelectedTemplate}
            category={activeNav}
          />

          <div className="mode-switcher">
            <button className={`mode-btn ${analysisMode === 'single' ? 'active' : ''}`} onClick={() => setAnalysisMode('single')}>Single File</button>
            <button className={`mode-btn ${analysisMode === 'batch' ? 'active' : ''}`} onClick={() => setAnalysisMode('batch')}>Batch Analysis</button>
          </div>

          <FileUpload
            mode={analysisMode}
            file={file}
            files={files}
            onFileChange={setFile}
            onFilesChange={setFiles}
          />

          {selectedTemplate && (
            <div className="template-display">
              <div className="template-display-label">Active Template: {selectedTemplate.name}</div>
              {selectedTemplate.prompt}
            </div>
          )}

          {analysisMode === 'single' ? (
            <button className="scan-btn" onClick={handleAnalyze} disabled={!file || loading}>
              {loading ? (<><span className="spinner"></span>Analyzing...</>) : (<><ScanSearch size={20} />Analyze</>)}
            </button>
          ) : (
            <button className="scan-btn" onClick={handleBatchAnalyze} disabled={loading || files.length === 0}>
              {loading
                ? (<><span className="spinner"></span>Processing {batchProgress.current}/{batchProgress.total}...</>)
                : (<><ScanSearch size={20} />Analyze Batch ({files.length} files)</>)}
            </button>
          )}

          {result && <ResultsPanel result={result} />}
        </>
      )
    }

    switch (activeNav) {
      case 'history':
        return (
          <HistoryView
            history={history}
            totalTokens={totalTokens}
            uniqueFiles={uniqueFiles}
            onClear={clearHistory}
          />
        )
      case 'settings':
        return (
          <SettingsPanel
            config={config}
            customSettings={customSettings}
            onSettingsChange={setCustomSettings}
          />
        )
      case 'help':
        return <HelpSection />
      case 'ecom-product':
        return <ProductAnalysis />
      case 'ecom-compliance':
        return <ComplianceReport />
      case 'ecom-seo':
        return <SEOPreview />
      case 'ecom-bulk':
        return <BulkUpload />
      case 'ecom-compare':
        return <CompetitorCompare />
      case 'ecom-tools':
        return <EcommerceTools />
      default:
        return null
    }
  }

  return (
    <ErrorBoundary>
      <div className="app">
        <Sidebar activeNav={activeNav} onNavChange={setActiveNav} config={config} />

        <main className="main-content">
          <div className={`splash-screen ${!showSplash ? 'hidden' : ''}`}>
            <div className="splash-logo-container">
              <div className="splash-ring"></div>
              <div className="splash-ring"></div>
              <div className="splash-ring"></div>
              <div className="splash-core"><ScanSearch size={40} /></div>
            </div>
            <div className="splash-text">Vision Agent</div>
            <div className="splash-subtext">Initializing Core Systems...</div>
          </div>

          <div className={`splash-screen ${loading ? '' : 'hidden'}`}>
            <div className="splash-logo-container">
              <div className="splash-ring"></div>
              <div className="splash-ring"></div>
              <div className="splash-ring"></div>
              <div className="splash-core"><ScanSearch size={40} /></div>
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
            {renderContent()}
          </div>
        </main>
      </div>
    </ErrorBoundary>
  )
}

export default App
