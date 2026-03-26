export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function parseSections(text: string): Record<string, string> {
  const sections: Record<string, string> = {}
  const lines = text.split('\n')
  let currentKey = ''
  let currentContent: string[] = []

  for (const line of lines) {
    const headerMatch = line.match(/^\*{0,2}(\d+\.\s*)?(.+?):\*{0,2}\s*(.*)$/)
    if (headerMatch && !line.startsWith(' ') && !line.startsWith('\t')) {
      if (currentKey) sections[currentKey] = currentContent.join('\n').trim()
      currentKey = headerMatch[2].trim().toLowerCase()
      currentContent = headerMatch[3] ? [headerMatch[3]] : []
    } else {
      currentContent.push(line)
    }
  }

  if (currentKey) sections[currentKey] = currentContent.join('\n').trim()
  return sections
}

export function extractList(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.replace(/^[-•*\d.)\s]+/, '').trim())
    .filter((line) => line.length > 3)
}

export function extractTags(text: string, maxTags: number = 20): string[] {
  const tags: string[] = []

  for (const line of text.split('\n')) {
    const cleaned = line.replace(/^[-•*\d.)\s]+/, '').trim()
    if (cleaned.length > 1 && cleaned.length < 60) {
      cleaned.split(/[,;]/).forEach((value) => {
        const tag = value.trim().replace(/^["']|["']$/g, '')
        if (tag.length > 1) tags.push(tag)
      })
    }
  }

  return tags.slice(0, maxTags)
}

export function extractScore(text: string): number | null {
  const match = text.match(/(\d+(?:\.\d+)?)\s*(?:\/\s*10|out of 10)/i)
  return match ? parseFloat(match[1]) : null
}

function stripMarkdownListMarker(line: string): string {
  return line
    .replace(/^\s*(?:[-•]|\d+[.)])\s+/, '')
    .replace(/^\s*\*\s+/, '')
}

function normalizeSeverityMarkdown(text: string): string {
  const severityMatch = text.match(/^(critical|warning|info)\*\*:\s*/i)
  if (!severityMatch) {
    return text
  }

  const severity = severityMatch[1]
  return text.replace(/^(critical|warning|info)\*\*:\s*/i, `**${severity.charAt(0).toUpperCase()}${severity.slice(1).toLowerCase()}**: `)
}

export interface ComplianceIssue {
  severity: 'critical' | 'warning' | 'info'
  text: string
}

export interface ComplianceSummary {
  status: 'pass' | 'fail' | 'unknown'
  score: number | null
  issues: ComplianceIssue[]
  recommendations: string[]
}

export interface ComplianceDeltaSummary {
  trend: 'improved' | 'regressed' | 'unchanged'
  statusChanged: boolean
  beforeStatus: ComplianceSummary['status']
  afterStatus: ComplianceSummary['status']
  beforeScore: number | null
  afterScore: number | null
  scoreDelta: number | null
  resolvedIssues: string[]
  newIssues: string[]
  remainingIssues: number
  criticalIssuesAfter: number
  recommendationsDelta: number
}

export interface RankedComplianceDelta {
  summary: ComplianceDeltaSummary
  score: number
}

export function parseCompliance(text: string): ComplianceSummary {
  const isPassing = /compliance\s*status[:\s]*pass/i.test(text) || /\bPASS\b/.test(text)
  const isFailing = /compliance\s*status[:\s]*fail/i.test(text) || /\bFAIL\b/.test(text)
  const status: ComplianceSummary['status'] = isPassing ? 'pass' : isFailing ? 'fail' : 'unknown'

  const scoreMatch = text.match(/(?:overall\s*score|score)[:\s]*(\d+(?:\.\d+)?)\s*(?:\/\s*10|out of 10)/i)
  const score = scoreMatch ? parseFloat(scoreMatch[1]) : null

  const issues: ComplianceIssue[] = []
  const recommendations: string[] = []

  let section = ''
  for (const line of text.split('\n')) {
    const lower = line.toLowerCase()
    if (lower.includes('issues found') || lower.includes('issue')) {
      section = 'issues'
      continue
    }
    if (lower.includes('recommendation')) {
      section = 'recommendations'
      continue
    }
    if (lower.includes('overall score') || lower.includes('compliance status')) {
      section = ''
      continue
    }

    const cleaned = stripMarkdownListMarker(line).trim()
    if (!cleaned || cleaned.length < 3) continue

    if (section === 'issues') {
      const normalizedIssueText = normalizeSeverityMarkdown(cleaned)
      let severity: ComplianceIssue['severity'] = 'info'
      if (/critical/i.test(normalizedIssueText)) severity = 'critical'
      else if (/warning/i.test(normalizedIssueText)) severity = 'warning'
      issues.push({ severity, text: normalizedIssueText })
    } else if (section === 'recommendations') {
      recommendations.push(cleaned)
    }
  }

  return { status, score, issues, recommendations }
}

function normalizeIssueText(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim()
}

export function buildComplianceDeltaSummary(
  beforeText: string,
  afterText: string,
): ComplianceDeltaSummary {
  const before = parseCompliance(beforeText)
  const after = parseCompliance(afterText)

  const beforeIssues = new Map(
    before.issues.map((issue) => [normalizeIssueText(issue.text), issue.text]),
  )
  const afterIssues = new Map(
    after.issues.map((issue) => [normalizeIssueText(issue.text), issue.text]),
  )

  const resolvedIssues = Array.from(beforeIssues.entries())
    .filter(([key]) => !afterIssues.has(key))
    .map(([, text]) => text)

  const newIssues = Array.from(afterIssues.entries())
    .filter(([key]) => !beforeIssues.has(key))
    .map(([, text]) => text)

  const scoreDelta =
    before.score !== null && after.score !== null
      ? Number((after.score - before.score).toFixed(1))
      : null

  let trend: ComplianceDeltaSummary['trend'] = 'unchanged'
  if (
    (before.status !== 'pass' && after.status === 'pass')
    || (scoreDelta !== null && scoreDelta > 0)
    || resolvedIssues.length > newIssues.length
  ) {
    trend = 'improved'
  } else if (
    (before.status === 'pass' && after.status !== 'pass')
    || (scoreDelta !== null && scoreDelta < 0)
    || newIssues.length > resolvedIssues.length
  ) {
    trend = 'regressed'
  }

  return {
    trend,
    statusChanged: before.status !== after.status,
    beforeStatus: before.status,
    afterStatus: after.status,
    beforeScore: before.score,
    afterScore: after.score,
    scoreDelta,
    resolvedIssues,
    newIssues,
    remainingIssues: after.issues.length,
    criticalIssuesAfter: after.issues.filter((issue) => issue.severity === 'critical').length,
    recommendationsDelta: after.recommendations.length - before.recommendations.length,
  }
}

export function rankComplianceDelta(
  summary: ComplianceDeltaSummary,
): RankedComplianceDelta {
  let score = 0

  if (summary.afterStatus === 'pass') score += 100
  if (summary.beforeStatus === 'pass' && summary.afterStatus !== 'pass') score -= 100

  if (summary.trend === 'improved') score += 20
  if (summary.trend === 'regressed') score -= 20

  if (summary.scoreDelta !== null) {
    score += summary.scoreDelta * 6
  }

  score += summary.resolvedIssues.length * 10
  score -= summary.newIssues.length * 12
  score -= summary.remainingIssues * 3
  score -= summary.criticalIssuesAfter * 15
  score += summary.recommendationsDelta * 1.5

  return {
    summary,
    score: Number(score.toFixed(1)),
  }
}
