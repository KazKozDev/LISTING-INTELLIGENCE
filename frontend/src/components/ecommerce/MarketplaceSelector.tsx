import { ShoppingCart, Monitor, ImageIcon, Ban, Info } from 'lucide-react'

const MARKETPLACES = [
  { id: 'general', name: 'General' },
  { id: 'wildberries', name: 'Wildberries' },
  { id: 'ozon', name: 'Ozon' },
  { id: 'amazon', name: 'Amazon' },
  { id: 'ebay', name: 'eBay' },
]

const MARKETPLACE_RULES: Record<string, {
  resolution: string
  aspect: string
  background: string
  maxSize: string
  forbidden: string[]
  tips: string[]
}> = {
  wildberries: {
    resolution: '900×1200 px min',
    aspect: '3:4',
    background: 'White or transparent',
    maxSize: '10 MB',
    forbidden: ['Watermarks', 'Promo text', 'Collages', 'Other brand logos', 'Price tags'],
    tips: ['4-6 images', 'First photo on white bg', 'Include scale reference'],
  },
  ozon: {
    resolution: '900×1200 px (rec)',
    aspect: '1:1 or 3:4',
    background: 'White recommended',
    maxSize: '10 MB',
    forbidden: ['Watermarks', 'Contact info', 'External URLs', 'Price comparisons'],
    tips: ['Add infographics', 'Lifestyle shots', 'Show packaging'],
  },
  amazon: {
    resolution: '1000×1000 px min',
    aspect: '1:1',
    background: 'Pure white (RGB 255,255,255)',
    maxSize: '10 MB',
    forbidden: ['Text overlays', 'Badges', 'Borders', 'Stickers', 'Watermarks'],
    tips: ['Product fills 85% frame', '7-9 images', 'Include A+ Content'],
  },
  ebay: {
    resolution: '500×500 px min',
    aspect: '1:1',
    background: 'White or neutral',
    maxSize: '12 MB',
    forbidden: ['Stock photos (used items)', 'Frames', 'Text obscuring product'],
    tips: ['Up to 12 images', 'Show condition/defects', 'Include measurements'],
  },
}

interface MarketplaceSelectorProps {
  selected: string
  onSelect: (marketplace: string) => void
  showRules?: boolean
}

export function MarketplaceSelector({ selected, onSelect, showRules = true }: MarketplaceSelectorProps) {
  const rules = MARKETPLACE_RULES[selected]

  return (
    <div className="template-selector">
      <div className="template-label">Target Marketplace</div>
      <div className="template-chips">
        {MARKETPLACES.map(mp => (
          <div
            key={mp.id}
            className={`template-chip ${selected === mp.id ? 'active' : ''}`}
            onClick={() => onSelect(mp.id)}
          >
            <ShoppingCart size={14} style={{ marginRight: '6px' }} />
            {mp.name}
          </div>
        ))}
      </div>

      {showRules && rules && (
        <div className="ecom-rules-card">
          <div className="ecom-rules-header">
            <Info size={14} />
            <span>{MARKETPLACES.find(m => m.id === selected)?.name} Requirements</span>
          </div>
          <div className="ecom-rules-grid">
            <div className="ecom-rule">
              <Monitor size={13} />
              <span className="ecom-rule-label">Resolution</span>
              <span className="ecom-rule-value">{rules.resolution}</span>
            </div>
            <div className="ecom-rule">
              <ImageIcon size={13} />
              <span className="ecom-rule-label">Aspect</span>
              <span className="ecom-rule-value">{rules.aspect}</span>
            </div>
            <div className="ecom-rule">
              <ImageIcon size={13} />
              <span className="ecom-rule-label">Background</span>
              <span className="ecom-rule-value">{rules.background}</span>
            </div>
          </div>
          <div className="ecom-rules-forbidden">
            <Ban size={12} />
            <span>{rules.forbidden.join(' · ')}</span>
          </div>
        </div>
      )}
    </div>
  )
}
