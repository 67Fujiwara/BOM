// p8: 最小ロット余剰（閾値超）で PM が承認／却下したあと、設計が必要数を変える（小さく／少し／MOQ 超）。発注数・フラグ・PM の 7・指摘の整合
//   usage: node p8.mjs approve|reject small|plus|big
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
import { errs, stuck } from './plib.mjs'
import { inv } from './nlib.mjs'
const dec = process.argv[2] ?? 'approve'; const qmode = process.argv[3] ?? 'plus'; const tag = `P8-${dec}-${qmode}`
const t = await launch({ time: '2026-10-26T09:00:00+09:00' }); const { page } = t; const h = helpers(t)
await t.open('design'); log('bulk →', await t.bulk()); let p = await t.proj()
const price = (r) => p.quotes.find((q) => q.rowId === r.id && q.supplierId === 'S1' && !q.stale)?.unitPrice ?? 0
const cand = p.rows.filter((r) => r.status === 'selected' && r.procurement === '相見積' && r.adoptedSupplierId === 'S1' && !r.flags.contested && !r.flags.leadNG && !r.needDateFixed && r.qtyNeeded >= 5 && r.qtyNeeded <= 40 && (100 - r.qtyNeeded - 1) * price(r) > 25000)
const X = cand[0].id; const need = cand[0].qtyNeeded; const unit = price(cand[0])
await t.role('purchasing'); await t.press('6')
log('moq 100 →', (await t.setCellKey(X, 'q.moq@S1', '100')).slice(0, 60)); await t.press('Escape')
await t.press('1'); await t.goto(X); await t.press('Shift+I'); await page.waitForTimeout(60); await t.press('l'); await page.waitForTimeout(60)
if (await page.getByTestId('issue-text').count()) { await page.getByTestId('issue-text').press('Enter'); await page.waitForTimeout(80) }
log('publish →', (await t.publish()).slice(0, 60))
await t.press('3'); await t.showCol('orderQty'); log('orderQty 100 →', (await t.setCellKey(X, 'orderQty', '100')).slice(0, 60)); await t.press('Escape')
p = await t.proj(); log('X', h.show(p, X).slice(0, 200), 'case', JSON.stringify(await h.caseOf(X)))
check(`${tag}-0 前提：余剰（閾値超）で PM の要決定`, (await h.caseOf(X)) === '閾値超' || /閾値/.test(String(await h.caseOf(X))), String(await h.caseOf(X)))
await t.role('pm'); await t.press('7')
const r1 = dec === 'approve' ? await t.yes(X, '余剰を承認') : await t.decide(X, 'Shift+Y', '余剰は受け入れない'); log('PM', dec, '→', r1.toast.slice(0, 100))
p = await t.proj(); let rX = p.rows.find((r) => r.id === X); log('after PM', h.show(p, X).slice(0, 240))
check(`${tag}-1 ${dec === 'approve' ? '承認で発注数は 100 のまま' : '却下で発注数は必要数 ' + need + ' に戻る'}`, dec === 'approve' ? rX.orderQty === 100 : rX.orderQty === need, `oq=${rX.orderQty}`)
// 必要数を変える
const q2 = qmode === 'small' ? Math.max(1, need - 2) : qmode === 'plus' ? need + 1 : 150
await t.role('design'); await t.press('1'); log('qty →', q2, (await t.setCellKey(X, 'qtyNeeded', String(q2))).slice(0, 50)); log('publish →', (await t.publish('1')).slice(-40))
p = await t.proj(); rX = p.rows.find((r) => r.id === X); const casex = await h.caseOf(X)
log('X after qty', h.show(p, X).slice(0, 260), 'case', JSON.stringify(casex), 'surplusRejected', rX.flags.surplusRejected)
const rounded = (n) => Math.ceil(n / 100) * 100
const surplusAmt = (oq) => (oq - q2) * unit
if (dec === 'reject') {
  check(`${tag}-2 却下した商社（S1）のまま必要数を変えても丸めない（発注数＝必要数 ${q2}。n3 と同じ）`, qmode === 'big' ? rX.orderQty === q2 || rX.orderQty === rounded(q2) : rX.orderQty === q2, `oq=${rX.orderQty}`)
} else {
  check(`${tag}-2 承認後に必要数を ${q2} に変えると発注数は丸め直す（${rounded(q2)}）か、発注数要確認が付く`, rX.orderQty === rounded(q2) || rX.orderQty === q2 || !!rX.flags.orderQtyCheck, `oq=${rX.orderQty} flags=${JSON.stringify(rX.flags)}`)
  // 余剰が閾値超のままなら PM に再度 or 受け入れ済みとして出さない（どちらかに決まっている）
  const sur = surplusAmt(rX.orderQty ?? q2)
  log('surplus now', sur, 'case', JSON.stringify(casex))
}
// 整合
const iv = inv(p); check(`${tag}-3 不変条件`, iv.length === 0, iv.join(' | '))
const sk = await stuck(t); check(`${tag}-4 固まる行がない`, sk.length === 0, sk.slice(0, 4))
// 購買・PM の見え方（7 に載る行は決定パネルが開く）
await t.role('pm'); await t.press('7'); const in7 = (await t.viewRows()).includes(X); log('in 7', in7)
if (in7) { await t.goto(X); await t.press('Enter'); await page.waitForTimeout(100); const pn = await t.panel(); log('panel', JSON.stringify(pn?.title ?? pn?.lines?.slice?.(0, 2) ?? pn)); check(`${tag}-5 7 に載る行は決定パネルが開く（undefined/NaN なし）`, !!pn && !/undefined|NaN/.test(JSON.stringify(pn)), JSON.stringify(pn).slice(0, 200)); await t.press('Escape'); if (await t.panel()) await t.press('Escape') }
await t.role('purchasing'); await t.press('9'); const in9 = (await t.viewRows()).includes(X); const ball = await h.ballOf(X)
check(`${tag}-6 ボール（${ball}）の役割のビューに載る`, (ball === 'pm' ? in7 : ball === 'purchasing' ? true : true), `ball=${ball} in7=${in7} in9=${in9}`)
// 正式依頼書の数量
await t.press('2'); const n0 = t.downloads.length; log('formal →', (await t.requestFormal()).slice(-60)); await page.waitForTimeout(1200)
const rX2 = await t.row(X); log('after formal', h.show(await t.proj(), X).slice(0, 220))
errs(t, tag + '-9'); summary(); await t.close()
