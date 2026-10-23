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
  // 表は見えている範囲の行だけを描く。先頭と最後の行に移動できることで 80 行あることを確かめる
  await expect(page.locator('[data-row-id="R001"]')).toBeVisible()
  await page.locator('.gridwrap').focus()
  await page.keyboard.press('Control+ArrowDown')
  await expect(page.locator('[data-row-id="R080"]')).toBeVisible()
  await expect(page.getByTestId('cursor')).toContainText('R080')
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
  // 最初の提出の後に足した行があるので、変更セットの理由を聞かれる。Enter だけでは進まず、数字で選ぶ
  await expect(page.getByTestId('prompt-options')).toContainText('客先要求')
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('toast')).toContainText('選んでから Enter')
  await page.keyboard.press('2') // 設計起因
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
  await page.keyboard.press('1') // 理由: 納期（数字で選ぶ。Enter だけでは進まない）
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

async function gotoCell(page: Page, id: string, colLabel: string) {
  await page.keyboard.press('Control+g')
  await page.getByTestId('prompt-text').fill(id)
  await page.keyboard.press('Enter')
  await page.keyboard.press('Home')
  while (!(await page.getByTestId('cursor').textContent())!.includes(colLabel)) await page.keyboard.press('ArrowRight')
}

test('英字で始まる値をいきなり打っても、先頭の文字がコマンドにならない（hello / relay / nut）', async ({ page }) => {
  await open(page)
  await gotoCell(page, 'R030', '型式')
  await page.keyboard.type('hello', { delay: 40 })
  await page.keyboard.press('Enter')
  await expect(page.locator('[data-row-id="R030"] td[data-col="model"]')).toHaveText('hello')
  await expect(page.locator('[data-row-id="R030"]')).not.toHaveClass(/hidden-row/)
  await gotoCell(page, 'R076', '部品名')
  await page.keyboard.type('relay', { delay: 40 })
  await page.keyboard.press('Enter')
  await expect(page.locator('[data-row-id="R076"] td[data-col="name"]')).toHaveText('relay')
  await expect(page.locator('[data-row-id="R081"]')).toHaveCount(0) // 置換行が作られていない
  await gotoCell(page, 'R033', '部品名')
  await page.keyboard.type('nut', { delay: 40 })
  await page.keyboard.press('Enter')
  await expect(page.locator('[data-row-id="R033"] td[data-col="name"]')).toHaveText('nut')
  // 2 文字目が移動キー（anode / kit）、Shift 付きの英字（NEC）
  for (const [id, word] of [['R034', 'anode'], ['R035', 'kit'], ['R037', 'knob']] as const) {
    await gotoCell(page, id, '部品名')
    await page.keyboard.type(word, { delay: 60 })
    await page.keyboard.press('Enter')
    await expect(page.locator(`[data-row-id="${id}"] td[data-col="name"]`)).toHaveText(word)
  }
  await gotoCell(page, 'R036', '部品名')
  for (const k of ['Shift+N', 'Shift+E', 'Shift+C']) await page.keyboard.press(k, { delay: 20 })
  await page.keyboard.press('Enter')
  await expect(page.locator('[data-row-id="R036"] td[data-col="name"]')).toHaveText('NEC')
  // Shift で打つ型番（1 文字目が Shift+N / Shift+D のコマンド）
  for (const [id, word] of [['R038', 'NJM2904'], ['R039', 'DRV8833']] as const) {
    await gotoCell(page, id, '型式')
    for (const ch of word) await page.keyboard.press(/[A-Z]/.test(ch) ? `Shift+${ch}` : ch, { delay: 15 })
    await page.keyboard.press('Enter')
    await expect(page.locator(`[data-row-id="${id}"] td[data-col="model"]`)).toHaveText(word)
  }
  await expect(page.getByTestId('status')).not.toContainText('R081')
  // ゆっくり打つ（1 文字 0.3 秒）・Shift の英字＋数字・回路記号・c / w で始まる語
  const cases: Array<[string, string, string, number]> = [
    ['R041', '部品名', 'anode', 300],
    ['R042', '部品名', 'cable', 60],
    ['R043', '部品名', 'washer', 60],
    ['R044', '型式', 'AC100V', 60],
    ['R045', '回路記号', 'K1', 60],
    ['R046', '型式', 'K8AK-AS1', 60],
    ['R047', '部品名', 'coil', 60],
    ['R048', '部品名', 'knob', 300],
    ['R049', '型式', 'ADP3338', 60],
  ]
  for (const [id, col, word, delay] of cases) {
    await gotoCell(page, id, col)
    for (const ch of word) await page.keyboard.press(/[A-Z]/.test(ch) ? `Shift+${ch}` : ch, { delay: 10 }), await page.waitForTimeout(delay)
    await page.keyboard.press('Enter')
    const key = col === '部品名' ? 'name' : col === '型式' ? 'model' : 'ref'
    await expect(page.locator(`[data-row-id="${id}"] td[data-col="${key}"]`)).toHaveText(word)
  }
})

test('編集中にサイドバーのビューをクリックしても、入力は編集していた行に入る', async ({ page }) => {
  await open(page)
  await gotoCell(page, 'R010', '部品名')
  await page.keyboard.press('Enter')
  await page.keyboard.press('Control+a')
  await page.keyboard.type('クリック確定')
  await page.getByTestId('view-4').click()
  await expect(page.getByTestId('mode')).toHaveText('ナビ')
  await page.getByTestId('view-1').click()
  await expect(page.locator('[data-row-id="R010"] td[data-col="name"]')).toHaveText('クリック確定')
})

test('リロードしてもビュー・カーソルと Ctrl+Z の履歴が残る', async ({ page }) => {
  await open(page)
  await gotoCell(page, 'R010', '部品名')
  await page.keyboard.press('Enter')
  await page.keyboard.press('Control+a')
  await page.keyboard.type('リロード前')
  await page.keyboard.press('Enter')
  await page.keyboard.press('4')
  await page.waitForTimeout(500)
  await page.reload()
  await expect(page.getByTestId('view-4')).toHaveAttribute('aria-current', 'true')
  await page.locator('.gridwrap').focus()
  await page.keyboard.press('1')
  await page.keyboard.press('Control+z')
  await expect(page.getByTestId('toast')).toContainText('元に戻す')
  await gotoCell(page, 'R010', '部品名')
  await expect(page.locator('[data-row-id="R010"] td[data-col="name"]')).not.toHaveText('リロード前')
})

test('提出済の行の取消は公開するまで購買に見えない', async ({ page }) => {
  await open(page)
  await gotoCell(page, 'R050', '部品名')
  await page.keyboard.press('Shift+Delete')
  await expect(page.locator('[data-row-id="R050"]')).toContainText('取消予定')
  await page.locator('.role button', { hasText: '購買' }).click()
  await page.locator('.gridwrap').focus()
  await page.keyboard.press('1')
  await gotoCell(page, 'R050', '部品名')
  await expect(page.locator('[data-row-id="R050"]')).not.toContainText('取消')
  await expect(page.locator('[data-row-id="R050"]')).toContainText('作業中')
})

test('英字コマンドを続けて使うとき（x → n、a → j、s → 4）は文字にならない', async ({ page }) => {
  await open(page)
  await gotoCell(page, 'R010', '部品名')
  await page.keyboard.press('s')
  await page.keyboard.press('4')
  await expect(page.getByTestId('view-4')).toHaveAttribute('aria-current', 'true')
  await expect(page.getByTestId('mode')).toHaveText('ナビ')
  await page.keyboard.press('1')
  await gotoCell(page, 'R011', '部品名')
  await page.keyboard.press('h')
  await page.keyboard.press('j')
  await expect(page.getByTestId('mode')).toHaveText('ナビ')
  await expect(page.getByTestId('toast')).toContainText('R011')
})
