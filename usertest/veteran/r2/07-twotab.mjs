// 2 タブ同時編集
import { launch, fresh, setRole, goto, toCol, cursor, mode, sleep, dumpErrors, save2, proj, row, panel, closeAll, palette, toastNow, ws, URL } from './lib.mjs'
const { browser, context, page: A, errors } = await launch()
const out = []
const log = (o) => { out.push(o); console.log(JSON.stringify(o).slice(0, 800)) }
const name = async (pg, id) => { const r = (await proj(pg)).rows.find((x) => x.id === id); return r.working?.name ?? r.name }
const uiCell = async (pg, id, col) => pg.locator(`[data-row-id="${id}"] td[data-col="${col}"]`).textContent().catch(() => null)
async function edit(pg, id, col, v) { await pg.bringToFront(); await pg.locator('.gridwrap').focus(); await goto(pg, id); await toCol(pg, col); await pg.keyboard.press('Enter'); await pg.keyboard.press('Control+a'); await pg.keyboard.type(v); await pg.keyboard.press('Enter') }
await fresh(A)
A._tag = 'A'
const B = await context.newPage(); B._tag = 'B'
await B.goto(URL); await B.waitForSelector('[data-testid="grid"]'); await B.locator('.gridwrap').focus()
// 1) 別の行
await edit(A, 'R030', '部品名', 'A-30')
await edit(B, 'R031', '部品名', 'B-31')
await sleep(200)
log({ case: 'different rows', ls30: await name(A, 'R030'), ls31: await name(A, 'R031'), A_ui31: await uiCell(A, 'R031', 'name'), B_ui30: await uiCell(B, 'R030', 'name') })
// 2) 同じ行の別の列
await edit(A, 'R032', '型式', 'A-MODEL')
await edit(B, 'R032', '備考', 'B-NOTE')
await sleep(200)
{ const r = (await proj(A)).rows.find((x) => x.id === 'R032'); log({ case: 'same row diff cols', model: r.working?.model ?? r.model, note: r.working?.note ?? r.note, A_ui: await uiCell(A, 'R032', 'note'), B_ui: await uiCell(B, 'R032', 'model') }) }
// 3) 同じセル（後勝ち）
await edit(A, 'R033', '部品名', 'A-33')
await edit(B, 'R033', '部品名', 'B-33')
await sleep(200)
log({ case: 'same cell', ls: await name(A, 'R033'), A_ui: await uiCell(A, 'R033', 'name'), B_ui: await uiCell(B, 'R033', 'name') })
// 4) A が編集中（未確定）に B が同じ行を確定 → A が確定
await A.bringToFront(); await A.locator('.gridwrap').focus(); await goto(A, 'R034'); await toCol(A, '部品名'); await A.keyboard.press('Enter'); await A.keyboard.press('Control+a'); await A.keyboard.type('A-typing')
await edit(B, 'R034', '型式', 'B-34MODEL')
await A.bringToFront(); const aStill = await mode(A); await A.keyboard.press('Enter'); await sleep(200)
{ const r = (await proj(A)).rows.find((x) => x.id === 'R034'); log({ case: 'A editing while B commits same row', aModeWhileB: aStill, name: r.working?.name ?? r.name, model: r.working?.model ?? r.model }) }
// 5) A の Ctrl+Z が B の変更を消さないか
await edit(A, 'R035', '部品名', 'A-35')
await edit(B, 'R035', '備考', 'B-35NOTE')
await A.bringToFront(); await A.locator('.gridwrap').focus(); await A.keyboard.press('Control+z'); await sleep(100)
{ const r = (await proj(A)).rows.find((x) => x.id === 'R035'); log({ case: 'A undo after B touched same row', toast: (await toastNow(A)).slice(0, 100), name: r.working?.name ?? r.name, note: r.working?.note ?? r.note }) }
// 6) 交互 20 回（別の行）
for (let i = 0; i < 20; i++) { await edit(i % 2 ? B : A, 'R0' + String(40 + i), '備考', (i % 2 ? 'B' : 'A') + i) }
await sleep(200)
{ const p = await proj(A); const ok = Array.from({ length: 20 }, (_, i) => { const r = p.rows.find((x) => x.id === 'R0' + String(40 + i)); return (r.working?.note ?? r.note) === (i % 2 ? 'B' : 'A') + i }).filter(Boolean).length; log({ case: 'alternate 20', ok }) }
// 7) 役割はタブごと
await setRole(B, 'purchasing'); await A.bringToFront(); await A.reload(); await A.waitForSelector('[data-testid="grid"]')
log({ case: 'role per tab', A: (await ws(A)).user, A_header: await A.locator('.role button[aria-pressed="true"]').textContent(), B_header: await B.locator('.role button[aria-pressed="true"]').textContent() })
// 8) B（購買）が見積を入れる／A（設計）が型式を変える → どちらも残る＆見積が stale になる
await B.bringToFront(); await B.locator('.gridwrap').focus(); await B.keyboard.press('9'); await goto(B, 'R036'); await B.keyboard.press('Home'); for (let i = 0; i < 40; i++) { if ((await cursor(B)).endsWith('単価')) break; await B.keyboard.press('ArrowRight') } await B.keyboard.press('Enter'); await B.keyboard.press('Control+a'); await B.keyboard.type('777'); await B.keyboard.press('Enter')
await edit(A, 'R036', '型式', 'CHANGED-36')
await sleep(200)
{ const p = await proj(A); log({ case: 'B quote then A model change', model: p.rows.find((r) => r.id === 'R036').working?.model, q: p.quotes.filter((q) => q.rowId === 'R036' && q.supplierId === 'S1').map((q) => q.unitPrice + (q.stale ? '(stale)' : '')) }) }
// 9) A が JSON 読込（古い内容）→ B の変更は？
await A.bringToFront()
const snap = JSON.stringify(await ws(A))
await edit(B, 'R037', '部品名', 'B-after-snapshot')
await B.bringToFront(); await setRole(B, 'design'); await edit(B, 'R037', '部品名', 'B-after-snapshot')
await A.bringToFront(); await A.locator('.gridwrap').focus(); await palette(A, 'JSON を読み込む'); await A.evaluate((t) => { const el = document.querySelector('[data-testid="import-text"]'); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(el, t); el.dispatchEvent(new Event('input', { bubbles: true })) }, snap); await A.getByTestId('import-text').focus(); await A.keyboard.press('Control+Enter'); await sleep(200)
log({ case: 'A imports old JSON', r037: await name(A, 'R037'), B_ui: await uiCell(B, 'R037', 'name'), toast: (await toastNow(A)).slice(0, 80) })
// 10) 2 タブで同時に公開
await edit(A, 'R038', '部品名', 'pub-A'); await edit(B, 'R039', '部品名', 'pub-B')
await A.bringToFront(); await A.keyboard.press('Control+Enter'); await sleep(60); const oa = await A.getByTestId('prompt-options').textContent().catch(() => null)
await B.bringToFront(); await B.keyboard.press('Control+Enter'); await sleep(60); const ob = await B.getByTestId('prompt-options').textContent().catch(() => null)
await A.bringToFront(); await A.keyboard.press('Enter'); await sleep(100)
await B.bringToFront(); await B.keyboard.press('Enter'); await sleep(100)
{ const p = await proj(A); log({ case: 'both publish', optsA: oa?.slice(0, 40), optsB: ob?.slice(0, 40), toastB: (await toastNow(B)).slice(0, 100), subs: p.submissions.map((s) => `Rev${s.rev}:${s.rowIds.length}行`), r38: p.rows.find((r) => r.id === 'R038').publishedRev, r39: p.rows.find((r) => r.id === 'R039').publishedRev }) }
save2('07-twotab.json', out)
dumpErrors(errors, 'twotab')
await browser.close()
