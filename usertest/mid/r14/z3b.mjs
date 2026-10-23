// z3b: 再交渉の印が残ったまま次の正式依頼に進む場合（先行発注判断を却下してから）、取消を断られた行の Ctrl+Z での戻し。元は z3: 再交渉で納期が縮んだ行の再判定と発注、再交渉の印が残ったまま次の正式依頼に進む場合、発注取消を商社に断られた場合の戻し方
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
const [G, H] = [lead[1], lead[1]]; log('leadNG rows', lead.join(','))
await t.role('purchasing'); log('formal →', await t.requestFormal())
// ---- B: H 正式依頼中の納期NG → d → 代替なし → g（再交渉中）→ 設計が数量を変えて公開（再見積要）→ 概算の取り直し → 採用 → 正式依頼
await t.role('pm'); await t.press('7'); await t.decide(H, 'd', '代替を'); await designNoAlt(H)
await t.role('pm'); await t.press('7'); let res = await t.decide(H, 'g', '再交渉'); log('g H →', res.toast)
await t.role('design'); await t.press('1'); const qty = p.rows.find((r) => r.id === H).qtyNeeded; log(await t.setCellKey(H, 'qtyNeeded', String(qty * 3))); log('publish →', await t.publish('1'))
p = await t.proj(); log('H after qty change', st(p, H))
await t.role('purchasing'); log('rough →', await t.requestRough())
p = await t.proj(); log('H after rough', st(p, H))
await t.press('6'); for (const q of p.quotes.filter((q) => q.rowId === H && !q.stale)) { await t.setCellKey(H, `q.unitPrice@${q.supplierId}`, '1000'); await t.press('Escape'); await t.setCellKey(H, `q.leadDays@${q.supplierId}`, '60'); await t.press('Escape') }
p = await t.proj(); log('H after answers (60 days)', st(p, H))
await t.role('design'); await t.press('1'); await t.goto(H); await t.press('a'); await page.waitForTimeout(80); log('design a H →', await t.toast())
p = await t.proj(); log('H selected', st(p, H))
const ngSelected = p.rows.find((r) => r.id === H).flags.leadNG
await t.role('pm'); await t.press('7'); await t.goto(H); await t.press('Enter'); await page.waitForTimeout(80); log('PM panel H', JSON.stringify((await t.panel())?.title), JSON.stringify((await t.panel())?.options)); await t.press('Escape')
await t.goto(H); await t.press('Shift+Y'); await page.waitForTimeout(80); if ((await t.panel())?.kind === 'prompt') { await t.promptFill('先行発注はしない'); await page.getByTestId('prompt-text').press('Enter'); await page.waitForTimeout(80) } log('PM Shift+Y H →', await t.toast())
p = await t.proj(); log('H after ltb reject', st(p, H))
await t.role('purchasing'); log('formal →', await t.requestFormal())
p = await t.proj(); log('H formalRequested', st(p, H))
await t.role('pm'); await t.press('7'); const pm7 = (await t.viewRows()).includes(H)
check('Z3b-1 再交渉の後に概算から取り直した行は、次の正式依頼中も納期NG（60 日で間に合わない）が PM の 7 に出る（前の再交渉の印で隠れない）', p.rows.find((r) => r.id === H).status === 'formalRequested' && (p.rows.find((r) => r.id === H).flags.leadNG && pm7), `selected leadNG=${ngSelected} → formalRequested leadNG=${p.rows.find((r) => r.id === H).flags.leadNG} PM7=${pm7} renegotiating=${p.rows.find((r) => r.id === H).flags.renegotiating}`)
// ---- C: 発注を外したあと、別の操作をしてから Ctrl+Z で戻せるか
p = await t.proj(); const K = p.rows.find((r) => r.status === 'formalRequested' && !r.flags.leadNG && !r.flags.contested && r.id !== H).id
const qK = p.quotes.find((q) => q.rowId === K && q.supplierId === p.rows.find((r) => r.id === K).adoptedSupplierId && !q.stale)
await t.role('purchasing'); await t.press('8'); await t.setCellKey(K, 'q.formalPrice@A', String(qK.unitPrice)); await t.press('Escape'); await t.press('Escape')
await page.getByTestId('view-3').click(); await page.locator('.gridwrap').focus(); log('o K', await t.order(K))
await t.press('1'); await t.goto(K); await t.press('Shift+I'); await t.press('h'); await page.waitForTimeout(60); await page.getByTestId('issue-text').fill('取消したい'); await page.getByTestId('issue-text').press('Enter'); await page.waitForTimeout(60); log('publish →', await t.publish())
await t.role('pm'); await t.press('7'); log('PM y →', (await t.yes(K, '承認')).toast)
await t.role('purchasing'); await page.getByTestId('view-3').click(); await page.locator('.gridwrap').focus(); await t.goto(K); await t.colKey('ordered'); await t.press('o'); await page.waitForTimeout(60); log('unorder K →', await t.toast())
await t.showCol('receivedLot'); await t.setCellKey('R002', 'receivedLot', 'LOT-1'); await t.press('Escape')
for (let i = 0; i < 2; i++) { await t.press('Control+z'); await page.waitForTimeout(80); log('Ctrl+Z', i + 1, '→', await t.toast()) }
p = await t.proj(); log('K after Ctrl+Z x2', st(p, K))
summary(); await t.close()
