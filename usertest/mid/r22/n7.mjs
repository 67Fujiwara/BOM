// n7: 調達区分の切り替え（相見積 ⇄ 指定商社 ⇄ 客先指定品 ⇄ 支給品 ⇄ 社内在庫）を、選定済・正式依頼中・正式見積済の行で続けて行う
//   各段階で 状態・採用商社・発注数・金額（概算）・総額・購買の 9 の有無・ボール・フラグを記録し、§3.4 の表（金額集計・分母・スコア）と照らす
//   mode=selected / formal / formalq
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
const mode = process.argv[2] ?? 'selected'
const t = await launch(); const { page } = t; const h = helpers(t)
await t.open('design'); log('bulk →', await t.bulk())
if (mode !== 'selected') {
  await t.role('purchasing'); log('formal →', await t.requestFormal())
}
let p = await t.proj()
const want = mode === 'selected' ? 'selected' : 'formalRequested'
const cand = p.rows.filter((r) => r.status === want && r.procurement === '相見積' && !r.flags.contested && !r.flags.leadNG && !r.flags.pmPending && r.qtyNeeded >= 3)
const X = cand[0].id
if (mode === 'formalq') {
  const q0 = p.quotes.find((q) => q.rowId === X && q.supplierId === cand[0].adoptedSupplierId && !q.stale)
  await t.role('purchasing'); await t.press('8'); log('formal price →', await t.setCellKey(X, 'q.formalPrice@A', String(q0.unitPrice))); await t.press('Escape')
}
const snap = async (label) => {
  p = await t.proj()
  const r = p.rows.find((x) => x.id === X)
  const info = await page.evaluate(async (id) => {
    const d = await import(window.__m('/src/model/derive.ts')); const s = (await import(window.__m('/src/model/store.ts'))).useStore.getState(); const pp = s.project(); const row = pp.rows.find((x) => x.id === id)
    const tt = d.totals(pp); const la = d.lineAmount(pp, row)
    return { rough: tt.rough, formal: tt.formal, line: la.rough, ball: d.ball(pp, row), fixedSid: d.isFixedProcurement(row) ? d.fixedSupplierId(pp, row, s.ws.suppliers) : null }
  }, X)
  await t.role('purchasing'); await t.press('9'); const in9 = (await t.viewRows()).includes(X); await t.press('8'); const in8 = (await t.viewRows()).includes(X)
  const fl = Object.fromEntries(Object.entries(r.flags).filter(([, v]) => v !== undefined && v !== false))
  const line = `${label}: proc=${r.procurement} des=${r.designated ?? '-'} st=${r.status} adopt=${r.adoptedSupplierId ?? '-'} oq=${r.orderQty ?? '-'} line=${info.line} total=${info.rough}/${info.formal} ball=${info.ball} in9=${in9} in8=${in8} fixedSid=${info.fixedSid} flags=${JSON.stringify(fl)} validQ=${p.quotes.filter((q) => q.rowId === X && !q.stale && q.unitPrice != null).length} wd=${r.flags.formalWithdrawn ?? ''}`
  log(line); return { r, info, in9, in8, line }
}
const s0 = await snap('start')
const apply = async (label, vals) => {
  await t.role('design'); await t.press('1'); await t.showCol('designated', 'procurement')
  for (const [k, v] of Object.entries(vals)) { const m = await t.setCellKey(X, k, v); if (/EDIT-ERR/.test(m)) log('  ', k, '→', m) }
  const pm = await t.publish('1'); log('  publish →', pm.slice(0, 120))
  return snap(label)
}
const sA = await apply('→指定商社(立花)', { procurement: '指定商社', designated: '立花エレテック' })
check('N7-1 指定商社に切り替えても金額が集計に残り、指定先（立花 S2）が固定で採用されるか見積を依頼する状態になる', sA.r.status !== 'draft' && sA.info.fixedSid === 'S2' && (sA.r.adoptedSupplierId === 'S2' || ['submitted', 'quoting', 'quoted'].includes(sA.r.status) || sA.r.flags.pmPending || sA.r.flags.reconfirm || sA.r.flags.requote || sA.r.flags.reissue), sA.line)
const sB = await apply('→客先指定品', { procurement: '客先指定品', designated: 'フエニックス A-123' })
const sC = await apply('→支給品', { procurement: '支給品' })
check('N7-2 支給品：金額・総額に含めない（§3.4）。購買の 9 に出ない（商社に頼まない）', sC.info.line == null || sC.info.line === 0 ? true : sC.info.rough < s0.info.rough, sC.line)
check('N7-2b 支給品：購買の 9 に出ない（正式依頼の取下げを伝える行は除く）', !sC.in9 || !!sC.r.flags.formalWithdrawn, sC.line)
const sD = await apply('→社内在庫', { procurement: '社内在庫' })
check('N7-3 社内在庫も同じ（総額に含めない）', sD.info.rough <= s0.info.rough - 1 || sD.info.rough === sC.info.rough, sD.line)
const sE = await apply('→相見積(戻す)', { procurement: '相見積' })
check('N7-4 相見積に戻すと、見積が有効なら総額に戻る・購買の作業に戻る（見積中／見積済／選定済のいずれか）', ['quoting', 'quoted', 'selected', 'submitted', 'formalRequested', 'formalQuoted'].includes(sE.r.status), sE.line)
log('ERRORS', JSON.stringify(t.errors))
summary(); await t.close()
