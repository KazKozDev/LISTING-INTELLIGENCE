import { useState } from 'react'
import {
  HelpCircle, ShoppingCart, ShieldCheck, Tag,
  GitCompareArrows, Wrench, Package, FileDown, Zap,
} from 'lucide-react'

type Tab = 'quickstart' | 'features' | 'tips'

export function HelpSection() {
  const [tab, setTab] = useState<Tab>('quickstart')

  return (
    <>
      <div className="hero-header-row">
        <div className="hero-icon-inline"><HelpCircle /></div>
        <div className="hero-text-col">
          <h1 className="hero-title">Help</h1>
          <p className="hero-subtitle">How to use Vision Agent Analyst</p>
        </div>
      </div>

      <div className="mode-switcher">
        <button className={`mode-btn ${tab === 'quickstart' ? 'active' : ''}`} onClick={() => setTab('quickstart')}>Quick Start</button>
        <button className={`mode-btn ${tab === 'features' ? 'active' : ''}`} onClick={() => setTab('features')}>Features</button>
        <button className={`mode-btn ${tab === 'tips' ? 'active' : ''}`} onClick={() => setTab('tips')}>Tips</button>
      </div>

      <div className="help-content">
        {tab === 'quickstart' && (
          <>
            <div className="help-section">
              <h3>What is this?</h3>
              <p>
                Vision Agent Analyst turns product photos into marketplace-ready listings.
                Upload a photo — get SEO titles, descriptions, tags, compliance reports, and competitor analysis.
              </p>
            </div>
            <div className="help-section">
              <h3>Supported files</h3>
              <ul>
                <li><strong>Images</strong> — PNG, JPG, JPEG, WebP, GIF, BMP</li>
                <li><strong>Documents</strong> — PDF (multi-page)</li>
              </ul>
            </div>
            <div className="help-section">
              <h3>Workflow</h3>
              <ol>
                <li>Pick a section from the sidebar (Product Analysis, SEO Generator, etc.)</li>
                <li>Upload a product photo</li>
                <li>Select target marketplace if needed</li>
                <li>Click Analyze — results appear in seconds</li>
                <li>Copy text or export to CSV</li>
              </ol>
            </div>
          </>
        )}

        {tab === 'features' && (
          <>
            <div className="help-section">
              <h3><ShoppingCart size={16} style={{ verticalAlign: 'middle', marginRight: '0.4rem' }} />Product Analysis</h3>
              <p>Upload a product photo and get: description, category, attributes, SEO title, search tags, quality score (1–10), and improvement suggestions. Choose a target marketplace for tailored output.</p>
            </div>
            <div className="help-section">
              <h3><ShieldCheck size={16} style={{ verticalAlign: 'middle', marginRight: '0.4rem' }} />Compliance</h3>
              <p>Check if your photo meets marketplace requirements before uploading. Verifies resolution, background, aspect ratio, and forbidden elements (watermarks, text, logos). Returns pass/fail with fix recommendations.</p>
            </div>
            <div className="help-section">
              <h3><Tag size={16} style={{ verticalAlign: 'middle', marginRight: '0.4rem' }} />SEO Generator</h3>
              <p>Generate marketplace-optimized listing content from a photo: title (60–80 chars), bullet points, full description, 15+ search tags, and backend keywords. Add target keywords to fine-tune.</p>
            </div>
            <div className="help-section">
              <h3><GitCompareArrows size={16} style={{ verticalAlign: 'middle', marginRight: '0.4rem' }} />Competitor Compare</h3>
              <p>Upload your product photo and a competitor's listing side by side. Get strengths, weaknesses, competitive edge opportunities, and 3 action items to outperform.</p>
            </div>
            <div className="help-section">
              <h3><Wrench size={16} style={{ verticalAlign: 'middle', marginRight: '0.4rem' }} />Tools</h3>
              <p>8 specialized modes: Photo Improvements, Extract Attributes, Listing Audit, Pricing Analysis, Review Sentiment, Packaging Critique, Visual Search SEO, Inventory Check.</p>
            </div>
            <div className="help-section">
              <h3><Package size={16} style={{ verticalAlign: 'middle', marginRight: '0.4rem' }} />Bulk Upload</h3>
              <p>Drag multiple product photos at once. Track real-time progress per file. Export all results as a single CSV ready for marketplace upload.</p>
            </div>
          </>
        )}

        {tab === 'tips' && (
          <>
            <div className="help-section">
              <h3><Zap size={16} style={{ verticalAlign: 'middle', marginRight: '0.4rem' }} />Better results</h3>
              <ul>
                <li>Use high-resolution photos (1000×1000 px minimum)</li>
                <li>White or neutral backgrounds work best for analysis</li>
                <li>One product per photo — avoid collages</li>
                <li>Select the correct marketplace for accurate compliance checks</li>
                <li>Add target keywords in SEO Generator for more relevant output</li>
              </ul>
            </div>
            <div className="help-section">
              <h3><FileDown size={16} style={{ verticalAlign: 'middle', marginRight: '0.4rem' }} />Export</h3>
              <ul>
                <li><strong>Copy</strong> — click the copy button on any result to clipboard</li>
                <li><strong>CSV</strong> — available in Bulk Upload, ready for marketplace import</li>
                <li><strong>API</strong> — all features available via REST API at <code>/docs</code></li>
              </ul>
            </div>
            <div className="help-section">
              <h3>Supported marketplaces</h3>
              <ul>
                <li><strong>Wildberries</strong> — 900×1200, white background, 3:4</li>
                <li><strong>Ozon</strong> — 900×1200, white preferred, 1:1 or 3:4</li>
                <li><strong>Amazon</strong> — 1000×1000, pure white, 1:1, 85% fill</li>
                <li><strong>eBay</strong> — 500×500, white/neutral, 1:1</li>
              </ul>
            </div>
          </>
        )}
      </div>
    </>
  )
}
