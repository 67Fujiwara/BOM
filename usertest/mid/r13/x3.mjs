// x3: 対策不成立（§9.1・§16）: 発注済（b 無効）、発注前の納期NG に g 再交渉 / b 次点、差分超過 q → 数量変更不可 → b
import { launch, check, log, summary } from './lib.mjs'
const t = await launch()
const { page } = t
await t.open('design')
log('bulk →', await t.bulk())
let p = await t.proj()
const st = (p, rid) => { const r = p.rows.find((x) => x.id === rid); return `${rid}:${r.status}:ord=${!!r.ordered}:adopt=${r.adoptedSupplierId ?? '-'}:${JSON.stringify(r.flags)} issues=${p.issues.filter((i) => i.rowId === rid).map((i) => `${i.id}:${i.kind}:${i.status}`).join(',')}` }
const leadRows = p.rows.filter((r) => r.status === 'selected' && r.flags.leadNG && !r.flags.contested).map((r) => r.id)
log('selected & leadNG rows', leadRows.join(','))
const [D, E] = leadRows
async function designNoAlt(id, label = '代替なし') {
  await t.role('design'); await t.press('1'); await t.goto(id); await t.press(' '); await t.press('ArrowDown'); await t.press('Enter'); await page.waitForTimeout(80)
  const pn = await t.panel(); if (!pn?.options?.some((o) => o.startsWith('7'))) { log('no 7 option', JSON.stringify(pn?.options)); await t.press('Escape'); await t.press('Escape'); return }
  await t.press('7'); await page.waitForTimeout(80); await t.promptFill(label); await page.getByTestId('prompt-text').press('Enter'); await page.waitForTimeout(100); await t.press('Escape'); await t.press('Escape')
}
// ---- D: 発注前の納期NG → d → 代替なし → g 再交渉
await t.role('pm'); await t.press('7'); let res = await t.decide(D, 'd', '代替を'); log('PM d D →', res.toast)
await designNoAlt(D)
p = await t.proj(); log('D 対策不成立', st(p, D), 'ball', await t.cellText(D, 'ball'))
await t.role('pm'); await t.press('7'); await t.goto(D); await t.press('Enter'); await page.waitForTimeout(80); const pd = await t.panel(); log('PM panel D', pd?.title, JSON.stringify(pd?.options)); await t.press('Escape')
res = await t.decide(D, 'g', '価格・納期を再交渉'); log('PM g D →', res.toast)
p = await t.proj(); const rD = p.rows.find((r) => r.id === D); log('D after g', st(p, D), 'ball', await t.cellText(D, 'ball'), 'formalReqNo', JSON.stringify(p.quotes.find((q) => q.rowId === D && q.supplierId === rD.adoptedSupplierId && !q.stale)?.formalRequestNo))
await t.role('purchasing'); await t.press('8'); await t.goto(D); await t.shot('x3-renegotiate-formalRequested'); await t.role('pm')
check('X3-1 正式依頼前の行に「再交渉」しても、正式依頼を出していないのに正式依頼中にならない', rD.status !== 'formalRequested', st(p, D))
await t.role('purchasing'); await t.press('8'); log('purch 8 has D?', (await t.viewRows()).includes(D)); await t.press('4'); log('purch 4 has D?', (await t.viewRows()).includes(D))
await t.role('design'); await t.press('4'); log('design 4 has D?', (await t.viewRows()).includes(D))
// ---- E: 発注前の納期NG → d → 代替なし → b 次点
await t.role('pm'); await t.press('7'); res = await t.decide(E, 'd', '代替を'); await designNoAlt(E)
await t.role('pm'); await t.press('7'); res = await t.decide(E, 'b', ''); log('PM b E →', res.toast, JSON.stringify(res.after)?.slice(0, 100))
p = await t.proj(); log('E after b', st(p, E), 'ball', await t.cellText(E, 'ball'))
// ---- 正式見積 → 差分超過 F → q → 数量変更不可 → b
await t.role('purchasing'); log('formal →', await t.requestFormal())
p = await t.proj(); const F = p.rows.find((r) => r.status === 'formalRequested' && !r.flags.leadNG && !r.flags.contested && p.quotes.filter((q) => q.rowId === r.id && !q.stale && q.unitPrice != null).length === 3).id
const rF = p.rows.find((r) => r.id === F); const qF = p.quotes.find((q) => q.rowId === F && q.supplierId === rF.adoptedSupplierId && !q.stale)
await t.press('8'); await t.setCellKey(F, 'q.formalPrice@A', String(Math.round(qF.unitPrice * 1.5) + 20000)); await t.press('Escape'); await t.press('Escape')
p = await t.proj(); log('F diff', st(p, F))
await t.role('pm'); await t.press('7'); res = await t.decide(F, 'q', ''); log('PM q F →', res.toast)
await designNoAlt(F, '減らせない')
p = await t.proj(); log('F 対策不成立', st(p, F))
await t.role('pm'); await t.press('7'); await t.goto(F); await t.press('Enter'); await page.waitForTimeout(80); log('PM panel F', JSON.stringify((await t.panel())?.options)); await t.press('Escape')
res = await t.decide(F, 'b', ''); log('PM b F →', res.toast)
p = await t.proj(); log('F after b', st(p, F), 'ball', await t.cellText(F, 'ball'))
await t.role('purchasing'); await page.getByTestId('view-3').click(); await page.locator('.gridwrap').focus(); log('o F →', await t.order(F))
// ---- C: 発注済の納期NG → d → 代替なし → パネル
p = await t.proj(); const C = p.rows.find((r) => r.status === 'formalRequested' && !r.flags.leadNG && !r.flags.contested && r.id !== F).id
const rC = p.rows.find((r) => r.id === C); const qC = p.quotes.find((q) => q.rowId === C && q.supplierId === rC.adoptedSupplierId && !q.stale)
await t.press('8'); await t.setCellKey(C, 'q.formalPrice@A', String(qC.unitPrice)); await t.press('Escape'); await t.press('Escape')
await page.getByTestId('view-3').click(); await page.locator('.gridwrap').focus(); log('o C →', await t.order(C))
await t.showCol('promisedDate'); await t.setCellKey(C, 'promisedDate', '2026-12-20'); await t.press('Escape')
await t.role('pm'); await t.press('7'); res = await t.decide(C, 'd', '代替を'); log('PM d C →', res.toast)
await designNoAlt(C)
p = await t.proj(); log('C 対策不成立', st(p, C))
await t.role('pm'); await t.press('7'); await t.goto(C); await t.press('Enter'); await page.waitForTimeout(80); const pc = await t.panel(); log('PM panel C', pc?.title, JSON.stringify(pc?.options)); await t.press('Escape')
check('X3-2 発注済の対策不成立は b が無く、e と受入だけ', pc && !pc.options.some((o) => o.startsWith('b ')) && pc.options.some((o) => o.startsWith('e ')))
res = await t.decide(C, 'e', '納期短縮交渉', { 上限金額: '20000' }); log('PM e C →', res.toast, JSON.stringify(res.prompt?.extra))
p = await t.proj(); log('C after e', st(p, C), 'ball', await t.cellText(C, 'ball'))
summary(); await t.close()
