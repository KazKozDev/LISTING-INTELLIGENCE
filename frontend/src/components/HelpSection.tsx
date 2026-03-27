import { useEffect, useRef, useState } from 'react'
import {
  ArrowRight,
  BookOpen,
  CheckCircle,
  Download,
  FileSearch,
  Layers3,
  Rocket,
  ShieldCheck,
  Sparkles,
  WandSparkles,
} from 'lucide-react'

type HelpSectionId = 'overview' | 'workflows' | 'shipping'
type HelpNavTarget = 'ecom-product' | 'ecom-compliance' | 'ecom-fix' | 'ecom-tools'

interface HelpSectionProps {
  onNavigate?: (target: HelpNavTarget) => void
}

const CORE_ROUTES = [
  {
    title: 'Product Workspace',
    icon: Sparkles,
    target: 'ecom-product' as const,
    summary: 'Primary workflow for listing output, comparison, marketplace context, and batch runs.',
  },
  {
    title: 'Compliance',
    icon: ShieldCheck,
    target: 'ecom-compliance' as const,
    summary: 'Marketplace audit for verdict, issue severity, policy guidance, and Fix Studio handoff.',
  },
  {
    title: 'Fix Studio',
    icon: WandSparkles,
    target: 'ecom-fix' as const,
    summary: 'Correction workspace for compose, auto-center, recheck, compare deltas, and export.',
  },
  {
    title: 'Additional Tools',
    icon: Layers3,
    target: 'ecom-tools' as const,
    summary: 'Targeted tools for pricing, review sentiment, competitor insights, keyword gaps, and object scans.',
  },
]

const QUICK_START_STEPS = [
  'Use Product Workspace for full listing output, competitor comparison, or batch SKU work.',
  'Use Compliance when the question is whether a marketplace image will pass.',
  'Use Fix Studio after a failed audit or when the image already needs controlled correction.',
  'Use Additional Tools for narrow tasks such as pricing, competitor insights, keyword gaps, review sentiment, or object scans.',
  'Use History to reopen earlier runs and Settings to verify provider or model choices.',
]

const WORKFLOW_GUIDES = [
  {
    title: 'Product Workspace Walkthrough',
    icon: Rocket,
    target: 'ecom-product' as const,
    cta: 'Open Product Workspace',
    summary: 'Use this for listing output, quality scoring, comparison, or batch-ready SKU work.',
    steps: [
      'Upload one image for Core Listing, or multiple images for a batch run.',
      'Pick marketplace and keywords when channel context or SEO direction matters.',
      'Switch to Compare Mode for a side-by-side read against a competitor image.',
      'Review title, bullets, description, search tags, backend keywords, and quality score, then copy or export.',
    ],
    preview: {
      badge: 'Primary Flow',
      title: 'Core Listing / Compare',
      chips: ['Listing', 'Compare', 'Batch'],
      bars: ['Marketplace + keyword context', 'Single, compare, or multi-image run', 'Listing output + quality score'],
      footer: 'Best for listing generation',
    },
  },
  {
    title: 'Compliance Walkthrough',
    icon: ShieldCheck,
    target: 'ecom-compliance' as const,
    cta: 'Open Compliance',
    summary: 'Use this when the question is whether the image will pass marketplace rules.',
    steps: [
      'Upload the image you want to verify.',
      'Choose the marketplace so the verdict uses the right rule set.',
      'Read the score, pass/fail decision, issue severity, and recommendations.',
      'Open Fix Studio if the image needs deterministic correction instead of advice only.',
    ],
    preview: {
      badge: 'Audit Layer',
      title: 'Marketplace Check',
      chips: ['Verdict', 'Issues', 'Handoff'],
      bars: ['Marketplace selector + image intake', 'Score, issues, and recommendations', 'Open Fix Studio next step'],
      footer: 'Best for validation before upload',
    },
  },
  {
    title: 'Fix Studio Walkthrough',
    icon: WandSparkles,
    target: 'ecom-fix' as const,
    cta: 'Open Fix Studio',
    summary: 'Use this when the image needs controlled correction and approval before export.',
    steps: [
      'Start from a Compliance handoff or upload directly when you already know the problem.',
      'Compose the frame with preset, zoom, and positioning before running a fix.',
      'Run Auto Center, Recheck Only, or another fix, then compare history and deltas.',
      'Approve one variant in Export and download after checking the result and remaining issues.',
    ],
    preview: {
      badge: 'Correction Workspace',
      title: 'Compose → Run → Compare → Export',
      chips: ['Canvas', 'Top Fixes', 'Approval'],
      bars: ['Canvas preset + positioning', 'Variant history + delta review', 'Approval panel + primary export'],
      footer: 'Best for controlled image correction',
    },
  },
]

const SHIPPING_CARDS = [
  {
    title: 'Input Quality',
    icon: FileSearch,
    points: [
      'Use the highest-resolution source available; 1000 x 1000 is still the practical floor for most marketplaces.',
      'Keep one product dominant in frame for cleaner listing extraction, stronger compare results, and fewer compliance false positives.',
      'White or neutral backgrounds reduce ambiguity before audit or correction workflows.',
    ],
  },
  {
    title: 'Output Handling',
    icon: Download,
    points: [
      'Use Product Workspace for listing text, keywords, comparisons, and batch-ready outputs; use Fix Studio for approved image exports.',
      'Use History to reopen earlier attempts, compare runs, or recover outputs without rerunning.',
      'In Fix Studio, approve one selected variant in Export before downloading.',
    ],
  },
  {
    title: 'API and Docs',
    icon: BookOpen,
    points: [
      'Interactive REST docs are available at /docs when the backend is running.',
      'A working UI path usually has a matching backend endpoint.',
      'Start automation with Product Workspace or Compliance before chaining batch or image-correction workflows.',
      'Use the UI first to validate prompts, marketplaces, and output shape before scripting the same path.',
    ],
  },
]

export function HelpSection({ onNavigate }: HelpSectionProps) {
  const [activeSection, setActiveSection] = useState<HelpSectionId>('overview')
  const rootRef = useRef<HTMLDivElement>(null)
  const overviewRef = useRef<HTMLDivElement>(null)
  const workflowsRef = useRef<HTMLDivElement>(null)
  const shippingRef = useRef<HTMLDivElement>(null)

  const sectionRefs: Record<HelpSectionId, React.RefObject<HTMLDivElement | null>> = {
    overview: overviewRef,
    workflows: workflowsRef,
    shipping: shippingRef,
  }

  const jumpToSection = (sectionId: HelpSectionId) => {
    setActiveSection(sectionId)
    sectionRefs[sectionId].current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  useEffect(() => {
    const updateActiveSection = () => {
      const sections: Array<{ id: HelpSectionId; element: HTMLDivElement | null }> = [
        { id: 'overview', element: overviewRef.current },
        { id: 'workflows', element: workflowsRef.current },
        { id: 'shipping', element: shippingRef.current },
      ]

      const offset = 132
      let nextSection: HelpSectionId = 'overview'

      for (const section of sections) {
        if (!section.element) {
          continue
        }

        if (section.element.getBoundingClientRect().top - offset <= 0) {
          nextSection = section.id
        }
      }

      setActiveSection(nextSection)
    }

    const nearestMainContent = rootRef.current?.closest('.main-content')
    const scrollContainer: HTMLElement | Window =
      nearestMainContent instanceof HTMLElement
        ? nearestMainContent
        : window

    updateActiveSection()
    scrollContainer.addEventListener('scroll', updateActiveSection, { passive: true })
    window.addEventListener('resize', updateActiveSection)

    return () => {
      scrollContainer.removeEventListener('scroll', updateActiveSection)
      window.removeEventListener('resize', updateActiveSection)
    }
  }, [])

  return (
    <div ref={rootRef}>
      <div className="hero-header-row hero-header-stacked">
        <span className="hero-kicker">Usage guide</span>
        <h1 className="hero-title hero-title-inline">Help Center</h1>
        <p className="hero-subtitle hero-subtitle-inline">Pick the right starting point</p>
      </div>

      <div className="help-shell">
        <div className="help-hero-panel">
          <div className="help-hero-copy">
            <span className="fix-workspace-label">Control Guide</span>
            <strong>Start in the right screen first.</strong>
            <span>
              Use Product Workspace for listing work, Compliance for marketplace audits, and Fix Studio for controlled image correction.
            </span>

            <div className="help-quick-actions">
              <button className="action-btn help-nav-action" onClick={() => onNavigate?.('ecom-product')}>
                <Sparkles size={16} />Open Product Workspace
              </button>
              <button className="secondary-btn help-nav-action" onClick={() => onNavigate?.('ecom-compliance')}>
                <ShieldCheck size={16} />Open Compliance
              </button>
              <button className="secondary-btn help-nav-action" onClick={() => onNavigate?.('ecom-fix')}>
                <WandSparkles size={16} />Open Fix Studio
              </button>
            </div>
          </div>

          <div className="help-hero-metrics">
            <div className="help-metric-card">
              <span className="fix-workspace-label">Primary Mode</span>
              <strong>Product Workspace</strong>
              <span>Core Listing, Compare Mode, keywords, quality score, and batch-ready output.</span>
            </div>
            <div className="help-metric-card">
              <span className="fix-workspace-label">Correction Mode</span>
              <strong>Fix Studio</strong>
              <span>Compose, run fixes, compare deltas, approve one variant, and export.</span>
            </div>
            <div className="help-metric-card">
              <span className="fix-workspace-label">Audit Mode</span>
              <strong>Compliance</strong>
              <span>Marketplace verdict, severity-ranked issues, and direct correction handoff.</span>
            </div>
          </div>
        </div>

        <div className="help-mini-nav" aria-label="Help section navigation">
          <button
            type="button"
            className={`help-mini-nav-button ${activeSection === 'overview' ? 'active' : ''}`}
            onClick={() => jumpToSection('overview')}
          >
            <span className="help-mini-nav-index">01</span>
            <span className="help-mini-nav-copy">
              <strong>Overview</strong>
              <span>What each screen is for</span>
            </span>
          </button>
          <button
            type="button"
            className={`help-mini-nav-button ${activeSection === 'workflows' ? 'active' : ''}`}
            onClick={() => jumpToSection('workflows')}
          >
            <span className="help-mini-nav-index">02</span>
            <span className="help-mini-nav-copy">
              <strong>Workflows</strong>
              <span>Screen-by-screen walkthroughs</span>
            </span>
          </button>
          <button
            type="button"
            className={`help-mini-nav-button ${activeSection === 'shipping' ? 'active' : ''}`}
            onClick={() => jumpToSection('shipping')}
          >
            <span className="help-mini-nav-index">03</span>
            <span className="help-mini-nav-copy">
              <strong>Shipping</strong>
              <span>Output, export, and docs</span>
            </span>
          </button>
        </div>

        <div className="help-content">
          <section ref={overviewRef} className="help-anchor-section help-anchor-section-overview">
            <div className="help-section-heading">
              <span className="fix-step-kicker">Section 1</span>
              <div>
                <h2>Overview</h2>
                <p>Use this section to choose the fastest screen for the current SKU, image, or audit task.</p>
              </div>
            </div>

            <div className="help-panel-stack">
              <div className="help-panel-grid help-panel-grid-overview">
                {CORE_ROUTES.map((route) => {
                  const Icon = route.icon

                  return (
                    <div key={route.title} className="help-card help-route-card">
                      <div className="help-card-icon"><Icon size={18} /></div>
                      <strong>{route.title}</strong>
                      <p>{route.summary}</p>
                      {'target' in route && route.target ? (
                        <button className="secondary-btn help-inline-action" onClick={() => onNavigate?.(route.target)}>
                          <ArrowRight size={15} />Open {route.title}
                        </button>
                      ) : null}
                    </div>
                  )
                })}
              </div>

              <div className="help-panel-grid help-panel-grid-split">
                <div className="help-card help-list-card">
                  <div className="help-card-header">
                    <CheckCircle size={18} />
                    <div>
                      <strong>Fast Orientation</strong>
                      <span>Use this when opening the app cold.</span>
                    </div>
                  </div>
                  <ol className="help-ordered-list">
                    {QUICK_START_STEPS.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                </div>

                <div className="help-card help-callout-card">
                  <span className="fix-workspace-label">Operator Rule</span>
                  <strong>Do not start in Fix Studio if you still need the verdict.</strong>
                  <p>
                    Compliance answers whether the image passes. Fix Studio corrects the frame. Product Workspace is the route for a complete listing package or competitor comparison.
                  </p>
                  <div className="help-inline-note">
                    <ArrowRight size={15} /> If the question is “what do I publish?”, use Product Workspace. If it is “will this pass?”, use Compliance. If it is “how do I fix this image?”, use Fix Studio.
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section ref={workflowsRef} className="help-anchor-section help-anchor-section-workflows">
            <div className="help-section-heading">
              <span className="fix-step-kicker">Section 2</span>
              <div>
                <h2>Workflow Walkthroughs</h2>
                <p>Each card maps one live workflow to a preview, a practical path, and a direct route into the current screen.</p>
              </div>
            </div>

            <div className="help-panel-grid help-panel-grid-workflows">
              {WORKFLOW_GUIDES.map((workflow) => {
                const Icon = workflow.icon

                return (
                  <div key={workflow.title} className="help-card help-workflow-card">
                    <div className="help-card-header">
                      <Icon size={18} />
                      <div>
                        <strong>{workflow.title}</strong>
                        <span>{workflow.summary}</span>
                      </div>
                    </div>

                    <div className="help-shot-card" aria-label={`${workflow.title} preview`}>
                      <div className="help-shot-window">
                        <div className="help-shot-topbar">
                          <span />
                          <span />
                          <span />
                        </div>
                        <div className="help-shot-body">
                          <div className="help-shot-badge">{workflow.preview.badge}</div>
                          <strong>{workflow.preview.title}</strong>
                          <div className="help-shot-chip-row">
                            {workflow.preview.chips.map((chip) => (
                              <span key={chip} className="help-shot-chip">{chip}</span>
                            ))}
                          </div>
                          <div className="help-shot-lines">
                            {workflow.preview.bars.map((bar) => (
                              <div key={bar} className="help-shot-line">
                                <span className="help-shot-line-fill" />
                                <span>{bar}</span>
                              </div>
                            ))}
                          </div>
                          <div className="help-shot-footer">{workflow.preview.footer}</div>
                        </div>
                      </div>
                    </div>

                    <ol className="help-ordered-list compact">
                      {workflow.steps.map((step) => (
                        <li key={step}>{step}</li>
                      ))}
                    </ol>

                    <button className="action-btn help-nav-action" onClick={() => onNavigate?.(workflow.target)}>
                      <ArrowRight size={16} />{workflow.cta}
                    </button>
                  </div>
                )
              })}
            </div>
          </section>

          <section ref={shippingRef} className="help-anchor-section help-anchor-section-shipping">
            <div className="help-section-heading">
              <span className="fix-step-kicker">Section 3</span>
              <div>
                <h2>Shipping and Output</h2>
                <p>Use this section when the work is moving from analysis into approval, export, automation, or downstream use.</p>
              </div>
            </div>

            <div className="help-panel-stack">
              <div className="help-panel-grid help-panel-grid-shipping">
                {SHIPPING_CARDS.map((card) => {
                  const Icon = card.icon

                  return (
                    <div key={card.title} className="help-card help-list-card">
                      <div className="help-card-header">
                        <Icon size={18} />
                        <div>
                          <strong>{card.title}</strong>
                          <span>What matters when the output leaves the tool.</span>
                        </div>
                      </div>
                      <ul className="help-bullet-list">
                        {card.points.map((point) => (
                          <li key={point}>{point}</li>
                        ))}
                      </ul>
                    </div>
                  )
                })}
              </div>

              <div className="help-card help-command-card">
                <span className="fix-workspace-label">Docs and Automation</span>
                <strong>When the UI path works, the matching backend path usually exists.</strong>
                <p>
                  Use the interactive API docs at <code>/docs</code> for repeatable automation, integration work, or bulk operations.
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
