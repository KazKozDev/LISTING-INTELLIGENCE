import {
  ShoppingCart,
  History, Settings, HelpCircle, Eye,
  Tag, ShieldCheck, Package, GitCompareArrows, Wrench,
} from 'lucide-react'
import type { Config } from '../api/types'

export const navItems = [
  { id: 'ecom-product', icon: ShoppingCart, label: 'Product Analysis' },
  { id: 'ecom-compliance', icon: ShieldCheck, label: 'Compliance' },
  { id: 'ecom-seo', icon: Tag, label: 'SEO Generator' },
  { id: 'ecom-compare', icon: GitCompareArrows, label: 'Competitor Compare' },
  { id: 'ecom-tools', icon: Wrench, label: 'Tools' },
  { id: 'ecom-bulk', icon: Package, label: 'Bulk Upload' },
  { id: 'history', icon: History, label: 'History' },
  { id: 'settings', icon: Settings, label: 'Settings' },
  { id: 'help', icon: HelpCircle, label: 'Help' },
]

interface SidebarProps {
  activeNav: string
  onNavChange: (id: string) => void
  config: Config | null
}

export function Sidebar({ activeNav, onNavChange, config }: SidebarProps) {
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
          return (
            <div
              key={item.id}
              className={`nav-item ${activeNav === item.id ? 'active' : ''}`}
              onClick={() => onNavChange(item.id)}
            >
              <span className="nav-icon"><IconComponent /></span>
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
  )
}
