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
    summary: 'Primary Listing Intelligence workflow for Core Listing, Compare Mode, marketplace context, keywords, and batch-ready output.',
  },
  {
    title: 'Compliance',
    icon: ShieldCheck,
    target: 'ecom-compliance' as const,
    summary: 'Marketplace photo audit for verdict, severity-ranked issues, policy guidance, and Fix Studio handoff.',
  },
  {
    title: 'Fix Studio',
    icon: WandSparkles,
    target: 'ecom-fix' as const,
    summary: 'Deterministic correction workspace for compose, auto-center, recheck, compare deltas, and approve export.',
  },
  {
    title: 'Additional Tools',
    icon: Layers3,
    target: 'ecom-tools' as const,
    summary: 'Targeted utilities for pricing, review sentiment, competitor insights, keyword gaps, USP extraction, and object scans.',
  },
]

const QUICK_START_STEPS = [
  'Open Product Workspace when you need a full listing package, competitor comparison, or batch processing for multiple SKUs.',
  'Open Compliance first when the question is whether a marketplace image will pass before upload.',
  'Jump into Fix Studio after a failed audit or when the image already needs controlled correction and export review.',
  'Use Additional Tools for narrow tasks such as pricing analysis, competitor insights, keyword gaps, USP extraction, review sentiment, or object scans.',
  'Use History to reopen earlier runs and Settings to verify provider, model, and Fix Studio stack details before shipping.',
]

const WORKFLOW_GUIDES = [
  {
    title: 'Product Workspace Walkthrough',
    icon: Rocket,
    target: 'ecom-product' as const,
    cta: 'Open Product Workspace',
    summary: 'Use this when the output is listing content, quality scoring, comparison, or batch-ready SKU packaging.',
    steps: [
      'Upload one product image for Core Listing, or add multiple images when you want a batch run.',
      'Pick marketplace and keywords before running when channel context or SEO steering matters.',
      'Switch to Compare Mode when you need a side-by-side read against a competitor image.',
      'Review title, bullets, description, search tags, backend keywords, and quality score, then copy or export the output.',
    ],
    preview: {
      badge: 'Primary Flow',
      title: 'Core Listing / Compare',
      chips: ['Listing', 'Compare', 'Batch'],
      bars: ['Marketplace + keyword context', 'Single, compare, or multi-image run', 'Listing output + quality score'],
      footer: 'Best for commercial listing generation',
    },
  },
  {
    title: 'Compliance Walkthrough',
    icon: ShieldCheck,
    target: 'ecom-compliance' as const,
    cta: 'Open Compliance',
    summary: 'Use this when the question is whether the image will pass marketplace rules before upload.',
    steps: [
      'Upload the listing image you want to verify.',
      'Choose the marketplace before running the check so the verdict uses the right rule set.',
      'Read the score, pass or fail decision, issue severity, and rule-specific recommendations.',
      'Open Fix Studio from the next-step card if the image needs deterministic correction instead of only advice.',
    ],
    preview: {
      badge: 'Audit Layer',
      title: 'Marketplace Check',
      chips: ['Verdict', 'Issues', 'Handoff'],
      bars: ['Marketplace selector + image intake', 'Score, issues, and recommendations', 'Open Fix Studio next step'],
      footer: 'Best for pre-upload validation',
    },
  },
  {
    title: 'Fix Studio Walkthrough',
    icon: WandSparkles,
    target: 'ecom-fix' as const,
    cta: 'Open Fix Studio',
    summary: 'Use this when the image needs controlled correction, variant comparison, and approval before export.',
    steps: [
      'Start from a Compliance handoff or upload directly when you already know the image problem.',
      'Compose the frame with preset, zoom, and positioning before running a fix.',
      'Run Auto Center, Recheck Only, or other available fix actions, then compare the result history and deltas.',
      'Approve one variant in Export and download only after checking the visual result and remaining issues.',
    ],
    preview: {
      badge: 'Correction Workspace',
      title: 'Compose → Run → Compare → Export',
      chips: ['Canvas', 'Top Fixes', 'Approval'],
      bars: ['Canvas preset + positioning', 'Variant history + delta review', 'Approval panel + primary export'],
      footer: 'Best for deterministic image correction',
    },
  },
]

const SHIPPING_CARDS = [
  {
    title: 'Input Quality',
    icon: FileSearch,
    points: [
      'Use the highest-resolution source you have; 1000 x 1000 remains the practical floor for most marketplaces.',
      'Keep one product dominant in frame when you want cleaner listing extraction, stronger compare results, and fewer compliance false positives.',
      'White or neutral backgrounds reduce ambiguity before you enter audit or deterministic correction workflows.',
    ],
  },
  {
    title: 'Output Handling',
    icon: Download,
    points: [
      'Use Product Workspace for listing text, keywords, comparisons, and batch-friendly outputs; use Fix Studio for approved image exports.',
      'Use History when you need to reopen earlier attempts, compare runs, or recover outputs without rerunning the workflow.',
      'In Fix Studio, approve one selected variant in Export before downloading so the final image matches the reviewed delta.',
    ],
  },
  {
    title: 'API and Docs',
    icon: BookOpen,
    points: [
      'Interactive REST documentation is available at /docs when the backend is running.',
      'Frontend routes and API flows mirror each other closely, so a working UI path usually has a matching endpoint.',
      'Start automation with Product Workspace or Compliance endpoints before chaining batch or image-correction workflows.',
      'Use the UI first to validate prompts, marketplaces, and output shape before wiring the same path into scripts.',
    ],
  },
]

export function HelpSection({ onNavigate }: HelpSectionProps) {
  const [activeSection, setActiveSection] = useState<HelpSectionId>('overview')
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

    updateActiveSection()
    window.addEventListener('scroll', updateActiveSection, { passive: true })
    window.addEventListener('resize', updateActiveSection)

    return () => {
      window.removeEventListener('scroll', updateActiveSection)
      window.removeEventListener('resize', updateActiveSection)
    }
  }, [])

  return (
    <>
      <div className="hero-header-row hero-header-stacked">
        <span className="hero-kicker">Usage guide</span>
        <h1 className="hero-title hero-title-inline">Help Center</h1>
        <p className="hero-subtitle hero-subtitle-inline">Pick the right starting point</p>
      </div>

      <div className="help-shell">
        <div className="help-hero-panel">
          <div className="help-hero-copy">
            <span className="fix-workspace-label">Control Guide</span>
            <strong>Start with the right screen so you do not solve the wrong problem.</strong>
            <span>
              Listing Intelligence starts in Product Workspace for full listing work, branches to Compliance for marketplace audits, and moves into Fix Studio for deterministic image correction.
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
                <p>Use this as the routing layer when you need to choose the fastest screen for the current SKU, image, or audit task.</p>
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
                  <strong>Do not start in Fix Studio when you still need the verdict.</strong>
                  <p>
                    Compliance tells you whether the image passes. Fix Studio corrects the frame and export path. Product Workspace remains the canonical route when the goal is a complete listing package or competitor comparison.
                  </p>
                  <div className="help-inline-note">
                    <ArrowRight size={15} /> If the question is “what do I publish?”, use Product Workspace. If the question is “will this pass?”, use Compliance. If the question is “how do I fix this exact image?”, use Fix Studio.
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
                <p>Each card maps one live workflow to a visual preview, a practical path, and a direct route into the current screen.</p>
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
                <p>Use this section when the work is moving from analysis into approval, export, automation, or downstream operations.</p>
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
                          <span>What matters when the output needs to leave the tool.</span>
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
                <strong>When the UI path works, the matching backend path usually exists too.</strong>
                <p>
                  Use the interactive API docs at <code>/docs</code> for repeatable automation, integration work, or bulk operations that should not stay manual.
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </>
  )
}