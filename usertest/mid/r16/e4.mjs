// e4: 2 つのタブで同じ行を採用する（V11-06 の修正「理由を入れているあいだに別のタブで採用が変わったら採用しない」）
// (i) A が 2 位を選んで理由を入れている間に B が 3 位を採用 → A の Enter
// (ii) A が Shift+A の一覧を開いている間に B が 2 位を理由つきで採用 → A が 1（1 位）
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
const t = await launch(); const { page, context } = t; const h = helpers(t)
await t.open('design'); await t.press('1')
const p2 = await context.newPage()
await p2.goto('http://localhost:5175/'); await p2.getByTestId('grid').waitFor()
await p2.getByTestId('role-design').click(); await p2.locator('.gridwrap').focus()
const S2 = (src) => p2.evaluate(async (src) => { const m = await import(window.__m('/src/model/store.ts')); const st = m.useStore.getState(); return new Function('st', 'p', src)(st, st.project()) }, src)
async function press2(k) {
  if (/^(Shift\+)?[a-zA-Z]$/.test(k)) {
    const nav = await S2(`const ae = document.activeElement; return !st.panel && st.mode === 'nav' && !(ae instanceof HTMLInputElement || ae instanceof HTMLTextAreaElement)`)
    if (nav) k = 'Alt+' + k
  }
  await p2.keyboard.press(k); await p2.waitForTimeout(60)
}
async function goto2(id) { await p2.keyboard.press('Control+g'); await p2.getByTestId('prompt-text').fill(id); await p2.keyboard.press('Enter'); await p2.waitForTimeout(80) }
const toast2 = () => S2('return st.toast?.text ?? ""')
let p = await t.proj()
const cands = await page.evaluate(async () => { const sc = await import(window.__m('/src/model/score.ts')); const s = (await import(window.__m('/src/model/store.ts'))).useStore.getState(); const p = s.project(); return p.rows.filter((r) => r.status === 'quoted' && r.procurement === '相見積' && !r.adoptedSupplierId && sc.scoreRow(p, r, s.ws.suppliers).length === 3).map((r) => [r.id, sc.scoreRow(p, r, s.ws.suppliers).map((x) => x.supplierId), sc.scoreRow(p, r, s.ws.suppliers).map((x) => x.total)]) }).catch((e) => 'ERR ' + e.message)
log('candidates', JSON.stringify(cands).slice(0, 300))
const [[X, scX], [Y, scY]] = cands
// (i)
await t.goto(X); await t.press('Shift+A'); await page.waitForTimeout(80); await t.press('2'); await page.waitForTimeout(80); log('A reason prompt', JSON.stringify((await t.panel())?.title)); await t.press('1')
await goto2(X); await press2('Shift+A'); await press2('3'); await press2('1'); await p2.getByTestId('prompt-text').press('Enter'); await p2.waitForTimeout(150)
log('B adopt 3rd →', await toast2())
await page.waitForTimeout(400)
log('A sees adopted', await t.S(`return p.rows.find((r) => r.id === '${X}').adoptedSupplierId`))
await page.getByTestId('prompt-text').press('Enter'); await page.waitForTimeout(150)
const tA = await t.toast(); p = await t.proj(); const rX = p.rows.find((r) => r.id === X)
log('A Enter →', tA, '| final', h.show(p, X))
check('E4-1 (i) 理由の入力中に別のタブが採用したら、Enter で上書きしない（知らせる）', rX.adoptedSupplierId === scX[2] && /別のタブ/.test(tA), `${rX.adoptedSupplierId} ${tA}`)
// (ii)
await t.goto(Y); await t.press('Shift+A'); await page.waitForTimeout(80); const ap = await t.panel(); log('A adopt panel', JSON.stringify(ap?.title))
await goto2(Y); await press2('Shift+A'); await press2('2'); await press2('1'); await p2.getByTestId('prompt-text').press('Enter'); await p2.waitForTimeout(150)
log('B adopt 2nd →', await toast2())
await page.waitForTimeout(400)
log('A panel after B', JSON.stringify(await t.panel())); await t.shot('e4-ii-panel'); log('A dialog text', (await t.dialog()).slice(0, 300))
await t.press('1'); await page.waitForTimeout(150)
const tA2 = await t.toast(); const pnA2 = await t.panel(); if (pnA2) await page.keyboard.press('Escape')
p = await t.proj(); const rY = p.rows.find((r) => r.id === Y)
log('A 1 →', tA2, '| panel', JSON.stringify(pnA2?.title), '| final', h.show(p, Y), 'decisions', JSON.stringify(p.decisions?.filter?.((d) => d.rowId === Y).map((d) => d.kind) ?? []))
check('E4-2 (ii) Shift+A の一覧を開いている間に別のタブが 2 位を理由つきで採用したら、1 で黙って 1 位に上書きしない', rY.adoptedSupplierId === scY[1] || /別のタブ|変わりました/.test(tA2), `${rY.adoptedSupplierId} toast=${tA2}`)
// (iii) A が行に居るあいだに B が 2 位を理由つきで採用 → A が a
const [Z, scZ] = cands.slice(2).find((c) => c[2][0] - c[2][1] <= 4.5)
await t.goto(Z)
await goto2(Z); await press2('Shift+A'); await press2('2'); await press2('1'); await p2.getByTestId('prompt-text').press('Enter'); await p2.waitForTimeout(150)
log('B adopt 2nd Z →', await toast2()); await page.waitForTimeout(400)
await t.press('a'); await page.waitForTimeout(150); const tA3 = await t.toast(); p = await t.proj()
log('A a →', tA3, '| final', h.show(p, Z))
check('E4-3 (iii) 別のタブが理由つきで 2 位を採用した行で a を押しても、黙って 1 位に上書きしない', p.rows.find((r) => r.id === Z).adoptedSupplierId === scZ[1], tA3)
await t.shot('e4')
summary(); await t.close()
