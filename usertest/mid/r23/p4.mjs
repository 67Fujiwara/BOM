// p4: 辞退・全社辞退の行、再見積／据え置き、再発行と差分シート（列名・項目名は日本語）
//   part=decl   : 1 行の 3 社を順に辞退 → 全社辞退（見積中・購買のボール）→ 案件の相見積先に S4 を足して依頼 → 回答 → 見積済 → 採用
//   part=requote: 必要数を大きく変えた行 → 再見積要 → Ctrl+. の 1 据え置き（旧見積を有効に戻す）／2 再見積 → 概算依頼書（Rev2）の差分シート
//   part=reissue: 正式依頼中の行の 型式・メーカ・必要数・必要日(前倒し) を同時に変えて公開 → 再発行（Rev F2）の差分シート（項目名が日本語）
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
import ExcelJS from '/home/user/BOM/node_modules/exceljs/excel.js'
import { errs, scanViews, stuck } from './plib.mjs'
import { inv } from './nlib.mjs'
const part = process.argv[2] ?? 'decl'; const tag = 'P4-' + part
const t = await launch({ time: '2026-10-26T09:00:00+09:00' }); const { page } = t; const h = helpers(t)
async function sheets(dl) { const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(dl.name); const out = {}; wb.eachSheet((sh) => { const rows = []; sh.eachRow((r) => rows.push(r.values.slice(1))); out[sh.name] = rows }); return out }
const EN = /\b(qtyNeeded|needOffset|model|maker|orderQty|leadDays|unitPrice)\b/
await t.open('design')
if (part === 'decl') {
  log('bulk →', await t.bulk()); let p = await t.proj()
  const X = p.rows.find((r) => r.status === 'selected' && r.procurement === '相見積' && !r.flags.contested).id
  // 選定済を一度外すのは難しいので、新しい行を足して見積から始める
  await t.press('1'); const Y = await h.addRow('R075', '全社辞退行', 'G3VM-61A1', 'オムロン', '相見積', '', '6')
  log('publish →', (await t.publish('1')).slice(-30)); await t.role('purchasing')
  log('rough →', JSON.stringify((await h.requestTo(null)).msg.slice(0, 60)))
  await t.press('6')
  for (const sid of ['S1', 'S2']) { await t.setCellKey(Y, `q.unitPrice@${sid}`, '100'); await t.press('Escape'); await t.setCellKey(Y, `q.leadDays@${sid}`, '取扱なし'); await t.press('Escape') }
  p = await t.proj(); log('Y after 2 declined', h.show(p, Y).slice(0, 200), 'status', await t.cellText(Y, 'status'))
  await t.setCellKey(Y, 'q.leadDays@S3', '取扱なし'); await t.press('Escape'); p = await t.proj(); const rY = p.rows.find((r) => r.id === Y); log('Y all declined', h.show(p, Y).slice(0, 220), '| status text:', await t.cellText(Y, 'status'), '| ball', await h.ballOf(Y))
  check(`${tag}-1 3 社とも辞退した行は見積済にならず、購買のボール`, !['quoted', 'selected'].includes(rY.status) && (await h.ballOf(Y)) === 'purchasing', `${rY.status}`)
  await t.press('9'); check(`${tag}-2 全社辞退の行は購買の 9 に出る`, (await t.viewRows()).includes(Y), '')
  await t.goto(Y); await page.keyboard.press('Control+.'); await page.waitForTimeout(200); const qf = await t.panel(); log('quickfix', JSON.stringify(qf?.options?.map((o) => o.slice(0, 50))))
  check(`${tag}-3 Ctrl+. に「ほかの商社に依頼する」「設計に代替を相談する」が出る`, (qf?.options ?? []).some((o) => /ほかの商社に依頼/.test(o)) && (qf?.options ?? []).some((o) => /設計に代替を相談/.test(o)), JSON.stringify(qf?.options?.map((o) => o.slice(0, 30))))
  await page.keyboard.press('Escape'); if (await t.panel()) await page.keyboard.press('Escape')
  log('add S4 →', await h.setting('supplierIds', 'S1,S2,S3,S4', 'S4 を足す')); p = await t.proj(); log('supplierIds', p.supplierIds)
  const rq = await h.requestTo('S4'); log('request S4 →', rq.msg.slice(0, 100), JSON.stringify(rq.f.map((f) => [f.sup, f.ids.length, f.ids.includes(Y)])))
  check(`${tag}-4 S4 宛の依頼書に全社辞退の行 ${Y} が入る`, rq.f.some((f) => /RS/.test(f.sup) && f.ids.includes(Y)), JSON.stringify(rq.f.map((f) => [f.sup, f.ids.slice(0, 5)])))
  check(`${tag}-4b 依頼書は S4 の 1 通だけ（辞退した 3 社には出さない）`, rq.f.length === 1, JSON.stringify(rq.f.map((f) => f.sup)))
  await t.press('6'); log('S4 price →', (await t.setCellKey(Y, 'q.unitPrice@S4', '120')).slice(0, 60)); await t.press('Escape'); log('S4 lead →', (await t.setCellKey(Y, 'q.leadDays@S4', '7')).slice(0, 60)); await t.press('Escape')
  p = await t.proj(); const rY2 = p.rows.find((r) => r.id === Y); log('Y after S4', h.show(p, Y).slice(0, 220), '| status', await t.cellText(Y, 'status'))
  check(`${tag}-5 S4 の回答で見積済になる（辞退の 3 社は待たない）`, rY2.status === 'quoted', `${rY2.status} ${await t.cellText(Y, 'status')}`)
  await t.role('design'); await t.press('2'); await t.goto(Y); await page.keyboard.press('a'); await page.waitForTimeout(150); const pa = await t.panel(); log('a →', (await t.toast()).slice(0, 80), JSON.stringify(pa?.kind)); if (pa) { await page.keyboard.press('Enter'); await page.waitForTimeout(100) }
  p = await t.proj(); const rY3 = p.rows.find((r) => r.id === Y); check(`${tag}-6 推奨で採用すると S4 が採用される`, rY3.adoptedSupplierId === 'S4', h.show(p, Y).slice(0, 160))
  const bad = await scanViews(t, ['design', 'purchasing'], [2, 4, 5, 6, 9]); check(`${tag}-7 画面の文字に undefined が出ない`, bad.length === 0, bad.slice(0, 3))
  const iv = inv(p); check(`${tag}-8 不変条件`, iv.length === 0, iv.join(' | '))
} else if (part === 'requote') {
  log('bulk →', await t.bulk()); await t.role('purchasing'); log('formal →', (await t.requestFormal()).slice(-30)); let p = await t.proj()
  // 選定済（正式依頼前）の行にしたいので、いくつかは依頼から外す…ここでは正式依頼中でない行を新規に作る
  await t.role('design'); await t.press('1'); const Y = await h.addRow('R075', '再見積行Y', 'G3VM-61A1', 'オムロン', '相見積', '', '10'); const Z = await h.addRow(Y, '再見積行Z', 'G3VM-61A2', 'オムロン', '相見積', '', '10')
  log('publish →', (await t.publish('1')).slice(-30)); await t.role('purchasing'); log('rough1 →', (await h.requestTo(null)).msg.slice(0, 50))
  await t.press('6'); for (const id of [Y, Z]) for (const sid of ['S1', 'S2', 'S3']) { await t.setCellKey(id, `q.unitPrice@${sid}`, String(100 + (sid === 'S2' ? 5 : 0))); await t.press('Escape'); await t.setCellKey(id, `q.leadDays@${sid}`, '5'); await t.press('Escape') }
  p = await t.proj(); log('Y', h.show(p, Y).slice(0, 160), 'Z', h.show(p, Z).slice(0, 100))
  await t.role('design'); await t.press('2'); for (const id of [Y, Z]) { await t.goto(id); await page.keyboard.press('a'); await page.waitForTimeout(120); if (await t.panel()) { await page.keyboard.press('Enter'); await page.waitForTimeout(100) } }
  await t.press('1'); for (const id of [Y, Z]) log('qty 10→30', id, (await t.setCellKey(id, 'qtyNeeded', '30')).slice(0, 40)); log('publish →', (await t.publish('1')).slice(-30))
  p = await t.proj(); log('Y', h.show(p, Y).slice(0, 220)); log('Z', h.show(p, Z).slice(0, 220))
  check(`${tag}-1 必要数 +200% の行は再見積要になる`, !!(await t.row(Y)).flags.requote && !!(await t.row(Z)).flags.requote, JSON.stringify([(await t.row(Y)).flags, (await t.row(Z)).flags]))
  await t.role('purchasing'); await t.press('9'); check(`${tag}-2 再見積要の行は購買の 9 に出る`, (await t.viewRows()).includes(Y), '')
  async function qfPick(id, re, fill = true) { await t.goto(id); await page.keyboard.press('Control+.'); await page.waitForTimeout(200); const pn = await t.panel(); const i = (pn?.options ?? []).findIndex((o) => re.test(o)); if (i < 0) { await page.keyboard.press('Escape'); return 'NONE ' + JSON.stringify(pn?.options?.map((o) => o.slice(0, 30))) } for (let k = 0; k < i; k++) await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter'); await page.waitForTimeout(200); if (await t.panel()) { if (fill) { try { await t.promptFill('据え置き') } catch {} } ; await page.keyboard.press('Enter'); await page.waitForTimeout(fill ? 150 : 1500) } return (await t.toast()).slice(0, 80) }
  log('Y 据え置き →', await qfPick(Y, /据え置き/)); p = await t.proj(); const rY = p.rows.find((r) => r.id === Y); log('Y', h.show(p, Y).slice(0, 240))
  check(`${tag}-3 据え置きで再見積要が外れ、旧見積が有効に戻る（見積は stale でない）`, !rY.flags.requote && p.quotes.filter((q) => q.rowId === Y && !q.stale).length === 3, h.show(p, Y).slice(0, 200))
  const nz = t.downloads.length; log('Z 再見積 →', await qfPick(Z, /再見積要: 再見積/, false)); await page.waitForTimeout(800); p = await t.proj(); const rZ = p.rows.find((r) => r.id === Z); log('Z', h.show(p, Z).slice(0, 240))
  const n0 = nz; const rq = { msg: await t.toast(), f: await h.files(nz) }; log('rough2 →', rq.msg.slice(0, 90), JSON.stringify(rq.f.map((f) => [f.sup, f.ids.length])))
  check(`${tag}-4 再見積の Z だけ概算を取り直す（Y は含まない）`, rq.f.length > 0 && rq.f.every((f) => f.ids.includes(Z) && !f.ids.includes(Y)), JSON.stringify(rq.f.map((f) => [f.sup, f.ids.filter((i) => [Y, Z].includes(i))])))
  await page.waitForTimeout(800)
  for (const dl of t.downloads.slice(n0)) { const sh = await sheets(dl); const names = Object.keys(sh); const d = sh['差分'];
    log('  file', dl.suggested, names.join('/'), '差分', JSON.stringify(d ?? null)?.slice(0, 300))
    check(`${tag}-5 ${dl.suggested.slice(0, 30)} の差分シート（Rev2）の見出しは 行ID/項目/旧/新、項目名は日本語`, !!d && JSON.stringify(d[0]) === JSON.stringify(['行ID', '項目', '旧', '新']) && d.slice(1).every((r) => !EN.test(String(r[1]))), JSON.stringify(d?.slice(0, 5))) }
  const bad = await scanViews(t, ['purchasing', 'design'], [4, 5, 6, 9]); check(`${tag}-6 画面の文字に undefined が出ない`, bad.length === 0, bad.slice(0, 3))
} else {
  log('bulk →', await t.bulk()); await t.role('purchasing'); log('formal →', (await t.requestFormal()).slice(-30)); let p = await t.proj()
  const X = p.rows.find((r) => r.status === 'formalRequested' && r.procurement === '相見積' && !r.flags.contested && !r.flags.leadNG && !r.needDateFixed && r.qtyNeeded >= 3 && r.adoptedSupplierId === 'S1')
  const id = X.id; log('X', id, h.show(p, id).slice(0, 150))
  await t.role('design'); await t.press('1'); await t.showCol('needOffset')
  log('qty →', (await t.setCellKey(id, 'qtyNeeded', String(X.qtyNeeded + 4))).slice(0, 30)); log('needOffset →', (await t.setCellKey(id, 'needOffset', '-3')).slice(0, 40))
  log('publish →', (await t.publish('1')).slice(-40)); p = await t.proj(); log('X', h.show(p, id).slice(0, 260))
  await t.role('purchasing'); await t.press('9'); await t.goto(id); await page.keyboard.press('Control+.'); await page.waitForTimeout(200); { const pn = await t.panel(); log('quickfix', JSON.stringify(pn?.options?.map((o) => o.slice(0, 40)))); const i = (pn?.options ?? []).findIndex((o) => /据え置き/.test(o)); if (i >= 0) { for (let k = 0; k < i; k++) await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter'); await page.waitForTimeout(200); if (await t.panel()) { try { await t.promptFill('据え置き') } catch {} ; await page.keyboard.press('Enter'); await page.waitForTimeout(150) } } else await page.keyboard.press('Escape') }
  p = await t.proj(); log('X after 据え置き', h.show(p, id).slice(0, 240))
  const n0 = t.downloads.length; const fm = await t.requestFormal(); log('formal2 →', fm.slice(-90)); await page.waitForTimeout(1500)
  for (const dl of t.downloads.slice(n0)) { const sh = await sheets(dl); const d = sh['差分']; log('  file', dl.suggested, Object.keys(sh).join('/'), '差分', JSON.stringify(d ?? null)?.slice(0, 400))
    if (d) { const mine = d.filter((r) => r[0] === id); log('   mine', JSON.stringify(mine))
      check(`${tag}-1 差分シートの見出しは 行ID/項目/旧/新`, JSON.stringify(d[0]) === JSON.stringify(['行ID', '項目', '旧', '新']), JSON.stringify(d[0]))
      check(`${tag}-2 差分シートの項目名が日本語（内部名 qtyNeeded 等でない）`, d.slice(1).every((r) => !EN.test(String(r[1]))), JSON.stringify(d.slice(1, 6).map((r) => r[1])))
      if (mine.length) check(`${tag}-3 ${id} の変更（必要数・必要日）が差分に出る`, mine.some((r) => /必要数/.test(r[1])) && mine.some((r) => /必要(日|納期)/.test(r[1])), JSON.stringify(mine)) } }
  const hasDiff = [...Array(t.downloads.length - n0).keys()].length
  check(`${tag}-4 再発行の依頼書が出る`, t.downloads.length > n0, fm.slice(-80))
}
errs(t, tag + '-9'); summary(); await t.close()
