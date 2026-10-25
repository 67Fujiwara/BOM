// l7: Excel の出力を役割ごとに（社内 / 商社向け 全商社共通 / 保管用 / 商社別）と、調達区分を変えた行の変更点（U17-04）
//   設計が A を 相見積 → 指定商社（立花）、B を 相見積 → 支給品、C の部品名を作業中のまま（未公開）にする。ミスミは取引停止
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
import ExcelJS from '/home/user/BOM/node_modules/exceljs/excel.js'
const t = await launch(); const { page } = t; const h = helpers(t)
async function sheetsOf(from) { const out = []; for (const dl of t.downloads.slice(from)) { const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(dl.name); const f = { f: dl.suggested, sheets: {} }; wb.eachSheet((sh) => { const rows = []; sh.eachRow((r) => rows.push(r.values.slice(1))); f.sheets[sh.name] = rows }); out.push(f) } return out }
async function exportOpts() { await page.locator('.gridwrap').focus(); await page.keyboard.press('Control+e'); await page.waitForTimeout(150); const pn = await t.panel(); await page.keyboard.press('Escape'); return pn?.options ?? [] }
async function excel(label) { const opts = await exportOpts(); const idx = opts.findIndex((o) => o.includes(label)); if (idx < 0) return { err: 'no option ' + label, opts }; const n0 = t.downloads.length; await page.keyboard.press('Control+e'); await page.waitForTimeout(150); for (let k = 0; k < idx; k++) await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter'); await page.waitForTimeout(1600); return { f: (await sheetsOf(n0))[0], toast: await t.toast() } }
const col = (rows, name) => rows[0].indexOf(name)
await t.open('design'); log('bulk →', await t.bulk())
let p = await t.proj()
const sel = p.rows.filter((r) => r.status === 'selected' && r.procurement === '相見積' && !r.flags.contested && !r.flags.leadNG && !r.working)
const A = sel.find((r) => r.adoptedSupplierId !== 'S2').id, B = sel[3].id === A ? sel[4].id : sel[3].id, C = sel[6].id
log('A', h.show(p, A)); log('B', h.show(p, B)); log('C', h.show(p, C))
await t.press('1'); await t.showCol('designated', 'procurement')
await t.setCellKey(A, 'procurement', '指定商社'); await t.setCellKey(A, 'designated', '立花エレテック'); await t.setCellKey(B, 'procurement', '支給品')
log('publish →', await t.publish('1'))
log('C name (未公開) →', await t.setCellKey(C, 'name', 'WIP-NAME'))
p = await t.proj(); log('A', h.show(p, A)); log('B', h.show(p, B))
// ミスミを取引停止（保存データを書き換えて開き直す）
const ws = await t.ws(); ws.suppliers = ws.suppliers.map((s) => (s.id === 'S3' ? { ...s, tradable: false } : s)); await t.open('design', ws)
const res = {}
for (const role of ['design', 'purchasing', 'pm']) {
  await t.role(role); await t.press('1'); const opts = await exportOpts(); log(role, 'Ctrl+E options', JSON.stringify(opts))
  res[role] = { opts }
  const internal = await excel('社内'); res[role].internal = internal
  const bom = internal.f?.sheets['BOM'] ?? [[]]; const chg = internal.f?.sheets['変更点'] ?? [[]]
  log(role, 'internal sheets', JSON.stringify(Object.keys(internal.f?.sheets ?? {})), internal.toast)
  const rowOf = (id) => bom.find((r) => r[0] === id)
  log(role, 'BOM A', JSON.stringify(rowOf(A)?.slice(0, 24))); log(role, 'BOM B', JSON.stringify(rowOf(B)?.slice(0, 24))); log(role, 'BOM C', JSON.stringify(rowOf(C)?.slice(0, 24)))
  const iAmt = col(bom, '金額'), iName = col(bom, '部品名'), iStat = col(bom, '状態')
  check(`L7-${role}-1 社内の BOM で支給品に変えた B の金額は空（§3.4 金額集計に含まない）`, rowOf(B) && (rowOf(B)[iAmt] === '' || rowOf(B)[iAmt] == null || rowOf(B)[iAmt] === 0), JSON.stringify(rowOf(B)?.[iAmt]))
  if (role === 'design') check('L7-design-2 設計の社内には作業中の部品名（WIP-NAME）が「作業中の値・未公開」付きで出る', rowOf(C)?.[iName] === 'WIP-NAME' && /作業中/.test(String(rowOf(C)?.[iStat])), JSON.stringify([rowOf(C)?.[iName], rowOf(C)?.[iStat]]))
  else check(`L7-${role}-2 ${role} の社内には公開値の部品名が出る（作業中の WIP-NAME は出ない）`, rowOf(C) && rowOf(C)[iName] !== 'WIP-NAME', JSON.stringify(rowOf(C)?.[iName]))
  const cA = chg.filter((r) => r[3] === A).map((r) => [r[0], r[4], r[5], r[7]]); const cB = chg.filter((r) => r[3] === B).map((r) => [r[0], r[4], r[5], r[7]])
  log(role, '変更点 A', JSON.stringify(cA)); log(role, '変更点 B', JSON.stringify(cB))
  check(`L7-${role}-3 変更点に A の調達区分・指定先の変更、B の調達区分の変更の内容が出る（U17-04）`, cA.some((r) => /調達区分: 相見積 → 指定商社/.test(r[3]) && /指定先/.test(r[3])) && cB.some((r) => /調達区分: 相見積 → 支給品/.test(r[3])), JSON.stringify({ cA, cB }))
  // 商社向け（全商社共通）: 価格列なし・支給品なし
  const sup = await excel('全商社共通'); const sb = sup.f?.sheets['BOM'] ?? [[]]
  log(role, 'supplier-common sheets', JSON.stringify(Object.keys(sup.f?.sheets ?? {})), 'rows', sb.length - 1, 'head', JSON.stringify(sb[0]))
  check(`L7-${role}-4 商社向け（全商社共通）は BOM シートだけ・価格/採用の列なし・支給品の B なし・作業中の値なし`, Object.keys(sup.f?.sheets ?? {}).length === 1 && !sb[0].some((x) => /単価|金額|採用/.test(String(x))) && !sb.some((r) => r[0] === B) && !sb.some((r) => r.includes('WIP-NAME')), JSON.stringify({ sheets: Object.keys(sup.f?.sheets ?? {}), head: sb[0] }))
  check(`L7-${role}-5 Ctrl+E の商社別に取引停止のミスミが無い（U17-03）`, !opts.some((o) => /ミスミ/.test(o)), JSON.stringify(opts))
  // 商社別: 立花 → A（指定商社 立花）が入り、B（支給品）は無い
  const tc = await excel('商社向け: 立花'); const tb = tc.f?.sheets['BOM'] ?? [[]]
  log(role, 'supplier 立花 rows', tb.length - 1, 'has A', tb.some((r) => r[0] === A), 'has B', tb.some((r) => r[0] === B))
  check(`L7-${role}-6 商社向け（立花）に指定先を立花にした A が出て、支給品の B は出ない`, tb.some((r) => r[0] === A) && !tb.some((r) => r[0] === B), `rows=${tb.length - 1}`)
  const ar = await excel('保管用'); const ab = ar.f?.sheets['BOM'] ?? [[]]
  log(role, 'archive head', JSON.stringify(ab[0]?.slice(15)))
  check(`L7-${role}-7 保管用は商社別の見積列つき（因幡・立花の単価列）`, ab[0]?.some((x) => /因幡電機 単価/.test(String(x))) && ab[0]?.some((x) => /立花エレテック 単価/.test(String(x))), JSON.stringify(ab[0]))
}
log('ERRORS', JSON.stringify(t.errors))
await t.shot('l7')
summary(); await t.close()
