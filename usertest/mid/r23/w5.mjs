// w5: 購買の 4（取込不一致・期限切れ・未回答）、先行発注の申請（理由・金額）、拮抗
import { launch, check, log, summary } from './lib.mjs'
const t = await launch()
const { page } = t
await t.open('purchasing')
let p = await t.proj()
const st = (p, id) => { const r = p.rows.find((x) => x.id === id); return `${id}:${r.status}:adopt=${r.adoptedSupplierId ?? '-'}:reason=${r.adoptReason ?? ''}:${JSON.stringify(r.flags)}` }
// 取込: R016（設計の指摘あり＝ボール設計）と R003（ボール？）に型式違いの回答
log('ball R016', await t.cellText('R016', 'ball'), 'R003', await t.cellText('R003', 'ball'), 'R030', await t.cellText('R030', 'ball'))
await t.cmd('見積回答を取り込む'); await page.waitForTimeout(80); await t.press('Enter'); await page.waitForTimeout(80)
const r16 = p.rows.find((r) => r.id === 'R016'), r30 = p.rows.find((r) => r.id === 'R030')
const imp = ['行ID\t型式\t単価\t納期', `R016\tXX-${r16.model}\t1000\t5`, `R030\tYY-1\t1000\t5`].join('\n')
await page.getByTestId('import-text').fill(imp); await page.getByTestId('import-text').press('Control+Enter'); await page.waitForTimeout(150); log('import →', await t.toast())
await t.press('4'); const v4 = await t.viewRows(); log('purchasing 4:', v4.join(','))
p = await t.proj(); log(st(p, 'R016'), 'ball', await t.cellText('R016', 'ball')); log(st(p, 'R030'), 'ball', await t.cellText('R030', 'ball'))
check('W5-1 型式不一致の行は、ボールが設計でも購買の 4 に出る（§7・§11）', v4.includes('R016'), v4.join(','))
check('W5-1b 型式不一致の行（ボール購買）が購買の 4 に出る', v4.includes('R030'))
// 先行発注の申請: 見積済の R020（金額の既定値）・選定済の行・発注済の行
await t.press('1'); await t.goto('R020'); await t.cmd('先行発注を申請'); await page.waitForTimeout(80); let pn = await t.panel(); log('ltb dialog', JSON.stringify(pn)?.slice(0, 250))
const sc20 = await page.evaluate(async () => { const sc = await import(window.__m('/src/model/score.ts')); const s = (await import(window.__m('/src/model/store.ts'))).useStore.getState(); const p = s.project(); const b = sc.scoreRow(p, p.rows.find((x) => x.id === 'R020'), s.ws.suppliers)[0]; return { s: b.supplierId, price: b.quote.unitPrice, rq: b.roundedQty } })
log('R020 best', JSON.stringify(sc20), 'expected default', sc20.price * sc20.rq)
check('W5-2 先行発注の申請で金額を聞き、既定値は推奨見積 × 丸め数量', pn?.extra?.['金額'] === String(sc20.price * sc20.rq), JSON.stringify(pn?.extra))
await t.promptFill('長納期のため'); await t.extraFill('金額', '12,345'); await page.getByTestId('prompt-text').press('Enter'); await page.waitForTimeout(100); log('ltb →', await t.toast(), JSON.stringify(await t.panel())?.slice(0, 100))
p = await t.proj(); log(st(p, 'R020'))
// PM の 7: 理由・金額が見えるか → y
await t.role('pm'); await t.press('7'); await t.goto('R020'); await t.press(' '); await page.waitForTimeout(80); const det = await page.getByTestId('detail').textContent(); log('PM detail R020', det.slice(0, 600)); await t.press(' ')
await t.goto('R020'); await t.press('Enter'); await page.waitForTimeout(80); pn = await t.panel(); log('PM panel R020', JSON.stringify(pn)?.slice(0, 300)); await t.press('Escape')
check('W5-3 PM が申請の理由・金額を見られる', /12,345|12345/.test(det + JSON.stringify(pn)), '')
const y = await t.yes('R020', '先行を許可'); log('y →', y.toast)
p = await t.proj(); log(st(p, 'R020')); const dl = p.decisions.filter((d) => d.rowId === 'R020'); log('decisions', JSON.stringify(dl))
check('W5-4 許可後も申請の理由・金額が行か決定に残る', JSON.stringify(dl).includes('12,345') || /12,345/.test(p.rows.find((r) => r.id === 'R020').adoptReason ?? ''), p.rows.find((r) => r.id === 'R020').adoptReason)
// 選定済の行への申請（採用理由が上書きされるか）
await t.role('design'); await t.press('1'); await t.goto('R011'); await t.press('Shift+A'); await page.waitForTimeout(60); await t.press('2'); await page.waitForTimeout(60); const pr = await t.panel(); if (pr?.kind === 'prompt') { await t.press('1'); await page.waitForTimeout(80); if ((await t.panel())?.kind === 'prompt') { await page.keyboard.press('Enter'); await page.waitForTimeout(100) } }
p = await t.proj(); log('R011 before', st(p, 'R011'))
await t.role('purchasing'); await t.press('1'); await t.goto('R011'); await t.cmd('先行発注を申請'); await page.waitForTimeout(80); pn = await t.panel(); log('ltb on selected', JSON.stringify(pn)?.slice(0, 120), await t.toast())
if (pn?.kind === 'prompt') { await t.promptFill('急ぎ'); await page.getByTestId('prompt-text').press('Enter'); await page.waitForTimeout(100) }
p = await t.proj(); log('R011 after ltb request', st(p, 'R011'))
check('W5-5 選定済の行に先行発注を申請しても、採用理由（設計の 1 納期）を消さない', /納期/.test(p.rows.find((r) => r.id === 'R011').adoptReason ?? ''), p.rows.find((r) => r.id === 'R011').adoptReason)
// 拮抗: 一括採用 → 設計の 4 に見直し推奨、購買の x では外れない、設計の x で外れる
await t.role('design'); log('bulk →', await t.bulk())
p = await t.proj(); const ct = p.rows.filter((r) => r.flags.contested).map((r) => r.id); log('contested', ct.length, ct.slice(0, 5))
await t.press('4'); const d4 = await t.viewRows(); log('design 4 has contested', ct.filter((x) => d4.includes(x)).length, '/', ct.length, 'ball', await t.cellText(ct[0], 'ball'))
check('W5-6 拮抗の行は選定者（設計）の 4 に出る', ct.every((x) => d4.includes(x)))
await t.goto(ct[0]); log('status bar x hint', (await t.status()).slice(0, 140)); await t.press('x'); await page.waitForTimeout(60); log('design x →', await t.toast()); p = await t.proj(); check('W5-7 設計の x で拮抗が外れる', !p.rows.find((r) => r.id === ct[0]).flags.contested)
summary(); await t.close()
