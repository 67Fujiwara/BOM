// ラウンド6: 2 タブ（同じブラウザ・同じ保存領域）での競合（実打鍵）。
// 1) A が R030 部品名を編集中に B が R030 を削除 → A Enter
// 2) A が R030 部品名を編集中に B が R030 を 5 つ上へ移動 → A Enter（値は R030 に入るか）
// 3) A が R045 を Alt+↓×3・部品名を編集・R010 を Alt+↑×2、その間に B が R046 を Alt+↑ と R045 の備考を編集 → A Ctrl+Z×3 → Ctrl+Y×3
// 4) A と B（どちらも設計）が同じ 20 行の別の列（備考・型式）を交互に 0ms で確定 → 取りこぼし（後勝ちの上書き）が無いか
// 5) A が Alt+h で R020 を隠す → B が R020 の部品名を編集 → A Ctrl+Z（隠すだけ戻り、B の部品名は残るか）
import { launch, fresh, goto, toCol, sleep, dumpErrors, toastNow, URL, LS_KEY } from '../../r6/rerun5/lib.mjs'
import { saveJson } from './lib7.mjs'
const { browser, context, page: A, errors } = await launch({ acceptDialogs: true })
const out = {}
const log = (k, o) => { out[k] = o; console.log(k, JSON.stringify(o).slice(0, 1200)) }
const rowsOf = (pg) => pg.evaluate((k) => { const w = JSON.parse(localStorage.getItem(k)); const p = w.projects.find((x) => x.id === w.currentProjectId); return p.rows.map((r) => ({ id: r.id, name: r.working?.name ?? r.name, note: r.working?.note ?? r.note, orderQty: r.orderQty, drawing: r.working?.drawing ?? r.drawing, model: r.working?.model ?? r.model, hidden: !!r.hidden })) }, LS_KEY)
const ids = (rows) => rows.map((r) => r.id)
async function both() {
  await fresh(A); await A.keyboard.press('Control+s'); await sleep(50)
  const B = await context.newPage(); B._tag = 'B'
  await B.goto(URL); await B.waitForSelector('[data-testid="grid"]'); await B.locator('.gridwrap').focus()
  await A.bringToFront(); await A.locator('.gridwrap').focus()
  return B
}
async function at(pg, id, col) { await pg.keyboard.press('Alt+1'); await goto(pg, id); await toCol(pg, col) }

// 1
{
  const B = await both()
  await at(A, 'R078', '部品名'); await A.keyboard.type('A-typed-R078')
  await at(B, 'R078', '部品名'); await B.keyboard.press('Shift+Delete'); await sleep(100)
  for (let i = 0; i < 2; i++) { const t = await B.evaluate(() => document.querySelector('[data-testid^="panel-"]')?.dataset.testid); if (!t) break; await B.keyboard.press('ArrowDown'); await B.keyboard.press('Enter'); await sleep(100) }
  const afterB = await rowsOf(B)
  await A.bringToFront(); await A.keyboard.press('Enter'); await sleep(200)
  const r = await rowsOf(A)
  const aState = { mode: await A.getByTestId('mode').textContent(), cursor: await A.getByTestId('cursor').textContent() }
  log('1 削除中の行に確定', { aState, r030B: afterB.find((x) => x.id === 'R078') ?? 'deleted', r030: r.find((x) => x.id === 'R078') ?? 'deleted', stray: r.filter((x) => x.name === 'A-typed-R078').map((x) => x.id), toast: await toastNow(A) })
  await B.close()
}
// 2
{
  const B = await both()
  await at(A, 'R030', '部品名'); await A.keyboard.type('A-typed-R030')
  await at(B, 'R030', '部品名'); for (let i = 0; i < 5; i++) { await B.keyboard.press('Alt+ArrowUp'); await sleep(30) }
  const orderB = ids(await rowsOf(B))
  await A.bringToFront(); await A.keyboard.press('Enter'); await sleep(200)
  const r = await rowsOf(A)
  log('2 移動中の行に確定', { idxB: orderB.indexOf('R030'), idxAfter: ids(r).indexOf('R030'), r030: r.find((x) => x.id === 'R030')?.name, stray: r.filter((x) => x.name === 'A-typed-R030').map((x) => x.id), cursorA: await A.getByTestId('cursor').textContent(), toast: await toastNow(A) })
  await B.close()
}
// 3
{
  const B = await both()
  const o0 = ids(await rowsOf(A))
  await at(A, 'R045', '部品名'); for (let i = 0; i < 3; i++) { await A.keyboard.press('Alt+ArrowDown'); await sleep(30) }
  await A.keyboard.type('A-name-R045'); await A.keyboard.press('Enter'); await sleep(50)
  await at(B, 'R046', '部品名'); await B.keyboard.press('Alt+ArrowUp'); await sleep(50)
  await at(B, 'R045', '備考'); await B.keyboard.type('B-note-R045'); await B.keyboard.press('Enter'); await sleep(50)
  await A.bringToFront(); await at(A, 'R010', '部品名'); for (let i = 0; i < 2; i++) { await A.keyboard.press('Alt+ArrowUp'); await sleep(30) }
  const mid = await rowsOf(A)
  const z = []
  for (let i = 0; i < 3; i++) { await A.keyboard.press('Control+z'); await sleep(120); z.push(await toastNow(A)) }
  const afterZ = await rowsOf(A)
  const y = []
  for (let i = 0; i < 3; i++) { await A.keyboard.press('Control+y'); await sleep(120); y.push(await toastNow(A)) }
  const afterY = await rowsOf(A)
  const pos = (rows, id) => ids(rows).indexOf(id)
  log('3 Undo/Redo と相手の移動', {
    start: { R045: pos(o0.map((id) => ({ id })), 'R045'), R046: pos(o0.map((id) => ({ id })), 'R046'), R010: pos(o0.map((id) => ({ id })), 'R010') },
    mid: { R045: pos(mid, 'R045'), R046: pos(mid, 'R046'), R010: pos(mid, 'R010'), name: mid.find((x) => x.id === 'R045').name, note: mid.find((x) => x.id === 'R045').note },
    afterZ: { R045: pos(afterZ, 'R045'), R046: pos(afterZ, 'R046'), R010: pos(afterZ, 'R010'), name: afterZ.find((x) => x.id === 'R045').name, note: afterZ.find((x) => x.id === 'R045').note },
    afterY: { R045: pos(afterY, 'R045'), R046: pos(afterY, 'R046'), R010: pos(afterY, 'R010'), name: afterY.find((x) => x.id === 'R045').name, note: afterY.find((x) => x.id === 'R045').note },
    z, y,
  })
  await B.close()
}
// 4
{
  const B = await both()
  await at(A, 'R020', '備考'); await at(B, 'R020', '型式')
  for (let i = 0; i < 20; i++) {
    await A.keyboard.type(`An${i}`); await A.keyboard.press('Enter')
    await B.keyboard.press('Enter'); await B.keyboard.press('Control+a'); await B.keyboard.type('M' + (100 + i)); await B.keyboard.press('Enter')
  }
  await sleep(300)
  const r = await rowsOf(A)
  const start = ids(r).indexOf('R020')
  const miss = []
  for (let i = 0; i < 20; i++) { const x = r[start + i]; if (x.note !== `An${i}`) miss.push({ id: x.id, col: '備考', got: x.note }); if (x.model !== 'M' + (100 + i)) miss.push({ id: x.id, col: '型式', got: x.model }) }
  log('4 2 タブが同じ行の別の列を交互に確定', { missN: miss.length, miss: miss.slice(0, 10) })
  await B.close()
}
// 5
{
  const B = await both()
  await at(A, 'R020', '部品名'); await A.keyboard.press('Alt+KeyH'); await sleep(80)
  await at(B, 'R020', '部品名'); await B.keyboard.type('B-name-R020'); await B.keyboard.press('Enter'); await sleep(80)
  await A.bringToFront(); await A.locator('.gridwrap').focus(); await A.keyboard.press('Control+z'); await sleep(150)
  const r = (await rowsOf(A)).find((x) => x.id === 'R020')
  log('5 隠すの Undo と相手の編集', { r020: r, toast: await toastNow(A) })
  await B.close()
}
out.errors = dumpErrors(errors, '58')
saveJson('58-twotab.json', out)
await browser.close()
