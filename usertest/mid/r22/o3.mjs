// o3: 選定後の調達区分の切り替えの輪（相見積 → 支給品 → 相見積 → 社内在庫 → 指定商社 → 相見積）を、選定済／正式依頼中／正式見積済の行で。
//   承認 OFF。各段階で不変条件を見る:
//    I1 見積の対象（相見積・指定系）の行は、選定済以降の状態なら採用商社がある（選定済なのに採用なしにならない）
//    I2 支給品・社内在庫の行は採用商社・発注数・納期NG・差分超過・正式依頼の印を持たない／総額（概算）に含めない／正式見積(8)・発注(3)・購買作業(9)に出ない／購買待ちに数えない（U20-01）
//    I3 見積済 n/N の分母 N は支給品・社内在庫の行を含まない
//   usage: node o3.mjs selected|formal|formalq
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
const mode = process.argv[2] ?? 'selected'
const t = await launch(); const { page } = t; const h = helpers(t)
await t.open('design'); log('publish drafts →', (await t.publish('1')).slice(0, 80)); log('bulk →', await t.bulk())
if (mode !== 'selected') { await t.role('purchasing'); log('formal →', await t.requestFormal()) }
let p = await t.proj()
const want = mode === 'selected' ? 'selected' : 'formalRequested'
const cand = p.rows.filter((r) => r.status === want && r.procurement === '相見積' && !r.flags.contested && !r.flags.leadNG && !r.flags.pmPending && r.qtyNeeded >= 3)
const X = cand[0].id
if (mode === 'formalq') {
  const q0 = p.quotes.find((q) => q.rowId === X && q.supplierId === cand[0].adoptedSupplierId && !q.stale)
  await t.role('purchasing'); await t.press('8'); log('formal price →', await t.setCellKey(X, 'q.formalPrice@A', String(q0.unitPrice))); await t.press('Escape')
}
const waitOf = async (role) => { await t.role(role); const s = await t.lamps(); return Number((s.match(/購買待ち\s*(\d+)/) ?? [])[1]) }
const snap = async (label) => {
  p = await t.proj(); const r = p.rows.find((x) => x.id === X)
  const info = await page.evaluate(async (id) => {
    const d = await import(window.__m('/src/model/derive.ts')); const s = (await import(window.__m('/src/model/store.ts'))).useStore.getState(); const pp = s.project(); const row = pp.rows.find((x) => x.id === id)
    return { rough: d.totals(pp).rough, ball: d.ball(pp, row), quotable: d.isQuotable(row), nQuotable: pp.rows.filter((x) => d.isQuotable(x) && x.status !== 'draft').length }
  }, X)
  const wait = await waitOf('purchasing')
  const prog = (await page.getByTestId('quote-progress').textContent().catch(() => '')) ?? ''
  await t.press('9'); const in9 = (await t.viewRows()).includes(X); await t.press('8'); const in8 = (await t.viewRows()).includes(X); await t.press('3'); const in3 = (await t.viewRows()).includes(X)
  const fl = Object.fromEntries(Object.entries(r.flags).filter(([, v]) => v !== undefined && v !== false))
  const line = `${label}: proc=${r.procurement} st=${r.status} adopt=${r.adoptedSupplierId ?? '-'} oq=${r.orderQty ?? '-'} total=${info.rough} ball=${info.ball} 購買待ち=${wait} ${prog} in9=${in9} in8=${in8} in3=${in3} flags=${JSON.stringify(fl)} wd=${r.flags.formalWithdrawn ?? ''}`
  log(line); return { r, info, in9, in8, in3, wait, prog, line }
}
const s0 = await snap('start')
const apply = async (label, vals) => {
  await t.role('design'); await t.press('1'); await t.showCol('designated', 'procurement')
  for (const [k, v] of Object.entries(vals)) { const m = await t.setCellKey(X, k, v); if (/EDIT-ERR/.test(m)) log('  ', k, '→', m) }
  log('  publish →', (await t.publish('1')).slice(0, 100))
  return snap(label)
}
let base = s0
const supplyChecks = (tag, s) => {
  const r = s.r
  check(`O3-${mode}-${tag}-I2a 採用商社・発注数・納期NG・差分超過を持たない`, !r.adoptedSupplierId && !r.flags.leadNG && !r.flags.formalDiff && !r.flags.pmPending, s.line)
  check(`O3-${mode}-${tag}-I2b 総額（概算）から外れる`, s.info.rough < s0.info.rough, `${s0.info.rough} → ${s.info.rough}`)
  check(`O3-${mode}-${tag}-I2c 購買の 8・3 に出ない（商社に頼まない行）`, !s.in8 && !s.in3, `in8=${s.in8} in3=${s.in3} st=${r.status}`)
  check(`O3-${mode}-${tag}-I2d 購買待ちに数えない（購買は何もできない）`, s.info.ball !== 'purchasing', `ball=${s.info.ball} 購買待ち ${s0.wait} → ${s.wait}`)
  check(`O3-${mode}-${tag}-I3 見積済の分母から外れる`, s.prog === '' || Number((s.prog.match(/\/(\d+)/) ?? [])[1]) === Number((base.prog.match(/\/(\d+)/) ?? [])[1]) - 1, `${base.prog} → ${s.prog}`)
}
const sC = await apply('→支給品', { procurement: '支給品' }); supplyChecks('supply', sC)
const sE = await apply('→相見積(戻す)', { procurement: '相見積' })
check(`O3-${mode}-back-I1 相見積に戻すと採用なしの選定済のまま残らない`, !(['selected', 'formalRequested', 'formalQuoted'].includes(sE.r.status) && !sE.r.adoptedSupplierId), sE.line)
check(`O3-${mode}-back-1 戻した行は購買の作業（9）に出るか選定待ち（設計）のボール`, sE.in9 || ['design', 'pm'].includes(sE.info.ball), sE.line)
base = sE
const sD = await apply('→社内在庫', { procurement: '社内在庫' }); supplyChecks('stock', sD)
const sA = await apply('→指定商社(立花)', { procurement: '指定商社', designated: '立花エレテック' })
check(`O3-${mode}-fixed-I1 指定商社に切り替えた行は採用先が指定先（立花）か、見積の依頼待ち`, sA.r.adoptedSupplierId === 'S2' || ['submitted', 'quoting', 'quoted'].includes(sA.r.status), sA.line)
check(`O3-${mode}-fixed-1 総額に含める（§3.4）`, sA.info.rough >= sC.info.rough, sA.line)
base = sA
const sF = await apply('→支給品(指定商社から)', { procurement: '支給品' }); supplyChecks('supply2', sF)
const sG = await apply('→相見積(最後)', { procurement: '相見積' })
check(`O3-${mode}-last-I1 最後に相見積に戻しても採用なしの選定済のまま残らない`, !(['selected', 'formalRequested', 'formalQuoted'].includes(sG.r.status) && !sG.r.adoptedSupplierId), sG.line)
// 戻したあとの正式依頼：支給品を経た行が依頼書に混ざらない／採用がないのに依頼に出ない
if (mode !== 'selected') {
  await t.role('purchasing'); const n0 = t.downloads.length
  log('formal again →', (await t.requestFormal()).slice(0, 160))
  const f = await h.files(n0); log('files', JSON.stringify(f.map((x) => [x.sup, x.ids.length, x.ids.includes(X)])))
  p = await t.proj(); const r = p.rows.find((x) => x.id === X)
  check(`O3-${mode}-last-2 採用の無い行 X が正式依頼書に出ない（依頼先が決まっていない）`, !r.adoptedSupplierId ? !f.some((x) => x.ids.includes(X)) : true, h.show(p, X).slice(0, 160))
}
log('ERRORS', JSON.stringify(t.errors)); summary(); await t.close()
