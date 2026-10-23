// ラウンド5: 行の移動の Undo（V4-09 の直し＝最長共通部分列）を行数別に。2 タブで A が移動 → B が別の行を移動 → A の Ctrl+Z / Ctrl+Y。
// 80 / 300 / 1,990 / 2,100 行。Ctrl+Z にかかる時間も測る
import { launch, fresh, goto, sleep, dumpErrors, save, closeAll, toastNow, ws, URL, LS_KEY } from './lib.mjs'
const { browser, context, page: A, errors } = await launch()
const out = []
const log = (o) => { out.push(o); console.log(JSON.stringify(o).slice(0, 700)) }
const order = async (pg) => { const w = await ws(pg); const p = w.projects.find((x) => x.id === w.currentProjectId); return p.rows.map((r) => r.id) }
const around = (o, ids) => ids.map((id) => [id, o.indexOf(id)])
async function grow(n) {
  await A.evaluate(([k, n]) => { const w = JSON.parse(localStorage.getItem(k)); const p = w.projects.find((x) => x.id === w.currentProjectId); const base = p.rows.filter((r) => ['draft', 'submitted', 'quoting', 'quoted'].includes(r.status)); let i = 0; while (p.rows.length < n) { const r = structuredClone(base[i % base.length]); r.id = 'X' + String(p.rows.length + 1).padStart(4, '0'); r.ref = 'XR' + p.rows.length; p.rows.push(r); i++ } localStorage.setItem(k, JSON.stringify(w)) }, [LS_KEY, n])
}
for (const n of (process.env.NS ?? '80,300,1990,2100').split(',').map(Number)) {
  await fresh(A); A._tag = 'A'; await A.keyboard.press('Control+s')
  if (n > 80) { await grow(n); await A.reload(); await A.waitForSelector('[data-testid="grid"]') }
  for (const p of context.pages()) if (p !== A) await p.close()
  const B = await context.newPage(); B._tag = 'B'
  await B.goto(URL); await B.waitForSelector('[data-testid="grid"]'); await B.locator('.gridwrap').focus(); await B.keyboard.press('1')
  await A.bringToFront(); await A.locator('.gridwrap').focus(); await A.keyboard.press('1')
  const o0 = await order(A)
  // A: R045 を 2 つ下へ
  await goto(A, 'R045'); await closeAll(A); await A.keyboard.press('Alt+ArrowDown'); await A.keyboard.press('Alt+ArrowDown'); await sleep(350)
  // B: R060 を 3 つ上へ
  await B.bringToFront(); await closeAll(B); await goto(B, 'R060'); await closeAll(B); for (let i = 0; i < 3; i++) await B.keyboard.press('Alt+ArrowUp'); await sleep(350)
  const o1 = await order(A)
  await A.bringToFront(); await closeAll(A)
  const t0 = Date.now(); await A.keyboard.press('Control+z'); await A.keyboard.press('Control+z'); const undoMs = Date.now() - t0
  await sleep(100)
  const tz = await toastNow(A)
  const o2 = await order(A)
  const t1 = Date.now(); await A.keyboard.press('Control+y'); await A.keyboard.press('Control+y'); const redoMs = Date.now() - t1
  await sleep(100)
  const o3 = await order(A)
  const idx = (o, id) => o.indexOf(id)
  log({ n, rows: o0.length, start: around(o0, ['R045', 'R060']), afterMoves: around(o1, ['R045', 'R060']), afterUndo2: around(o2, ['R045', 'R060']), afterRedo2: around(o3, ['R045', 'R060']), undoToast: tz.slice(0, 80), undoMsFor2: undoMs, redoMsFor2: redoMs,
    R045back: idx(o2, 'R045') === idx(o0, 'R045'), R060keptByB: idx(o2, 'R060') === idx(o1, 'R060'), R060afterRedo: idx(o3, 'R060') === idx(o1, 'R060') })
}
dumpErrors(errors, '36')
save('36-undo-order.json', out)
await browser.close()
