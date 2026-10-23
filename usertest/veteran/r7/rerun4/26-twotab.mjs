// ラウンド4: 2 タブ × 行の移動・追加・削除と Undo / Redo、同じ行の別項目の作業中の値、Redo の衝突
import { launch, fresh, goto, toColKey, mode, sleep, dumpErrors, save, panel, closeAll, toastNow, ws, URL } from './lib.mjs'
const { browser, context, page: A, errors } = await launch()
const out = []
const log = (o) => { out.push(o); console.log(JSON.stringify(o).slice(0, 1200)) }
const order = async (pg, ids) => { const w = await ws(pg); const p = w.projects.find((x) => x.id === w.currentProjectId); return p.rows.map((r) => r.id).filter((id) => !ids || ids.includes(id)) }
const near = async (pg, from, to) => { const o = await order(pg); return o.slice(o.indexOf(from), o.indexOf(to) + 1) }
const val = async (pg, id, k = 'name') => { const w = await ws(pg); const p = w.projects.find((x) => x.id === w.currentProjectId); const r = p?.rows.find((x) => x.id === id); return r ? (r.working?.[k] ?? r[k]) : undefined }
async function edit(pg, id, col, v) { await pg.bringToFront(); await closeAll(pg); await goto(pg, id); await toColKey(pg, col); await pg.keyboard.press('Enter'); await pg.keyboard.press('Control+a'); await pg.keyboard.type(v); await pg.keyboard.press('Enter'); await sleep(80) }
async function key(pg, id, k, col = 'name') { await pg.bringToFront(); await closeAll(pg); await goto(pg, id); await toColKey(pg, col); await pg.keyboard.press(k); await sleep(400) }
async function undo(pg, k = 'Control+z') { await pg.bringToFront(); await closeAll(pg); await pg.keyboard.press(k); await sleep(100); return (await toastNow(pg)).slice(0, 120) }
async function reset() {
  await fresh(A); A._tag = 'A'; await A.keyboard.press('Control+s')
  for (const p of context.pages()) if (p !== A) await p.close()
  const B = await context.newPage(); B._tag = 'B'
  await B.goto(URL); await B.waitForSelector('[data-testid="grid"]'); await B.locator('.gridwrap').focus(); await B.keyboard.press('1'); await A.keyboard.press('1')
  return B
}
if (!process.env.SKIP3)
// 1) A が R045 を下へ → B が R046 の部品名を変える → A の Ctrl+Z
{
  const B = await reset()
  await key(A, 'R045', 'Alt+ArrowDown')
  const o1 = await near(A, 'R044', 'R047')
  await edit(B, 'R046', 'name', 'B-46')
  const t = await undo(A)
  log({ case: '1 A move, B edits neighbour, A undo', afterMove: o1, undoToast: t, orderA: await near(A, 'R044', 'R047'), orderB: await near(B, 'R044', 'R047'), R046: await val(A, 'R046') })
}
if (!process.env.SKIP3)
// 2) A が R045 を下へ → B が R050 を上へ 2 回 → A の Ctrl+Z → A の Ctrl+Y
{
  const B = await reset()
  await key(A, 'R045', 'Alt+ArrowDown')
  await key(B, 'R050', 'Alt+ArrowUp'); await key(B, 'R050', 'Alt+ArrowUp')
  const before = await near(A, 'R044', 'R051')
  const t = await undo(A)
  const afterUndo = await near(A, 'R044', 'R051')
  const t2 = await undo(A, 'Control+y')
  log({ case: '2 both move, A undo/redo', before, undoToast: t, afterUndo, redoToast: t2, afterRedo: await near(A, 'R044', 'R051'), B_sees: await near(B, 'R044', 'R051') })
}
if (!process.env.SKIP3)
// 3) A が R045 を下へ → B が R045 の下に行を追加 → A の Ctrl+Z
{
  const B = await reset()
  await key(A, 'R045', 'Alt+ArrowDown')
  await B.bringToFront(); await closeAll(B); await goto(B, 'R045'); await toColKey(B, 'name'); await B.keyboard.press('Shift+Enter'); await sleep(60); await B.keyboard.type('B-new'); await B.keyboard.press('Enter'); await sleep(100)
  const before = await near(A, 'R044', 'R047')
  const t = await undo(A)
  log({ case: '3 A move, B inserts below, A undo', before, undoToast: t, after: await near(A, 'R044', 'R047'), all: (await order(A)).length })
}
// 4) A が下書き R076 を削除 → B が R077 を上へ（R076 の位置へ）→ A の Ctrl+Z（R076 の戻る位置）
{
  const B = await reset()
  const o0 = await near(A, 'R075', 'R078')
  await A.bringToFront(); await closeAll(A); await goto(A, 'R076'); await A.keyboard.press('Shift+Delete'); await sleep(80); if (await panel(A)) { await A.keyboard.press('ArrowDown'); await A.keyboard.press('Enter'); await sleep(80) }
  await key(B, 'R077', 'Alt+ArrowUp')
  const t = await undo(A)
  log({ case: '4 A deletes draft, B moves neighbour, A undo', start: o0, undoToast: t, after: await order(A, ['R074', 'R075', 'R076', 'R077', 'R078']) })
}
// 5) 提出済の行: A が部品名、B が型式（作業中の値）→ A Ctrl+Z → B Ctrl+Z
{
  const B = await reset()
  await edit(A, 'R035', 'name', 'A-name'); await edit(B, 'R035', 'model', 'B-model')
  const t1 = await undo(A)
  const s1 = { name: await val(A, 'R035'), model: await val(A, 'R035', 'model') }
  const t2 = await undo(B)
  log({ case: '5 working per-field merge', t1, s1, t2, s2: { name: await val(A, 'R035'), model: await val(A, 'R035', 'model') } })
}
// 6) A が編集 → Ctrl+Z → B が同じセルを編集 → A の Ctrl+Y（やり直しが B の値を消さないか）
{
  const B = await reset()
  await edit(A, 'R038', 'name', 'A-38'); await undo(A)
  await edit(B, 'R038', 'name', 'B-38')
  const t = await undo(A, 'Control+y')
  log({ case: '6 A redo after B changed same cell', toast: t, R038: await val(A, 'R038') })
}
// 7) A が R045 を 5 回下へ（B は何もしない）→ B のタブで表示がついてくるか → A Ctrl+Z ×5
{
  const B = await reset()
  for (let i = 0; i < 5; i++) { await A.bringToFront(); await A.keyboard.press('Alt+ArrowDown'); await sleep(30) }
  await goto(A, 'R045'); await closeAll(A)
  for (let i = 0; i < 5; i++) { await A.keyboard.press('Alt+ArrowDown'); await sleep(40) }
  const a1 = await near(A, 'R044', 'R051')
  await B.bringToFront(); await sleep(150)
  const bDom = await B.evaluate(() => [...document.querySelectorAll('.gridwrap tr.row')].map((tr) => tr.querySelector('td')?.textContent).filter((x) => /^R04[4-9]|^R05[01]/.test(x ?? '')))
  for (let i = 0; i < 5; i++) await undo(A)
  log({ case: '7 move x5 then undo x5', afterMoves: a1, B_dom: bDom, afterUndo: await near(A, 'R044', 'R051') })
}
save('26-twotab.json', out)
dumpErrors(errors, '26')
await browser.close()
