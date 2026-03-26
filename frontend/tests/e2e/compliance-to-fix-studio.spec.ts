import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { expect, test, type Page, type Route } from '@playwright/test'

const PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wn8s1gAAAAASUVORK5CYII='
const PNG_BYTES = Buffer.from(PNG_BASE64, 'base64')
const FIXTURE_FILE_PATH = path.join(os.tmpdir(), 'vision-agent-analyst-compliance-fixture.png')

if (!fs.existsSync(FIXTURE_FILE_PATH)) {
  fs.writeFileSync(FIXTURE_FILE_PATH, PNG_BYTES)
}

async function mockComplianceToStudioApi(page: Page) {
  await page.route('**/api/config', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        provider: 'mock',
        model: 'mock-model',
        temperature: 0,
        max_tokens: 0,
      }),
    })
  })

  await page.route('**/api/ecommerce/marketplaces', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        marketplaces: [
          {
            id: 'allegro',
            name: 'Allegro',
            min_image_width: 800,
            min_image_height: 800,
            recommended_image_width: 1200,
            recommended_image_height: 1200,
            max_file_size_mb: 10,
            required_background: 'White',
            aspect_ratio: '1:1',
            allowed_formats: ['PNG', 'JPG', 'WEBP'],
            forbidden_elements: ['Watermarks'],
            main_image_rules: ['Centered product'],
            recommendations: ['Use square canvas'],
            sources: [],
          },
        ],
      }),
    })
  })

  await page.route('**/api/ecommerce/compliance-check', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        filename: 'fixture.png',
        marketplace: 'allegro',
        analysis: [
          'Compliance Status: FAIL',
          'Overall Score: 4/10',
          'Issues Found',
          '- Critical: Product not centered',
          '- Warning: Background not compliant',
          'Recommendations',
          '- Center the product',
          '- Use compliant white background',
        ].join('\n'),
        timestamp: '2026-03-24T10:05:00.000Z',
        tokens_used: 88,
      }),
    })
  })

  await page.route('**/api/ecommerce/compliance-fix/suggestions', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        filename: 'fixture.png',
        marketplace: 'allegro',
        image_width: 900,
        image_height: 900,
        suggestions: [
          {
            id: 'pad-square',
            title: 'Pad to square canvas',
            description: 'Center the product on a square canvas.',
            action: 'pad_to_square',
            automated: true,
            priority: 'high',
          },
        ],
        timestamp: '2026-03-24T10:05:05.000Z',
      }),
    })
  })
}

async function waitForAppReady(page: Page) {
  await page.locator('.nav-item').first().waitFor()
}

async function openCompliance(page: Page) {
  const checkButton = page.getByRole('button', { name: /Check Compliance/i })
  const fullReportToggle = page.getByTestId('full-report-toggle')
  const issuesToggle = page.getByTestId('issues-toggle')

  if (await fullReportToggle.isVisible().catch(() => false)) {
    return
  }

  if (await issuesToggle.isVisible().catch(() => false)) {
    return
  }

  if (await checkButton.isVisible().catch(() => false)) {
    return
  }

  await page.locator('.nav-item').filter({ hasText: 'Compliance' }).dispatchEvent('click')
  await expect(checkButton).toBeVisible()
}

async function openProductAnalysis(page: Page) {
  await page.locator('.nav-item').filter({ hasText: 'Product Analysis' }).dispatchEvent('click')
  await expect(page.getByRole('heading', { name: 'Product Analysis' })).toBeVisible()
}

test.describe('Compliance to Fix Studio handoff', () => {
  test.beforeEach(async ({ page }: { page: Page }) => {
    await mockComplianceToStudioApi(page)
  })

  test('opens Fix Studio with the same file and marketplace from the compliance CTA', async ({ page }: { page: Page }) => {
    await page.goto('/')
    await waitForAppReady(page)
    await openCompliance(page)
    await page.locator('input[type="file"]').setInputFiles(FIXTURE_FILE_PATH)

    await page.getByRole('button', { name: /Check Compliance/i }).click()
    await expect(page.getByTestId('open-fix-studio-button')).toBeVisible()

    await page.getByTestId('open-fix-studio-button').click()

    await expect(page.getByRole('heading', { name: 'Fix Studio' })).toBeVisible()
    await expect(page.getByTestId('workspace-source-badge')).toHaveText('Opened from Compliance')
    await expect(page.getByText(/vision-agent-analyst-compliance-fixture\.png/).first()).toBeVisible()
    await expect(page.getByText('Compliance handoff')).toBeVisible()

    await page.getByRole('button', { name: /Find Fix Suggestions/i }).click()
    await expect(page.getByText('Pad to square canvas')).toBeVisible()
  })

  test('persists collapsed state for Issues, Recommendations, and Full Report after reload', async ({ page }: { page: Page }) => {
    await page.goto('/')
    await waitForAppReady(page)
    await openCompliance(page)
    await page.locator('input[type="file"]').setInputFiles(FIXTURE_FILE_PATH)

    await page.getByRole('button', { name: /Check Compliance/i }).click()
    await expect(page.getByTestId('issues-body')).toBeVisible()
    await expect(page.getByTestId('recommendations-body')).toBeVisible()

    await page.getByTestId('full-report-toggle').click()
    await expect(page.getByTestId('full-report-body')).toBeVisible()

    await page.getByTestId('issues-toggle').click()
    await page.getByTestId('recommendations-toggle').click()
    await page.getByTestId('full-report-toggle').click()

    await expect(page.getByTestId('issues-body')).toHaveCount(0)
    await expect(page.getByTestId('recommendations-body')).toHaveCount(0)
    await expect(page.getByTestId('full-report-body')).toHaveCount(0)

    await openProductAnalysis(page)
    await openCompliance(page)
    await page.locator('input[type="file"]').setInputFiles(FIXTURE_FILE_PATH)

    await expect(page.getByTestId('issues-toggle')).toHaveAttribute('aria-expanded', 'false')
    await expect(page.getByTestId('recommendations-toggle')).toHaveAttribute('aria-expanded', 'false')
    await expect(page.getByTestId('full-report-toggle')).toHaveAttribute('aria-expanded', 'false')
    await expect(page.getByTestId('issues-body')).toHaveCount(0)
    await expect(page.getByTestId('recommendations-body')).toHaveCount(0)
    await expect(page.getByTestId('full-report-body')).toHaveCount(0)
  })
})