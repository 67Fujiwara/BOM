// y3: 再交渉（g）の出る場面と結果（M5-06 の再検証）: 発注前・正式依頼前の対策不成立 / 正式依頼中の納期NG → d → 代替なし → g / 差分超過 g → 購買の再入力
import { launch, check, log, summary } from './lib.mjs'
const t = await launch()
const { page } = t
await t.open('design')
log('bulk →', await t.bulk())
let p = await t.proj()
const st = (p, rid) => { const r = p.rows.find((x) => x.id === rid); const q = p.quotes.find((x) => x.rowId === rid && x.supplierId === r.adoptedSupplierId && !x.stale); return `${rid}:${r.status}:adopt=${r.adoptedSupplierId}:lead=${q?.leadDays}:fp=${q?.formalPrice}:prevfp=${q?.prevFormalPrice}:${JSON.stringify(r.flags)} due=${r.dueAt} issues=${p.issues.filter((i) => i.rowId === rid).map((i) => `${i.id}:${i.kind}:${i.status}`).join(',')}` }
async function designNoAlt(id, label = '代替なし') {
  await t.role('design'); await t.press('1'); await t.goto(id); await t.press(' '); await t.press('ArrowDown'); await t.press('Enter'); await page.waitForTimeout(80)
  const pn = await t.panel(); if (!pn?.options?.some((o) => o.startsWith('7'))) { log('no 7 option', JSON.stringify(pn?.options)); await t.press('Escape'); await t.press('Escape'); return }
  await t.press('7'); await page.waitForTimeout(80); await t.promptFill(label); await page.getByTestId('prompt-text').press('Enter'); await page.waitForTimeout(100); await t.press('Escape'); await t.press('Escape')
}
const leadRows = p.rows.filter((r) => r.status === 'selected' && r.flags.leadNG && !r.flags.contested).map((r) => r.id)
log('selected & leadNG', leadRows.join(','))
const [D, G] = leadRows
// ---- D: 選定済（正式依頼前）の納期NG → d → 代替なし → パネルに g が無い
await t.role('pm'); await t.press('7'); let res = await t.decide(D, 'd', '代替を'); await designNoAlt(D)
await t.role('pm'); await t.press('7'); await t.goto(D); await t.press('Enter'); await page.waitForTimeout(80); const pd = await t.panel(); log('PM panel D', pd?.title, JSON.stringify(pd?.options)); await t.press('g'); await page.waitForTimeout(80); log('g on D →', await t.toast()); if (await t.panel()) await t.press('Escape')
p = await t.proj(); log('D', st(p, D))
check('Y3-1 正式依頼前の対策不成立の決定パネルに g（再交渉）が無く、g を押しても状態が変わらない', !pd.options.some((o) => o.startsWith('g ')) && p.rows.find((r) => r.id === D).status === 'selected')
// ---- G: 正式依頼中の納期NG → d → 代替なし → g
await t.role('purchasing'); log('formal →', await t.requestFormal())
p = await t.proj(); log('G before', st(p, G))
await t.role('pm'); await t.press('7'); res = await t.decide(G, 'd', '代替を'); log('PM d G →', res.toast); await designNoAlt(G)
p = await t.proj(); log('G 対策不成立', st(p, G))
await t.role('pm'); await t.press('7'); await t.goto(G); await t.press('Enter'); await page.waitForTimeout(80); const pg = await t.panel(); log('PM panel G', pg?.title, JSON.stringify(pg?.options)); await t.press('Escape')
res = await t.decide(G, 'g', '納期を再交渉'); log('PM g G →', res.toast)
p = await t.proj(); log('G after g', st(p, G), 'ball', await t.cellText(G, 'ball'))
await t.role('purchasing'); await t.press('4'); const pu4 = (await t.viewRows()).includes(G); await t.press('8'); const pu8 = (await t.viewRows()).includes(G); await t.role('design'); await t.press('4'); const de4 = (await t.viewRows()).includes(G)
log('G purch4', pu4, 'purch8', pu8, 'design4', de4)
await t.role('purchasing'); await t.press('8'); await t.goto(G); await t.shot('y3-formal-lead-renegotiate')
const rG = p.rows.find((r) => r.id === G)
check('Y3-2 正式依頼中の納期NG の対策不成立に g → ボールは購買（交渉）。設計（代替なしと答えた）に戻らない', (await t.cellText(G, 'ball')) === '購買' && !de4, `ball=${await t.cellText(G, 'ball')} design4=${de4} cm=${rG.flags.countermeasure}`)
// 再交渉が不成立（納期は変わらず）で正式回答を入れる → 納期NG が PM に戻るか
const qG = p.quotes.find((q) => q.rowId === G && q.supplierId === rG.adoptedSupplierId && !q.stale)
await t.press('8'); log(await t.setCellKey(G, 'q.formalPrice@A', String(qG.unitPrice))); await t.press('Escape'); await t.press('Escape')
p = await t.proj(); log('G after formal answer (same lead)', st(p, G), 'ball', await t.cellText(G, 'ball'))
await t.role('pm'); await t.press('7'); const pm7 = (await t.viewRows()).includes(G); log('PM 7 has G?', pm7)
await t.role('purchasing'); await page.getByTestId('view-3').click(); await page.locator('.gridwrap').focus(); const og = await t.order(G); log('o G →', og)
p = await t.proj(); log('G', st(p, G))
check('Y3-3 再交渉で納期が縮まなかった行は、納期NG（PM の決定待ち）に戻り、受入なしに発注されない', pm7 || !p.rows.find((r) => r.id === G).ordered, `PM7=${pm7} ordered=${p.rows.find((r) => r.id === G).ordered}`)
// ---- F: 差分超過 → g → 購買が再交渉の単価を入れる
p = await t.proj(); const F = p.rows.find((r) => r.status === 'formalRequested' && !r.flags.leadNG && !r.flags.contested && p.quotes.filter((q) => q.rowId === r.id && !q.stale && q.unitPrice != null).length === 3).id
const rF = p.rows.find((r) => r.id === F); const qF = p.quotes.find((q) => q.rowId === F && q.supplierId === rF.adoptedSupplierId && !q.stale)
await t.press('8'); await t.setCellKey(F, 'q.formalPrice@A', String(Math.round(qF.unitPrice * 1.5) + 20000)); await t.press('Escape'); await t.press('Escape')
await t.role('pm'); await t.press('7'); await t.goto(F); await t.press('Enter'); await page.waitForTimeout(80); log('PM panel F', JSON.stringify((await t.panel())?.options)); await t.press('Escape')
res = await t.decide(F, 'g', '価格を再交渉'); log('PM g F →', res.toast)
p = await t.proj(); log('F after g', st(p, F), 'ball', await t.cellText(F, 'ball'))
await t.role('purchasing'); await t.press('8'); log('purch 8 has F', (await t.viewRows()).includes(F)); log(await t.setCellKey(F, 'q.formalPrice@A', String(qF.unitPrice))); await t.press('Escape'); await t.press('Escape')
p = await t.proj(); log('F after re-entry', st(p, F))
check('Y3-4 差分超過 g → 購買が交渉後の単価を入れると閾値内で正式見積済', p.rows.find((r) => r.id === F).status === 'formalQuoted')
await t.goto(F); await t.press(' '); await page.waitForTimeout(80); log('detail F', (await page.getByTestId('detail').textContent()).match(/決定・履歴.{0,300}/)?.[0]); await t.press(' ')
summary(); await t.close()
