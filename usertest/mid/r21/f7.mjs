// f7: 公開ダイアログの範囲（V12-07 の修正「ダイアログを開いたときの行だけを公開」）
// (i) A が Ctrl+Enter（理由の選択中）→ B（同じ設計者）が別の行 R002 の型式を直す → A が確定 → R002 は作業中のまま
// (ii) A が Ctrl+Enter を開いたまま → B が同じ行 R001 を公開 → A が確定 → Rev が二重にならない
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
const t = await launch(); const { page, context } = t; const h = helpers(t)
await t.open('design'); await t.press('1')
const p2 = await context.newPage()
await p2.goto('http://localhost:5175/'); await p2.getByTestId('grid').waitFor()
await p2.getByTestId('role-design').click(); await p2.locator('.gridwrap').focus()
const S2 = (src) => p2.evaluate(async (src) => { const m = await import(window.__m('/src/model/store.ts')); const st = m.useStore.getState(); return new Function('st', 'p', src)(st, st.project()) }, src)
async function goto2(id) { await p2.keyboard.press('Control+g'); await p2.getByTestId('prompt-text').fill(id); await p2.keyboard.press('Enter'); await p2.waitForTimeout(80) }
async function col2(key) { for (let i = 0; i < 90; i++) { if ((await S2('return st.cursorCol')) === key) return; await p2.keyboard.press('ArrowRight') } for (let i = 0; i < 90; i++) { if ((await S2('return st.cursorCol')) === key) return; await p2.keyboard.press('ArrowLeft') } }
async function set2(id, col, v) { await goto2(id); await col2(col); await p2.keyboard.press('Enter'); await p2.waitForTimeout(40); await p2.keyboard.press('Control+a'); await p2.keyboard.type(v); await p2.keyboard.press('Enter'); await p2.waitForTimeout(150) }
const revs = async () => (await t.proj()).submissions.map((s) => [s.rev, s.rowIds.join(',')])
// (i)
log('A R001 qty →', await t.setCellKey('R001', 'qtyNeeded', '7'))
await page.waitForTimeout(300)
await page.keyboard.press('Control+Enter'); await page.waitForTimeout(150); const pn = await t.panel(); log('A dialog', pn?.title)
await set2('R002', 'model', 'TABB-0002'); await page.waitForTimeout(400)
log('B R002 working', JSON.stringify(await S2(`return p.rows.find(r=>r.id==='R002').working`)))
await page.keyboard.press('2'); await page.waitForTimeout(80); let pp = await t.panel(); let g = 0
while (pp && g++ < 3) { await page.keyboard.press('Enter'); await page.waitForTimeout(150); pp = await t.panel() }
log('A confirm →', await t.toast())
await page.waitForTimeout(300)
let p = await t.proj(); const r2 = p.rows.find((r) => r.id === 'R002'), r1 = p.rows.find((r) => r.id === 'R001')
log('R001', r1.qtyNeeded, JSON.stringify(r1.working ?? null), '| R002', r2.model, JSON.stringify(r2.working ?? null), '| revs', JSON.stringify(await revs()))
check('F7-1 ダイアログを開いたあとで別のタブが直した R002 は公開されない（作業中のまま）', r2.model !== 'TABB-0002' && r2.working?.model === 'TABB-0002', `model=${r2.model} working=${JSON.stringify(r2.working)}`)
check('F7-2 ダイアログを開いたときの R001 は公開される', r1.qtyNeeded === 7 && !r1.working?.qtyNeeded, `qty=${r1.qtyNeeded}`)
// (ii)
log('A R003 qty →', await t.setCellKey('R003', 'qtyNeeded', '9'))
await page.waitForTimeout(300)
await page.keyboard.press('Control+Enter'); await page.waitForTimeout(150); log('A dialog 2', (await t.panel())?.title)
// B: 公開（R002 と R003）
await p2.locator('.gridwrap').focus(); await p2.keyboard.press('Control+Enter'); await p2.waitForTimeout(150)
let bp = await S2('return st.panel ? st.panel.title : null'); log('B dialog', bp)
await p2.keyboard.press('2'); await p2.waitForTimeout(80); for (let k = 0; k < 3 && (await S2('return !!st.panel')); k++) { await p2.keyboard.press('Enter'); await p2.waitForTimeout(150) }
log('B publish →', await S2('return st.toast?.text ?? ""'))
await page.waitForTimeout(400)
await page.keyboard.press('2'); await page.waitForTimeout(80); pp = await t.panel(); g = 0
while (pp && g++ < 3) { await page.keyboard.press('Enter'); await page.waitForTimeout(150); pp = await t.panel() }
log('A confirm 2 →', await t.toast())
await page.waitForTimeout(300)
const rv = await revs(); log('revs', JSON.stringify(rv))
const r3count = rv.filter(([rev, ids]) => rev > 1 && ids.split(',').includes('R003')).length
check('F7-3 別のタブが先に公開した R003 を、A の確定で二重に公開しない（R003 の Rev は 1 つ）', r3count === 1, JSON.stringify(rv))
await t.shot('f7')
summary(); await t.close()
