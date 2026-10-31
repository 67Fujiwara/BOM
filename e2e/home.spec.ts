import { test, expect, type Page } from '@playwright/test'
import JSZip from 'jszip'

async function fresh(page: Page) {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.goto('/')
}

async function createProject(page: Page, no: string, customer: string, device: string) {
  await page.getByTestId('tab-new').click()
  await page.getByTestId('new-no').fill(no)
  await page.getByTestId('new-customer').fill(customer)
  await page.getByTestId('new-device').fill(device)
  await page.getByTestId('new-submit').click()
}

test('空で始まり、5 つの画面（在庫・購入歴あり・新規作成・作成中・完了案件）に PM は無い', async ({ page }) => {
  await fresh(page)
  await expect(page.getByTestId('screen-active')).toBeVisible()
  await expect(page.getByTestId('project-empty')).toBeVisible()
  for (const t of ['stock', 'history', 'new', 'active', 'done']) await expect(page.getByTestId(`tab-${t}`)).toBeVisible()
  await expect(page.getByTestId('role-design')).toBeVisible()
  await expect(page.getByTestId('role-purchasing')).toBeVisible()
  await expect(page.getByTestId('role-pm')).toHaveCount(0)
  await expect(page.locator('body')).not.toContainText('PM')
})

test('案件登録は番号（例 A123456）・客先・装置名。形式違反と重複は止まる', async ({ page }) => {
  await fresh(page)
  await createProject(page, 'a123456', '〇〇株式会社', '検査装置 1号機')
  await expect(page.getByTestId('project-A123456')).toContainText('〇〇株式会社')
  await expect(page.getByTestId('project-A123456')).toContainText('検査装置 1号機')
  await createProject(page, 'A123456', 'x', 'y')
  await expect(page.getByTestId('new-error')).toContainText('A123456')
  await page.getByTestId('new-no').fill('12345')
  await page.getByTestId('new-submit').click()
  await expect(page.getByTestId('new-error')).toBeVisible()
})

test('在庫の部品をクリック → 数量 → 作成中の案件の番号を選ぶと、その案件に追加される', async ({ page }) => {
  await fresh(page)
  await createProject(page, 'A123456', '〇〇株式会社', '検査装置 1号機')
  await page.getByTestId('tab-stock').click()
  await page.getByTestId('stock-add').click()
  await page.getByTestId('stock-f-name').fill('リレー')
  await page.getByTestId('stock-f-model').fill('MY4N-D2')
  await page.getByTestId('stock-f-maker').fill('オムロン')
  await page.getByTestId('stock-f-qty').fill('10')
  await page.getByTestId('stock-save').click()
  await page.locator('[data-testid^="stock-ST"]').first().click()
  await page.getByTestId('add-qty').fill('3')
  await page.getByTestId('add-project-A123456').click()
  await page.getByTestId('add-submit').click()
  await expect(page.getByTestId('add-done')).toBeVisible()
  await page.getByTestId('add-open-project').click()
  await expect(page.getByTestId('header')).toContainText('A123456')
  // 在庫から入れた行は 在庫 のビューに出る
  await expect(page.getByTestId('view-1')).toHaveAttribute('aria-current', 'true')
  await expect(page.getByTestId('row')).toHaveCount(1)
  await expect(page.getByTestId('row')).toContainText('MY4N-D2')
  // 在庫の画面に戻ると引当が出る
  await page.getByTestId('tab-stock').click()
  await expect(page.getByTestId('stock-table')).toContainText('3')
})

test('購入歴あり: サンプルの履歴から数量を決めて作成中の案件に追加できる', async ({ page }) => {
  await fresh(page)
  await page.getByTestId('add-sample').click()
  await page.getByTestId('tab-history').click()
  await expect(page.getByTestId('history-table')).toBeVisible()
  await page.locator('[data-testid="history-table"] tbody tr').first().click()
  await page.getByTestId('add-qty').fill('2')
  await page.locator('[data-testid^="add-project-"]').first().click()
  await page.getByTestId('add-submit').click()
  await expect(page.getByTestId('add-done')).toBeVisible()
})

test('完了にすると完了案件へ移り、作成中に戻せる', async ({ page }) => {
  await fresh(page)
  await createProject(page, 'B000001', '△△工業', '組立機')
  await page.getByTestId('complete-B000001').click()
  await expect(page.getByTestId('project-B000001')).toHaveCount(0)
  await page.getByTestId('tab-done').click()
  await expect(page.getByTestId('project-B000001')).toBeVisible()
  await page.getByTestId('reopen-B000001').click()
  await page.getByTestId('tab-active').click()
  await expect(page.getByTestId('project-B000001')).toBeVisible()
})

test('開いた案件はリロードしても同じ案件から続けられ、一覧へ戻れる', async ({ page }) => {
  await fresh(page)
  await createProject(page, 'C000001', '□□', '搬送機')
  await page.getByTestId('open-C000001').click()
  await expect(page.getByTestId('header')).toContainText('C000001')
  await page.waitForTimeout(500)
  await page.reload()
  await expect(page.getByTestId('header')).toContainText('C000001')
  await page.getByTestId('tab-active').click()
  await expect(page.getByTestId('screen-active')).toBeVisible()
})

test('Panel Studio の設計完了の部品表（JSON）から案件と部品の行を取り込める', async ({ page }) => {
  await fresh(page)
  await page.getByTestId('tab-new').click()
  const bom = {
    format: 'panel-studio/bom',
    version: 1,
    job: { company: '〇〇株式会社', jobNo: 'A123456', owner: '山田', completedAt: '2026-10-29', note: '' },
    deviceName: '検査装置 1号機',
    lines: [
      { model: 'MY4N-D2 DC24V', maker: 'オムロン', name: 'リレー', qty: 4, unit: '個', source: 'device' },
      { model: 'TS35 （必要長 1200mm）', maker: '', name: 'DINレール', qty: 2, unit: '本', source: 'derived' },
    ],
  }
  await page.getByTestId('ps-file').setInputFiles({ name: 'A123456_bom.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(bom)) })
  await expect(page.getByTestId('ps-preview')).toContainText('部品 2 行')
  await expect(page.getByTestId('ps-no')).toHaveValue('A123456')
  await expect(page.getByTestId('ps-customer')).toHaveValue('〇〇株式会社')
  await page.getByTestId('ps-go').click()
  await expect(page.getByTestId('header')).toContainText('A123456')
  await expect(page.getByTestId('header')).toContainText('検査装置 1号機')
  await expect(page.getByTestId('row')).toHaveCount(2)
  await expect(page.getByTestId('row').first()).toContainText('MY4N-D2')
  // 同じ案件番号でもう一度読むと、同じ型式の行は飛ばして追加になる
  await page.getByTestId('tab-new').click()
  await page.getByTestId('ps-file').setInputFiles({ name: 'A123456_bom.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(bom)) })
  await expect(page.getByTestId('ps-go')).toContainText('案件に追加')
  // 図面用のファイルは理由を出して断る
  await page.getByTestId('ps-file').setInputFiles({ name: 'x_electracad.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ format: 'panel-studio/electracad-sheets' })) })
  await expect(page.getByTestId('ps-error')).toContainText('_bom.json')
})

test('設計完了の ZIP をそのまま選んでも、中の _bom.json を読める', async ({ page }) => {
  await fresh(page)
  await page.getByTestId('tab-new').click()
  const zip = new JSZip()
  zip.file('A200001/A200001_electracad.json', JSON.stringify({ format: 'panel-studio/electracad-sheets' }))
  zip.file('A200001/A200001_bom.json', JSON.stringify({ format: 'panel-studio/bom', version: 1, job: { company: '△△工業', jobNo: 'A200001' }, deviceName: '組立機', lines: [{ model: 'F-5A', maker: 'ミスミ', name: 'ヒューズ', qty: 10, unit: '個', source: 'device' }] }))
  const buffer = await zip.generateAsync({ type: 'nodebuffer' })
  await page.getByTestId('ps-file').setInputFiles({ name: 'A200001_dxf.zip', mimeType: 'application/zip', buffer })
  await expect(page.getByTestId('ps-no')).toHaveValue('A200001')
  await page.getByTestId('ps-go').click()
  await expect(page.getByTestId('row')).toHaveCount(1)
})

test('不要な列を非表示に設定でき、全ビューに効いて、リロードしても残る。「初めの表示に戻す」で戻る', async ({ page }) => {
  await fresh(page)
  await page.getByTestId('add-sample').click()
  await page.locator('[data-testid^="open-"]').first().click()
  const th = (label: string) => page.locator('thead th', { hasText: label })
  await expect(th('備考')).toBeVisible()
  await expect(th('回路記号')).toHaveCount(0) // 「すべて」の初めの表示では隠れている
  await page.getByTestId('cols-button').click()
  await expect(page.getByTestId('columns')).toBeVisible()
  await page.getByTestId('col-note').click()
  await page.getByTestId('col-ref').click() // 隠れていた列を出す
  await page.keyboard.press('Escape')
  await expect(th('備考')).toHaveCount(0)
  await expect(th('回路記号')).toBeVisible()
  await expect(page.getByTestId('cols-button')).toContainText('1 件')
  // 列が決まっている別のビュー（2 購買提出用には備考がある）でも隠れたまま
  await page.locator('.gridwrap').focus()
  await page.keyboard.press('2')
  await expect(th('部品名')).toBeVisible()
  await expect(th('備考')).toHaveCount(0)
  // リロードしても残る
  await page.waitForTimeout(400)
  await page.reload()
  await expect(th('部品名')).toBeVisible()
  await expect(th('備考')).toHaveCount(0)
  // 戻す
  await page.getByTestId('cols-button').click()
  await page.getByTestId('cols-reset').click()
  await page.keyboard.press('Escape')
  await expect(th('備考')).toBeVisible()
})
