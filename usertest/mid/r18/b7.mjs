// b7: 上限超過の PM 決定（M8-04 の修正）: y で承認 → 上限が実費に → 再超過 → Shift+Y 却下 → 購買の 4 → 再入力、PM の Ctrl+Z、件数
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
const t = await launch(); const { page } = t; const h = helpers(t)
const raw = (k) => page.keyboard.rawPress(k)
await t.open('design'); await t.press('1'); log('bulk →', await t.bulk())
let p = await t.proj()
await t.role('pm'); await t.press('7')
const L = p.rows.filter((r) => r.status === 'selected' && r.flags.leadNG && !r.flags.contested).map((r) => r.id)[0]
log('L', L)
const r0 = await t.decide(L, 'e', '特急で', { 上限金額: '30000' }); log('e →', r0.toast)
const setCost = async (v) => { await t.role('purchasing'); await t.press('3'); await t.showCol('extraCost', 'extraCostKind'); const r = await t.setCellKey(L, 'extraCost', String(v)); await t.press('Escape'); return r }
const counts = async () => { await t.role('pm'); await t.press('7'); const hdr = await t.header(); const sb = await t.status(); return { in7: (await t.viewRows()).includes(L), c7: await t.viewCount(7), hdr: /PM待ち (\d+)/.exec(hdr)?.[1], sb: /要決定 (\d+)/.exec(sb)?.[1], case: await h.caseOf(L) } }
await setCost(45000); let c = await counts(); log('45000', JSON.stringify(c))
// PM: 部品名の列で素の y
await t.goto(L); await t.colKey('name'); await raw('y'); await page.waitForTimeout(100); let pn = await t.panel(); log('raw y panel', pn?.title)
if (pn?.kind === 'prompt') { await t.promptFill('実費で承認'); if (pn.extra && '承認者' in pn.extra) { await t.extraFill('承認者', '部長'); if ('決裁書No' in pn.extra) await t.extraFill('決裁書No', 'K-9') } await page.getByTestId('prompt-text').press('Enter'); await page.waitForTimeout(100) }
p = await t.proj(); const dLast = p.decisions.at(-1); log('after y', JSON.stringify(dLast), await t.toast())
c = await counts(); log('after approve', JSON.stringify(c))
check('B7-1 PM の素の y で上限超過を承認 → 7 から消え、上限が ¥45,000 に', !c.in7 && dLast.payload?.amount === 45000, JSON.stringify(c))
await t.goto(L); await t.press(' '); await page.waitForTimeout(80); const det = await page.getByTestId('detail').textContent(); await t.press(' '); log('detail', det.slice(det.indexOf('決定・履歴'), det.indexOf('決定・履歴') + 260))
// 再超過
await setCost(50000); c = await counts(); log('50000', JSON.stringify(c))
check('B7-2 引き上げた上限を再び超えたら 7 に戻る（上限 ¥45,000）', c.in7 && c.case === '上限超過', JSON.stringify(c))
check('B7-3 ヘッダーの PM待ちとステータスバーの要決定が一致', c.hdr === c.sb, JSON.stringify(c))
// 却下
await t.goto(L); await t.colKey('maker'); await raw('Shift+Y'); await page.waitForTimeout(100); pn = await t.panel(); if (pn?.kind === 'prompt') { await t.promptFill('上限内で'); await page.getByTestId('prompt-text').press('Enter'); await page.waitForTimeout(100) }
p = await t.proj(); log('after reject', JSON.stringify(p.rows.find((r) => r.id === L).flags), await t.toast())
c = await counts(); log('after reject', JSON.stringify(c))
await t.role('purchasing'); await t.press('4'); const pu4 = (await t.viewRows()).includes(L); await t.goto(L); await t.press('Home'); const sbP = await t.status(); log('purch 4 has L', pu4, sbP.slice(0, 200))
check('B7-4 却下で 7 から消え、購買の 4 に「上限内で手配し直す」行として残る', !c.in7 && pu4, `in7=${c.in7} pu4=${pu4}`)
// PM の Ctrl+Z で却下を戻す
await t.role('pm'); await t.press('7'); await t.press('Control+z'); await page.waitForTimeout(100); log('PM Ctrl+Z →', await t.toast()); c = await counts(); log('after undo', JSON.stringify(c))
check('B7-5 PM の Ctrl+Z で却下を戻すと 7 に戻る', c.in7, JSON.stringify(c))
await t.press('Control+y'); await page.waitForTimeout(100); log('PM Ctrl+Y →', await t.toast())
// 購買が上限内（45,000）に下げる
await setCost(44000); c = await counts(); log('44000', JSON.stringify(c))
check('B7-6 上限内に下げたら 7 に出ない', !c.in7, JSON.stringify(c))
await t.role('purchasing'); await t.press('4'); log('purch 4 has L after 44000', (await t.viewRows()).includes(L))
// 同じ額（却下した 50,000）をもう一度入れたら？
await setCost(50000); c = await counts(); log('50000 again (was rejected)', JSON.stringify(c))
check('B7-7 却下された額を購買がもう一度入れたら、PM の 7 に出る（黙って通らない）', c.in7, JSON.stringify(c))
summary(); await t.close()
