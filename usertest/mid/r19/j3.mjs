// j3: 再発行の差分シート（M15-08 の修正: その商社に前回送った内容と比べる）を「据え置き」と「案件納期の変更」で
//   X: 正式見積済の行の必要数を 3 倍 → 購買 9 の Ctrl+. →「再見積要: 据え置き」→ 正式見積を依頼（再発行）
//   Z: 正式依頼中の行の型式を変更（指摘対応でない）→ 据え置き → 選定者が a → 正式見積を依頼
//   そのあと PM が案件納期を 7 日前倒し → 正式依頼中の行の再発行 → 差分シートは必要納期だけ（必要数・型式の古い差分を繰り返さない）
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
import ExcelJS from '/home/user/BOM/node_modules/exceljs/excel.js'
const t = await launch(); const { page } = t; const h = helpers(t)
async function sheetsOf(from) { const out = []; for (const dl of t.downloads.slice(from)) { const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(dl.name); wb.eachSheet((sh) => { const rows = []; sh.eachRow((r) => rows.push(r.values.slice(1))); out.push({ f: dl.suggested, sh: sh.name, rows }) }) } return out }
async function keep(id) {
  await t.press('9'); await t.goto(id); await t.press('Home'); await t.press('Control+.'); await page.waitForTimeout(80)
  const o = (await t.panel())?.options ?? []; const i = o.findIndex((x) => x.includes('再見積要: 据え置き'))
  if (i < 0) { await t.press('Escape'); return 'NO OPTION ' + JSON.stringify(o) }
  for (let k = 0; k < i; k++) await t.press('ArrowDown'); await t.press('Enter'); await page.waitForTimeout(150); return t.toast()
}
await t.open('design'); log('bulk →', await t.bulk())
await t.role('purchasing'); log('formal →', await t.requestFormal())
let p = await t.proj()
const clean = await page.evaluate(async () => { const m = await import(window.__m('/src/model/rules.ts')); const s = (await import(window.__m('/src/model/store.ts'))).useStore.getState(); const p = s.project(); return p.rows.filter((r) => !m.checkRow(r, s.ws.rules, p).length).map((r) => r.id) })
const fr = p.rows.filter((r) => clean.includes(r.id) && !r.working && r.status === 'formalRequested' && r.procurement === '相見積' && !r.flags.contested && !r.flags.leadNG && !r.needDateFixed && r.altPolicy !== '客先承認要' && p.quotes.filter((q) => q.rowId === r.id && !q.stale && q.unitPrice != null && q.leadDays >= 0).length === 3)
const X = fr[0].id, Z = fr[1].id, W = fr[2].id
const ad = Object.fromEntries([X, Z, W].map((id) => [id, p.rows.find((r) => r.id === id).adoptedSupplierId]))
const q0 = p.rows.find((r) => r.id === X).qtyNeeded, m0 = p.rows.find((r) => r.id === Z).model
log('rows', JSON.stringify(ad), 'X qty', q0, 'Z model', m0)
{ const q = p.quotes.find((x) => x.rowId === X && x.supplierId === ad[X] && !x.stale); await t.press('8'); await t.setCellKey(X, 'q.formalPrice@A', String(q.unitPrice)); await t.press('Escape'); await t.press('Escape') }
await t.role('design'); await t.press('1')
log('X qty →', await t.setCellKey(X, 'qtyNeeded', String(q0 * 3)))
log('Z model →', await t.setCellKey(Z, 'model', m0 + '-V2'))
log('publish →', await t.publish('1'))
p = await t.proj(); for (const id of [X, Z]) log('after publish', h.show(p, id), '|', await h.status(id))
await t.role('purchasing')
log('keep X →', await keep(X)); log('keep Z →', await keep(Z))
p = await t.proj(); for (const id of [X, Z]) log('after keep', h.show(p, id), '|', await h.status(id))
await t.role('design'); await t.press('1'); await t.goto(Z); await t.press('a'); await page.waitForTimeout(80); log('design a Z →', await t.toast())
p = await t.proj(); log('Z after a', h.show(p, Z), '|', await h.status(Z))
await t.role('purchasing'); let n0 = t.downloads.length; log('formal reissue →', await t.requestFormal()); let sh = await sheetsOf(n0)
const files = (id) => [...new Set(sh.filter((s) => s.rows.some((r) => r[0] === id)).map((s) => s.f))]
const diffOf = (id) => sh.filter((s) => s.sh === '差分' && files(id).includes(s.f)).flatMap((s) => s.rows).filter((r) => r[0] === id)
log('files', JSON.stringify([...new Set(sh.map((s) => s.f + ':' + s.sh))]))
const dX = diffOf(X), dZ = diffOf(Z)
log('diff X', JSON.stringify(dX)); log('diff Z', JSON.stringify(dZ))
log('main X', JSON.stringify(sh.filter((s) => s.sh !== '差分').flatMap((s) => s.rows).filter((r) => r[0] === X)))
p = await t.proj(); for (const id of [X, Z]) log('after formal', h.show(p, id), 'withdrawn=', p.rows.find((r) => r.id === id).flags.formalWithdrawn ?? '-', '|', await h.status(id))
check('J3-1 据え置きのあと同じ商社に再発行した X の差分シートに必要数の変化（' + q0 + ' → ' + q0 * 3 + '）が出る', dX.some((r) => r[1] === 'qtyNeeded' && String(r[2]) === String(q0) && String(r[3]) === String(q0 * 3)), JSON.stringify(dX))
const rZ = p.rows.find((r) => r.id === Z)
if (rZ.adoptedSupplierId === ad[Z]) check('J3-2 型式を変えて据え置き・同じ商社で採用し直した Z の差分シートに型式の変化が出る', dZ.some((r) => r[1] === 'model' && String(r[2]) === m0), JSON.stringify(dZ))
else log('INFO Z は別の商社', rZ.adoptedSupplierId, 'で採用（差分シートなしで新規の依頼）', JSON.stringify(dZ))
// 案件納期の前倒し
await t.role('pm'); p = await t.proj(); const due1 = new Date(new Date(p.dueDate).getTime() - 7 * 86400000).toISOString().slice(0, 10); log('PM dueDate →', await h.setting('dueDate', due1, '客先の前倒し'))
p = await t.proj(); for (const id of [X, Z, W]) log('after due', h.show(p, id), '|', await h.status(id))
await t.role('purchasing'); n0 = t.downloads.length; log('formal reissue (due) →', await t.requestFormal()); sh = await sheetsOf(n0)
const d2 = Object.fromEntries([X, Z, W].map((id) => [id, diffOf(id)]))
log('diff after due', JSON.stringify(d2))
check('J3-3 案件納期の変更の再発行で、差分シートに必要納期の変化が出る（W）', d2[W].some((r) => r[1] === '必要納期'), JSON.stringify(d2[W]))
check('J3-4 案件納期の変更の再発行で、前回送った必要数・型式の差分を繰り返さない（X・Z は必要納期だけ）', [X, Z].every((id) => !d2[id].some((r) => ['qtyNeeded', 'model'].includes(r[1]))), JSON.stringify(d2))
log('ERRORS', JSON.stringify(t.errors))
await t.shot('j3')
summary(); await t.close()
