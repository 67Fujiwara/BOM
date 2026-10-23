// ラウンド11: Undo / Redo の 200 件の履歴とリロード（V10-07 の再確認と新しい形）
import { open, reset, sleep, logger, gotoCell, installToastLog, takeToasts, state } from './lib11.mjs'
const port = Number(process.env.PORT ?? 5176)
const env = await open(port); const pg = env.page; const log = logger(`25-undo200-${port}.json`)
await env.context.grantPermissions(['clipboard-read', 'clipboard-write'])
const LSK = 'bom-pro.workspace.v2'
const val = (id, f = 'name') => pg.evaluate(([k, id, f]) => { const w = JSON.parse(localStorage.getItem(k)); const p = w.projects.find((x) => x.id === w.currentProjectId); const r = p.rows.find((x) => x.id === id); return r ? (r.working?.[f] ?? r[f]) : null }, [LSK, id, f])
const nrows = () => pg.evaluate((k) => { const w = JSON.parse(localStorage.getItem(k)); return w.projects.find((x) => x.id === w.currentProjectId).rows.length }, LSK)
const hist = () => pg.evaluate(() => { const raw = sessionStorage.getItem('bom-pro.history') ?? ''; try { const h = JSON.parse(raw); return { len: raw.length, undo: Object.values(h.undo).map((v) => v.length), redo: Object.values(h.redo).map((v) => v.length) } } catch { return { len: raw.length } } })
const reload = async () => { await pg.reload(); await pg.waitForSelector('[data-testid="grid"]'); await pg.locator('.gridwrap').focus(); await sleep(200) }
const lastToast = () => pg.evaluate(() => (document.querySelector('[data-testid="toast-float"]') ?? document.querySelector('[data-testid="toast"]'))?.textContent?.slice(0, 160) ?? '')
async function press(k, n) { for (let i = 0; i < n; i++) await pg.keyboard.press(k) }
// A: 同じセルを 205 回 → リロード → Ctrl+Z ×206
{
  await reset(env); await gotoCell(pg, 1, 'R010', '部品名'); const orig = await val('R010')
  for (let i = 0; i < 205; i++) { await pg.keyboard.type('U' + i); await pg.keyboard.press('Enter'); await pg.keyboard.press('ArrowUp') }
  await sleep(500); const h0 = await hist(); const v0 = await val('R010')
  await reload(); const h1 = await hist()
  const t0 = Date.now(); await press('Control+z', 200); const tUndo = Date.now() - t0; await sleep(300)
  const v200 = await val('R010'); const t200 = await lastToast()
  await pg.keyboard.press('Control+z'); await sleep(100); const v201 = await val('R010'); const t201 = await lastToast()
  await press('Control+y', 200); await sleep(300); const vRedo = await val('R010'); const tRedo = await lastToast()
  log({ case: 'A 205 回編集 → リロード → Z×200 → Z → Y×200', orig, v0, h0, h1, v200, t200, v201, t201, vRedo, tRedo, msFor200Undo: tUndo })
}
// B: 10 編集 → Z×10 → リロード → Y×10
{
  await reset(env); await gotoCell(pg, 1, 'R020', '型式'); const orig = await val('R020', 'model')
  for (let i = 0; i < 10; i++) { await pg.keyboard.type('B' + i); await pg.keyboard.press('Enter'); await pg.keyboard.press('ArrowUp') }
  await press('Control+z', 10); await sleep(500); const vz = await val('R020', 'model'); const h0 = await hist()
  await reload(); const h1 = await hist(); await press('Control+y', 10); await sleep(300); const vy = await val('R020', 'model'); const ty = await lastToast()
  await pg.keyboard.press('Control+y'); await sleep(100); const ty11 = await lastToast()
  log({ case: 'B 10 編集 → Z×10 → リロード → Y×10', orig, vz, h0, h1, vy, ty, ty11 })
}
// C: Z×5 → 新しい編集（やり直しが消える）→ リロード → Ctrl+Y
{
  await reset(env); await gotoCell(pg, 1, 'R020', '型式')
  for (let i = 0; i < 8; i++) { await pg.keyboard.type('C' + i); await pg.keyboard.press('Enter'); await pg.keyboard.press('ArrowUp') }
  await press('Control+z', 5); await pg.keyboard.type('NEW'); await pg.keyboard.press('Enter'); await sleep(500)
  await reload(); await pg.keyboard.press('Control+y'); await sleep(100); const ty = await lastToast(); const v = await val('R020', 'model')
  log({ case: 'C Z×5 → 新しい編集 → リロード → Y', v, ty })
}
// D: 大きい履歴（2,500 行の貼り付け ×4）で sessionStorage に入らないとき。リロード後の Ctrl+Z は何を戻すか
{
  await reset(env); await gotoCell(pg, 1, 'R010', '部品名')
  await pg.keyboard.type('D-EDIT'); await pg.keyboard.press('Enter'); await sleep(500); const hA = await hist()
  await gotoCell(pg, 1, 'R080', '部品名')
  const toasts = []
  for (let k = 0; k < 4; k++) {
    await pg.evaluate((k) => navigator.clipboard.writeText(Array.from({ length: 2500 }, (_, i) => `P${k}-${i}-長めの部品名をつけて履歴を大きくする\tMODEL-${k}-${i}-ABCDEFGHIJ\tメーカ${k}\t${i + 1}`).join('\n')), k)
    await pg.keyboard.press('Control+v'); await sleep(1500); toasts.push(await lastToast())
    await pg.keyboard.press('Control+g'); await pg.getByTestId('prompt-text').fill('R080'); await pg.keyboard.press('Enter'); await sleep(100)
  }
  await sleep(800); const hB = await hist(); const n0 = await nrows(); const last0 = await val('R2579')
  await reload(); const hC = await hist()
  await installToastLog(pg); await takeToasts(pg)
  const steps = []
  for (let i = 0; i < 6; i++) { await pg.keyboard.press('Control+z'); await sleep(600); steps.push({ rows: await nrows(), r010: await val('R010'), r080: await val('R080'), toast: await lastToast() }) }
  log({ case: 'D 編集 1 → 2,500 行貼り付け ×4 → リロード → Z×6', hA, hB, hC, n0, last0, toasts, steps })
}
console.log('errors', JSON.stringify(env.errs.slice(0, 5)))
log.save(); await env.browser.close()
