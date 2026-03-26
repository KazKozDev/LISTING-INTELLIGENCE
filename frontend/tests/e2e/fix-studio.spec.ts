import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { expect, test, type Page, type Route } from '@playwright/test'

const PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wn8s1gAAAAASUVORK5CYII='
const PNG_BYTES = Buffer.from(PNG_BASE64, 'base64')
const FIXTURE_FILE_PATH = path.join(os.tmpdir(), 'vision-agent-analyst-fix-studio-fixture.png')

if (!fs.existsSync(FIXTURE_FILE_PATH)) {
  fs.writeFileSync(FIXTURE_FILE_PATH, PNG_BYTES)
}

function extractMultipartField(body: string, fieldName: string): string | null {
  const pattern = new RegExp(`name="${fieldName}"\\r\\n\\r\\n([^\\r]+)`)
  const match = body.match(pattern)
  return match ? match[1] : null
}

async function mockFixStudioApi(page: Page) {
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
            composition_policy: {
              main_image: {
                minimum_fill_ratio: 0.72,
                recommended_fill_ratio: 0.84,
              },
              gallery_image: {
                minimum_fill_ratio: 0.58,
                recommended_fill_ratio: 0.68,
              },
            },
            sources: [],
          },
          {
            id: 'etsy',
            name: 'Etsy',
            min_image_width: 570,
            min_image_height: 456,
            recommended_image_width: 2000,
            recommended_image_height: 1600,
            max_file_size_mb: 10,
            required_background: 'Flexible background',
            aspect_ratio: '4:3',
            allowed_formats: ['PNG', 'JPG'],
            forbidden_elements: ['Heavy watermarks'],
            main_image_rules: ['Readable first image'],
            recommendations: ['Use 4:3 framing'],
            composition_policy: {
              main_image: {
                minimum_fill_ratio: 0.74,
                recommended_fill_ratio: 0.82,
              },
              gallery_image: {
                minimum_fill_ratio: 0.56,
                recommended_fill_ratio: 0.64,
              },
            },
            sources: [],
          },
        ],
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
            id: 'auto-center-ai',
            title: 'Auto Center With AI',
            description: 'Extract the product foreground and place it on a centered white canvas.',
            action: 'auto_center_ai',
            automated: true,
            priority: 'high',
          },
          {
            id: 'pad-square',
            title: 'Pad to square canvas',
            description: 'Center the product on a square canvas.',
            action: 'pad_to_square',
            automated: true,
            priority: 'high',
          },
          {
            id: 'white-background',
            title: 'Place on white background',
            description: 'Flatten on white background.',
            action: 'white_background',
            automated: true,
            priority: 'medium',
          },
          {
            id: 'resize-recommended',
            title: 'Prepare recommended export size',
            description: 'Fit into recommended canvas.',
            action: 'resize_to_recommended',
            automated: true,
            priority: 'medium',
          },
        ],
        timestamp: '2026-03-24T10:00:00.000Z',
      }),
    })
  })

  await page.route('**/api/ecommerce/compliance-fix/apply', async (route: Route) => {
    const requestBody = route.request().postDataBuffer()?.toString('utf8') ?? ''
    const action = extractMultipartField(requestBody, 'action') ?? 'unknown'
    const transformPayloadRaw = extractMultipartField(
      requestBody,
      'transform_payload',
    )
    const payload = transformPayloadRaw ? JSON.parse(transformPayloadRaw) : null
    const imageUsage = payload?.image_usage === 'gallery_image' ? 'gallery_image' : 'main_image'
    const fillRatio = imageUsage === 'gallery_image' ? 0.68 : 0.84

    const scoreByAction: Record<string, number> = {
      auto_center_ai: 9.4,
      pad_to_square: 7.5,
      white_background: 6.5,
      resize_to_recommended: 8.8,
      canvas_transform: 9.1,
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        filename: 'fixture.png',
        fixed_filename: `fixture-${action}.png`,
        marketplace: 'allegro',
        applied_action: action,
        image_data_url: `data:image/png;base64,${PNG_BASE64}#${action}`,
        before_analysis: [
          'Compliance Status: FAIL',
          'Overall Score: 4/10',
          'Issues Found',
          '- Critical: Product not centered',
          '- Warning: Background not compliant',
          'Recommendations',
          '- Center the product',
        ].join('\n'),
        after_analysis: [
          scoreByAction[action] >= 8 ? 'Compliance Status: PASS' : 'Compliance Status: FAIL',
          `Overall Score: ${scoreByAction[action]}/10`,
          'Issues Found',
          ...(scoreByAction[action] >= 8
            ? ['- Info: Minor margin review only']
            : ['- Warning: Minor alignment issue remains']),
          'Recommendations',
          '- Review final export',
        ].join('\n'),
        metadata: {
          fix: {
            action,
            payload,
            ai: action === 'auto_center_ai'
              ? {
                  mask_source: 'huggingface',
                  fallback_used: false,
                  fill_ratio: fillRatio,
                  target_class: 'recommended',
                  image_usage: imageUsage,
                }
              : undefined,
          },
        },
        timestamp: `2026-03-24T10:00:0${action === 'canvas_transform' ? '5' : action === 'auto_center_ai' ? '4' : action === 'resize_to_recommended' ? '3' : action === 'white_background' ? '2' : '1'}.000Z`,
        tokens_used: 120,
      }),
    })
  })

  await page.route('**/api/image-intelligence/text', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        total_text_regions: 1,
        has_text: true,
        combined_text: 'SALE',
        text_coverage_ratio: 0.04,
        warnings: [],
        regions: [
          {
            text: 'SALE',
            confidence: 0.98,
            bbox: [10, 10, 50, 50],
            area_ratio: 0.04,
          },
        ],
      }),
    })
  })

  await page.route('**/api/image-intelligence/objects', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        total_count: 1,
        has_watermark: true,
        has_text_overlay: true,
        warnings: [],
        objects: [
          {
            label: 'watermark',
            confidence: 0.95,
            bbox: [12, 12, 48, 48],
            area_ratio: 0.03,
          },
        ],
      }),
    })
  })

  await page.route('**/api/image-intelligence/upscale', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        upscale_recommended: true,
      }),
    })
  })

  await page.route('**/api/image-intelligence/upscale/apply', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'image/png',
      body: PNG_BYTES,
    })
  })

  await page.route('**/api/image-intelligence/relight/apply', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'image/png',
      headers: {
        'X-Relight-Model': 'ic-light-mock',
        'X-Relight-Mask-Source': 'foreground-mask',
      },
      body: PNG_BYTES,
    })
  })

  await page.route('**/api/image-intelligence/outpaint/apply', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'image/png',
      headers: {
        'X-Outpaint-Model': 'runwayml/stable-diffusion-inpainting',
        'X-Outpaint-Direction': 'right',
        'X-Outpaint-Expansion': '0.25',
      },
      body: PNG_BYTES,
    })
  })

  await page.route('**/api/image-intelligence/erase', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'image/png',
      body: PNG_BYTES,
    })
  })
}

async function uploadFixture(page: Page) {
  await page.locator('.section-fix-studio input[type="file"]').setInputFiles(FIXTURE_FILE_PATH)
}

async function openFixStudioWithFixture(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Fix Studio' }).click()
  await uploadFixture(page)
}

function getFixStudioSection(page: Page) {
  return page.locator('.section-fix-studio').first()
}

async function getCanvasTransform(page: Page) {
  return page.locator('.canvas-stage-image').evaluate((element: HTMLImageElement) => {
    return element.style.transform
  })
}

async function getCanvasImageSource(page: Page) {
  return page.locator('.canvas-stage-image').evaluate((element: HTMLImageElement) => {
    return element.getAttribute('src') ?? ''
  })
}

async function increaseCanvasZoom(page: Page, steps: number) {
  const slider = page.getByTestId('canvas-zoom-slider')
  await slider.focus()

  for (let index = 0; index < steps; index += 1) {
    await page.keyboard.press('ArrowRight')
  }
}

async function openExportStep(page: Page) {
  await page.getByTestId('open-export-button').click()
  await expect(page.getByTestId('fix-history-filmstrip')).toBeVisible()
}

async function runAutoCenter(page: Page) {
  await page.getByRole('button', { name: /Auto Center With AI/i }).click()
  await expect(page.getByTestId('open-compare-button')).toBeVisible()
}

test.describe('Fix Studio', () => {
  test.beforeEach(async ({ page }: { page: Page }) => {
    await mockFixStudioApi(page)
  })

  test('allows panning the canvas at zoom 1 before any zoom adjustment', async ({ page }: { page: Page }) => {
    await openFixStudioWithFixture(page)

    const stage = page.getByTestId('canvas-stage')
    await stage.focus()

    const beforeTransform = await getCanvasTransform(page)
    await page.keyboard.press('ArrowRight')

    await expect.poll(async () => getCanvasTransform(page)).not.toBe(beforeTransform)
    await expect(page.getByTestId('canvas-zoom-slider')).toHaveValue('1')
  })

  test('supports drag, zoom, canvas export, top-3 execution, and history selection', async ({ page }: { page: Page }) => {
    await openFixStudioWithFixture(page)
    await expect(page.getByText('Auto Center With AI')).toBeVisible()

    const beforeTransform = await getCanvasTransform(page)

    const stage = page.getByTestId('canvas-stage')
    const box = await stage.boundingBox()
    if (!box) throw new Error('Canvas stage is not visible')

    await stage.focus()
    await page.keyboard.press('ArrowRight')

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2 + 80, box.y + box.height / 2 + 60)
    await page.mouse.up()

    await increaseCanvasZoom(page, 8)
    await stage.focus()
    await page.keyboard.press('ArrowRight')

    await expect.poll(async () => getCanvasTransform(page)).not.toBe(beforeTransform)

    const afterTransform = await getCanvasTransform(page)
    expect(afterTransform).not.toBe(beforeTransform)

    await page.getByTestId('apply-canvas-export-button').click()

    await page.getByRole('button', { name: /Auto Center With AI/i }).click()
    await expect(page.getByText(/Open Compare/i)).toBeVisible()

    const stageSourceBeforeHistorySelection = await getCanvasImageSource(page)

    await page.getByTestId('open-export-button').click()
    await expect(page.getByTestId('fix-history-card')).toHaveCount(2)
    await expect(
      page.getByTestId('fix-history-card').filter({ hasText: /Canvas Export #1/i }).first(),
    ).toBeVisible()
    await expect(
      page.getByTestId('fix-history-card').filter({ hasText: /auto_center_ai/i }).first(),
    ).toBeVisible()

    const firstHistoryCard = page.getByTestId('fix-history-card').filter({ hasText: /Canvas Export #1/i }).first()
    await firstHistoryCard.getByTestId('view-history-result-button').click()

    await expect(page.getByTestId('canvas-stage')).toBeVisible()
    await expect.poll(async () => getCanvasImageSource(page)).not.toBe(stageSourceBeforeHistorySelection)
  })

  test('supports sticky step navigation and keyboard filmstrip selection', async ({ page }: { page: Page }) => {
    await openFixStudioWithFixture(page)

    const studio = getFixStudioSection(page)
    await expect(studio.locator('.fix-studio-stage-panel > .fix-step-header').first()).toBeVisible()

    await page.getByTestId('apply-canvas-export-button').click()
    await runAutoCenter(page)

    await page.getByTestId('open-export-button').click()
    await expect(page.getByTestId('selected-export-title')).toBeVisible()

    const filmstrip = page.getByTestId('fix-history-filmstrip')
    await filmstrip.focus()

    const optionTitles = await filmstrip.locator('[data-testid="fix-history-card"] strong').allTextContents()
    expect(optionTitles.length).toBeGreaterThan(1)

    const selectedTitleBeforeKeyboard = ((await page.getByTestId('selected-export-title').textContent()) ?? '').trim()
    const targetTitle = optionTitles.find((title) => title.trim() !== selectedTitleBeforeKeyboard)?.trim()
    expect(targetTitle).toBeTruthy()

    const keyToUse = optionTitles[0]?.trim() === selectedTitleBeforeKeyboard ? 'End' : 'Home'
    await page.keyboard.press(keyToUse)

    await expect(page.getByTestId('canvas-stage')).toBeVisible()
    await page.getByTestId('open-export-button').click()
    await expect(page.getByTestId('selected-export-title')).toHaveText(targetTitle ?? '')
    await expect(page.getByTestId('fix-history-filmstrip').getByRole('option', { selected: true })).toBeVisible()
  })

  test('switches image usage policy before AI auto-center', async ({ page }: { page: Page }) => {
    await openFixStudioWithFixture(page)

    const studio = getFixStudioSection(page)

    await expect(studio.getByTestId('marketplace-policy-label').first()).toContainText('Main image · recommended · 0.84 fill')
    await expect(studio.getByTestId('image-usage-control')).toContainText('Main image · recommended · 0.84 fill')

    await studio.getByTestId('image-usage-gallery').click()

    await expect(studio.getByTestId('marketplace-policy-label').first()).toContainText('Gallery image · recommended · 0.68 fill')
    await expect(studio.getByTestId('image-usage-control')).toContainText('Gallery image · recommended · 0.68 fill')

    await page.getByRole('button', { name: /Auto Center With AI/i }).click()
    await page.getByTestId('open-compare-button').click()

    await expect(page.getByText(/Usage: gallery_image/i)).toBeVisible()
    await expect(page.getByText(/Fill ratio: 0.68/i)).toBeVisible()
  })

  test('numbers repeated canvas exports and preserves distinct labels', async ({ page }: { page: Page }) => {
    await openFixStudioWithFixture(page)

    const stage = page.getByTestId('canvas-stage')
    await stage.focus()
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('Shift+ArrowDown')
    await increaseCanvasZoom(page, 5)
    await page.getByTestId('apply-canvas-export-button').click()

    await page.getByTestId('canvas-preset').selectOption('minimum')
    await increaseCanvasZoom(page, 12)
    await stage.focus()
    await page.keyboard.press('ArrowLeft')
    await page.getByTestId('apply-canvas-export-button').click()

    await openExportStep(page)
    const historyCards = page.getByTestId('fix-history-card').filter({ hasText: /Canvas Export #/i })
    await expect(historyCards).toHaveCount(2)
    await expect(historyCards.filter({ hasText: /Canvas Export #1/i })).toHaveCount(1)
    await expect(historyCards.filter({ hasText: /Canvas Export #2/i })).toHaveCount(1)
    await expect(historyCards.filter({ hasText: /800x800/i })).toHaveCount(1)
    await expect(historyCards.filter({ hasText: /1200x1200/i })).toHaveCount(1)
  })

  test('supports canvas undo and redo for local composition changes', async ({ page }: { page: Page }) => {
    await openFixStudioWithFixture(page)

    const preset = page.getByTestId('canvas-preset')
    await expect(preset).toHaveValue('recommended')

    await preset.selectOption('minimum')
    await expect(preset).toHaveValue('minimum')

    await page.getByTestId('undo-canvas-button').click()
    await expect(preset).toHaveValue('recommended')

    await page.getByTestId('redo-canvas-button').click()
    await expect(preset).toHaveValue('minimum')
  })

  test('restores the persisted canvas draft after reload for the same file and marketplace', async ({ page }: { page: Page }) => {
    await openFixStudioWithFixture(page)

    const stage = page.getByTestId('canvas-stage')
    await stage.focus()
    await page.getByTestId('canvas-preset').selectOption('minimum')
    await increaseCanvasZoom(page, 12)
    await expect.poll(async () => page.getByTestId('canvas-zoom-slider').inputValue()).not.toBe('1')
    const expectedZoom = await page.getByTestId('canvas-zoom-slider').inputValue()
    await stage.focus()
    await page.keyboard.press('ArrowLeft')

    await expect(page.getByTestId('canvas-preset')).toHaveValue('minimum')
    await expect(page.getByTestId('canvas-zoom-slider')).toHaveValue(expectedZoom)

    await page.reload()
    await page.getByRole('button', { name: 'Fix Studio' }).click()
    await uploadFixture(page)

    await expect(page.getByTestId('canvas-preset')).toHaveValue('minimum')
    await expect(page.getByTestId('canvas-zoom-slider')).toHaveValue(expectedZoom)
    await expect.poll(async () => getCanvasTransform(page)).toContain(`scale(${expectedZoom})`)
    const restoredTransform = await getCanvasTransform(page)
    expect(restoredTransform).not.toBe('translate(0px, 0px) scale(1)')
    expect(restoredTransform.startsWith('translate(-')).toBeTruthy()
  })

  test('loads cached auto-center result and still updates the workspace stage image', async ({ page }: { page: Page }) => {
    await openFixStudioWithFixture(page)

    const initialStageSource = await getCanvasImageSource(page)
    await runAutoCenter(page)

    const firstAutoCenterSource = await getCanvasImageSource(page)
    expect(firstAutoCenterSource).not.toBe(initialStageSource)

    await page.getByTestId('reset-to-original-button').click()
    await expect.poll(async () => getCanvasImageSource(page)).not.toBe(firstAutoCenterSource)

    await runAutoCenter(page)
    await expect(page.getByText(/Loaded from cache/i)).toBeVisible()
    await expect.poll(async () => getCanvasImageSource(page)).not.toBe(initialStageSource)
  })

  test('updates the workspace stage after LaMa cleanup, relight, outpaint, and upscale apply', async ({ page }: { page: Page }) => {
    await openFixStudioWithFixture(page)

    const sourceBeforeCleanup = await getCanvasImageSource(page)
    await page.getByRole('button', { name: /LaMa Cleanup/i }).click()
    await expect.poll(async () => getCanvasImageSource(page)).not.toBe(sourceBeforeCleanup)
    await expect(page.getByText(/Cleanup applied|Cleanup scan complete/i)).toBeVisible()

    const sourceBeforeRelight = await getCanvasImageSource(page)
    await page.getByRole('button', { name: /Studio Relight/i }).click()
    await expect.poll(async () => getCanvasImageSource(page)).not.toBe(sourceBeforeRelight)
    await expect(page.getByText(/Studio relight applied/i)).toBeVisible()

    const sourceBeforeOutpaint = await getCanvasImageSource(page)
    const outpaintCard = page.locator('.fix-action-card').filter({ hasText: /Generative Expand|Canvas expand applied/i }).first()
    await outpaintCard.getByRole('button', { name: /Apply/i }).click()
    await expect.poll(async () => getCanvasImageSource(page)).not.toBe(sourceBeforeOutpaint)
    await expect(page.getByText(/Canvas expand applied/i)).toBeVisible()

    const sourceBeforeUpscale = await getCanvasImageSource(page)
    await page.getByRole('button', { name: /Resolution AI/i }).click()
    await expect(page.getByText(/Low resolution detected/i)).toBeVisible()
    await page.getByRole('button', { name: /Apply Upscale/i }).click()
    await expect.poll(async () => getCanvasImageSource(page)).not.toBe(sourceBeforeUpscale)
    await expect(page.getByRole('button', { name: /Resolution AI/i })).toBeVisible()
  })

  test('keeps workspace stage synced when selecting history after non-fix neural tools changed the image', async ({ page }: { page: Page }) => {
    await openFixStudioWithFixture(page)

    await page.getByRole('button', { name: /Studio Relight/i }).click()
    const relitStageSource = await getCanvasImageSource(page)

    await page.getByTestId('apply-canvas-export-button').click()
    await runAutoCenter(page)
    await openExportStep(page)

    const exportPreviewSourceBeforeHistorySelection = await page.locator('.fix-export-preview-image').evaluate((element: HTMLImageElement) => {
      return element.getAttribute('src') ?? ''
    })
    expect(exportPreviewSourceBeforeHistorySelection).toContain('#auto_center_ai')

    const relightDerivedHistoryCard = page
      .getByTestId('fix-history-card')
      .filter({ hasText: /Canvas Export #1/i })
      .first()

    await relightDerivedHistoryCard.getByTestId('view-history-result-button').click()
    await expect(page.getByTestId('canvas-stage')).toBeVisible()
    await expect.poll(async () => getCanvasImageSource(page)).not.toBe(exportPreviewSourceBeforeHistorySelection)
    await expect.poll(async () => getCanvasImageSource(page)).not.toBe(relitStageSource)
  })
})
