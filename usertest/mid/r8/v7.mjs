// v7: 先行発注判断（M-07）・先行採用 → 発注、拮抗の x、提出後の設計変更（表記修正 / 再見積要 / 発注数要確認 / 再発行）と再見積・正式依頼
import { launch, check, log, summary } from './lib.mjs'
const t = await launch()
const { page } = t
await t.open('design')
// 一括採用（拮抗を作る）
log('bulk →', await t.bulk())
let p = await t.proj(); const ct = p.rows.find((r) => r.flags.contested); log('contested', ct.id)
await t.role('purchasing'); await t.press('1'); await t.goto(ct.id); await t.press('x'); await page.waitForTimeout(60); log('purchasing x on contested →', await t.toast())
check('M3 拮抗バッジは選定者（設計）だけが外せる', (await t.row(ct.id)).flags.contested === true, JSON.stringify((await t.row(ct.id)).flags))
// 設計: 下書き R076〜R080 を公開 → 購買が概算依頼 → 長納期を入れる → 先行発注判断
await t.role('design'); await t.press('Control+Enter'); await page.waitForTimeout(100); let pn = await t.panel(); if (pn?.kind === 'prompt') { await t.press('1'); await page.waitForTimeout(100) }
log('publish →', await t.toast())
await t.role('purchasing'); await t.cmd('概算見積を依頼'); await page.waitForTimeout(60); await t.press('Enter'); await page.waitForTimeout(800); log('request →', await t.toast())
await t.press('6')
const lines = ['R076', 'R077', 'R078'].map((id, i) => [[5000 + i * 10, 45, '', '受注生産', '2026-12-31'], [5100, 40, '', '受注生産', '2026-12-31'], [5200, 50, '', '受注生産', '2026-12-31']].map((x) => x.join('\t')).join('\t')).join('\n')
await page.evaluate((txt) => navigator.clipboard.writeText(txt), lines)
await t.goto('R076'); await t.colKey('q.unitPrice@S1'); await t.press('Control+v'); await page.waitForTimeout(300); log('paste →', await t.toast())
p = await t.proj(); log('R076-78', p.rows.filter((r) => ['R076', 'R077', 'R078'].includes(r.id)).map((r) => `${r.id}:${r.status}:${JSON.stringify(r.flags)}`).join(' '))
// R079: 1 社だけ回答（見積中）→ 設計が Alt+A で先行採用
await t.goto('R079'); await t.colKey('q.unitPrice@S2'); await t.press('Enter'); await t.type('777'); await t.press('Tab'); await t.type('3'); await t.press('Enter'); await page.waitForTimeout(60); await t.press('Escape')
log('R079', (await t.row('R079')).status)
await t.role('design'); await t.press('1'); await t.goto('R079'); await t.press('Control+Alt+a'); await page.waitForTimeout(60); await t.press('2'); await page.waitForTimeout(80); log('Alt+A →', await t.toast())
// PM: 先行発注判断 R076 を y、先行採用 R079 を y
await t.role('pm'); await t.press('7')
await t.goto('R076'); await t.press('Enter'); await page.waitForTimeout(60); pn = await t.panel(); log('PM panel R076:', pn?.title, JSON.stringify(pn?.options)); await t.press('Escape')
await t.goto('R076'); await t.press('y'); await page.waitForTimeout(60); pn = await t.panel(); log('y dialog', JSON.stringify(pn)?.slice(0, 160))
if (pn?.extra && '承認者' in pn.extra) await t.extraFill('承認者', '部長')
await t.promptFill('長納期のため先行'); await t.press('Enter'); await page.waitForTimeout(80); log('y →', await t.toast())
let r = await t.row('R076'); p = await t.proj()
const sc76 = await page.evaluate(async () => { const sc = await import(window.__m('/src/model/score.ts')); const s = (await import(window.__m('/src/model/store.ts'))).useStore.getState(); const p = s.project(); return sc.scoreRow(p, p.rows.find((x) => x.id === 'R076'), s.ws.suppliers).map((x) => x.supplierId + ':' + x.total) })
log('R076 after y', r.status, r.adoptedSupplierId, r.orderQty, JSON.stringify(r.flags), 'scores', sc76)
check('M-07 先行発注判断の y で推奨商社が採用され選定済＋先行', r.status === 'selected' && r.adoptedSupplierId === sc76[0].split(':')[0] && r.flags.early)
await t.goto('R079'); await t.press('y'); await page.waitForTimeout(60); pn = await t.panel(); if (pn?.extra && '承認者' in pn.extra) await t.extraFill('承認者', '部長'); await t.promptFill('先行'); await t.press('Enter'); await page.waitForTimeout(80)
r = await t.row('R079'); log('R079 after y', r.status, r.adoptedSupplierId, JSON.stringify(r.flags))
// 購買: 発注
await t.role('purchasing'); await page.getByTestId('view-3').click(); await page.locator('.gridwrap').focus()
for (const id of ['R076', 'R079']) { await t.goto(id); await t.colKey('ordered'); await t.press('o'); await page.waitForTimeout(60); r = await t.row(id); log('o', id, '→', await t.toast(), r.status, r.adoptedSupplierId, await t.cellText(id, 'amount')) }
check('M-07b 先行の行は採用商社・金額つきで発注できる', (await t.row('R076')).status === 'ordered' && !!(await t.cellText('R076', 'amount')))
// 先行発注を申請（購買）: 状態のチェック
await t.press('1'); await t.goto('R080'); await t.cmd('先行発注を申請'); await page.waitForTimeout(60); pn = await t.panel(); log('ltb request on', (await t.row('R080')).status, JSON.stringify(pn)?.slice(0, 120))
if (pn) { await t.promptFill('LTB'); await t.press('Enter'); await page.waitForTimeout(60) }
log('R080 after ltb request', JSON.stringify((await t.row('R080')).flags), (await t.row('R080')).status)

// 提出後の設計変更
await t.role('design'); await t.press('1')
// R061: 全角の型式を半角に（表記だけの変更 → 表記修正）
log('R061 model', (await t.row('R061')).model, (await t.row('R061')).status)
log(await t.setCellKey('R061', 'model', 'MT-2.5 白'))
// R020: 意味のある型式変更（採用済）
log('R020', (await t.row('R020')).status, (await t.row('R020')).adoptedSupplierId)
log(await t.setCellKey('R020', 'model', 'S-T25 AC200V'))
// R025: 必要数 3 → 4（+33%）, R035: 6 → 7（+17%）
log('R025', (await t.row('R025')).qtyNeeded, (await t.row('R025')).status, 'R035', (await t.row('R035')).qtyNeeded, (await t.row('R035')).status)
log(await t.setCellKey('R025', 'qtyNeeded', '4'))
log(await t.setCellKey('R035', 'qtyNeeded', '7'))
// R002（選定済）の必要数 2 → 3 で発注数の再計算、R001 は購買が発注数を手で変えてから
await t.role('purchasing'); await t.press('1'); await t.showCol('orderQty'); log(await t.setCellKey('R003', 'orderQty', '5'))
await t.role('design'); await t.press('1')
log(await t.setCellKey('R003', 'qtyNeeded', '3'))
await t.press('Control+Enter'); await page.waitForTimeout(100); pn = await t.panel(); log('publish dialog', pn?.title); if (pn?.kind === 'prompt') { await t.press('2'); await page.waitForTimeout(100) }
pn = await t.panel(); if (pn) { log('2nd', pn.title); await t.press('Enter'); await page.waitForTimeout(80) }
log('publish →', await t.toast())
p = await t.proj()
for (const id of ['R061', 'R020', 'R025', 'R035', 'R003']) { const x = p.rows.find((y) => y.id === id); log(id, x.status, 'adopt', x.adoptedSupplierId, 'oq', x.orderQty, JSON.stringify(x.flags), 'live quotes', p.quotes.filter((q) => q.rowId === id && !q.stale && q.unitPrice != null).length) }
const g = (id) => p.rows.find((y) => y.id === id)
check('M3 型式の全角→半角だけの変更は表記修正（見積は有効のまま）', g('R061').flags.notation && !g('R061').flags.requote, JSON.stringify(g('R061').flags))
check('S 意味のある型式変更 → 再見積要・採用解除・見積失効', g('R020').flags.requote && !g('R020').adoptedSupplierId)
check('S 必要数 +33%（>20%）→ 再見積要', g('R025').flags.requote === true)
check('S 必要数 +17%（≤20%）→ 再見積要にしない', !g('R035').flags.requote)
check('S 発注数を手で変えた行の必要数変更 → 発注数要確認', g('R003').flags.orderQtyCheck === true)
// 再見積要の行が正式見積依頼に入るか
await t.role('purchasing'); await t.cmd('正式見積を依頼（社外）', '正式見積を依頼'); await page.waitForTimeout(100); pn = await t.panel(); log('formal confirm', pn?.title)
await t.press('2'); await page.waitForTimeout(1500); log('formal →', await t.toast())
p = await t.proj(); log('R025 after formal request', g('R025').status, '→', p.rows.find((y) => y.id === 'R025').status, JSON.stringify(p.rows.find((y) => y.id === 'R025').flags))
check('M3 再見積要（数量 +33%）の行は正式見積依頼から外れる', p.rows.find((y) => y.id === 'R025').status !== 'formalRequested')
summary(); await t.close()
