// V2-02 取込の数値検証 / V2-14 取消・発注済への取込 / V2-03 型式変更後の発注 / V2-22 発注済・置換済の入口 / V2-21 数値の端 / V2-12 改行入りセル / V2-24 空欄の並び
import { publish, launch, fresh, setRole, goto, toCol, cursor, mode, sleep, dumpErrors, save, proj, row, panel, closeAll, palette, toastNow, ws, shot } from './lib.mjs'
const { browser, context, page, errors } = await launch()
const out = {}
const log = (k, o) => { out[k] = o; console.log(k, JSON.stringify(o).slice(0, 1500)) }
const perr = (n) => errors.slice(n).filter((e) => e.type === 'pageerror' || e.type === 'error').map((e) => e.text.slice(0, 160))
const opts = async () => page.getByTestId('prompt-options').textContent().catch(() => null)
const mem = async (ids) => (await proj(page)).quotes.filter((q) => ids.includes(q.rowId) && q.supplierId === 'S1' && !q.stale).map((q) => `${q.rowId}:${q.unitPrice}/${q.leadDays}/${q.moq}`)
// ---- V2-02
{
  await fresh(page, 'purchasing')
  const n = errors.length
  await palette(page, '見積回答を取り込む'); await sleep(50); await page.keyboard.press('Enter'); await sleep(40)
  await page.getByTestId('import-text').fill('行ID\t型式\t単価\t納期\tMOQ\nR030\t\t1,200円\t2週間\t10個\nR031\t\t１２００\t14\t\nR032\t\t¥1,200\t即納\t\nR033\t\t-500\t-3\t0\nR034\t\t1e9\t99999\t\n')
  await page.keyboard.press('Control+Enter'); await sleep(150)
  const t = await toastNow(page)
  const stillOpen = await panel(page)
  const m = await mem(['R030', 'R031', 'R032', 'R033', 'R034'])
  const nan = await page.evaluate(() => /NaN|Infinity/.test(document.body.innerText))
  log('V2-02/direct', { toast: t.slice(0, 300), stillOpen, memory: m, nanInUi: nan, errors: perr(n) })
  await closeAll(page)
  // 正しい値だけの取込は通るか
  await palette(page, '見積回答を取り込む'); await sleep(50); await page.keyboard.press('Enter'); await sleep(40)
  await page.getByTestId('import-text').fill('行ID\t型式\t単価\t納期\tMOQ\nR030\t\t1,200円\t2週間\t10個\nR031\t\t１２００\t14日\t\n')
  await page.keyboard.press('Control+Enter'); await sleep(150)
  log('V2-02/goodOnly', { toast: (await toastNow(page)).slice(0, 200), memory: await mem(['R030', 'R031']), panel: await panel(page) })
  await closeAll(page)
  // 依頼書の形（表題行つき）
  await palette(page, '見積回答を取り込む'); await sleep(50); await page.keyboard.press('Enter'); await sleep(40)
  await page.getByTestId('import-text').fill('概算見積依頼書\t\t\t\n依頼No\tQ-1\t\t\n案件\tP-2026-041\t\t\n\n行ID\t部品名\t型式\tメーカ\t数量\t単位\t希望納期\t単価\t納期\tMOQ\nR032\tx\t\t\t1\t個\t\t980\t10\t1\n')
  await page.keyboard.press('Control+Enter'); await sleep(150)
  log('V2-02/wholeSheet', { toast: (await toastNow(page)).slice(0, 200), memory: await mem(['R032']), panel: await panel(page) })
  await closeAll(page)
}
// ---- V2-14
{
  await fresh(page, 'purchasing')
  await page.keyboard.press('Control+s')
  const w = await ws(page); const r1 = w.projects[0].rows.find((x) => x.id === 'R001'); r1.status = 'ordered'; r1.ordered = true; const r5 = w.projects[0].rows.find((x) => x.id === 'R005'); r5.status = 'cancelled'
  await page.evaluate((s) => localStorage.setItem('bom-pro.workspace.v2', s), JSON.stringify(w)); await page.reload(); await page.waitForSelector('[data-testid="grid"]'); await page.locator('.gridwrap').focus()
  await palette(page, '見積回答を取り込む'); await sleep(50); await page.keyboard.press('Enter'); await sleep(40)
  await page.getByTestId('import-text').fill('行ID\t型式\t単価\t納期\nR001\t\t1\t1\nR005\t\t2\t2'); await page.keyboard.press('Control+Enter'); await sleep(100)
  const p = await proj(page)
  log('V2-14', { toast: (await toastNow(page)).slice(0, 200), r001q: p.quotes.filter((q) => q.rowId === 'R001' && q.supplierId === 'S1' && !q.stale).map((q) => q.unitPrice), r005q: p.quotes.filter((q) => q.rowId === 'R005' && q.supplierId === 'S1' && !q.stale).map((q) => q.unitPrice) })
  await closeAll(page)
}
// ---- V2-03 A
{
  await fresh(page)
  await goto(page, 'R013'); await toCol(page, '型式'); await page.keyboard.press('Enter'); await page.keyboard.press('Control+a'); await page.keyboard.type('NEW-013'); await page.keyboard.press('Enter')
  await publish(page)
  const afterPub = await row(page, 'R013')
  await setRole(page, 'pm'); await page.keyboard.press('7'); await goto(page, 'R013')
  await page.keyboard.press('Enter'); await sleep(30)
  const decisionPanel = await page.locator('[data-testid^="panel-"]').textContent().catch(() => null)
  await page.keyboard.press('Escape')
  await page.keyboard.press('y'); await sleep(30); const ptitle = await page.locator('[data-testid^="panel-"]').textContent().catch(() => null); if (await panel(page)) { await page.keyboard.type('OK'); await page.keyboard.press('Enter') } await sleep(40)
  const pmToast = await toastNow(page)
  await closeAll(page)
  await setRole(page, 'purchasing'); await page.keyboard.press('3'); await goto(page, 'R013'); await page.keyboard.press('o'); await sleep(30)
  const r = await row(page, 'R013')
  log('V2-03/A', { afterPublish: { status: afterPub.status, flags: afterPub.flags, adopted: afterPub.adoptedSupplierId }, decisionPanel: decisionPanel?.slice(0, 200), pmPrompt: ptitle?.slice(0, 100), pmToast: pmToast.slice(0, 100), oToast: (await toastNow(page)).slice(0, 120), status: r.status, ordered: r.ordered, adopted: r.adoptedSupplierId, flags: r.flags })
}
// ---- V2-03 B
{
  await fresh(page)
  await goto(page, 'R076'); await toCol(page, '型式'); await page.keyboard.press('Enter'); await page.keyboard.type('M76'); await page.keyboard.press('Enter'); await goto(page, 'R076'); await toCol(page, 'メーカ'); await page.keyboard.press('Enter'); await page.keyboard.type('オムロン'); await page.keyboard.press('Enter'); await goto(page, 'R076'); await toCol(page, '部品名'); await page.keyboard.press('Enter'); await page.keyboard.type('N76'); await page.keyboard.press('Enter')
  await publish(page)
  await setRole(page, 'purchasing'); await page.keyboard.press('9'); await goto(page, 'R076'); await page.keyboard.press('Home'); for (let i = 0; i < 40; i++) { if ((await cursor(page)).endsWith('単価')) break; await page.keyboard.press('ArrowRight') } await page.keyboard.press('Enter'); await page.keyboard.type('100'); await page.keyboard.press('Tab'); await page.keyboard.type('5'); await page.keyboard.press('Enter')
  await setRole(page, 'design'); await page.keyboard.press('1'); await goto(page, 'R076'); await page.keyboard.press('Alt+a'); await sleep(30); if (await panel(page)) { await page.keyboard.press('1'); await page.keyboard.press('Enter') } await sleep(30)
  const earlyT = await toastNow(page)
  await closeAll(page)
  await goto(page, 'R076'); await toCol(page, '型式'); await page.keyboard.press('Enter'); await page.keyboard.press('Control+a'); await page.keyboard.type('M76-CHANGED'); await page.keyboard.press('Enter'); await publish(page)
  const afterChange = await row(page, 'R076')
  await setRole(page, 'pm'); await page.keyboard.press('7'); await goto(page, 'R076'); await page.keyboard.press('y'); await sleep(30); const t2 = await page.locator('[data-testid^="panel-"]').textContent().catch(() => null); if (await panel(page)) { await page.keyboard.type('OK'); await page.keyboard.press('Enter') } await sleep(40)
  const pmT = await toastNow(page)
  await closeAll(page)
  await setRole(page, 'purchasing'); await page.keyboard.press('3'); await goto(page, 'R076'); await page.keyboard.press('o'); await sleep(30)
  const r2 = await row(page, 'R076')
  log('V2-03/B', { earlyToast: earlyT.slice(0, 100), afterChange: { status: afterChange.status, flags: afterChange.flags, adopted: afterChange.adoptedSupplierId }, pmPrompt: t2?.slice(0, 120), pmToast: pmT.slice(0, 120), oToast: (await toastNow(page)).slice(0, 100), status: r2.status, ordered: r2.ordered, adopted: r2.adoptedSupplierId, flags: r2.flags })
}
// ---- V2-22 発注済の行で Enter / 置換済の行で Shift+D・w・Alt+↑
{
  await fresh(page)
  await page.keyboard.press('Control+s')
  const w = await ws(page); const r1 = w.projects[0].rows.find((x) => x.id === 'R001'); r1.status = 'ordered'; r1.ordered = true
  await page.evaluate((s) => localStorage.setItem('bom-pro.workspace.v2', s), JSON.stringify(w)); await page.reload(); await page.waitForSelector('[data-testid="grid"]'); await page.locator('.gridwrap').focus()
  await page.keyboard.press('1'); await goto(page, 'R001'); await toCol(page, '型式'); await page.keyboard.press('Enter'); await sleep(20)
  const m1 = await mode(page); const t1 = await toastNow(page)
  await closeAll(page)
  // 置換済の行
  const p0 = await proj(page)
  const rep = p0.rows.find((r) => r.status === 'replaced')
  const res = { orderedEnter: { mode: m1, toast: t1.slice(0, 100) }, replacedRow: rep?.id }
  if (rep) {
    for (const k of ['Shift+D', 'w', 'Alt+ArrowUp', 'Shift+Enter', 'Enter']) {
      await goto(page, rep.id); const n0 = (await proj(page)).rows.length
      await page.keyboard.press(k); await sleep(30)
      res[k] = { panel: await panel(page), mode: await mode(page), rows: (await proj(page)).rows.length - n0, toast: (await toastNow(page)).slice(0, 80), cursor: await cursor(page) }
      await closeAll(page)
    }
  }
  log('V2-22', res)
}
// ---- V2-21 数値の端
{
  await fresh(page)
  const res = {}
  for (const [col, vals] of [['必要数', ['0x10', '0b11', '0o7', '1e3', 'Infinity', ' 12 ', '12.5', '1_000']], ['前倒し日数', ['-10', '400', '-400', '365', '3.5']]]) {
    if (col === '前倒し日数') { await page.keyboard.press('c'); const cols = await page.locator('[data-testid="columns"] .opt').allTextContents(); const i = cols.findIndex((c) => c.includes('前倒し')); for (let k = 0; k < i; k++) await page.keyboard.press('ArrowDown'); if (cols[i]?.startsWith('○')) await page.keyboard.press('Space'); await page.keyboard.press('Escape') }
    for (const v of vals) {
      await goto(page, 'R030'); if (!(await toCol(page, col))) { res[col] = 'col not found'; break }
      await page.keyboard.press('Enter'); await page.keyboard.press('Control+a'); await page.keyboard.type(v); await page.keyboard.press('Enter'); await sleep(20)
      const m = await mode(page); const err = await page.getByTestId('edit-error').textContent().catch(() => null)
      await closeAll(page)
      const r = await row(page, 'R030')
      res[col + ':' + v] = { mode: m, err: err?.slice(0, 60), stored: col === '必要数' ? (r.working?.qtyNeeded ?? r.qtyNeeded) : (r.working?.needOffset ?? r.needOffset) }
    }
  }
  log('V2-21', res)
}
// ---- V2-12 改行入りセルの貼り付け
{
  await fresh(page)
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: 'http://localhost:5173' })
  await goto(page, 'R039'); await toCol(page, '備考')
  await page.evaluate(() => navigator.clipboard.writeText('"1行目\n2行目"'))
  await page.keyboard.press('Control+v'); await sleep(80)
  const a = await row(page, 'R039'), b = await row(page, 'R040')
  // 2 セル（改行入り＋普通）を横に
  await goto(page, 'R041'); await toCol(page, '部品名')
  await page.evaluate(() => navigator.clipboard.writeText('"名前A\nつづき"\tMODEL-A\n名前B\tMODEL-B'))
  await page.keyboard.press('Control+v'); await sleep(80)
  const c = await row(page, 'R041'), d = await row(page, 'R042')
  log('V2-12', { R039note: a.working?.note ?? a.note, R040note: b.working?.note ?? b.note, toast: (await toastNow(page)).slice(0, 100), R041: [c.working?.name ?? c.name, c.working?.model ?? c.model], R042: [d.working?.name ?? d.name, d.working?.model ?? d.model] })
}
// ---- V2-24 空欄の並び（型式空の行を作って s / Shift+S）
{
  await fresh(page)
  await goto(page, 'R030'); await toCol(page, '型式'); await page.keyboard.press('Delete'); await sleep(20)
  await page.keyboard.press('s'); await sleep(30)
  const firstAsc = await page.locator('[data-testid="row"] td[data-col="model"]').first().textContent()
  const lastAscRow = await page.evaluate(() => { const w = document.querySelector('.gridwrap'); w.scrollTop = 1e6; return null })
  await sleep(100)
  const tailAsc = await page.locator('[data-testid="row"] td[data-col="model"]').allTextContents()
  await page.keyboard.press('Shift+S'); await sleep(30)
  await page.evaluate(() => { document.querySelector('.gridwrap').scrollTop = 0 }); await sleep(80)
  const firstDesc = await page.locator('[data-testid="row"] td[data-col="model"]').first().textContent()
  log('V2-24', { firstAsc, tailAsc: tailAsc.slice(-3), firstDesc })
}
save('01b-data-rules.json', out)
dumpErrors(errors, '01b')
await browser.close()
