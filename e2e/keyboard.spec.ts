import { test, expect, type Page } from '@playwright/test'

async function open(page: Page, role: 'design' | 'purchasing' | 'pm' = 'design') {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.goto('/')
  await expect(page.getByTestId('grid')).toBeVisible()
  if (role !== 'design') {
    const label = role === 'purchasing' ? '購買' : 'PM'
    await page.locator('.role button', { hasText: label }).click()
  }
  await page.locator('.gridwrap').focus()
}

test('80 行の BOM が表示され、ヘッダーにボール別件数と金額が出る', async ({ page }) => {
  await open(page)
  await expect(page.getByTestId('row')).toHaveCount(80)
  await expect(page.getByTestId('lamps')).toContainText('設計待ち')
  await expect(page.getByTestId('money')).toContainText('概算')
  await expect(page.getByTestId('due')).toContainText('必要日')
})

test('矢印・j/k・数字キーで移動とビュー切替ができ、? のヘルプに全キーが載る', async ({ page }) => {
  await open(page)
  await page.keyboard.press('ArrowDown')
  await expect(page.getByTestId('cursor')).toContainText('R001')
  await page.keyboard.press('j')
  await page.keyboard.press('j')
  await expect(page.getByTestId('cursor')).toContainText('R003')
  await page.keyboard.press('k')
  await expect(page.getByTestId('cursor')).toContainText('R002')
  await page.keyboard.press('4')
  await expect(page.getByTestId('view-4')).toHaveAttribute('aria-current', 'true')
  await page.keyboard.press('7')
  await expect(page.getByTestId('view-7')).toHaveAttribute('aria-current', 'true')
  await page.keyboard.press('1')
  await page.keyboard.press('?')
  const help = page.getByTestId('help')
  await expect(help).toBeVisible()
  for (const label of ['コマンドパレットを開く', '公開（自分の未公開の行＋下書き指摘）', '指摘を起票（種別は頭文字）', '推奨（最高スコア）で採用。見積済のみ', '順番に直すモード', '承認 / 受入 / 許可（PM）']) await expect(help).toContainText(label)
  await page.keyboard.press('Escape')
  await expect(help).toBeHidden()
})

test('編集モード中は1キー操作が効かず、Enter で確定して下へ移動し、Ctrl+Z で戻る', async ({ page }) => {
  await open(page)
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Control+g')
  await page.getByTestId('prompt-text').fill('R076')
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('cursor')).toContainText('R076')
  // 部品名セルで Enter → 編集
  await page.keyboard.press('Home')
  while (!(await page.getByTestId('cursor').textContent())!.includes('部品名')) await page.keyboard.press('ArrowRight')
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('mode')).toHaveText('編集')
  await page.keyboard.press('Control+a')
  await page.keyboard.type('a1o2h3')
  await expect(page.getByTestId('cell-editor')).toHaveValue('a1o2h3')
  await expect(page.getByTestId('view-1')).toHaveAttribute('aria-current', 'true') // 1 でビューが変わっていない
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('mode')).toHaveText('ナビ')
  await expect(page.getByTestId('cursor')).toContainText('R077')
  await expect(page.locator('[data-row-id="R076"] td.name')).toHaveText('a1o2h3')
  await page.keyboard.press('Control+z')
  await expect(page.locator('[data-row-id="R076"] td.name')).not.toHaveText('a1o2h3')
})

test('コマンドパレット: 文の形 "R035 採用" で推奨採用が先頭に出て Enter で実行できる', async ({ page }) => {
  await open(page)
  await page.keyboard.press('Control+k')
  await page.getByTestId('palette-input').fill('R035 採用')
  const first = page.getByTestId('palette-list').locator('.item').first()
  await expect(first).toContainText('R035 を')
  await expect(first).toContainText('推奨')
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('toast')).toContainText('R035 を')
  await expect(page.locator('[data-row-id="R035"]')).toContainText('選定済')
})

test('設計: 4 要確認 → n → 直す → Ctrl+Enter で公開すると指摘が対応済になり、購買が x で確認済にできる', async ({ page }) => {
  await open(page)
  await page.keyboard.press('4')
  await page.keyboard.press('n')
  const cur = await page.getByTestId('cursor').textContent()
  expect(cur).toMatch(/R0(16|09|41|54|22)/)
  // R016 型式あいまい → 定格を書き足す
  await page.keyboard.press('Control+g')
  await page.getByTestId('prompt-text').fill('R016')
  await page.keyboard.press('Enter')
  while (!(await page.getByTestId('cursor').textContent())!.includes('型式')) await page.keyboard.press('ArrowRight')
  await page.keyboard.press('Enter')
  await page.keyboard.press('Control+a')
  await page.keyboard.type('CP30-BA 2P 1-M 10A')
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('status')).toContainText('未公開 6 行')
  await page.keyboard.press('Control+Enter')
  await expect(page.getByTestId('prompt-options')).toContainText('直前の Rev に追記')
  await page.keyboard.press('1') // 新しい Rev
  await expect(page.getByTestId('toast')).toContainText('公開しました')
  await expect(page.getByTestId('status')).toContainText('未公開 0 行')
  // 公開後：購買に切り替えて 5 変更あり → x
  await page.locator('.role button', { hasText: '購買' }).click()
  await page.locator('.gridwrap').focus()
  await page.keyboard.press('5')
  await expect(page.locator('[data-row-id="R016"]')).toBeVisible()
  await page.keyboard.press('Control+g')
  await page.getByTestId('prompt-text').fill('R016')
  await page.keyboard.press('Enter')
  await page.keyboard.press(' ')
  await expect(page.getByTestId('issues')).toContainText('対応済')
  await page.keyboard.press('x')
  await expect(page.getByTestId('issues')).toContainText('確認済')
})

test('購買: Shift+I → k → 本文 → Enter で下書き、Ctrl+Enter で発行。設計の 4 に出る', async ({ page }) => {
  await open(page, 'purchasing')
  await page.keyboard.press('Control+g')
  await page.getByTestId('prompt-text').fill('R030')
  await page.keyboard.press('Enter')
  await page.keyboard.press('Shift+I')
  await expect(page.getByTestId('issue-kinds')).toBeVisible()
  await page.keyboard.press('k')
  await page.getByTestId('issue-text').fill('サフィックスが不明')
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('status')).toContainText('未発行 1 件')
  await page.keyboard.press('Control+Enter')
  await expect(page.getByTestId('toast')).toContainText('指摘 1 件')
  await page.locator('.role button', { hasText: '設計' }).click()
  await page.locator('.gridwrap').focus()
  await page.keyboard.press('4')
  await expect(page.locator('[data-row-id="R030"]')).toBeVisible()
})

test('Shift+A で2位商社を選ぶと理由が要り、閾値超なら 7 要決定に載って PM の y で確定する', async ({ page }) => {
  await open(page)
  // 見積済の行を探して開く
  await page.keyboard.press('Control+g')
  await page.getByTestId('prompt-text').fill('R020')
  await page.keyboard.press('Enter')
  await page.keyboard.press('Shift+A')
  await expect(page.getByTestId('adopt')).toBeVisible()
  const n = await page.getByTestId('adopt').locator('.opt').count()
  expect(n).toBeGreaterThan(1)
  await page.keyboard.press(String(n)) // 最下位の商社
  await expect(page.getByTestId('prompt-options')).toBeVisible()
  await page.keyboard.press('1') // 納期
  const toast = await page.getByTestId('toast').textContent()
  const row = page.locator('[data-row-id="R020"]')
  if (toast?.includes('PM')) {
    await expect(row).toContainText('PM承認待ち')
    await page.locator('.role button', { hasText: 'PM' }).click()
    await page.locator('.gridwrap').focus()
    await page.keyboard.press('7')
    await expect(row).toBeVisible()
    await page.keyboard.press('Control+g')
    await page.getByTestId('prompt-text').fill('R020')
    await page.keyboard.press('Enter')
    await page.keyboard.press('y')
    await page.keyboard.press('Enter')
    await expect(page.locator('[data-row-id="R020"]')).toContainText('選定済')
    await expect(page.locator('[data-row-id="R020"]')).not.toContainText('PM承認待ち')
  } else {
    await expect(row).toContainText('選定済')
  }
})

test('新しいBOM ガイドをキーボードだけで通せる', async ({ page }) => {
  await open(page)
  await page.keyboard.press('Control+k')
  await page.getByTestId('palette-input').fill('新しいBOM')
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('wizard')).toBeVisible()
  await page.getByTestId('wizard-id').fill('P-2026-099')
  await page.keyboard.press('Enter')
  await page.getByTestId('wizard-name').fill('テスト盤')
  await page.keyboard.press('Enter')
  await page.getByTestId('wizard-due').fill('未定')
  await page.keyboard.press('Enter')
  await page.getByTestId('wizard-processDays').fill('7')
  await page.keyboard.press('Enter')
  await page.keyboard.press('Enter') // 予算なし
  await page.getByTestId('wizard-buyer').fill('佐藤')
  await page.keyboard.press('Enter')
  await page.keyboard.press(' ') // 商社1
  await page.keyboard.press('Enter')
  await page.keyboard.press('1')
  await page.getByTestId('wizard-paste').fill('制御\tリレー\tMY4N-D2 DC24\tオムロン\t4\t個\tKA1\n制御\tソケット\tPYF14A-E\tオムロン\t4\t個\tKA1S')
  await page.keyboard.press('Control+Enter')
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('header')).toContainText('テスト盤')
  await page.keyboard.press('1')
  await expect(page.getByTestId('row')).toHaveCount(2)
  // 公開
  await page.keyboard.press('Control+Enter')
  await expect(page.getByTestId('toast')).toContainText('公開しました')
  await expect(page.getByTestId('rev-info')).toContainText('Rev.1')
})

test('80 行でキー入力から画面反応まで 50ms 以内（ページ内計測）', async ({ page }) => {
  await open(page)
  await page.keyboard.press('ArrowDown')
  const times = await page.evaluate(async () => {
    const out: number[] = []
    const cursor = () => document.querySelector('[data-testid="cursor"]')!.textContent
    for (let i = 0; i < 30; i++) {
      const before = cursor()
      const t0 = performance.now()
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'j', bubbles: true }))
      await new Promise<void>((resolve) => {
        const check = () => (cursor() !== before ? resolve() : requestAnimationFrame(check))
        requestAnimationFrame(check)
      })
      out.push(performance.now() - t0)
    }
    return out
  })
  const med = [...times].sort((a, b) => a - b)[15]
  console.log('median key→render ms:', med.toFixed(1), times.map((t) => t.toFixed(0)).join(','))
  expect(med).toBeLessThan(50)
})

test('スクリーンショット', async ({ page }) => {
  await open(page)
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Control+g')
  await page.getByTestId('prompt-text').fill('R022')
  await page.keyboard.press('Enter')
  await page.keyboard.press(' ')
  await page.screenshot({ path: 'docs/screenshots/light-detail.png', fullPage: false })
  await page.keyboard.press('Control+k')
  await page.getByTestId('palette-input').fill('R035 採用')
  await page.screenshot({ path: 'docs/screenshots/palette.png' })
  await page.keyboard.press('Escape')
  await page.evaluate(() => { document.documentElement.dataset.theme = 'dark' })
  await page.keyboard.press('7')
  await page.locator('.role button', { hasText: 'PM' }).click()
  await page.screenshot({ path: 'docs/screenshots/dark-pm.png' })
})
