import {
  BarChart3, Palette, FileText, FileSpreadsheet,
  ScanSearch, Building2, ShoppingCart, Wallet, File, Plus,
} from 'lucide-react'
import type { Template } from '../api/types'

const getTemplateIcon = (key: string) => {
  if (key.includes('chart')) return BarChart3
  if (key.includes('ui')) return Palette
  if (key.includes('contract') || key.includes('policy')) return FileText
  if (key.includes('invoice') || key.includes('tax')) return FileSpreadsheet
  if (key.includes('resume')) return ScanSearch
  if (key.includes('medical')) return Building2
  if (key.includes('ecommerce')) return ShoppingCart
  if (key.includes('finance')) return Wallet
  return File
}

interface TemplateSelectorProps {
  templates: Template[]
  selected: Template | null
  onSelect: (template: Template) => void
  category: string
}

export function TemplateSelector({ templates, selected, onSelect, category }: TemplateSelectorProps) {
  return (
    <div className="template-selector">
      <div className="template-label">Available Templates</div>
      <div className="template-chips">
        {templates.map(template => {
          const Icon = getTemplateIcon(template.key)
          return (
            <div
              key={template.key}
              className={`template-chip ${selected?.key === template.key ? 'active' : ''}`}
              onClick={() => onSelect(template)}
            >
              <Icon size={14} style={{ marginRight: '6px' }} />
              {template.name}
            </div>
          )
        })}
        <div
          className="template-chip add-new"
          onClick={() => {
            const name = prompt(`Enter name for new ${category} template:`)
            if (name) alert(`Template "${name}" created! (Persistence not yet implemented)`)
          }}
        >
          <Plus size={14} style={{ marginRight: '6px' }} />
          New Template
        </div>
      </div>
    </div>
  )
}
