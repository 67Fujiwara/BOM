// p5: 承認 ON。承認待ちの必要数（A）・作業中の必要数（B）・未提出の下書き行（C）・承認待ちの追加行（D）・却下で下書きに戻った追加行（E）があるとき、
//     3 役割 × 全ての出力先（社内／商社向け共通／保管用／商社別 3 社）の BOM シート。商社に渡すものに未承認・未公開が漏れない／購買に未承認の行が出ない／列名は日本語
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
import { csHelpers } from './mcs.mjs'
import { lintXlsx, errs } from './plib.mjs'
const t = await launch({ time: '2026-10-26T09:00:00+09:00' }); const { page } = t; const h = helpers(t); const c = csHelpers(t, h)
const sel = await c.setup(); const A = sel[0].id, B = sel[1].id, qA = sel[0].qtyNeeded, qB = sel[1].qtyNeeded
await t.press('1')
const E = await h.addRow('R075', '追加行E', 'G3VM-61A2', 'オムロン', '相見積', '', '5')
await t.setCellKey(A, 'qtyNeeded', String(qA + 3))
// Rev.3＝A の必要数 ＋ E の追加 → PM が却下（E は下書きに戻る、A は作業中に戻る）
log('publish Rev.3 →', (await t.publish('1')).slice(-40))
let p = await t.proj(); log('subs', c.subs(p))
await t.role('pm'); await t.press('7'); const rE = await t.decide(E, 'Shift+Y', 'Rev.3 は却下'); log('PM reject →', rE.toast.slice(0, 60))
p = await t.proj(); log('E', h.show(p, E).slice(0, 120), '| A', h.show(p, A).slice(0, 120), JSON.stringify(p.rows.find((r) => r.id === A).working ?? null))
// Rev.4＝D の追加 ＋ A の必要数（もう一度）→ 承認待ちのまま
await t.role('design'); await t.press('1')
const D = await h.addRow(E, '追加行D', 'G3VM-61A1', 'オムロン', '相見積', '', '4')
log('publish Rev.4 →', (await t.publish('1')).slice(-40)); p = await t.proj(); log('subs', c.subs(p))
log('A', A, 'B', B, 'D', D, 'E', E)
// B は作業中、C は新しい下書き
await t.role('design'); await t.press('1'); await t.setCellKey(B, 'qtyNeeded', String(qB + 5))
const C = await h.addRow(E, '下書き行C', 'G3VM-61A3', 'オムロン', '相見積', '', '6')
p = await t.proj(); log('B working', JSON.stringify(p.rows.find((r) => r.id === B).working), 'C', h.show(p, C).slice(0, 100))
const ids = { A, B, C, D, E }; const st = Object.fromEntries(Object.entries(ids).map(([k, id]) => [k, p.rows.find((r) => r.id === id).status + (p.rows.find((r) => r.id === id).flags.pmPending ? '/pm' : '')])); log('states', JSON.stringify(st))
const n0 = t.downloads.length; const out = {}
for (const role of ['design', 'purchasing', 'pm']) {
  await t.role(role)
  for (const [i, nm] of [[0, '社内'], [1, '商社共通'], [2, '保管用'], [3, '因幡'], [4, '立花'], [5, 'ミスミ']]) {
    const ex = await c.excel(i); const bom = ex.find((s) => s.sh === 'BOM'); const head = bom.rows[0].map(String)
    const idx = (n) => head.indexOf(n)
    const rowsOf = Object.fromEntries(Object.entries(ids).map(([k, id]) => [k, bom.rows.find((r) => r[0] === id || r[idx('ID')] === id)]))
    const qty = (k) => { const r = rowsOf[k]; const j = head.indexOf('必要数'); return r && j >= 0 ? r[j] : undefined }
    out[`${role}/${nm}`] = { has: Object.fromEntries(Object.keys(ids).map((k) => [k, !!rowsOf[k]])), qA: qty('A'), qB: qty('B'), head: head.slice(0, 40) }
    log(role, nm, 'rows', bom.rows.length - 1, 'has', JSON.stringify(out[`${role}/${nm}`].has), 'qA', qty('A'), 'qB', qty('B'))
  }
}
const o = (k) => out[k]
// 商社に渡すもの（商社向け共通・商社別）は、誰が出しても 公開・承認済の値だけ：A は元の数量、B は元の数量、C・E は出ない、D は承認前なので出ない
for (const role of ['design', 'purchasing', 'pm']) for (const nm of ['商社共通', '因幡', '立花', 'ミスミ']) {
  const x = o(`${role}/${nm}`)
  check(`P5-${role}-${nm}-1 商社に渡す Excel に、下書き行 C・却下で下書きに戻った E が出ない`, !x.has.C && !x.has.E, JSON.stringify(x.has))
  check(`P5-${role}-${nm}-2 商社に渡す Excel に、承認待ちの追加行 D が出ない（まだ社内で決まっていない）`, !x.has.D, JSON.stringify(x.has))
  check(`P5-${role}-${nm}-3 商社に渡す Excel の A・B の必要数は公開済の値（A=${qA}、B=${qB}）。承認待ち・作業中の値を渡さない`, (!x.has.A || x.qA === qA) && (!x.has.B || x.qB === qB), `qA=${x.qA} qB=${x.qB}`)
}
// 購買：社内・保管用にも未承認の行・値が出ない
for (const nm of ['社内', '保管用']) {
  const x = o(`purchasing/${nm}`)
  check(`P5-purchasing-${nm}-1 購買の Excel に、承認待ちの追加行 D が出ない（A は承認待ちの必要数、E は却下で下書きに戻った行、C は未提出の下書き。E・C が下書きとして出るのは画面の 1・2 と同じ＝O5 の判断）`, !x.has.D, JSON.stringify(x.has))
  log('INFO purchasing', nm, '下書き C', x.has.C, '却下で下書きの E', x.has.E)
  check(`P5-purchasing-${nm}-2 購買の Excel の A・B の必要数は公開済の値`, (!x.has.A || x.qA === qA) && (!x.has.B || x.qB === qB), `qA=${x.qA} qB=${x.qB}`)
}
// PM：社内・保管用に C（下書き）・E は出ない。A は承認待ちの値を見せてよい（出すなら承認待ちと分かる）
for (const nm of ['社内', '保管用']) { const x = o(`pm/${nm}`); log('INFO pm', nm, JSON.stringify(x.has), 'qA', x.qA) }
// 設計の社内：全部（作業中の値）。
const xd = o('design/社内'); log('design 社内', JSON.stringify(xd.has), xd.qA, xd.qB)
const lb = await lintXlsx(t.downloads.slice(n0)); log('lint', lb.length, JSON.stringify(lb.slice(0, 4)))
check('P5-lint Excel（3 役割 × 6 出力先）の全シートに undefined/NaN/内部名が出ない（チェック結果の「列」は M22-01 として別に数える）', lb.filter((x) => !/チェック結果/.test(x)).length === 0, lb.filter((x) => !/チェック結果/.test(x)).slice(0, 4))
check('P5-lint2 チェック結果の「列」に内部名が出ない（M22-01）', lb.filter((x) => /チェック結果/.test(x)).length === 0, lb.filter((x) => /チェック結果/.test(x)).slice(0, 3))
errs(t, 'P5-9'); summary(); await t.close()
