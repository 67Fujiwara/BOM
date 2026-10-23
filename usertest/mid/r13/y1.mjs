// y1: 指定系の依頼先（M5-01・M5-02 の再検証と周辺）: 商社を分けた依頼、案件外の指定先、客先指定品の辞退 → 次の商社、指定商社の辞退
import { launch, check, log, summary } from './lib.mjs'
import ExcelJS from '/home/user/BOM/node_modules/exceljs/excel.js'
const t = await launch()
const { page } = t
await t.open('design')
const show = (p, id) => { const r = p.rows.find((x) => x.id === id); return `${id} ${r.procurement} des=${r.designated} st=${r.status} adopt=${r.adoptedSupplierId ?? '-'} quotes=${JSON.stringify(p.quotes.filter((q) => q.rowId === id && !q.stale).map((q) => [q.supplierId, q.unitPrice, q.leadDays]))}` }
const addRow = async (after, name, model, maker, proc, des) => {
  await t.goto(after); await t.press('Shift+Enter'); await page.waitForTimeout(80); await t.type(name); await t.press('Enter'); await page.waitForTimeout(60); if ((await t.mode()) === 'edit') await t.press('Escape')
  const pp = await t.proj(); const id = pp.rows.find((r) => r.name === name).id
  await t.showCol('designated', 'procurement')
  await t.setCellKey(id, 'model', model); await t.setCellKey(id, 'maker', maker); await t.setCellKey(id, 'procurement', proc); if (des) await t.setCellKey(id, 'designated', des)
  await t.setCellKey(id, 'qtyNeeded', '4'); await t.setCellKey(id, 'ref', 'Z' + id)
  return id
}
await t.press('1')
const a = await addRow('R080', '直販指定リレー', 'G3NA-210B', 'オムロン', '指定商社', 'オムロン直販')
const b = await addRow(a, '立花指定ブレーカ', 'NV32-SV 3P 20A', '三菱電機', '指定商社', '立花エレテック')
const c = await addRow(b, '客先指定スイッチ', 'WTP5001', 'パナソニック', '客先指定品', '客先承認 KS-9')
const d = await addRow(c, '因幡指定端子', 'UK5N', 'フエニックス', '指定商社', '因幡電機')
log('publish →', await t.publish('1'))
let p = await t.proj(); for (const id of [a, b, c, d]) log(show(p, id))
await t.role('purchasing')
const files = async (from) => { const out = []; for (const dl of t.downloads.slice(from)) { const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(dl.name); const sh = wb.worksheets[0]; let sup = ''; const ids = []; sh.eachRow((r) => { const v = r.values.slice(1); const j = v.indexOf('宛先'); if (j >= 0 && !sup) sup = v[j + 1]; if (typeof v[0] === 'string' && /^R\d+$/.test(v[0])) ids.push(v[0]) }); out.push({ sup, file: dl.suggested, ids }) } return out }
async function requestTo(prefix) {
  const n0 = t.downloads.length
  await t.cmd('概算見積を依頼'); await page.waitForTimeout(100); const pr = await t.panel()
  const i = prefix ? (pr?.options ?? []).findIndex((o) => o.startsWith(prefix + ' ')) : 0
  for (let k = 0; k < i; k++) await t.press('ArrowDown')
  await t.press('Enter'); await page.waitForTimeout(1300)
  const msg = await t.toast(); const f = await files(n0)
  return { opts: pr?.options, msg, f }
}
const lamp = async () => (await page.getByTestId('quote-progress').textContent().catch(() => 'none'))
log('lamp before', await lamp())
// (1) 因幡だけ
let r1 = await requestTo('S1'); log('options', JSON.stringify(r1.opts)); log('S1 only →', r1.msg, JSON.stringify(r1.f))
p = await t.proj(); for (const id of [a, b, c, d]) log(show(p, id))
check('Y1-1 因幡だけの依頼で、因幡指定の行は見積中・依頼書に入る', p.rows.find((r) => r.id === d).status === 'quoting' && r1.f.some((f) => f.ids.includes(d)))
check('Y1-2 因幡だけの依頼で、立花指定・直販指定・客先指定品（立花）は提出済のまま', [a, b, c].every((id) => p.rows.find((r) => r.id === id).status === 'submitted'), [a, b, c].map((id) => p.rows.find((r) => r.id === id).status).join(','))
const n1 = /^(\d+) 行/.exec(r1.msg)?.[1]; check('Y1-3 「n 行 × 1 社」の件数が依頼書の行数と一致', Number(n1) === r1.f.reduce((s, f) => s + f.ids.length, 0), `${n1} vs ${r1.f.map((f) => f.ids.length)}`)
// (2) 立花だけ
let r2 = await requestTo('S2'); log('S2 only →', r2.msg, JSON.stringify(r2.f))
p = await t.proj(); for (const id of [a, b, c]) log(show(p, id))
check('Y1-4 立花だけの依頼で、立花指定と客先指定品（パナソニック→立花）が見積中、直販指定は提出済のまま', p.rows.find((r) => r.id === b).status === 'quoting' && p.rows.find((r) => r.id === c).status === 'quoting' && p.rows.find((r) => r.id === a).status === 'submitted')
// (3) 残りを「相見積先すべて」
let r3 = await requestTo(null); log('all →', r3.msg, JSON.stringify(r3.f))
p = await t.proj(); log(show(p, a)); log('project suppliers', JSON.stringify(p.supplierIds))
check('Y1-5 相見積先すべてで、案件外の指定先（オムロン直販）に依頼書が出て見積中', p.rows.find((r) => r.id === a).status === 'quoting' && r3.f.some((f) => /オムロン直販/.test(f.sup + f.file) && f.ids.includes(a)), JSON.stringify(r3.f))
// (4) 6 でオムロン直販の回答を入れられるか
await t.press('6'); const cols6 = await page.evaluate(async () => { const m = await import(window.__m('/src/model/selectors.ts')); const s = (await import(window.__m('/src/model/store.ts'))).useStore.getState(); const vm = m.buildViewModel(s); return vm.cols ?? vm.columns ?? Object.keys(vm) })
log('6 columns', JSON.stringify(cols6).slice(0, 600))
log('6 rows has a?', (await t.viewRows()).includes(a))
let ok5 = 'n/a'
try { ok5 = await t.setCellKey(a, 'q.unitPrice@S5', '2100'); await t.press('Escape'); ok5 += ' / ' + await t.setCellKey(a, 'q.leadDays@S5', '6'); await t.press('Escape') } catch (e) { ok5 = 'ERR ' + e.message.slice(0, 120) }
log('enter S5 in 6 →', ok5)
await t.shot('y1-view6-omron-direct')
p = await t.proj(); log(show(p, a), 'ball', await t.cellText(a, 'ball'))
check('Y1-6 購買が 6 でオムロン直販の回答を入れられ、直販指定の行が指定先で採用される', p.rows.find((r) => r.id === a).adoptedSupplierId === 'S5', show(p, a))
log('lamp after', await lamp())
// (5) 客先指定品: 立花が辞退 → もう一度依頼 → 次の商社
await t.press('6'); log('decline c', await t.setCellKey(c, 'q.leadDays@S2', '取扱なし')); await t.press('Escape')
p = await t.proj(); log('after decline', show(p, c), 'ball', await t.cellText(c, 'ball'))
await t.press('9'); log('purch 9 has c?', (await t.viewRows()).includes(c)); await t.press('4'); log('purch 4 has c?', (await t.viewRows()).includes(c))
await t.role('design'); await t.press('4'); log('design 4 has c?', (await t.viewRows()).includes(c), 'ball', await t.cellText(c, 'ball')); await t.role('purchasing')
let r4 = await requestTo(null); log('re-request →', r4.msg, JSON.stringify(r4.f))
p = await t.proj(); log(show(p, c))
const nextSup = p.quotes.filter((q) => q.rowId === c && !q.stale && q.leadDays !== -1).map((q) => q.supplierId)
log('c next requested to', nextSup, 'handles パナソニック?', (await t.ws()).suppliers.filter((s) => nextSup.includes(s.id)).map((s) => s.name + ':' + s.handledMakers.includes('パナソニック')))
check('Y1-7 客先指定品の依頼先が辞退したら、もう一度の依頼で次の商社に依頼書が出る', r4.f.some((f) => f.ids.includes(c)), JSON.stringify(r4.f))
if (nextSup[0]) { await t.press('6'); log(await t.setCellKey(c, `q.unitPrice@${nextSup[0]}`, '1500')); await t.press('Escape'); log(await t.setCellKey(c, `q.leadDays@${nextSup[0]}`, '7')); await t.press('Escape') }
p = await t.proj(); log('c after answer', show(p, c), 'ball', await t.cellText(c, 'ball'))
check('Y1-8 次の商社の回答で、客先指定品がその商社で採用（選定済）', p.rows.find((r) => r.id === c).adoptedSupplierId === nextSup[0], show(p, c))
// (6) 指定商社（因幡）が辞退 → どうなるか
await t.press('6'); log('decline d', await t.setCellKey(d, 'q.leadDays@S1', '取扱なし')); await t.press('Escape')
p = await t.proj(); log('d after decline', show(p, d), 'ball', await t.cellText(d, 'ball'), 'flags', JSON.stringify(p.rows.find((r) => r.id === d).flags))
await t.press('4'); const p4 = (await t.viewRows()).includes(d); await t.press('9'); const p9 = (await t.viewRows()).includes(d)
await t.role('design'); await t.press('4'); const d4 = (await t.viewRows()).includes(d)
log('d in purch4', p4, 'purch9', p9, 'design4', d4)
await t.press('1'); await t.goto(d); log('design status bar on d', (await t.status()).slice(0, 200)); await t.press('Control+.'); await page.waitForTimeout(80); log('design Ctrl+. on d', JSON.stringify((await t.panel())?.options)); if (await t.panel()) await t.press('Escape')
await t.goto(d); await t.press('a'); await page.waitForTimeout(80); log('design a on d', await t.toast())
await t.goto(d); await t.press(' '); await page.waitForTimeout(80); log('detail d', (await page.getByTestId('detail').textContent()).slice(0, 300)); await t.press(' ')
await t.shot('y1-designated-declined')
check('Y1-9 指定商社が辞退した行は、指定先を変える設計の 4 に出る（または購買の 4）', d4 || p4, `design4=${d4} purch4=${p4} ball=${await t.cellText(d, 'ball')}`)
summary(); await t.close()
