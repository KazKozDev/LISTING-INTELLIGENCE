import type { Config } from '../api/types'

interface SidebarProps {
  activeNav: string
  onNavChange: (id: string) => void
  config: Config | null
}

export function Sidebar({ activeNav, onNavChange, config }: SidebarProps) {
  const githubUrl = 'https://github.com/KazKozDev'
  const navItems = [
    { id: 'ecom-product', label: 'Product Workspace', eyebrow: 'Core workflow' },
    { id: 'ecom-compliance', label: 'Compliance', eyebrow: 'Marketplace rules' },
    { id: 'ecom-fix', label: 'Fix Studio', eyebrow: 'Image operations' },
    { id: 'ecom-tools', label: 'Additional Tools', eyebrow: 'Focused analyses' },
    { id: 'history', label: 'History', eyebrow: 'Past runs' },
    { id: 'settings', label: 'Settings', eyebrow: 'System controls' },
    { id: 'help', label: 'Help', eyebrow: 'Usage guide' },
  ]

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <span className="logo-kicker">Vision workspace</span>
          <div className="logo-lockup" aria-label="Listing Intelligence">
            <span className="logo-text logo-text-primary">LISTING</span>
            <span className="logo-text logo-text-secondary">INTELLIGENCE</span>
          </div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item, index) => {
          const isActive = activeNav === item.id
          const navIndex = String(index + 1).padStart(2, '0')
          return (
            <button
              key={item.id}
              type="button"
              className={`nav-item ${isActive ? 'active' : ''}`}
              onClick={() => onNavChange(item.id)}
              aria-current={isActive ? 'page' : undefined}
            >
              <span className="nav-index" aria-hidden="true">{navIndex}</span>
              <span className="nav-copy">
                <span className="nav-eyebrow">{item.eyebrow}</span>
                <span className="nav-label">{item.label}</span>
              </span>
            </button>
          )
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="provider-info" data-configured={Boolean(config)}>
          <span className="provider-kicker">Built by</span>
          <a
            className="provider-link provider-name"
            href={githubUrl}
            target="_blank"
            rel="noreferrer"
          >
            KazKozDev
          </a>
        </div>
      </div>
    </aside>
  )
}
