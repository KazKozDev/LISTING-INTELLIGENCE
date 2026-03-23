import { useState, useEffect } from 'react'
import { ScanSearch } from 'lucide-react'
import './App.css'
import './splash.css'

import { Sidebar } from './components/Sidebar'
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

function App() {
  const [activeNav, setActiveNav] = useState('ecom-product')
  const [showSplash, setShowSplash] = useState(true)
  const [customSettings, setCustomSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('customSettings')
      return saved ? JSON.parse(saved) : { provider: '', model: '', apiKey: '' }
    } catch {
      return { provider: '', model: '', apiKey: '' }
    }
  })

  const handleSettingsChange = (settings: { provider: string; model: string; apiKey: string }) => {
    setCustomSettings(settings)
    localStorage.setItem('customSettings', JSON.stringify(settings))
  }

  const { config } = useConfig()
  const { history, addToHistory, clearHistory, totalTokens, uniqueFiles } = useHistory()

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 3500)
    return () => clearTimeout(timer)
  }, [])

  const renderContent = () => {
    switch (activeNav) {
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
            onSettingsChange={handleSettingsChange}
          />
        )
      case 'help':
        return <HelpSection />
      default:
        return <ProductAnalysis />
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

          <div className="content-wrapper">
            {renderContent()}
          </div>
        </main>
      </div>
    </ErrorBoundary>
  )
}

export default App
