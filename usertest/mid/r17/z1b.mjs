// z1b: 指定商社の辞退（指定先を ID で書いた行 / 名前で書いた行）、メーカ表記の揺れ、全社回答の完了条件
import { launch, check, log, summary } from './lib.mjs'
const t = await launch()
const { page } = t
await t.open('design')
const show = (p, id) => { const r = p.rows.find((x) => x.id === id); return `${id} ${r.procurement} maker=${r.maker} des=${r.designated} st=${r.status} adopt=${r.adoptedSupplierId ?? '-'} quotes=${JSON.stringify(p.quotes.filter((q) => q.rowId === id && !q.stale).map((q) => [q.supplierId, q.unitPrice, q.leadDays]))}` }
const addRow = async (after, name, model, maker, proc, des) => {
  await t.goto(after); await t.press('Shift+Enter'); await page.waitForTimeout(80); await t.type(name); await t.press('Enter'); await page.waitForTimeout(60); if ((await t.mode()) === 'edit') await t.press('Escape')
  const pp = await t.proj(); const id = pp.rows.find((r) => r.name === name).id
  await t.showCol('designated', 'procurement')
  await t.setCellKey(id, 'model', model); await t.setCellKey(id, 'maker', maker); await t.setCellKey(id, 'procurement', proc); if (des) await t.setCellKey(id, 'designated', des)
  await t.setCellKey(id, 'qtyNeeded', '4'); await t.setCellKey(id, 'ref', 'Z' + id)
  return id
}
await t.press('1')
const G1 = await addRow('R080', '因幡指定ID', 'UK5N', 'フエニックス', '指定商社', 'S1')
const G2 = await addRow(G1, '因幡指定名前', 'UK10N', 'フエニックス', '指定商社', '因幡電機')
const M1 = await addRow(G2, 'リレー小文字', 'G2R-2 DC24', 'omron', '相見積')
const M2 = await addRow(M1, 'リレー株式会社', 'G2R-2 DC12', 'オムロン株式会社', '相見積')
const M3 = await addRow(M2, 'ブレーカ略称', 'NF32-SV 3P', '三菱', '相見積')
const P1 = await addRow(M3, '表示灯2', 'LR4-302WJNW', 'パトライト', '相見積')
log('cells as displayed: G1 designated', await t.cellText(G1, 'designated'), '/ G2', await t.cellText(G2, 'designated'))
log('publish →', await t.publish('1'))
await t.role('purchasing')
await t.cmd('概算見積を依頼'); await page.waitForTimeout(100); await t.press('Enter'); await page.waitForTimeout(1300); log('request →', await t.toast())
let p = await t.proj(); for (const id of [G1, G2, M1, M2, M3, P1]) log(show(p, id))
const tg = (id) => p.quotes.filter((q) => q.rowId === id && !q.stale).map((q) => q.supplierId).sort().join(',')
check('Z1b-1 メーカ表記の揺れ（omron / オムロン株式会社 / 三菱）でも扱う商社に依頼される', [M1, M2, M3].every((id) => tg(id).includes('S1')), [M1, M2, M3].map((id) => `${id}:${tg(id)}`).join(' '))
// 全社回答で、依頼した 2 社（因幡・ミスミ）の回答で見積済になるか
log('rule', p.settings.quoteCompleteRule)
await t.press('6'); for (const [sid, pr] of [['S1', 900], ['S3', 950]]) { await t.setCellKey(P1, `q.unitPrice@${sid}`, String(pr)); await t.press('Escape'); await t.setCellKey(P1, `q.leadDays@${sid}`, '5'); await t.press('Escape') }
p = await t.proj(); log('P1 after 2 answers', show(p, P1), 'status cell', await t.cellText(P1, 'status'))
check('Z1b-2 メーカで絞った行は、依頼した商社（2 社）の回答で見積済（扱わない商社の回答を待たない）', p.rows.find((r) => r.id === P1).status === 'quoted', show(p, P1))
// 指定商社の辞退: ID で書いた行と名前で書いた行
for (const id of [G1, G2]) { await t.press('6'); await t.setCellKey(id, 'q.leadDays@S1', '取扱なし'); await t.press('Escape') }
p = await t.proj()
const res = {}
for (const id of [G1, G2]) res[id] = { ball: await t.cellText(id, 'ball'), st: p.rows.find((r) => r.id === id).status }
await t.press('4'); const pu4 = await t.viewRows()
await t.role('design'); await t.press('4'); const de4 = await t.viewRows()
for (const id of [G1, G2]) { res[id].pu4 = pu4.includes(id); res[id].de4 = de4.includes(id); await t.goto(id); await t.press('Home'); res[id].sb = (await t.status()).slice(0, 200) }
log(JSON.stringify(res, null, 1))
check('Z1b-3 指定先を ID（S1）で書いた指定商社の辞退 → ボール設計・設計の 4', res[G1].ball === '設計' && res[G1].de4, JSON.stringify(res[G1]))
check('Z1b-4 指定先を名前（因幡電機）で書いた指定商社の辞退 → ボール設計・設計の 4（ID と同じ扱い）', res[G2].ball === '設計' && res[G2].de4, JSON.stringify(res[G2]))
// 名前で書いた行: 購買が 4 から次の依頼をしようとすると？
await t.role('purchasing'); await t.cmd('概算見積を依頼'); await page.waitForTimeout(100); await t.press('Enter'); await page.waitForTimeout(1000); log('purch re-request →', await t.toast())
await t.press('4'); await t.goto(G2); await t.press('Home'); log('purch status on G2', (await t.status()).slice(0, 200)); await t.press('Control+.'); await page.waitForTimeout(80); log('purch Ctrl+. G2', JSON.stringify((await t.panel())?.options)); if (await t.panel()) await t.press('Escape')
await t.shot('z1b-designated-name-declined')
summary(); await t.close()
