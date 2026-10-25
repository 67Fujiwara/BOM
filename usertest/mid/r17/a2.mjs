// a2: メーカの表記ゆれと依頼先の絞り込み・結果の文・全社への逃げ道、客先指定品の辞退 → 次の商社に依頼（Ctrl+.・ステータスバー）
import { launch, check, log, summary } from './lib.mjs'
import ExcelJS from '/home/user/BOM/node_modules/exceljs/excel.js'
const t = await launch()
const { page } = t
await t.open('design')
const show = (p, id) => { const r = p.rows.find((x) => x.id === id); return `${id} ${r.procurement} maker=${r.maker} st=${r.status} adopt=${r.adoptedSupplierId ?? '-'} reason=${r.adoptReason ?? ''} quotes=${JSON.stringify(p.quotes.filter((q) => q.rowId === id && !q.stale).map((q) => [q.supplierId, q.unitPrice, q.leadDays]))}` }
const addRow = async (after, name, model, maker, proc, des) => {
  await t.goto(after); await t.press('Shift+Enter'); await page.waitForTimeout(80); await t.type(name); await t.press('Enter'); await page.waitForTimeout(60); if ((await t.mode()) === 'edit') await t.press('Escape')
  const pp = await t.proj(); const id = pp.rows.find((r) => r.name === name).id
  await t.showCol('designated', 'procurement')
  await t.setCellKey(id, 'model', model); await t.setCellKey(id, 'maker', maker); await t.setCellKey(id, 'procurement', proc); if (des) await t.setCellKey(id, 'designated', des)
  await t.setCellKey(id, 'qtyNeeded', '4'); await t.setCellKey(id, 'ref', 'Z' + id)
  return id
}
await t.press('1')
const defs = [
  ['英字大文字', 'G2R-1-SN DC24', 'OMRON', 'S1,S2,S3'],
  ['英字小文字', 'G2R-2 DC24', 'omron', 'S1,S2,S3'],
  ['株式会社付き', 'G2R-2 DC12', 'オムロン株式会社', 'S1,S2,S3'],
  ['半角カナ', 'G2R-1 DC12', 'ｵﾑﾛﾝ', 'S1,S2,S3'],
  ['括弧株', 'MY2N DC24', 'オムロン(株)', 'S1,S2,S3'],
  ['略称三菱', 'NF32-SV 3P 10A', '三菱', 'S1,S2,S3'],
  ['英字三菱', 'NF63-SV 3P 20A', 'Mitsubishi Electric', 'S1,S2,S3'],
  ['英字パトライト', 'LR6-302WJNW', 'PATLITE', 'S1,S3'],
  ['パナ英字', 'WTP5002', 'Panasonic', 'S2,S3'],
  ['フエニックス英字', 'UK5N-X', 'Phoenix Contact', 'S1,S2,S3'],
  ['未登録メーカ', 'TS-35', 'ワイドミュラー', 'S1,S2,S3'],
  ['音羽略称', 'LT-C32', '音羽', 'S2,S3'],
  ['TDK単体', 'C1608X7R', 'TDK', '?'],
  ['住友略称', 'HVSF-2', '住友', '?'],
  ['三菱電線', 'MC-CV 2sq', '三菱電線', '?'],
]
const ids = []
let prev = 'R080'
for (const [n, m, mk] of defs) { prev = await addRow(prev, n, m, mk, '相見積'); ids.push(prev) }
const D = await addRow(prev, '客先指定パナ', 'WTP5001', 'パナソニック', '客先指定品', '客先承認 KS-9')
const E = await addRow(D, '客先指定パトライト', 'LR4-302', 'パトライト', '客先指定品', '客先承認 KS-2')
log('publish →', await t.publish('1'))
await t.role('purchasing')
const n0 = t.downloads.length
await t.cmd('概算見積を依頼'); await page.waitForTimeout(100); const pr = await t.panel(); log('request panel', pr?.title, JSON.stringify(pr?.options)); await t.press('Enter'); await page.waitForTimeout(1500)
const msg = await t.toast(); log('request →', msg)
let p = await t.proj()
const tg = (id) => p.quotes.filter((q) => q.rowId === id && !q.stale).map((q) => q.supplierId).sort().join(',')
const table = defs.map(([n, m, mk, exp], i) => ({ id: ids[i], maker: mk, exp, got: tg(ids[i]) }))
for (const r of table) log(`  ${r.id} ${r.maker} → ${r.got} (expect ${r.exp})`)
for (const r of table.filter((x) => x.exp !== '?')) check(`A2-1 ${r.maker} → ${r.exp}`, r.got === r.exp, r.got)
check('A2-2 (U7-03) 結果に「メーカを扱わない商社には頼まない行」', /扱わない商社には頼まない/.test(msg), msg)
check('A2-3 (M7-02) 結果に「扱う商社がマスタに無い行は全社に依頼」', /全社に依頼/.test(msg), msg)
// 結果の件数が正しいか: 絞った行数・全社行数
const narrowedN = table.filter((r) => r.got.split(',').length < 3).length + [D, E].length * 0
const m1 = /頼まない行 (\d+) 行/.exec(msg); const m2 = /マスタに無い行 (\d+) 行/.exec(msg)
// 提出済のサンプル行（相見積）も同じ依頼に入っているので、件数はサンプルを含めて数える
const allSent = p.rows.filter((r) => p.quotes.some((q) => q.rowId === r.id && !q.stale) && r.procurement === '相見積' && r.status === 'quoting')
log('sent 相見積 rows', allSent.length, 'narrowed (<3社)', allSent.filter((r) => tg(r.id).split(',').length < 3).map((r) => r.id + ':' + r.maker).join(' '))
log('message counts', m1?.[1], m2?.[1])
check('A2-4 結果の「頼まない行 n 行」が実際に絞った行数と一致', m1 && Number(m1[1]) === allSent.filter((r) => tg(r.id).split(',').length < 3).length, `${m1?.[1]} vs ${allSent.filter((r) => tg(r.id).split(',').length < 3).length}`)
// 依頼書（Excel）の中身でも確かめる
const files = []
for (const dl of t.downloads.slice(n0)) { const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(dl.name); const sh = wb.worksheets[0]; let sup = ''; const rids = []; sh.eachRow((r) => { const v = r.values.slice(1); const j = v.indexOf('宛先'); if (j >= 0 && !sup) sup = v[j + 1]; if (typeof v[0] === 'string' && /^R\d+$/.test(v[0])) rids.push(v[0]) }); files.push({ sup, file: dl.suggested, ids: rids }) }
for (const f of files) log('  file', f.sup, f.file, 'rows', f.ids.length, 'has PATLITE row', f.ids.includes(ids[7]))
// 一部の商社だけを選んで依頼したときの文（全社と書くか）
// 客先指定品 D（パナソニック）: 最初の依頼先
log('D', show(p, D)); log('E', show(p, E))
check('A2-5 客先指定品（パナソニック）は扱う立花に依頼', tg(D) === 'S2', tg(D))
check('A2-6 客先指定品（パトライト）は扱う因幡に依頼', tg(E) === 'S1', tg(E))
// D: 立花が辞退 → 購買の 4・ステータスバー・Ctrl+.
await t.press('6'); log('D decline', await t.setCellKey(D, 'q.leadDays@S2', '取扱なし')); await t.press('Escape')
p = await t.proj(); log('D after decline', show(p, D), 'ball', await t.cellText(D, 'ball'))
await t.press('4'); const pu4 = (await t.viewRows()).includes(D); await t.goto(D); await t.press('Home'); const sbD = await t.status(); log('purch 4 has D', pu4, 'sb', sbD.slice(0, 250))
await t.press('Control+.'); await page.waitForTimeout(80); const qfD = await t.panel(); log('Ctrl+. D', JSON.stringify(qfD?.options))
check('A2-7 (U7-02) ステータスバーに「次の商社に依頼」', /次の商社/.test(sbD), sbD.slice(0, 200))
check('A2-8 (U7-02) Ctrl+. に「次の商社 X に依頼する」', /次の商社/.test(JSON.stringify(qfD?.options ?? [])), JSON.stringify(qfD?.options))
const nextName = (/次の商社 (\S+) に依頼/.exec(JSON.stringify(qfD?.options ?? [])) ?? [])[1]
log('next supplier named', nextName)
check('A2-9 (U6-05) 次の依頼先がパナソニックを扱わない商社（因幡）でない', nextName !== '因幡電機', nextName)
// Ctrl+. の候補を選んで依頼まで進む
let reqMsg = ''
if (qfD) {
  const i = qfD.options.findIndex((o) => o.includes('次の商社')); for (let k = 0; k < i; k++) await t.press('ArrowDown'); await t.press('Enter'); await page.waitForTimeout(150)
  const pn2 = await t.panel(); log('after choose', pn2?.kind, pn2?.title, JSON.stringify(pn2?.options))
  if (pn2) { await t.press('Enter'); await page.waitForTimeout(1300) }
  reqMsg = await t.toast(); log('next request →', reqMsg)
}
p = await t.proj(); log('D after next request', show(p, D))
const nextD = p.quotes.filter((q) => q.rowId === D && !q.stale && q.leadDays !== -1).map((q) => q.supplierId)
check('A2-10 Ctrl+. の「次の商社に依頼」で、名前の出た商社に依頼される', nextD.length === 1 && (await t.ws()).suppliers.find((s) => s.id === nextD[0])?.name === nextName, `${nextD} ${reqMsg}`)
// 次の商社も辞退 → 3 社目（全滅）
await t.press('6'); await t.setCellKey(D, `q.leadDays@${nextD[0]}`, '取扱なし'); await t.press('Escape')
await t.press('4'); await t.goto(D); await t.press('Home'); const sb3 = await t.status(); await t.press('Control+.'); await page.waitForTimeout(80); const qf3 = await t.panel(); if (qf3) await t.press('Escape')
p = await t.proj(); log('D after 2nd decline', show(p, D), 'sb', sb3.slice(0, 200), 'qf', JSON.stringify(qf3?.options))
// 3 社とも辞退したとき
const left = ['S1', 'S2', 'S3'].filter((s) => !p.quotes.some((q) => q.rowId === D && q.supplierId === s && q.leadDays === -1))
log('left suppliers', left)
if (left.length) { await t.cmd('概算見積を依頼'); await page.waitForTimeout(100); if (await t.panel()) { await t.press('Enter'); await page.waitForTimeout(1200) } ; log('3rd request', await t.toast()); await t.press('6'); await t.setCellKey(D, `q.leadDays@${left[0]}`, '取扱なし'); await t.press('Escape') }
p = await t.proj(); await t.press('4'); await t.goto(D); await t.press('Home'); const sb4 = await t.status(); await t.press('Control+.'); await page.waitForTimeout(80); const qf4 = await t.panel(); if (qf4) await t.press('Escape')
await t.cmd('概算見積を依頼'); await page.waitForTimeout(100); if (await t.panel()) { await t.press('Enter'); await page.waitForTimeout(1200) }
const allDeclined = await t.toast()
log('D all declined', show(p, D), 'ball', await t.cellText(D, 'ball'), 'sb', sb4.slice(0, 200), 'qf', JSON.stringify(qf4?.options), 'request →', allDeclined)
await t.role('design'); await t.press('4'); const de4 = (await t.viewRows()).includes(D); await t.role('pm'); await t.press('7'); const pm7 = (await t.viewRows()).includes(D)
log('all declined: design4', de4, 'pm7', pm7)
check('A2-11 客先指定品で案件の商社が全社辞退したら、誰かのボールで次の手（設計・PM に相談、商社を足す）が出る', de4 || pm7 || /全社|ありません|足/.test(sb4 + JSON.stringify(qf4?.options ?? [])), `de4=${de4} pm7=${pm7} sb=${sb4.slice(0, 120)}`)
await t.shot('a2-maker')
summary(); await t.close()
