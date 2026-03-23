import {
  ScanSearch, ShoppingCart,
  History, Settings, HelpCircle, Eye,
  Tag, ShieldCheck, Package, GitCompareArrows, Wrench,
} from 'lucide-react'
import type { Config } from '../api/types'

export const navItems = [
  { id: 'analyze', icon: ScanSearch, label: 'Smart Analyze' },
  { id: 'ecommerce', icon: ShoppingCart, label: 'E-commerce' },
  { id: 'history', icon: History, label: 'History' },
  { id: 'settings', icon: Settings, label: 'Settings' },
  { id: 'help', icon: HelpCircle, label: 'Help' },
]

const ecommerceSubItems = [
  { id: 'ecom-product', icon: ShoppingCart, label: 'Product Analysis' },
  { id: 'ecom-compliance', icon: ShieldCheck, label: 'Compliance' },
  { id: 'ecom-seo', icon: Tag, label: 'SEO Generator' },
  { id: 'ecom-compare', icon: GitCompareArrows, label: 'Competitor Compare' },
  { id: 'ecom-tools', icon: Wrench, label: 'Tools' },
  { id: 'ecom-bulk', icon: Package, label: 'Bulk Upload' },
]

interface SidebarProps {
  activeNav: string
  onNavChange: (id: string) => void
  config: Config | null
}

export function Sidebar({ activeNav, onNavChange, config }: SidebarProps) {
  const isEcomActive = activeNav === 'ecommerce' || activeNav.startsWith('ecom-')

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <div className="logo-icon"><Eye /></div>
          <span className="logo-text">Vision Agent</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {navItems.map(item => {
          const IconComponent = item.icon
          const isActive = item.id === 'ecommerce'
            ? isEcomActive
            : activeNav === item.id

          return (
            <div key={item.id}>
              <div
                className={`nav-item ${isActive ? 'active' : ''}`}
                onClick={() => onNavChange(item.id === 'ecommerce' ? 'ecom-product' : item.id)}
              >
                <span className="nav-icon"><IconComponent /></span>
                <span>{item.label}</span>
              </div>
              {item.id === 'ecommerce' && isEcomActive && (
                <div className="nav-sub-items">
                  {ecommerceSubItems.map(sub => {
                    const SubIcon = sub.icon
                    return (
                      <div
                        key={sub.id}
                        className={`nav-item nav-sub-item ${activeNav === sub.id ? 'active' : ''}`}
                        onClick={() => onNavChange(sub.id)}
                      >
                        <span className="nav-icon"><SubIcon /></span>
                        <span>{sub.label}</span>
                      </div>
                    )
                  })}
                </div>
              )}
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
  )
}
