// n3: PM が余剰（因幡 MOQ 100）を却下した行を、別の経路で因幡に採り直す（M19-03 の修正の確認と、同じ形の他の経路）
//   mode=a      : 因幡しか回答の無い行で却下 → 選定者が a
//   mode=shiftA : 同じ → Shift+A で 1 位（因幡）
//   mode=swap   : 3 社回答の行で却下 → Shift+A で別の商社（理由つき）→ Shift+A で因幡に戻す
//   mode=consol : 却下 → 別の商社に付け替え → Ctrl+K →「商社を集約」で因幡（確認で Enter）
//   mode=fixed  : 却下 → 設計が調達区分を指定商社・指定先＝因幡に（指定先の自動採用）
//   mode=nextb  : 却下 → 別の商社 → 正式依頼 → 差分超過 → PM が b（次点＝因幡）
//   期待: 発注数は必要数のまま（却下した数 100 に戻らない）。必要数を変えても丸めない。正式依頼書も必要数
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
import ExcelJS from '/home/user/BOM/node_modules/exceljs/excel.js'
const mode = process.argv[2] ?? 'a'
const t = await launch(); const { page } = t; const h = helpers(t)
async function raiseMinLot(X) {
  await t.press('1'); await t.goto(X); await t.press('Shift+I'); await page.waitForTimeout(60); await t.press('l'); await page.waitForTimeout(60)
  if (await page.getByTestId('issue-text').count()) { await page.getByTestId('issue-text').press('Enter'); await page.waitForTimeout(80) }
  return t.publish()
}
await t.open('design'); log('bulk →', await t.bulk())
let p = await t.proj()
const price = (r) => p.quotes.find((q) => q.rowId === r.id && q.supplierId === 'S1' && !q.stale)?.unitPrice ?? 0
const cand = p.rows.filter((r) => r.status === 'selected' && r.procurement === '相見積' && r.adoptedSupplierId === 'S1' && !r.flags.contested && !r.flags.leadNG && !r.needDateFixed && r.qtyNeeded >= 5 && r.qtyNeeded <= 40 && (100 - r.qtyNeeded - 1) * price(r) > 25000)
const X = cand[0].id; const need = cand[0].qtyNeeded
log('X', h.show(p, X))
const rankOf = (sid) => page.evaluate(async ([id, sid]) => { const m = await import(window.__m('/src/model/score.ts')); const s = (await import(window.__m('/src/model/store.ts'))).useStore.getState(); const p = s.project(); return m.scoreRow(p, p.rows.find((r) => r.id === id), s.ws.suppliers).map((x) => x.supplierId).indexOf(sid) + 1 }, [X, sid])
await t.role('purchasing'); await t.press('6')
if (mode === 'a' || mode === 'shiftA') for (const sid of ['S2', 'S3']) log('decline', sid, '→', await h.decline(X, sid))
log('moq →', await t.setCellKey(X, 'q.moq@S1', '100')); await t.press('Escape')
log('raise →', await raiseMinLot(X))
await t.press('3'); await t.showCol('orderQty'); log('orderQty 100 →', await t.setCellKey(X, 'orderQty', '100')); await t.press('Escape')
await t.role('pm'); await t.press('7')
const dec = await t.decide(X, 'Shift+Y', '余剰が多すぎる'); log('PM Shift+Y →', dec.toast)
p = await t.proj(); let rX = p.rows.find((r) => r.id === X); log('after reject', h.show(p, X))
check('N3-0 却下で発注数は必要数 ' + need + '、却下の印は因幡', rX.orderQty === need && rX.flags.surplusRejected === 'S1', h.show(p, X))
async function pmYes(txt = '承認') { await t.role('pm'); await t.press('7'); const y = await t.yes(X, txt); log('PM y →', y.toast) }
async function pick(sid, reason = '6') {
  await t.role('design'); await t.press('1'); const rk = await rankOf(sid); const r = await h.adoptPick(X, rk, reason, '理由'); p = await t.proj(); log(`Shift+A ${sid} (rank ${rk}) →`, r.toast, '|', h.show(p, X))
  if (p.rows.find((r) => r.id === X).flags.pmPending) await pmYes('例外を承認'); p = await t.proj()
}
if (mode === 'a') {
  await t.role('design'); await t.press('1'); await t.goto(X); await t.press('Home'); await t.press('a'); await page.waitForTimeout(120)
} else if (mode === 'shiftA') {
  await pick('S1', '1')
} else if (mode === 'swap') {
  await pick('S2'); p = await t.proj(); log('S2 adopted', h.show(p, X))
  await pick('S1')
} else if (mode === 'consol') {
  await pick('S2')
  await t.role('design'); await t.press('1')
  await t.cmd('商社を集約'); await page.waitForTimeout(100); const pn = await t.panel(); log('consolidate options', JSON.stringify(pn?.options))
  const idx = pn?.options?.findIndex((o) => /^因幡/.test(o) && !/[、・\/+]/.test(o.split('::')[0])) ?? -1
  log('idx', idx)
  if (idx >= 0) { for (let k = 0; k < idx; k++) await t.press('ArrowDown'); await t.press('Enter'); await page.waitForTimeout(120); log('confirm', (await t.dialog()).slice(0, 120)); await page.keyboard.press('2'); await page.waitForTimeout(300); await page.keyboard.press('Escape') }
  log('consol toast', await t.toast())
} else if (mode === 'fixed') {
  await t.role('design'); await t.press('1'); await t.showCol('designated', 'procurement')
  log('proc →', await t.setCellKey(X, 'procurement', '指定商社')); log('designated →', await t.setCellKey(X, 'designated', '因幡電機'))
  log('publish →', await t.publish('1'))
} else if (mode === 'nextb') {
  await pick('S2')
  await t.role('purchasing'); log('formal →', await t.requestFormal()); p = await t.proj(); log('X after formal', h.show(p, X))
  const q2 = p.quotes.find((q) => q.rowId === X && q.supplierId === p.rows.find((r) => r.id === X).adoptedSupplierId && !q.stale)
  await t.press('8'); log('formal price x3 →', await t.setCellKey(X, 'q.formalPrice@' + 'A', String(q2.unitPrice * 3 + 30000))); await t.press('Escape')
  p = await t.proj(); log('case', await h.caseOf(X), h.show(p, X))
  await t.role('pm'); await t.press('7'); await t.goto(X); await t.press('Enter'); await page.waitForTimeout(100); log('panel', JSON.stringify((await t.panel())?.options))
  await t.press('b'); await page.waitForTimeout(100); let pr = await t.panel(); if (pr?.kind === 'prompt') { await t.promptFill('次点へ'); await page.getByTestId('prompt-text').press('Enter'); await page.waitForTimeout(150) }
  if (await t.panel()) { await t.press('Escape'); await t.press('Escape') }
  log('b →', await t.toast())
}
p = await t.proj(); rX = p.rows.find((r) => r.id === X); log('after adopt', h.show(p, X), 'case', await h.caseOf(X))
const sidNow = rX.adoptedSupplierId
check(`N3-1 因幡（S1）を採り直しても発注数は必要数 ${need}（却下した 100 に戻らない）`, sidNow !== 'S1' || rX.orderQty === need, h.show(p, X))
if (sidNow === 'S1') {
  check('N3-1b PM の 7 に黙って載らない／載るなら理由が分かる', true, 'case=' + await h.caseOf(X))
  // 必要数の変更でも丸めない
  await t.role('design'); await t.press('1'); log('qty +2 →', await t.setCellKey(X, 'qtyNeeded', String(need + 2))); log('publish →', await t.publish('1'))
  p = await t.proj(); rX = p.rows.find((r) => r.id === X); log('after qty', h.show(p, X))
  check(`N3-2 必要数 ${need + 2} で発注数 ${need + 2}（丸めない）`, rX.orderQty === need + 2, h.show(p, X))
  if (mode !== 'fixed') {
    await t.role('purchasing'); const n0 = t.downloads.length; log('formal →', await t.requestFormal())
    const rows = []; for (const dl of t.downloads.slice(n0)) { const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(dl.name); wb.worksheets[0].eachRow((r) => { const v = r.values.slice(1); if (v[0] === X) rows.push(v.slice(0, 6)) }) }
    log('formal X', JSON.stringify(rows))
    check('N3-3 正式見積の依頼書に因幡の 100 が出ない', !rows.some((r) => r[4] === 100), JSON.stringify(rows))
  }
}
log('ERRORS', JSON.stringify(t.errors))
summary(); await t.close()
