// V2-05 Enter 連続入力 / V2-11 分類が連続しない BOM / V2-16 見出しのスクロール / V2-18 コンパクトの保持 / V2-19 通知の重なり / V2-06 Undo の巻き込み / V2-07 担当者名
import { storeState, launch, fresh, setRole, goto, toCol, cursor, mode, sleep, dumpErrors, save, proj, row, panel, closeAll, palette, toastNow, ws, shot, wizardCreate, bom300, cursorVisible, publish } from './lib.mjs'
const { browser, page, errors } = await launch()
const out = {}
const log = (k, o) => { out[k] = o; console.log(k, JSON.stringify(o).slice(0, 1200)) }
// V2-05
{
  await fresh(page)
  await goto(page, 'R001'); await toCol(page, '部品名')
  const t0 = Date.now()
  for (let i = 0; i < 50; i++) { await page.keyboard.press('Enter'); await page.keyboard.press('Control+a'); await page.keyboard.type('品' + i); await page.keyboard.press('Enter') }
  const p = await proj(page)
  const active = p.rows.filter((r) => r.status !== 'cancelled' && r.status !== 'replaced')
  const names = active.slice(0, 50).map((r) => r.working?.name ?? r.name)
  const ok = names.filter((n, i) => n === '品' + i).length
  log('V2-05/enter50', { ms: Date.now() - t0, ok, firstBad: names.findIndex((n, i) => n !== '品' + i), cursor: await cursor(page), mode: await mode(page), collapsed: await storeState(page, (s) => s.collapsed) })
  // Excel 流の上書き入力（型式）: 文字 → Enter
  await fresh(page)
  await goto(page, 'R001'); await toCol(page, '型式')
  for (let i = 0; i < 30; i++) { await page.keyboard.type('MX' + i); await page.keyboard.press('Enter') }
  const p2 = await proj(page)
  const models = p2.rows.filter((r) => r.status !== 'cancelled' && r.status !== 'replaced').slice(0, 30).map((r) => r.working?.model ?? r.model)
  log('V2-05/overwrite30', { ok: models.filter((m, i) => m === 'MX' + i).length, sample: models.slice(10, 16), cursor: await cursor(page) })
}
// V2-11 分類が交互
{
  await fresh(page)
  await wizardCreate(page, 'P-INT', bom300(300, true))
  await page.keyboard.press('1')
  const groups = await page.evaluate(async () => (await import('/src/model/store.ts')).useStore.getState())
  const nGroups = await page.evaluate(() => document.querySelectorAll('[data-testid="group-row"]').length)
  await page.keyboard.press('Control+ArrowUp')
  const seq = []
  for (let i = 0; i < 5; i++) { await page.keyboard.press(']'); seq.push(await cursor(page)) }
  log('V2-11', { groupRowsRendered: nGroups, bracketSeq: seq })
}
// V2-16 見出しにカーソル（80 行で Ctrl+↓ → k×90）
{
  await fresh(page)
  await page.keyboard.press('1'); await page.keyboard.press('Control+ArrowDown')
  for (let i = 0; i < 90; i++) await page.keyboard.press('k')
  const c = await cursor(page)
  log('V2-16', { cursor: c, vis: await cursorVisible(page) })
  await shot(page, '01d-group-header-cursor')
}
// V2-18 コンパクトの保持
{
  await fresh(page)
  await palette(page, 'コンパクト表示切替'); await sleep(50)
  const d1 = await page.evaluate(() => document.documentElement.dataset.density)
  await page.reload(); await page.waitForSelector('[data-testid="grid"]'); await sleep(50)
  const d2 = await page.evaluate(() => document.documentElement.dataset.density)
  log('V2-18', { before: d1, afterReload: d2 })
  await page.locator('.gridwrap').focus(); await palette(page, 'コンパクト表示切替')
}
// V2-19 通知とカーソル行（853×480）
{
  await fresh(page)
  await page.setViewportSize({ width: 853, height: 480 })
  await page.keyboard.press('1'); await goto(page, 'R001')
  const res = []
  for (let i = 0; i < 15; i++) {
    await page.keyboard.press('j')
    await palette(page, 'ダークモード切替'); await sleep(30)
    const ov = await page.evaluate(() => { const t = document.querySelector('[data-testid="toast-float"]'); const c = document.querySelector('td.cursor'); if (!t || !c) return null; const a = t.getBoundingClientRect(), b = c.getBoundingClientRect(); return a.top < b.bottom && a.bottom > b.top && a.left < b.right && a.right > b.left })
    res.push(ov)
  }
  await shot(page, '01d-toast-853')
  log('V2-19', { overlaps: res.filter(Boolean).length, of: res.length })
  await page.setViewportSize({ width: 1440, height: 900 })
}
// V2-06 Undo が他行の自動更新を巻き込まない
{
  await fresh(page)
  await goto(page, 'R030'); await toCol(page, '部品名'); await page.keyboard.press('Enter'); await page.keyboard.press('Control+a'); await page.keyboard.type('自分の編集'); await page.keyboard.press('Enter')
  await setRole(page, 'pm'); await page.keyboard.press('7'); await goto(page, 'R013'); await page.keyboard.press('y'); await sleep(30); if (await panel(page)) { await page.keyboard.type('OK'); await page.keyboard.press('Enter') } await sleep(40)
  await setRole(page, 'design'); await page.keyboard.press('1'); await page.keyboard.press('Control+z'); await sleep(30)
  const t = await toastNow(page)
  const r = await row(page, 'R030')
  log('V2-06/a', { toast: t.slice(0, 120), R030: r.working?.name ?? r.name })
  // 同じ行の別の列を他の役割（購買の見積）が変えた後の Ctrl+Z
  await fresh(page)
  await goto(page, 'R020'); await toCol(page, '備考'); await page.keyboard.press('Enter'); await page.keyboard.press('Control+a'); await page.keyboard.type('設計の備考'); await page.keyboard.press('Enter')
  await setRole(page, 'purchasing'); await page.keyboard.press('1'); await goto(page, 'R020'); await toCol(page, '入荷予定'); await page.keyboard.press('Enter'); await page.keyboard.type('2026-12-01'); await page.keyboard.press('Enter'); await sleep(20)
  const t1 = await toastNow(page)
  await setRole(page, 'design'); await page.keyboard.press('1'); await page.keyboard.press('Control+z'); await sleep(30)
  const r2 = await row(page, 'R020')
  log('V2-06/b', { purchaseToast: t1.slice(0, 80), undoToast: (await toastNow(page)).slice(0, 120), note: r2.working?.note ?? r2.note, promised: r2.promisedDate })
}
// V2-07 担当者名
{
  await fresh(page)
  await palette(page, '新しいBOM'); await page.getByTestId('wizard-id').fill('P-MEM'); await page.keyboard.press('Enter')
  for (let i = 0; i < 4; i++) await page.keyboard.press('Enter')
  const res = {}
  for (const v of ['山田, 鈴木', '佐藤, 佐藤', '佐藤,', ',', '佐藤, 鈴木']) {
    await page.getByTestId('wizard-buyer').fill(v); await page.keyboard.press('Enter'); await sleep(30)
    const still = await page.getByTestId('wizard-buyer').count()
    res[v] = { accepted: !still, err: (await page.getByTestId('wizard-error').textContent().catch(() => null))?.slice(0, 80) }
    if (!still) break
  }
  await closeAll(page)
  // 案件設定の担当者
  await setRole(page, 'pm'); await palette(page, '案件設定'); await sleep(40)
  const f = await page.locator('[data-testid="settings"] .opt').allTextContents(); const i = f.findIndex((x) => x.includes('担当'))
  for (let k = 0; k < i; k++) await page.keyboard.press('ArrowDown')
  const res2 = {}
  for (const v of ['山田,佐藤,山田', ',,', '山田,佐藤']) {
    await page.keyboard.press('Enter'); await page.getByTestId('settings-input').fill(v); await page.keyboard.press('Enter'); await sleep(20)
    res2[v] = { err: (await toastNow(page)).slice(0, 80), stillEditing: await page.getByTestId('settings-input').count() }
    if (await page.getByTestId('settings-input').count()) await page.keyboard.press('Escape')
  }
  await closeAll(page)
  log('V2-07', { wizard: res, settings: res2 })
}
save('01d-grid-undo.json', out)
dumpErrors(errors, '01d')
await browser.close()
