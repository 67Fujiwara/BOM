// l3: 正式依頼中の行の型式を変えて（変更セット）同じ商社に再発行したときの差分シート（M17-05 の修正「はじめて頼む行は旧を出さない」の副作用）
//   mode=rough : 購買が概算見積を依頼してから 6 で回答 → 採用 → 正式見積の依頼（F2）
//   mode=manual: 概算見積の依頼をせずに 6 で回答を入れる（電話の回答）→ 採用 → F2
//   mode=import: 概算見積の依頼をせずに「見積回答を取り込む」→ 採用 → F2
//   mode=qty   : 必要数を +50%（再見積要）にして 6 で回答 → 採用 → F2
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
import ExcelJS from '/home/user/BOM/node_modules/exceljs/excel.js'
const mode = process.argv[2] ?? 'manual'
const t = await launch(); const { page } = t; const h = helpers(t)
async function sheetsOf(from) { const out = []; for (const dl of t.downloads.slice(from)) { const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(dl.name); const f = { f: dl.suggested, sheets: {} }; wb.eachSheet((sh) => { const rows = []; sh.eachRow((r) => rows.push(r.values.slice(1))); f.sheets[sh.name] = rows }); out.push(f) } return out }
await t.open('design'); log('bulk →', await t.bulk())
await t.role('purchasing'); log('formal F1 →', await t.requestFormal())
let p = await t.proj()
const X = p.rows.find((r) => r.status === 'formalRequested' && r.procurement === '相見積' && r.adoptedSupplierId === 'S1' && !r.flags.contested && !r.flags.leadNG && r.altPolicy !== '客先承認要' && r.qtyNeeded >= 2 && p.quotes.filter((q) => q.rowId === r.id && !q.stale && q.unitPrice != null && q.leadDays >= 0).length === 3).id
const r0 = p.rows.find((r) => r.id === X); const oldModel = r0.model, need = r0.qtyNeeded
log('X', h.show(p, X), 'model', oldModel)
await t.role('design'); await t.press('1')
const newModel = oldModel + '-N2'
if (mode === 'qty') log('qty →', await t.setCellKey(X, 'qtyNeeded', String(Math.ceil(need * 1.5))))
else log('model →', await t.setCellKey(X, 'model', newModel))
log('publish →', await t.publish('2'))
p = await t.proj(); log('X after change', h.show(p, X), 'wd', p.rows.find((r) => r.id === X).flags.formalWithdrawn ?? '-', '|', await h.status(X))
await t.role('purchasing')
if (mode === 'rough' || mode === 'qty') log('rough →', await t.requestRough())
if (mode === 'import') {
  const m = p.rows.find((r) => r.id === X).model
  log('import S1 →', await h.importAnswers('S1', `${X}\t${m}\t100\t5\t1`))
  log('import S2 →', await h.importAnswers('S2', `${X}\t${m}\t900\t20\t1`))
  log('import S3 →', await h.importAnswers('S3', `${X}\t${m}\t900\t20\t1`))
} else {
  await t.press('6'); log('S1 →', await h.q(X, 'S1', 100, 5)); log('S2 →', await h.q(X, 'S2', 900, 20)); log('S3 →', await h.q(X, 'S3', 900, 20))
}
p = await t.proj(); log('X quotes', h.show(p, X), '|', await h.status(X))
const st1 = p.rows.find((r) => r.id === X).status
if (st1 === 'quoting' || (st1 === 'quoted' && !p.rows.find((r) => r.id === X).adoptedSupplierId)) { await t.role('design'); await t.press('1'); await t.goto(X); await t.press('a'); await page.waitForTimeout(120); log('design a →', await t.toast()) }
p = await t.proj(); log('X adopted', h.show(p, X))
if (p.rows.find((r) => r.id === X).flags.requote) { await t.role('purchasing'); await t.press('9'); await t.goto(X); await t.press('Control+.'); await page.waitForTimeout(80); log('Ctrl+. opts', JSON.stringify((await t.panel())?.options)); await t.press('Escape') }
await t.role('purchasing'); const n0 = t.downloads.length; const fm2 = await t.requestFormal(); log('formal F2 →', fm2); const files = await sheetsOf(n0)
const mObj = /対象 (\d+) 行/.exec(fm2); check('L3-0 正式見積の依頼の確認に出る対象の行数と、実際に依頼する行数が合う（再見積要の行を対象に数えない）', !(mObj && +mObj[1] > 0 && /依頼する行がありません/.test(fm2)), fm2)
const toS1 = files.find((f) => f.sheets['正式見積依頼']?.some((r) => r[0] === X))
log('files', JSON.stringify(files.map((f) => [f.f, Object.keys(f.sheets)])))
const diff = toS1?.sheets['差分'] ?? []
log('S1 file', toS1?.f, 'diff rows for X', JSON.stringify(diff.filter((r) => r[0] === X)))
if (!toS1) log('INFO X が F2 に出ない', h.show(await t.proj(), X))
else if (mode === 'qty') check('L3-' + mode + ' 同じ商社への再発行の差分シートに X の必要数の旧→新が出る（その商社に F1 で送った行）', diff.some((r) => r[0] === X && r[1] === 'qtyNeeded' && String(r[2]) === String(need)), JSON.stringify(diff.filter((r) => r[0] === X)))
else check('L3-' + mode + ' 同じ商社（因幡）への再発行の差分シートに X の型式の旧→新が出る（その商社に F1 で送った行）', diff.some((r) => r[0] === X && r[1] === 'model' && r[2] === oldModel && r[3] === newModel), JSON.stringify(diff.filter((r) => r[0] === X)))
log('ERRORS', JSON.stringify(t.errors))
await t.shot('l3-' + mode)
summary(); await t.close()
