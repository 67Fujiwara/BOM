// g3: スコア・推奨から取引不可・相見積先外の商社を外す（M13-05 の修正）の周り
//   mode=adopted: 取引不可にした商社で採用済みの行の選び直し / PM の次点（差分超過）/ 集約の候補 / 詳細
//   mode=quoted : 最安で採用（Ctrl+Alt+A）/ 取引不可の商社の見積しか残らない行
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
const mode = process.argv[2] ?? 'adopted'
const t = await launch(); const { page } = t; const h = helpers(t)
const scores = (id) => page.evaluate(async (id) => { const sc = await import(window.__m('/src/model/score.ts')); const s = (await import(window.__m('/src/model/store.ts'))).useStore.getState(); const p = s.project(); return sc.scoreRow(p, p.rows.find((r) => r.id === id), s.ws.suppliers).map((x) => [x.supplierId, x.total, Math.round(x.effectivePrice)]) }, id)
async function nonTradable(sid) { const ws = await t.ws(); ws.suppliers = ws.suppliers.map((s) => (s.id === sid ? { ...s, tradable: false } : s)); await t.open(t.__role ?? 'design', ws) }
if (mode === 'adopted') {
  await t.open('design'); log('bulk →', await t.bulk())
  let p = await t.proj()
  const atS3 = p.rows.filter((r) => r.adoptedSupplierId === 'S3' && r.status === 'selected' && r.procurement === '相見積').map((r) => r.id)
  log('adopted at S3', atS3.join(','))
  // D: S1 採用で 2 位が S3 の行（差分超過 → PM の次点）
  let D = null
  for (const r of p.rows.filter((r) => r.adoptedSupplierId === 'S1' && r.status === 'selected' && r.procurement === '相見積' && !r.flags.leadNG && !r.flags.contested)) { const sc = await scores(r.id); if (sc.length === 3 && sc[1][0] === 'S3') { D = r.id; log('D', D, JSON.stringify(sc)); break } }
  await t.role('purchasing'); log('formal →', await t.requestFormal())
  p = await t.proj(); const rD = p.rows.find((r) => r.id === D); const qD = p.quotes.find((q) => q.rowId === D && q.supplierId === 'S1' && !q.stale)
  await t.press('8'); await t.setCellKey(D, 'q.formalPrice@A', String(qD.unitPrice + Math.ceil(30000 / Math.max(1, rD.orderQty ?? rD.qtyNeeded)))); await t.press('Escape'); await t.press('Escape')
  p = await t.proj(); log('D before', h.show(p, D), '|', await h.status(D))
  // A: 正式依頼の前に戻す行（S3 で採用・選定済）。正式依頼で formalRequested になっているので、別の案: 一括採用前の状態で見る
  t.__role = 'design'; await nonTradable('S3')
  log('suppliers', JSON.stringify((await t.ws()).suppliers.map((s) => [s.id, s.tradable])))
  // (b) PM 次点
  await t.role('pm'); await t.press('7'); const dec = await t.decide(D, 'b', '次点へ')
  log('PM b →', dec.toast, '| panel', JSON.stringify(dec.panel?.options ?? []).slice(0, 300))
  p = await t.proj(); const rD2 = p.rows.find((r) => r.id === D)
  log('D after b', h.show(p, D), 'withdrawn', rD2.flags.formalWithdrawn ?? '-', 'S1 fno', p.quotes.find((q) => q.rowId === D && q.supplierId === 'S1' && !q.stale).formalRequestNo ?? null, '|', await h.status(D))
  check('G3-1 PM の「次点商社へ」は取引不可の商社を選ばない', rD2.adoptedSupplierId && rD2.adoptedSupplierId !== 'S3', h.show(p, D))
  const qS1 = p.quotes.find((q) => q.rowId === D && q.supplierId === 'S1' && !q.stale)
  check('G3-2 正式見積済（差分超過）の行を PM が次点商社へ替えたら、元の商社の正式依頼の取下げが購買に分かる（調達区分の切り替えと同じ「正式依頼取下げ」）', !!rD2.flags.formalWithdrawn || /取下げ/.test(await h.status(D)), `withdrawn=${rD2.flags.formalWithdrawn} S1 formalRequestNo=${qS1.formalRequestNo} formalPrice=${qS1.formalPrice}`)
  // (a) S3 で採用済み（正式依頼中）の行の詳細・一覧
  await t.role('design'); await t.press('1')
  const A = atS3[0]
  log('A', A, 'scores', JSON.stringify(await scores(A)), '|', await h.status(A))
  await t.goto(A); await t.press('Space'); await page.waitForTimeout(150); const det = ((await page.locator('[data-testid=detail]').count()) ? await page.getByTestId('detail').textContent() : await t.dialog()) ?? ''; await t.press('Escape')
  log('detail A', det.slice(0, 400))
  check('G3-3 S3（取引不可）で採用済みの行の詳細で、S3 に「取引不可」の印がある', /取引不可|取引停止/.test(det), det.slice(0, 200))
} else if (mode === 'reselect') {
  // (a') 選定済（S3）の行を、S3 を取引不可にしたあとで選び直す
  await t.open('design'); log('bulk →', await t.bulk())
  let p = await t.proj()
  const atS3 = p.rows.filter((r) => r.adoptedSupplierId === 'S3' && r.status === 'selected' && r.procurement === '相見積').map((r) => r.id)
  // 例外選定（PM 承認）になる組み合わせ（1 位が S3 で、n 位を選ぶ）を探す
  let A = atS3[0], N = 2
  for (const id of atS3) { const ok = await page.evaluate(async (id) => { const sc = await import(window.__m('/src/model/score.ts')); const s = (await import(window.__m('/src/model/store.ts'))).useStore.getState(); const p = s.project(); const r = p.rows.find((x) => x.id === id); const all = sc.scoreRow(p, r, s.ws.suppliers); for (let n = 1; n < all.length; n++) if (sc.needsPmApproval(p, r, all, all[n])) return n + 1; return 0 }, id); if (ok) { A = id; N = ok; break } }
  log('A', A, 'N', N, JSON.stringify(await scores(A)))
  t.__role = 'design'; await nonTradable('S3')
  // (e) 集約の候補
  await t.press('1'); await t.cmd('商社を集約'); await page.waitForTimeout(150); const cons = await t.panel(); await page.keyboard.press('Escape')
  log('consolidate options', JSON.stringify(cons?.options ?? cons))
  check('G3-4 商社を集約の候補に取引不可の商社（ミスミ）を出さない', !(cons?.options ?? []).some((o) => /ミスミ/.test(o)), JSON.stringify(cons?.options ?? []))
  log('A scores after', JSON.stringify(await scores(A)))
  await t.press('1'); await t.goto(A); await t.press('Shift+A'); await page.waitForTimeout(120); const dlg = (await t.dialog()).slice(0, 400); log('Shift+A list', dlg)
  await t.press(String(N)); await page.waitForTimeout(100); const pr = await t.panel(); log('after N →', JSON.stringify(pr ? { title: pr.title, options: pr.options } : null))
  if (pr?.kind === 'prompt') { await t.press('6'); await page.waitForTimeout(60); await t.promptFill('取引停止のため'); await page.getByTestId('prompt-text').press('Enter'); await page.waitForTimeout(120) }
  if (await t.panel()) await page.keyboard.press('Escape')
  const msg = await t.toast(); p = await t.proj(); const rA = p.rows.find((r) => r.id === A)
  log('reselect →', msg, '|', h.show(p, A), '|', await h.status(A), 'ball', await h.ballOf(A))
  check('G3-5 取引不可にした商社から選び直すのに、PM の例外選定（承認待ち）にならない', rA.adoptedSupplierId !== 'S3' && !rA.flags.pmPending, `${msg} / ${h.show(p, A)}`)
  check('G3-6 Shift+A の一覧で、いまの採用（取引不可）に「取引不可」の印がある', /取引不可|取引停止/.test(dlg), dlg)
} else {
  await t.open('design')
  let p = await t.proj()
  const quoted = p.rows.filter((r) => r.status === 'quoted' && r.procurement === '相見積')
  // C: 最安が S3 の行。F: S1・S2 を辞退にして S3 だけ残す行
  let C = null
  for (const r of quoted) { const sc = await scores(r.id); const ch = [...sc].sort((a, b) => a[2] - b[2])[0]; if (sc.length === 3 && ch[0] === 'S3') { C = r.id; log('C', C, JSON.stringify(sc)); break } }
  const F = quoted.find((r) => r.id !== C && p.quotes.filter((q) => q.rowId === r.id && !q.stale && q.unitPrice != null).length === 3).id
  await t.role('purchasing'); for (const sid of ['S1', 'S2']) log('decline', F, sid, await h.decline(F, sid))
  p = await t.proj(); log('F', h.show(p, F), '|', await h.status(F))
  t.__role = 'design'; await nonTradable('S3')
  await t.press('1'); await t.goto(C); await t.press('Control+Alt+a'); await page.waitForTimeout(100); let pr = await t.panel(); if (pr?.kind === 'prompt') { log('cheapest prompt', pr.title); await page.keyboard.press('Escape') }
  const mc = await t.toast(); p = await t.proj(); log('Ctrl+Alt+A C →', mc, '|', h.show(p, C))
  check('G3-7 最安で採用（Ctrl+Alt+A）は取引不可の商社を選ばない', p.rows.find((r) => r.id === C).adoptedSupplierId !== 'S3', `${mc} / ${h.show(p, C)}`)
  log('F status', await h.status(F), 'ball', await h.ballOf(F), 'scores', JSON.stringify(await scores(F)))
  await t.goto(F); await t.press('a'); await page.waitForTimeout(80); const ma = await t.toast(); log('a F →', ma)
  await t.role('purchasing'); await t.press('4'); const v4 = (await t.viewRows()).includes(F); await t.press('9'); const v9 = (await t.viewRows()).includes(F)
  log('purch 4/9 has F', v4, v9, 'status', await h.status(F))
  p = await t.proj(); const rF = p.rows.find((r) => r.id === F)
  check('G3-8 取引不可の商社の見積しか残らない行は、選定者の「見積済」で止めず購買に戻す（または理由を言う）', rF.status !== 'quoted' || /取引不可|取引停止|相見積先/.test(ma), `status=${rF.status} a→${ma} ball=${await h.ballOf(F)}`)
}
await t.shot('g3-' + mode)
summary(); await t.close()
