import { useEffect, useState } from 'react'
import { ShoppingCart, Ban, ChevronDown, Info, Link as LinkIcon } from 'lucide-react'

import { api } from '../../api/client'
import type { ImageUsage, MarketplaceInfo } from '../../api/types'

const FALLBACK_MARKETPLACE_RULES: Record<string, MarketplaceInfo> = {
  allegro: {
    id: 'allegro',
    name: 'Allegro',
    min_image_width: 500,
    min_image_height: 500,
    recommended_image_width: 2560,
    recommended_image_height: 2560,
    max_file_size_mb: 26,
    required_background: 'any background allowed if the product is presented clearly',
    aspect_ratio: 'any ratio allowed',
    allowed_formats: ['JPG', 'JPEG', 'PNG', 'WEBP via API/file feed'],
    forbidden_elements: [
      'store text overlays',
      'store logos',
      'contact details',
      'advertising that redirects outside Allegro',
      'photos that do not show the offered product or correct variant',
    ],
    main_image_rules: [
      'The image should accurately present the exact product being sold.',
      'Store-added text and logos are not allowed.',
      'Graphic annotations such as numbers, close-ups, arrows, certificates, and color markings can be used.',
    ],
    recommendations: [
      'Use sRGB to preserve color fidelity.',
      'Keep the longer side at 500 px or more; Allegro scales down anything above 2560 px per side.',
      'Use multiple angles and packaging shots when they help represent the offer.',
    ],
    sources: [
      {
        label: 'Allegro Help: Rules for images in the gallery and in descriptions',
        url: 'https://help.allegro.com/en/sell/a/rules-for-images-in-the-gallery-and-in-descriptions-8dvWB8Y2PIq',
      },
      {
        label: 'Allegro Help: When we can remove a photo from an offer',
        url: 'https://help.allegro.com/en/sell/a/when-we-can-remove-a-photo-from-an-offer-aMloBWa7wu5',
      },
    ],
    notes: 'Some category-specific or distributor-specific exceptions may apply on Allegro.',
  },
  walmart: {
    id: 'walmart',
    name: 'Walmart',
    min_image_width: 1500,
    min_image_height: 1500,
    recommended_image_width: 2200,
    recommended_image_height: 2200,
    max_file_size_mb: 5,
    required_background: 'seamless white (RGB 255,255,255)',
    aspect_ratio: '1:1 square',
    allowed_formats: ['JPEG', 'JPG', 'PNG', 'BMP'],
    forbidden_elements: [
      'watermarks',
      'seller name or seller logo on main image',
      'claims or promotional language',
      'Walmart or other retailer logos',
      'languages other than English',
      'accessories or props not included with the item',
      'sold out or out of stock messages',
    ],
    main_image_rules: [
      'Main images should feature the item on a seamless white background.',
      'Crop the product close to the frame and avoid excessive empty background.',
      'Images must correspond to the product name, type, and key attributes.',
    ],
    recommendations: [
      'Upload at least four images per listing.',
      'Keep all images in focus and professionally lit.',
      'Use 2200x2200 px where possible; 1500x1500 px is the minimum for zoom.',
    ],
    sources: [
      {
        label: 'Walmart Marketplace Learn: Product detail page image guidelines and requirements',
        url: 'https://marketplacelearn.walmart.com/guides/Item%20setup/Item%20content,%20imagery,%20and%20media/Product-detail-page:-Image-guidelines-%26-requirements',
      },
    ],
    notes: 'Walmart notes that some categories have additional image requirements.',
  },
  amazon: {
    id: 'amazon',
    name: 'Amazon',
    min_image_width: 500,
    min_image_height: 500,
    recommended_image_width: 1000,
    recommended_image_height: 1000,
    max_file_size_mb: 10,
    required_background: 'pure white (RGB 255,255,255) for the main image',
    aspect_ratio: 'not fixed; square is common',
    allowed_formats: ['JPEG', 'PNG', 'TIFF', 'non-animated GIF'],
    forbidden_elements: [
      'text overlays',
      'logos',
      'borders or color blocks',
      'watermarks',
      'badges or Amazon-style badges',
      'placeholder images',
      'props or accessories not included with the product',
      'packaging unless it is an important included feature',
    ],
    main_image_rules: [
      'The main image must show the product on a pure white background.',
      'The product should occupy at least 85% of the frame.',
      'Show the entire product and only one unit of it.',
    ],
    recommendations: [
      'Amazon recommends at least six images plus one video.',
      'Use 1000 px or more on the longest side to enable zoom, even though the technical minimum is 500 px.',
      'Keep secondary images accurate and free from Amazon logos or seller-specific claims.',
    ],
    sources: [
      {
        label: 'Amazon Seller Central: Product image guide',
        url: 'https://sellercentral.amazon.com/help/hub/reference/external/G1881?locale=en-US',
      },
    ],
    notes: 'Amazon has category-specific image rules beyond the general product image guide.',
  },
  ebay: {
    id: 'ebay',
    name: 'eBay',
    min_image_width: 500,
    min_image_height: 500,
    recommended_image_width: 1600,
    recommended_image_height: 1600,
    max_file_size_mb: 12,
    required_background: 'white or neutral background recommended, not strictly required',
    aspect_ratio: 'not fixed',
    allowed_formats: ['JPG', 'PNG', 'GIF', 'BMP', 'TIFF'],
    forbidden_elements: [
      'stock photos for used, damaged, or defective items',
      'added borders',
      'added text or marketing artwork',
      'contact details',
      'watermarks',
    ],
    main_image_rules: [
      'Photos should represent the actual item and its real condition.',
      'Used-item listings should show flaws instead of relying on stock imagery.',
      'Images 500 px or larger on the longest side meet eBay\'s minimum; 1600 px is commonly recommended for better detail.',
    ],
    recommendations: [
      'Use your own photos for used, damaged, or defective items.',
      'Show multiple angles and any defects clearly.',
      'Prefer high-resolution images without enlarging small originals.',
    ],
    sources: [
      {
        label: 'eBay Help: Picture policy',
        url: 'https://www.ebay.com/help/policies/listing-policies/picture-policy?id=4370',
      },
      {
        label: 'eBay Seller Center: Photo quality requirements',
        url: 'http://ebaysc.liveplatform.com/m/how-to-take-product-photos/ebay-photo-requirements',
      },
    ],
    notes: 'eBay image restrictions are less rigid on background, but stricter on authenticity for used-item photos.',
  },
  etsy: {
    id: 'etsy',
    name: 'Etsy',
    min_image_width: 570,
    min_image_height: 456,
    recommended_image_width: 2000,
    recommended_image_height: 1600,
    max_file_size_mb: 10,
    required_background: 'no strict white-background requirement; the first image should present the item clearly',
    aspect_ratio: '4:3 horizontal recommended',
    allowed_formats: ['JPG', 'PNG', 'GIF'],
    forbidden_elements: [
      'heavy watermarks',
      'misleading text overlays',
      'graphics that obscure the product',
      'cluttered hero images that hide item detail',
    ],
    main_image_rules: [
      'The first listing photo should clearly show the product and read well in search results.',
      'Etsy listing photos are commonly prepared in a 4:3 horizontal ratio.',
      'Lifestyle backgrounds are allowed, but the item should remain the focal point.',
    ],
    recommendations: [
      'Use 2000 px width for sharp zoomable listing images.',
      'Keep the first image clean and readable at thumbnail size.',
      'Use supporting images for scale, detail, and alternate angles.',
    ],
    sources: [
      {
        label: 'Etsy Seller Handbook: Product photography and listing presentation guidance',
        url: 'https://www.etsy.com/seller-handbook',
      },
      {
        label: 'Etsy Help: Creating a listing',
        url: 'https://help.etsy.com/hc/en-us/sections/360000066268-Creating-a-Listing?segment=selling',
      },
    ],
    notes: 'Etsy is more flexible on backgrounds than Amazon or Walmart, but thumbnail readability and horizontal framing matter more.',
  },
}

const DEFAULT_MARKETPLACES = [
  { id: 'general', name: 'General' },
  { id: 'allegro', name: 'Allegro' },
  { id: 'walmart', name: 'Walmart' },
  { id: 'amazon', name: 'Amazon' },
  { id: 'ebay', name: 'eBay' },
  { id: 'etsy', name: 'Etsy' },
]

function mergeMarketplaces(
  base: Array<{ id: string; name: string }>,
  incoming: Array<{ id: string; name: string }>,
) {
  const seen = new Set<string>()

  return [...base, ...incoming].filter((marketplace) => {
    if (seen.has(marketplace.id)) {
      return false
    }

    seen.add(marketplace.id)
    return true
  })
}

interface MarketplaceSelectorProps {
  selected: string
  onSelect: (marketplace: string) => void
  showRules?: boolean
  selectedImageUsage?: ImageUsage
  selectedTargetClass?: 'minimum' | 'recommended'
  policyLabel?: string | null
  className?: string
}

function MarketplaceBrandIcon({ marketplaceId, name }: { marketplaceId: string; name: string }) {
  if (marketplaceId === 'allegro') {
    return (
      <span className="marketplace-logo marketplace-logo-allegro" aria-hidden="true" title={name}>
        <svg viewBox="0 0 24 24" focusable="false">
          <path d="M5.2 7.1h1.4v9.8H5.2zm3.2 0h1.4v9.8H8.4zm8.8 2.9c1.6 0 2.7 1.1 2.7 2.8v4.1h-1.4v-3.9c0-1-.5-1.5-1.4-1.5-.9 0-1.5.6-1.5 1.5v3.9h-1.4v-3.8c0-1.1-.5-1.6-1.4-1.6-.9 0-1.5.6-1.5 1.6v3.8h-1.4V10h1.3v.9c.4-.6 1.1-1 2-1 .9 0 1.5.4 2 1.1.5-.7 1.3-1.1 2.4-1.1Z" fill="currentColor" />
        </svg>
      </span>
    )
  }

  if (marketplaceId === 'amazon') {
    return (
      <span className="marketplace-logo marketplace-logo-amazon" aria-hidden="true" title={name}>
        <svg viewBox="0 0 24 24" focusable="false">
          <path d="M4.2 16.1c4.1 2.7 9.4 3 14.6.7.5-.2 1 .4.4.8-5.3 4-12.1 4.2-15.5.9-.3-.3.1-.8.5-.6Zm13.9-1.2c-.5-.6-2.9-.3-4-.2-.3.1-.4-.2-.1-.4 2-.9 5.1-.6 5.5-.1.5.5-.1 3.5-1.9 5-.3.2-.5.1-.4-.2.3-.8 1.4-2.5.9-3.1Z" fill="currentColor" />
        </svg>
      </span>
    )
  }

  if (marketplaceId === 'walmart') {
    return (
      <span className="marketplace-logo marketplace-logo-walmart" aria-hidden="true" title={name}>
        <svg viewBox="0 0 24 24" focusable="false">
          <circle cx="12" cy="4.2" r="1.55" fill="currentColor" />
          <circle cx="12" cy="19.8" r="1.55" fill="currentColor" />
          <circle cx="4.2" cy="12" r="1.55" fill="currentColor" />
          <circle cx="19.8" cy="12" r="1.55" fill="currentColor" />
          <circle cx="6.6" cy="6.6" r="1.55" fill="currentColor" />
          <circle cx="17.4" cy="17.4" r="1.55" fill="currentColor" />
        </svg>
      </span>
    )
  }

  if (marketplaceId === 'ebay') {
    return (
      <span className="marketplace-logo marketplace-logo-ebay" aria-hidden="true" title={name}>
        <svg viewBox="0 0 24 24" focusable="false">
          <path d="M5.7 12.1c0-1.9 1.2-3.1 2.9-3.1.6 0 1.3.2 1.8.6V7h1.3v6.1c0 .4 0 .8.1 1.2H10.5l-.1-.6c-.5.5-1.2.8-2 .8-1.6 0-2.7-1-2.7-2.4Zm4.8-.1c0-1.1-.7-1.8-1.7-1.8-1 0-1.7.7-1.7 1.8s.7 1.8 1.7 1.8c1 0 1.7-.7 1.7-1.8Zm2.4.5c0-2.1 1.5-3.5 3.7-3.5 1.4 0 2.6.6 3.1 1.9l-1.2.3c-.3-.7-.9-1-1.8-1-1.2 0-2 .7-2.1 1.8h5.2v.4c0 2-1.3 3.3-3.4 3.3-2.2 0-3.5-1.2-3.5-3.2Zm1.4-.5h3.8c-.1-1-.7-1.6-1.8-1.6-1 0-1.7.6-2 1.6Z" fill="currentColor" />
        </svg>
      </span>
    )
  }

  if (marketplaceId === 'etsy') {
    return (
      <span className="marketplace-logo marketplace-logo-etsy" aria-hidden="true" title={name}>
        <svg viewBox="0 0 24 24" focusable="false">
          <path d="M7.1 4.4c0-.4.1-.6.7-.6h8.3c1.3 0 2 .8 2.4 2.2l.2.9h.9l.2-3.1s-1.8.2-3.3.2H6.3L3.5 3.8v1l1.4.2c.8.1 1 .3 1 .9 0 0 .1 2 .1 6 0 3.8-.1 5.9-.1 5.9 0 .7-.3.9-1.1 1.1l-1.3.2V20l3.6-.1h8.1c1.7 0 4.1.1 4.1.1.1-.8.4-3.7.5-4.2H19l-.9 1.8c-.7 1.4-1.6 1.6-2.8 1.6h-3.5c-1.1 0-1.7-.4-1.7-1.4v-4.7h2.8c1.2 0 1.5.3 1.7 1.1l.2.9h.9v-4.8h-.9l-.2.8c-.2.8-.5 1.1-1.7 1.1h-2.8V5.2h3.7c1.2 0 1.8.2 2.3 1.4l.7 1.5h1l-.2-2.1c-1.2 0-2.7.1-3.9.1H7.1Z" fill="currentColor" />
        </svg>
      </span>
    )
  }

  return <ShoppingCart size={14} aria-hidden="true" />
}

export function MarketplaceSelector({
  selected,
  onSelect,
  showRules = true,
  selectedImageUsage = 'main_image',
  selectedTargetClass = 'recommended',
  policyLabel = null,
  className = '',
}: MarketplaceSelectorProps) {
  const [marketplaces, setMarketplaces] = useState<Array<{ id: string; name: string }>>(DEFAULT_MARKETPLACES)
  const [rulesByMarketplace, setRulesByMarketplace] = useState<Record<string, MarketplaceInfo>>(FALLBACK_MARKETPLACE_RULES)
  const [isRulesOpen, setIsRulesOpen] = useState(false)

  useEffect(() => {
    let active = true

    api.getMarketplaces()
      .then((response) => {
        if (!active) return

        setMarketplaces(
          mergeMarketplaces(
            DEFAULT_MARKETPLACES,
            response.marketplaces.map(({ id, name }) => ({ id, name })),
          )
        )
        setRulesByMarketplace(
          {
            ...FALLBACK_MARKETPLACE_RULES,
            ...Object.fromEntries(
              response.marketplaces.map((marketplace) => [marketplace.id, marketplace])
            ),
          }
        )
      })
      .catch(() => {
        if (!active) return
        setRulesByMarketplace(FALLBACK_MARKETPLACE_RULES)
      })

    return () => {
      active = false
    }
  }, [])

  const rules = rulesByMarketplace[selected]
  const resolution = rules
    ? `${rules.min_image_width}×${rules.min_image_height} px min${rules.recommended_image_width && rules.recommended_image_height ? ` · ${rules.recommended_image_width}×${rules.recommended_image_height} preferred` : ''}`
    : ''
  const formatAndSize = rules
    ? `${rules.allowed_formats.join(', ')} · ${rules.max_file_size_mb} MB`
    : ''
  const computedPolicyLabel = rules?.composition_policy
    ? (() => {
        const usagePolicy = rules.composition_policy[selectedImageUsage] ?? rules.composition_policy.main_image
        const fillRatio = selectedTargetClass === 'minimum'
          ? usagePolicy.minimum_fill_ratio
          : usagePolicy.recommended_fill_ratio
        const usageLabel = selectedImageUsage === 'gallery_image' ? 'Gallery image' : 'Main image'
        return `${usageLabel} · ${selectedTargetClass} · ${fillRatio.toFixed(2)} fill`
      })()
    : null
  const visiblePolicyLabel = policyLabel ?? computedPolicyLabel

  useEffect(() => {
    setIsRulesOpen(false)
  }, [selected])

  return (
    <div className={`template-selector ${className}`.trim()}>
      <div className="template-chips">
        {marketplaces.map(mp => (
          <div
            key={mp.id}
            className={`template-chip ${selected === mp.id ? 'active' : ''}`}
            onClick={() => onSelect(mp.id)}
          >
            <MarketplaceBrandIcon marketplaceId={mp.id} name={mp.name} />
            {mp.name}
          </div>
        ))}
      </div>

      {showRules && rules && (
        <div className="ecom-rules-card">
          <button
            type="button"
            className="ecom-rules-header ecom-rules-toggle"
            onClick={() => setIsRulesOpen((currentValue) => !currentValue)}
            aria-expanded={isRulesOpen}
          >
            <span className="ecom-rules-title">
              <Info size={14} />
              <span>{marketplaces.find(m => m.id === selected)?.name} Requirements</span>
            </span>
            <span className={`ecom-rules-toggle-icon ${isRulesOpen ? 'open' : ''}`}>
              <ChevronDown size={15} />
            </span>
          </button>
          {isRulesOpen && (
            <>
              <div className="ecom-rules-grid">
                <div className="ecom-rule">
                  <span className="ecom-rule-label">Resolution</span>
                  <span className="ecom-rule-value">{resolution}</span>
                </div>
                <div className="ecom-rule">
                  <span className="ecom-rule-label">Aspect</span>
                  <span className="ecom-rule-value">{rules.aspect_ratio ?? 'Varies'}</span>
                </div>
                <div className="ecom-rule">
                  <span className="ecom-rule-label">Background</span>
                  <span className="ecom-rule-value">{rules.required_background}</span>
                </div>
                <div className="ecom-rule">
                  <span className="ecom-rule-label">Formats / Size</span>
                  <span className="ecom-rule-value">{formatAndSize}</span>
                </div>
                {visiblePolicyLabel && (
                  <div className="ecom-rule" data-testid="marketplace-policy-label">
                    <span className="ecom-rule-label">Framing Policy</span>
                    <span className="ecom-rule-value">{visiblePolicyLabel}</span>
                  </div>
                )}
              </div>
              <div className="ecom-rules-forbidden">
                <Ban size={12} />
                <span>{rules.forbidden_elements.join(' · ')}</span>
              </div>
              {rules.main_image_rules.length > 0 && (
                <div className="ecom-rules-forbidden" style={{ marginTop: '0.65rem' }}>
                  <Info size={12} />
                  <span>{rules.main_image_rules.slice(0, 3).join(' · ')}</span>
                </div>
              )}
              {rules.sources.length > 0 && (
                <div className="ecom-rules-forbidden" style={{ marginTop: '0.65rem', flexWrap: 'wrap' }}>
                  <LinkIcon size={12} />
                  <span>
                    {rules.sources.map((source, index) => (
                      <span key={source.url}>
                        <a href={source.url} target="_blank" rel="noreferrer">{source.label}</a>
                        {index < rules.sources.length - 1 ? ' · ' : ''}
                      </span>
                    ))}
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
