// z3: 再交渉で納期が縮んだ行の再判定と発注、再交渉の印が残ったまま次の正式依頼に進む場合、発注取消を商社に断られた場合の戻し方
import { launch, check, log, summary } from './lib.mjs'
const t = await launch()
const { page } = t
await t.open('design')
log('bulk →', await t.bulk())
let p = await t.proj()
const st = (p, rid) => { const r = p.rows.find((x) => x.id === rid); const q = p.quotes.find((x) => x.rowId === rid && x.supplierId === r.adoptedSupplierId && !x.stale); return `${rid}:${r.status}:ord=${!!r.ordered}:adopt=${r.adoptedSupplierId ?? '-'}:lead=${q?.leadDays}:flead=${q?.formalLeadDays}:fp=${q?.formalPrice}:${JSON.stringify(r.flags)} issues=${p.issues.filter((i) => i.rowId === rid).map((i) => `${i.id}:${i.kind}:${i.status}`).join(',')}` }
async function designNoAlt(id) {
  await t.role('design'); await t.press('1'); await t.goto(id); await t.press(' '); await t.press('ArrowDown'); await t.press('Enter'); await page.waitForTimeout(80)
  await t.press('7'); await page.waitForTimeout(80); await t.promptFill('代替なし'); await page.getByTestId('prompt-text').press('Enter'); await page.waitForTimeout(100); await t.press('Escape'); await t.press('Escape')
}
const lead = p.rows.filter((r) => r.status === 'selected' && r.flags.leadNG && !r.flags.contested).map((r) => r.id)
const [G, H] = lead; log('leadNG rows', lead.join(','))
await t.role('purchasing'); log('formal →', await t.requestFormal())
// ---- A: G 正式依頼中の納期NG → d → 代替なし → g → 購買が短い正式納期で回答 → 納期NG が消え、発注できる
await t.role('pm'); await t.press('7'); await t.decide(G, 'd', '代替を'); await designNoAlt(G)
await t.role('pm'); await t.press('7'); let res = await t.decide(G, 'g', '納期短縮を交渉'); log('g →', res.toast)
p = await t.proj(); log('G after g', st(p, G))
await t.role('purchasing'); await t.press('8'); await t.showCol('q.formalLeadDays@A')
const qG = p.quotes.find((q) => q.rowId === G && q.supplierId === p.rows.find((r) => r.id === G).adoptedSupplierId && !q.stale)
let msg = 'n/a'; try { msg = await t.setCellKey(G, 'q.formalLeadDays@A', '3') } catch (e) { msg = 'ERR ' + e.message.slice(0, 80) } ; await t.press('Escape'); log('formal lead 3 →', msg)
log(await t.setCellKey(G, 'q.formalPrice@A', String(qG.unitPrice))); await t.press('Escape'); await t.press('Escape')
p = await t.proj(); log('G after short formal lead', st(p, G))
await page.getByTestId('view-3').click(); await page.locator('.gridwrap').focus(); const oG = await t.order(G); p = await t.proj(); log('o G →', oG, st(p, G))
check('Z3-1 再交渉で正式納期が必要日に間に合えば、納期NG が消えて正式見積済 → 発注できる', p.rows.find((r) => r.id === G).ordered && !p.rows.find((r) => r.id === G).flags.leadNG, st(p, G))
// ---- B: H 正式依頼中の納期NG → d → 代替なし → g（再交渉中）→ 設計が数量を変えて公開（再見積要）→ 概算の取り直し → 採用 → 正式依頼
await t.role('pm'); await t.press('7'); await t.decide(H, 'd', '代替を'); await designNoAlt(H)
await t.role('pm'); await t.press('7'); res = await t.decide(H, 'g', '再交渉'); log('g H →', res.toast)
await t.role('design'); await t.press('1'); const qty = p.rows.find((r) => r.id === H).qtyNeeded; log(await t.setCellKey(H, 'qtyNeeded', String(qty * 3))); log('publish →', await t.publish('1'))
p = await t.proj(); log('H after qty change', st(p, H))
await t.role('purchasing'); log('rough →', await t.requestRough())
p = await t.proj(); log('H after rough', st(p, H))
await t.press('6'); for (const q of p.quotes.filter((q) => q.rowId === H && !q.stale)) { await t.setCellKey(H, `q.unitPrice@${q.supplierId}`, '1000'); await t.press('Escape'); await t.setCellKey(H, `q.leadDays@${q.supplierId}`, '60'); await t.press('Escape') }
p = await t.proj(); log('H after answers (60 days)', st(p, H))
await t.role('design'); await t.press('1'); await t.goto(H); await t.press('a'); await page.waitForTimeout(80); log('design a H →', await t.toast())
p = await t.proj(); log('H selected', st(p, H))
const ngSelected = p.rows.find((r) => r.id === H).flags.leadNG
await t.role('purchasing'); log('formal →', await t.requestFormal())
p = await t.proj(); log('H formalRequested', st(p, H))
await t.role('pm'); await t.press('7'); const pm7 = (await t.viewRows()).includes(H)
check('Z3-2 再交渉の後に概算から取り直した行は、次の正式依頼中も納期NG（60 日で間に合わない）が PM の 7 に出る（前の再交渉の印で隠れない）', !ngSelected || (p.rows.find((r) => r.id === H).flags.leadNG && pm7), `selected leadNG=${ngSelected} → formalRequested leadNG=${p.rows.find((r) => r.id === H).flags.leadNG} PM7=${pm7} renegotiating=${p.rows.find((r) => r.id === H).flags.renegotiating}`)
// ---- C: 発注取消を商社に断られた: 承認 → 外す → 元の発注に戻す手段
p = await t.proj(); const K = p.rows.find((r) => r.status === 'formalRequested' && !r.flags.leadNG && !r.flags.contested && r.id !== G && r.id !== H).id
const qK = p.quotes.find((q) => q.rowId === K && q.supplierId === p.rows.find((r) => r.id === K).adoptedSupplierId && !q.stale)
await t.role('purchasing'); await t.press('8'); await t.setCellKey(K, 'q.formalPrice@A', String(qK.unitPrice)); await t.press('Escape'); await t.press('Escape')
await page.getByTestId('view-3').click(); await page.locator('.gridwrap').focus(); log('o K', await t.order(K))
await t.press('1'); await t.goto(K); await t.press('Shift+I'); await t.press('h'); await page.waitForTimeout(60); await page.getByTestId('issue-text').fill('取消したい'); await page.getByTestId('issue-text').press('Enter'); await page.waitForTimeout(60); log('publish →', await t.publish())
await t.role('pm'); await t.press('7'); log('PM y →', (await t.yes(K, '承認')).toast)
await t.role('purchasing'); await page.getByTestId('view-3').click(); await page.locator('.gridwrap').focus(); await t.goto(K); await t.colKey('ordered'); await t.press('o'); await page.waitForTimeout(60); log('unorder K →', await t.toast())
// 他の作業（別の行のセル）をしてから、商社が取消を断ったと分かる
await t.showCol('receivedLot'); await t.setCellKey(G, 'receivedLot', 'LOT-1'); await t.press('Escape')
const tries = {}
await t.goto(K); await t.colKey('ordered'); await t.press('o'); await page.waitForTimeout(60); tries.o = await t.toast()
await t.goto(K); await t.press('Home'); await t.press('Control+.'); await page.waitForTimeout(80); tries.purchQF = JSON.stringify((await t.panel())?.options); if (await t.panel()) await t.press('Escape')
await t.goto(K); await t.press('Shift+I'); await page.waitForTimeout(60); await t.press('h'); await page.waitForTimeout(60); tries.raise = (await t.panel())?.step + ' ' + await t.toast(); if (await t.panel()) { await t.press('Escape'); await t.press('Escape') }
await t.role('pm'); await t.press('7'); tries.pm7 = (await t.viewRows()).includes(K); await t.press('1'); await t.goto(K); await t.press('Enter'); await page.waitForTimeout(80); tries.pmEnter = JSON.stringify((await t.panel())?.options) + ' ' + await t.toast(); if (await t.panel()) await t.press('Escape')
await t.role('design'); await t.press('1'); await t.goto(K); await t.press('Home'); await t.press('Control+.'); await page.waitForTimeout(80); tries.designQF = JSON.stringify((await t.panel())?.options); if (await t.panel()) await t.press('Escape')
p = await t.proj(); log('K', st(p, K)); log(JSON.stringify(tries, null, 1))
check('Z3-3 発注取消を商社に断られたとき、元の発注に戻す手段がある（購買の o / PM の決定 / 候補のどれか）', !/置き換え/.test(tries.o), JSON.stringify(tries).slice(0, 300))
summary(); await t.close()
