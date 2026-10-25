// v4: 案件納期の前倒し → 影響試算 → 納期NG の決定（b / p / d / e / 受入）、発注済の納期NG
// 再検証: M-18, M-19, M-20, M-21, M-29, M-01(e の上限金額)
import { launch, check, log, summary } from './lib.mjs'
const t = await launch()
const { page } = t
await t.open('design')
log('bulk →', await t.bulk())
await t.role('purchasing')
await t.cmd('正式見積を依頼（社外）', '正式見積を依頼'); await page.waitForTimeout(100); await t.press('2'); await page.waitForTimeout(1500); log('formal →', await t.toast())
let p = await t.proj()
// R005〜R007 を概算どおりの正式単価で正式見積済 → R005 を発注
await t.press('8')
for (const id of ['R005', 'R006', 'R007']) { const r = p.rows.find((x) => x.id === id); const q = p.quotes.find((x) => x.rowId === id && x.supplierId === r.adoptedSupplierId && !x.stale); await t.setCellKey(id, 'q.formalPrice@A', String(q.unitPrice)); await t.press('Escape') }
await t.press('Escape'); await page.getByTestId('view-3').click(); await page.locator('.gridwrap').focus()
await t.goto('R005'); await t.press('o'); await page.waitForTimeout(60); log('o R005 →', await t.toast(), (await t.row('R005')).status)
// PM: 予算を上げて（上長決裁の予算条件を外す）、納期を前倒し
await t.role('pm')
await t.cmd('案件設定'); await page.waitForTimeout(80)
let pn = await t.panel(); log('settings panel kind', pn?.kind)
const fields = await page.getByTestId('settings').textContent(); log('settings:', fields.slice(0, 160))
async function setField(label, value) {
  const items = await page.getByTestId('settings').locator('.opt, li, div.row').allTextContents()
  const idx = await page.evaluate(async (label) => { const m = await import(window.__m('/src/ui/settingsFields.ts')); const s = (await import(window.__m('/src/model/store.ts'))).useStore.getState(); return m.settingsFields(s.project()).findIndex((f) => f.label.startsWith(label)) }, label)
  const cur = (await t.panel()).index
  for (let i = cur; i < idx; i++) await t.press('ArrowDown')
  for (let i = cur; i > idx; i--) await t.press('ArrowUp')
  await t.press('Enter'); await page.getByTestId('settings-input').fill(value); await t.press('Enter'); await page.waitForTimeout(40)
}
await setField('予算', '100000000')
const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10)
const addD = (d, n) => new Date(new Date(d).getTime() + n * 86400e3).toISOString().slice(0, 10)
const newDue = addD(today, 15)
await setField('案件納期', newDue)
await t.press('Control+Enter'); await page.waitForTimeout(150)
pn = await t.panel(); log('impact:', JSON.stringify(pn?.lines ?? pn))
check('M-29 影響試算に総額差・特急費概算', (pn?.lines ?? []).some((l) => /総額差/.test(l)) && (pn?.lines ?? []).some((l) => /特急費/.test(l)))
await t.shot('v4-impact')
await t.press('Enter'); await page.waitForTimeout(60); pn = await t.panel(); log('reason dialog:', JSON.stringify(pn)?.slice(0, 200))
await t.promptFill('客先の前倒し要求'); if (pn?.options?.length) { await t.press('ArrowDown'); }
await t.press('Enter'); await page.waitForTimeout(100); pn = await t.panel(); log('2nd:', JSON.stringify(pn)?.slice(0, 160)); if (pn?.kind === 'prompt') { await t.press('2'); await page.waitForTimeout(100); if ((await t.panel())?.kind === 'prompt') { await page.keyboard.press('Enter'); await page.waitForTimeout(100) } }
p = await t.proj(); log('due', p.dueDate, 'budget', p.settings.budget)
const ng = p.rows.filter((r) => r.flags.leadNG); log('leadNG rows', ng.map((r) => `${r.id}:${r.status}`).join(' '))
await t.press('7'); const v7 = await t.viewRows(); log('PM 7:', v7.length)
// 必要日
const need = addD(newDue, -p.settings.processDays)
log('need', need)
const ldOf = (r) => { const q = p.quotes.find((x) => x.rowId === r.id && x.supplierId === r.adoptedSupplierId && !x.stale); return q?.stock === '在庫' ? 0 : (q?.formalLeadDays ?? q?.leadDays) }
// 次点が必要日を満たす商社を持つ formalRequested の行を探す
const meets = (r) => p.quotes.filter((q) => q.rowId === r.id && !q.stale && q.unitPrice != null && q.leadDays != null && q.leadDays >= 0 && q.supplierId !== r.adoptedSupplierId && addD(today, q.stock === '在庫' ? 0 : q.leadDays) <= need)
const frNG = ng.filter((r) => r.status === 'formalRequested')
const rowB = frNG.find((r) => meets(r).length) ; const rowNoB = frNG.find((r) => !meets(r).length && r.id !== rowB?.id)
const rest = frNG.filter((r) => r.id !== rowB?.id && r.id !== rowNoB?.id)
const [rowP, rowD, rowE, rowY] = rest
log('rows: b', rowB?.id, 'noB', rowNoB?.id, 'p', rowP?.id, 'd', rowD?.id, 'e', rowE?.id, 'Y', rowY?.id)
async function decide(id, key, text = '', extra) {
  await t.goto(id); await t.press('Enter'); await page.waitForTimeout(60); const panel = await t.panel()
  await t.press(key); await page.waitForTimeout(60); const pr = await t.panel()
  if (pr?.kind === 'prompt') { if (text) await t.promptFill(text); if (extra) for (const [k, v] of Object.entries(extra)) await t.extraFill(k, v); await t.press('Enter'); await page.waitForTimeout(80) }
  return { panel, prompt: pr, after: await t.panel(), toast: await t.toast() }
}
// b（次点は必要日を満たす商社）
let res = await decide(rowB.id, 'b'); let r = await t.row(rowB.id); p = await t.proj()
const nq = p.quotes.find((q) => q.rowId === r.id && q.supplierId === r.adoptedSupplierId && !q.stale)
log('b panel', JSON.stringify(res.panel?.options), '→', res.toast, r.adoptedSupplierId, 'lead', nq?.leadDays, nq?.stock, 'arrive', addD(today, nq?.stock === '在庫' ? 0 : nq?.leadDays ?? 0), 'need', need, r.status, JSON.stringify(r.flags))
check('M-20 b 次点は必要日を満たす商社', addD(today, nq?.stock === '在庫' ? 0 : nq?.leadDays ?? 999) <= need && !r.flags.leadNG)
// 次点の無い行の b
res = await decide(rowNoB.id, 'b'); log('b on no-candidate row', rowNoB.id, '→', res.toast, JSON.stringify((await t.row(rowNoB.id)).flags))
await t.press('Escape')
// p 委譲 → 購買が Shift+A で選び直せる（PM 承認不要）
res = await decide(rowP.id, 'p', ''); r = await t.row(rowP.id); log('p →', res.toast, r.status, JSON.stringify(r.flags))
// d → 納期NG の指摘（R=設計）
res = await decide(rowD.id, 'd', ''); r = await t.row(rowD.id); p = await t.proj()
const iD = p.issues.filter((i) => i.rowId === rowD.id); log('d →', res.toast, JSON.stringify(r.flags), iD.map((i) => `${i.kind}:${i.status}:${i.dueAt}`), 'ball', await t.cellText(rowD.id, 'ball'))
check('M-19 PM の d（納期NG）で起票された指摘は設計のボール', (await t.cellText(rowD.id, 'ball')) === '設計' && iD.some((i) => i.kind === '納期NG'))
const bd1 = await page.evaluate(async (today) => { const m = await import(window.__m('/src/model/dates.ts')); return m.addBusinessDays(today, 1, []) }, today)
check('M-34b 納期NG の指摘の期限は 1 営業日（§6.2）', iD.find((i) => i.kind === '納期NG')?.dueAt === bd1, `${iD.find((i) => i.kind === '納期NG')?.dueAt} vs ${bd1}`)
// e 特急・分納（上限金額）
res = await decide(rowE.id, 'e', '特急で', { 上限金額: '50000' }); p = await t.proj(); const de = p.decisions.filter((d) => d.rowId === rowE.id).at(-1)
log('e prompt extra', JSON.stringify(res.prompt?.extra), '→', res.toast, JSON.stringify(de))
check('M-01e e の上限金額が決定に記録される', de?.payload?.amount === 50000)
// 発注済の行の納期NG: R005 に入荷予定（必要日より後）
await t.role('purchasing'); await t.press('3'); log('R005', (await t.row('R005')).status)
log(await t.setCellKey('R005', 'promisedDate', addD(need, 5))); await t.press('Escape')
r = await t.row('R005'); log('R005 after promised', r.promisedDate, JSON.stringify(r.flags))
// 委譲された行を購買が選び直す
await t.press('1'); await t.goto(rowP.id); await t.press('Shift+A'); await page.waitForTimeout(80); pn = await t.panel(); log('purchasing Shift+A on 委譲 row:', JSON.stringify(pn)?.slice(0, 100), await t.toast())
if (pn?.kind === 'adopt') { await t.press('2'); await page.waitForTimeout(60); pn = await t.panel(); if (pn?.kind === 'prompt') { await t.press('1'); await page.waitForTimeout(80); if ((await t.panel())?.kind === 'prompt') { await page.keyboard.press('Enter'); await page.waitForTimeout(100) } } }
r = await t.row(rowP.id); log('after reselect', r.status, r.adoptedSupplierId, r.adoptReason, JSON.stringify(r.flags))
check('M-21 委譲された正式依頼中の行を購買が選び直せる（PM 承認不要）', !r.flags.pmPending && r.status === 'selected', `${r.status} ${JSON.stringify(r.flags)}`)
// PM: 発注済の納期NG の決定パネル
await t.role('pm'); await t.press('7'); await t.goto('R005'); await t.press('Enter'); await page.waitForTimeout(60); pn = await t.panel(); log('PM panel R005 ordered NG:', pn?.title, JSON.stringify(pn?.options)); await t.press('Escape')
check('M-18 発注済の納期NG は e / d / 受入 だけ（b・p なし）', (pn?.options ?? []).length > 0 && !(pn?.options ?? []).some((o) => /^b |^p /.test(o)))
// 受入（遅延許容）
res = await decide(rowY.id, 'Shift+Y', '遅延を客先了承'); r = await t.row(rowY.id); log('Y →', res.toast, JSON.stringify(r.flags))
// 設計: d の行で「代替なし」→ 対策不成立
await t.role('design'); await t.press('1'); await t.goto(rowD.id); await t.press(' '); await t.press('ArrowDown'); await t.press('Enter'); await page.waitForTimeout(60); pn = await t.panel(); log('design panel 納期NG:', JSON.stringify(pn?.options))
await t.press('7'); await page.waitForTimeout(60); await t.promptFill('代替品なし'); await t.press('Enter'); await page.waitForTimeout(80); await t.press('Escape'); await t.press('Escape')
await t.role('pm'); await t.press('7'); await t.goto(rowD.id); await t.press('Enter'); await page.waitForTimeout(60); pn = await t.panel(); log('PM panel 対策不成立(納期):', pn?.title, JSON.stringify(pn?.options)); await t.press('Escape')
r = await t.row(rowD.id); log(rowD.id, JSON.stringify(r.flags), 'status-cell', await t.cellText(rowD.id, 'status'))
await t.shot('v4-pm7')
summary(); await t.close()
