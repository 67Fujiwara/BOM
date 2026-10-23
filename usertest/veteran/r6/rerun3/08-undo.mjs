// Undo / Redo の連鎖: 300 行の貼り付け、操作の混在、上限、リロード直後、案件をまたぐ
import { launch, fresh, setRole, goto, toColKey, cursor, mode, sleep, dumpErrors, save, proj, panel, closeAll, palette, toastNow, ws, wizardCreate, bom300, storeState, shot } from './lib.mjs'
const { browser, context, page, errors } = await launch()
await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: 'http://localhost:5173' })
const out = {}
const log = (k, o) => { out[k] = o; console.log(k, JSON.stringify(o).slice(0, 900)) }
const sig = async () => { const p = await proj(page); return JSON.stringify(p.rows.map((r) => [r.id, r.status, r.hidden ?? false, r.adoptedSupplierId ?? null, r.working ?? null, r.name, r.model, r.note ?? ''])) }
// A: 300 行に 300×3 セルを Ctrl+V → Ctrl+Z 1 回 → Ctrl+Y
{
  await fresh(page)
  await wizardCreate(page, 'P-U300', bom300())
  await page.keyboard.press('1'); await goto(page, 'R001'); await toColKey(page, 'model')
  const s0 = await sig()
  const tsv = Array.from({ length: 300 }, (_, i) => `PM-${i}\tメーカ${i}\t${i + 1}`).join('\n')
  await page.evaluate((t) => navigator.clipboard.writeText(t), tsv)
  let t = Date.now(); await page.keyboard.press('Control+v'); await page.waitForFunction(() => /貼り付け/.test(document.body.innerText)); const pasteMs = Date.now() - t
  const s1 = await sig()
  t = Date.now(); await page.keyboard.press('Control+z'); await sleep(50); const undoMs = Date.now() - t
  const s2 = await sig()
  t = Date.now(); await page.keyboard.press('Control+y'); await sleep(50); const redoMs = Date.now() - t
  const s3 = await sig()
  log('A paste 900 cells', { pasteMs, undoMs, redoMs, pasted: s1 !== s0, undoRestored: s2 === s0, redoReapplied: s3 === s1, toast: (await toastNow(page)).slice(0, 80) })
}
// B: 混在 30 操作（編集・行追加・複製・削除・移動・隠す）→ Ctrl+Z ×30 → 元と一致 → Ctrl+Y ×30 → 最後と一致
{
  await fresh(page)
  await page.keyboard.press('1')
  const s0 = await sig()
  const ops = []
  for (let i = 0; i < 30; i++) {
    const id = 'R0' + String(40 + (i % 20)).padStart(2, '0')
    await goto(page, id)
    const k = i % 6
    if (k === 0) { await toColKey(page, 'name'); await page.keyboard.press('Enter'); await page.keyboard.press('Control+a'); await page.keyboard.type('U' + i); await page.keyboard.press('Enter'); ops.push('edit') }
    if (k === 1) { await page.keyboard.press('Shift+Enter'); await sleep(20); await page.keyboard.type('追加' + i); await page.keyboard.press('Enter'); ops.push('insert') }
    if (k === 2) { await page.keyboard.press('Shift+D'); ops.push('dup') }
    if (k === 3) { await page.keyboard.press('Alt+ArrowDown'); ops.push('moveDown') }
    if (k === 4) { await page.keyboard.press('h'); await sleep(400); ops.push('hide') }
    if (k === 5) { await toColKey(page, 'note'); await page.keyboard.press('Delete'); ops.push('clear') }
    await sleep(30); await closeAll(page)
  }
  const s1 = await sig()
  const u0 = await storeState(page, (s) => Object.values(s.undo).reduce((a, b) => a + b.length, 0))
  const msgs = []
  for (let i = 0; i < 40; i++) { await page.keyboard.press('Control+z'); await sleep(15); msgs.push((await toastNow(page)).slice(0, 40)) }
  const s2 = await sig()
  for (let i = 0; i < 40; i++) { await page.keyboard.press('Control+y'); await sleep(15) }
  const s3 = await sig()
  log('B mixed 30', { undoEntries: u0, undoBackToStart: s2 === s0, redoBackToEnd: s3 === s1, lastMsgs: [...new Set(msgs)].slice(-4) })
}
// C: 上限（250 回編集 → Ctrl+Z を 260 回）
{
  await fresh(page)
  await goto(page, 'R050'); await toColKey(page, 'note')
  for (let i = 0; i < 250; i++) { await page.keyboard.press('Enter'); await page.keyboard.press('Control+a'); await page.keyboard.type(String(i)); await page.keyboard.press('Enter'); await page.keyboard.press('k') }
  let n = 0
  for (let i = 0; i < 260; i++) { await page.keyboard.press('Control+z'); const t = await toastNow(page); if (/^元に戻す/.test(t)) n++; else if (/戻す操作がありません/.test(t)) break }
  const r = (await proj(page)).rows.find((x) => x.id === 'R050')
  log('C limit', { undone: n, R050note: r.working?.note ?? r.note, toast: (await toastNow(page)).slice(0, 80) })
}
// D: リロード直後の Undo（履歴の保存は 300ms 後）
{
  await fresh(page)
  for (const [i, id] of ['R030', 'R031', 'R032'].entries()) { await goto(page, id); await toColKey(page, 'name'); await page.keyboard.press('Enter'); await page.keyboard.press('Control+a'); await page.keyboard.type('D' + i); await page.keyboard.press('Enter') }
  await page.reload(); await page.waitForSelector('[data-testid="grid"]'); await page.locator('.gridwrap').focus()
  await page.keyboard.press('Control+z'); await sleep(40)
  const t1 = await toastNow(page)
  const r = (await proj(page)).rows.find((x) => x.id === 'R032')
  // 待ってからリロード
  await goto(page, 'R033'); await toColKey(page, 'name'); await page.keyboard.press('Enter'); await page.keyboard.press('Control+a'); await page.keyboard.type('D-wait'); await page.keyboard.press('Enter'); await sleep(600)
  await page.reload(); await page.waitForSelector('[data-testid="grid"]'); await page.locator('.gridwrap').focus()
  await page.keyboard.press('Control+z'); await sleep(40)
  const r33 = (await proj(page)).rows.find((x) => x.id === 'R033')
  log('D reload right after edits', { immediateReload: { toast: t1.slice(0, 80), R032: r.working?.name ?? r.name }, after600ms: { toast: (await toastNow(page)).slice(0, 80), R033: r33.working?.name ?? r33.name } })
}
// E: 51 回編集 → リロード → Ctrl+Z は何回できるか
{
  await fresh(page)
  await goto(page, 'R050'); await toColKey(page, 'note')
  for (let i = 0; i < 60; i++) { await page.keyboard.press('Enter'); await page.keyboard.press('Control+a'); await page.keyboard.type('e' + i); await page.keyboard.press('Enter'); await page.keyboard.press('k') }
  await sleep(600)
  await page.reload(); await page.waitForSelector('[data-testid="grid"]'); await page.locator('.gridwrap').focus()
  let n = 0
  for (let i = 0; i < 70; i++) { await page.keyboard.press('Control+z'); const t = await toastNow(page); if (/^元に戻す/.test(t)) n++; else break }
  log('E history after reload', { undoneAfterReload: n, of: 60 })
}
// F: 案件をまたぐ・役割をまたぐ
{
  await fresh(page)
  await goto(page, 'R030'); await toColKey(page, 'name'); await page.keyboard.press('Enter'); await page.keyboard.press('Control+a'); await page.keyboard.type('F-P1'); await page.keyboard.press('Enter')
  await wizardCreate(page, 'P-F2', '部品名\t型式\t数量\nA\tB\t1')
  await page.keyboard.press('Control+z'); await sleep(30); const t1 = await toastNow(page)
  const ids = (await ws(page)).projects.map((p) => p.id)
  await page.keyboard.press('Control+p'); await sleep(30); await page.keyboard.press('Home').catch(() => {}); await page.keyboard.press('ArrowUp'); await page.keyboard.press('ArrowUp'); await page.keyboard.press('Enter'); await sleep(60)
  const cur = (await ws(page)).currentProjectId
  await page.keyboard.press('Control+z'); await sleep(30); const t2 = await toastNow(page)
  const r = (await ws(page)).projects.find((p) => p.id === 'P-2026-041').rows.find((x) => x.id === 'R030')
  log('F cross project', { undoInNewProject: t1.slice(0, 80), projectsAfter: ids, switchedTo: cur, undoBack: t2.slice(0, 60), R030: r.working?.name ?? r.name })
}
save('08-undo.json', out)
dumpErrors(errors, '08')
await browser.close()
