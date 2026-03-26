import { useState, useEffect } from 'react'
import './App.css'
import './splash.css'

import { Sidebar } from './components/Sidebar'
import { HistoryView } from './components/HistoryView'
import { SettingsPanel } from './components/SettingsPanel'
import { HelpSection } from './components/HelpSection'
import { ErrorBoundary } from './components/ErrorBoundary'
import { ProductAnalysis } from './components/ecommerce/ProductAnalysis'
import { ComplianceReport } from './components/ecommerce/ComplianceReport'
import { EcommerceTools } from './components/ecommerce/EcommerceTools'
import { ComplianceFixStudio } from './components/ecommerce/ComplianceFixStudio'
import type { ComplianceFixStudioLaunchState, CustomSettings } from './api/types'
import { useConfig } from './hooks/useConfig'
import { useHistory } from './hooks/useHistory'
import {
  type AppActiveNav,
  getPersistedAppActiveNav,
  setPersistedAppActiveNav,
} from './utils/analysisCache'
import { loadCustomSettings, saveCustomSettings } from './utils/customSettings'

const SPLASH_FRAMES = [
  {
    word: 'READ',
    line: 'Parses listings, signals weak copy, and finds what should rank.',
  },
  {
    word: 'CHECK',
    line: 'Reads compliance risk before the image goes live on the marketplace.',
  },
  {
    word: 'FIX',
    line: 'Cleans visuals, relights frames, and prepares export-ready assets.',
  },
] as const

function App() {
  const [activeNav, setActiveNav] = useState(
    () => getPersistedAppActiveNav() ?? 'ecom-product',
  )
  const [showSplash, setShowSplash] = useState(true)
  const [splashFrameIndex, setSplashFrameIndex] = useState(0)
  const [customSettings, setCustomSettings] = useState<CustomSettings>(loadCustomSettings)
  const [fixStudioLaunchState, setFixStudioLaunchState] = useState<ComplianceFixStudioLaunchState | null>(null)

  const handleSettingsChange = (settings: CustomSettings) => {
    setCustomSettings(settings)
    saveCustomSettings(settings)
  }

  const { config } = useConfig()
  const { history, clearHistory, totalTokens, uniqueFiles } = useHistory()

  useEffect(() => {
    const frameTimer = setInterval(() => {
      setSplashFrameIndex((current) => (current + 1) % SPLASH_FRAMES.length)
    }, 900)
    const timer = setTimeout(() => setShowSplash(false), 3500)
    return () => {
      clearInterval(frameTimer)
      clearTimeout(timer)
    }
  }, [])

  useEffect(() => {
    setPersistedAppActiveNav(activeNav)
  }, [activeNav])

  const openFixStudioFromCompliance = (file: File, marketplace: string) => {
    setFixStudioLaunchState({
      id: Date.now(),
      file,
      marketplace,
      source: 'compliance',
    })
    setActiveNav('ecom-fix')
  }

  const handleNavChange = (id: string) => {
    setActiveNav(id as AppActiveNav)
  }

  const activeSplashFrame = SPLASH_FRAMES[splashFrameIndex]

  return (
    <ErrorBoundary>
      <div className="app">
        <Sidebar activeNav={activeNav} onNavChange={handleNavChange} config={config} />

        <main className="main-content">
          <div className={`splash-screen ${!showSplash ? 'hidden' : ''}`}>
            <div className="splash-headline" aria-label={activeSplashFrame.word}>
              {SPLASH_FRAMES.map((frame, index) => {
                const isActive = index === splashFrameIndex
                const isPrevious = index === (splashFrameIndex + SPLASH_FRAMES.length - 1) % SPLASH_FRAMES.length
                const isNext = index === (splashFrameIndex + 1) % SPLASH_FRAMES.length

                return (
                  <div
                    key={frame.word}
                    className={[
                      'splash-word',
                      isActive ? 'is-active' : '',
                      isPrevious ? 'is-previous' : '',
                      isNext ? 'is-next' : '',
                    ].filter(Boolean).join(' ')}
                  >
                    {frame.word}
                  </div>
                )
              })}
            </div>
            <div className="splash-signature" aria-label="Listing Intelligence">
              <span className="splash-signature-primary">Listing</span>
              <span className="splash-signature-secondary">Intelligence</span>
            </div>
            <div className="splash-subtext">{activeSplashFrame.line}</div>
          </div>

          <div className={`content-wrapper ${activeNav === 'help' ? 'content-wrapper-wide' : ''}`}>
            <div hidden={activeNav !== 'ecom-product'}>
              <ProductAnalysis />
            </div>

            <div hidden={activeNav !== 'ecom-compliance'}>
              <ComplianceReport onOpenFixStudio={openFixStudioFromCompliance} />
            </div>

            <div hidden={activeNav !== 'ecom-fix'}>
              <ComplianceFixStudio launchState={fixStudioLaunchState} />
            </div>

            <div hidden={activeNav !== 'ecom-tools'}>
              <EcommerceTools />
            </div>

            <div hidden={activeNav !== 'history'}>
              <HistoryView
                history={history}
                totalTokens={totalTokens}
                uniqueFiles={uniqueFiles}
                onClear={clearHistory}
              />
            </div>

            <div hidden={activeNav !== 'settings'}>
              <SettingsPanel
                config={config}
                customSettings={customSettings}
                onSettingsChange={handleSettingsChange}
              />
            </div>

            <div hidden={activeNav !== 'help'}>
              <HelpSection onNavigate={setActiveNav} />
            </div>
          </div>
        </main>
      </div>
    </ErrorBoundary>
  )
}

export default App
