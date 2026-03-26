import { extractList, extractScore, extractTags, parseSections } from './analysis'

function findSection(sections: Record<string, string>, candidates: string[]): string | null {
  return Object.keys(sections).find((key) => candidates.some((candidate) => key.includes(candidate))) ?? null
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

type ProductSectionKey =
  | 'score'
  | 'seoTitle'
  | 'productDescription'
  | 'bulletPoints'
  | 'listingDescription'
  | 'searchTags'
  | 'backendKeywords'
  | 'categorySuggestion'
  | 'attributes'
  | 'improvements'
  | 'packagingReview'
  | 'visualSearchSeo'

interface SectionMatch {
  key: ProductSectionKey
  label: string
  start: number
  contentStart: number
}

const PRODUCT_SECTION_PATTERNS: Array<{ key: ProductSectionKey; labels: string[] }> = [
  { key: 'productDescription', labels: ['product description'] },
  { key: 'score', labels: ['photo quality score', 'quality score', 'overall score'] },
  { key: 'attributes', labels: ['attributes'] },
  { key: 'improvements', labels: ['improvements', 'suggestions', 'recommendations'] },
  { key: 'seoTitle', labels: ['seo title', 'title'] },
  { key: 'bulletPoints', labels: ['bullet points', 'key bullet points', 'bullets'] },
  { key: 'listingDescription', labels: ['full listing description', 'listing description'] },
  { key: 'searchTags', labels: ['search tags', 'seo tags', 'tags'] },
  { key: 'backendKeywords', labels: ['backend keywords'] },
  { key: 'categorySuggestion', labels: ['category suggestion', 'category'] },
  { key: 'packagingReview', labels: ['packaging review', 'packaging critique'] },
  { key: 'visualSearchSeo', labels: ['visual search seo', 'visual search', 'lens seo'] },
]

function extractExplicitProductSections(text: string): Partial<Record<ProductSectionKey, string>> {
  const matches: SectionMatch[] = []

  for (const section of PRODUCT_SECTION_PATTERNS) {
    for (const label of section.labels) {
      const regex = new RegExp(
        `^\\s*(?:#{1,6}\\s*)?(?:\\d+[.)]\\s*)?(?:\\*\\*|__)?${escapeRegExp(label)}(?:\\*\\*|__)?(?:\\s*\\([^\\n)]*\\))?\\s*:?[ \\t]*`,
        'gim',
      )

      for (const match of text.matchAll(regex)) {
        if (match.index === undefined) continue
        matches.push({
          key: section.key,
          label,
          start: match.index,
          contentStart: match.index + match[0].length,
        })
      }
    }
  }

  const orderedMatches = matches
    .sort((a, b) => (a.start - b.start) || (b.label.length - a.label.length))
    .filter((match, index, list) => index === 0 || match.start !== list[index - 1].start)

  const extracted: Partial<Record<ProductSectionKey, string>> = {}

  orderedMatches.forEach((match, index) => {
    const nextStart = orderedMatches[index + 1]?.start ?? text.length
    const content = text.slice(match.contentStart, nextStart).trim()
    if (content && !extracted[match.key]) {
      extracted[match.key] = content
    }
  })

  return extracted
}

function firstNonEmptyLine(text: string): string | null {
  const line = text
    .split('\n')
    .map((value) => value.trim())
    .find(Boolean)

  return line || null
}

export interface ParsedProductAnalysis {
  sections: Record<string, string>
  score: number | null
  seoTitle: string | null
  productDescription: string | null
  bulletPoints: string[]
  listingDescription: string | null
  tags: string[]
  backendKeywords: string | null
  categorySuggestion: string | null
  attributes: string | null
  improvements: string[]
  packagingReview: string | null
  visualSearchSeo: string | null
}

export function parseProductAnalysisContent(text: string): ParsedProductAnalysis {
  const sections = parseSections(text)
  const explicitSections = extractExplicitProductSections(text)

  const qualityKey = findSection(sections, ['quality', 'score'])
  const titleKey = findSection(sections, ['seo title', 'title'])
  const descriptionKey = findSection(sections, ['product description', 'description'])
  const bulletKey = findSection(sections, ['bullet'])
  const listingDescriptionKey = findSection(sections, ['listing description', 'full listing'])
  const tagsKey = findSection(sections, ['search tag', 'tag', 'keyword'])
  const backendKey = findSection(sections, ['backend'])
  const categoryKey = findSection(sections, ['category'])
  const attributesKey = findSection(sections, ['attribute'])
  const improvementsKey = findSection(sections, ['improv', 'suggest', 'recommend'])
  const packagingKey = findSection(sections, ['packaging review', 'packaging critique'])
  const visualSearchKey = findSection(sections, ['visual search seo', 'visual search', 'lens seo'])

  return {
    sections: {
      ...sections,
      ...Object.fromEntries(
        Object.entries(explicitSections).map(([key, value]) => [key, value ?? '']),
      ),
    },
    score: explicitSections.score
      ? extractScore(explicitSections.score)
      : qualityKey
        ? extractScore(sections[qualityKey])
        : null,
    seoTitle: explicitSections.seoTitle
      ? firstNonEmptyLine(explicitSections.seoTitle)
      : titleKey
        ? firstNonEmptyLine(sections[titleKey])
        : null,
    productDescription: explicitSections.productDescription
      ?? (descriptionKey ? sections[descriptionKey] : null),
    bulletPoints: explicitSections.bulletPoints
      ? extractList(explicitSections.bulletPoints)
      : bulletKey
        ? extractList(sections[bulletKey])
        : [],
    listingDescription: explicitSections.listingDescription
      ?? (listingDescriptionKey ? sections[listingDescriptionKey] : null),
    tags: explicitSections.searchTags
      ? extractTags(explicitSections.searchTags)
      : tagsKey
        ? extractTags(sections[tagsKey])
        : [],
    backendKeywords: explicitSections.backendKeywords
      ?? (backendKey ? sections[backendKey] : null),
    categorySuggestion: explicitSections.categorySuggestion
      ?? (categoryKey ? sections[categoryKey] : null),
    attributes: explicitSections.attributes
      ?? (attributesKey ? sections[attributesKey] : null),
    improvements: explicitSections.improvements
      ? extractList(explicitSections.improvements)
      : improvementsKey
        ? extractList(sections[improvementsKey])
        : [],
    packagingReview: explicitSections.packagingReview
      ?? (packagingKey ? sections[packagingKey] : null),
    visualSearchSeo: explicitSections.visualSearchSeo
      ?? (visualSearchKey ? sections[visualSearchKey] : null),
  }
}

export interface ParsedComparisonAnalysis {
  sections: Record<string, string>
  strengths: string[]
  weaknesses: string[]
  competitiveEdge: string | null
  actionItems: string[]
}

export function parseComparisonContent(text: string): ParsedComparisonAnalysis {
  const sections = parseSections(text)
  const strengthsKey = findSection(sections, ['strength'])
  const weaknessesKey = findSection(sections, ['weakness'])
  const edgeKey = findSection(sections, ['edge', 'differentiat'])
  const actionsKey = findSection(sections, ['action', 'recommend'])

  return {
    sections,
    strengths: strengthsKey ? extractList(sections[strengthsKey]) : [],
    weaknesses: weaknessesKey ? extractList(sections[weaknessesKey]) : [],
    competitiveEdge: edgeKey ? sections[edgeKey] : null,
    actionItems: actionsKey ? extractList(sections[actionsKey]) : [],
  }
}