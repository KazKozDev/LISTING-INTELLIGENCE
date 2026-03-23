import { useState } from 'react'
import { HelpCircle } from 'lucide-react'

export function HelpSection() {
  const [tab, setTab] = useState<'general' | 'templates' | 'export'>('general')

  return (
    <>
      <div className="hero-header-row">
        <div className="hero-icon-inline"><HelpCircle /></div>
        <div className="hero-text-col">
          <h1 className="hero-title">Help & Documentation</h1>
          <p className="hero-subtitle">Learn how to use Vision Agent effectively</p>
        </div>
      </div>

      <div className="mode-switcher">
        <button className={`mode-btn ${tab === 'general' ? 'active' : ''}`} onClick={() => setTab('general')}>General</button>
        <button className={`mode-btn ${tab === 'templates' ? 'active' : ''}`} onClick={() => setTab('templates')}>Templates</button>
        <button className={`mode-btn ${tab === 'export' ? 'active' : ''}`} onClick={() => setTab('export')}>Export</button>
      </div>

      <div className="help-content">
        {tab === 'general' && (
          <>
            <div className="help-section">
              <h3>Getting Started</h3>
              <p>Vision Agent Analyst is a multimodal analysis tool that uses AI to analyze images, charts, UI screenshots, and documents. Specialized in e-commerce product analysis.</p>
            </div>
            <div className="help-section">
              <h3>Supported File Types</h3>
              <ul>
                <li>Images: PNG, JPG, JPEG, GIF, BMP, WebP</li>
                <li>Documents: PDF</li>
                <li>Batch: ZIP archives (e-commerce mode)</li>
              </ul>
            </div>
          </>
        )}
        {tab === 'templates' && (
          <div className="help-section">
            <h3>Analysis Templates</h3>
            <p>Choose from specialized templates for different use cases:</p>
            <ul>
              <li><strong>General</strong> - Basic file analysis</li>
              <li><strong>Chart Analysis</strong> - Data visualization insights</li>
              <li><strong>UI Screenshot</strong> - UI/UX feedback</li>
              <li><strong>E-commerce</strong> - Product photo analysis, SEO, compliance</li>
              <li><strong>Finance</strong> - Financial chart analysis</li>
              <li><strong>Medical</strong> - Medical image description</li>
            </ul>
            <p style={{ marginTop: '1rem', fontStyle: 'italic', borderLeft: '3px solid var(--accent-orange)', paddingLeft: '1rem' }}>
              <strong>Tip:</strong> Templates are specialized prompts that guide the AI to focus on specific details relevant to your use case.
            </p>
          </div>
        )}
        {tab === 'export' && (
          <div className="help-section">
            <h3>Export Formats</h3>
            <ul>
              <li><strong>JSON</strong> - Full structured data with metadata</li>
              <li><strong>CSV</strong> - Spreadsheet-compatible, marketplace-ready</li>
              <li><strong>Markdown</strong> - Readable report format</li>
            </ul>
          </div>
        )}
      </div>
    </>
  )
}
