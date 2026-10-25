// o4c: 見積中の行（全社回答の条件）で、まだ回答していない商社 S3 を 取引停止（stop）／商社マスタから削除（remove）にする。
//   期待: 回答のある S1・S2 で見積済になる（停止・削除した商社の回答は待たない）。remove も stop と同じ
//   usage: node o4c.mjs stop|remove
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
const mode = process.argv[2] ?? 'stop'
const t = await launch(); const { page } = t; const h = helpers(t)
async function importWs(mut) {
  const ws = await t.ws(); mut(ws)
  await t.cmd('JSON を読み込む'); await page.waitForTimeout(150)
  await page.getByTestId('import-text').fill(JSON.stringify(ws)); await page.getByTestId('import-text').press('Control+Enter'); await page.waitForTimeout(250)
  for (let g = 0; g < 3; g++) { const pn = await t.panel(); if (!pn) break; const i = (pn.options ?? []).findIndex((o) => /置き換える/.test(o)); if (i < 0) { await t.press('Escape'); break } for (let k = 0; k < i; k++) await t.press('ArrowDown'); await t.press('Enter'); await page.waitForTimeout(250) }
  await page.locator('.gridwrap').focus(); return t.toast()
}
await t.open('design'); await t.press('1')
const A = await h.addRow('R080', '見積中A', 'G2R-1 DC24', 'オムロン', '相見積')
const B = await h.addRow(A, '見積中B', 'G2R-2 DC24', 'オムロン', '相見積')
log('publish →', (await t.publish('1')).slice(0, 60))
await t.role('purchasing'); log('rule →', await h.setting('quoteCompleteRule', '全社', '完了条件'))
log('request all →', (await h.requestTo(null)).msg.slice(0, 80))
await t.press('6'); await h.q(A, 'S1', 1200, 5); await h.q(A, 'S2', 1300, 6); await h.q(B, 'S1', 800, 5); await h.q(B, 'S2', 850, 6); await t.press('Escape')
let p = await t.proj(); log('A', h.show(p, A).slice(0, 200), '|', await h.status(A))
check('O4C-0 前提：S3 未回答で A は見積中（全社回答の条件）', p.rows.find((r) => r.id === A).status === 'quoting', p.rows.find((r) => r.id === A).status)
log(mode, 'S3 →', await importWs((ws) => { if (mode === 'remove') ws.suppliers = ws.suppliers.filter((s) => s.id !== 'S3'); else ws.suppliers = ws.suppliers.map((s) => (s.id === 'S3' ? { ...s, tradable: false } : s)) }))
p = await t.proj(); const rA = p.rows.find((r) => r.id === A), rB = p.rows.find((r) => r.id === B)
log('A', h.show(p, A).slice(0, 200), '|', await h.status(A)); log('B', h.show(p, B).slice(0, 200), '|', await h.status(B))
check(`O4C-${mode}-1 S3 を${mode === 'remove' ? '削除' : '取引停止'}にすると、回答のある S1・S2 で見積済になる（S3 の回答を待たない）`, rA.status === 'quoted' && rB.status === 'quoted', `${rA.status} ${rB.status} | ${await h.status(A)}`)
if (mode === 'remove') {
  await t.role('purchasing'); await t.press('6'); const r1 = await h.decline(A, 'S3').catch((e) => 'ERR ' + e.message); p = await t.proj()
  log('decline S3 on A →', r1, '|', h.show(p, A).slice(0, 160))
  check('O4C-remove-1b 購買が消えた商社 S3 の欄に「取扱なし」を入れれば見積済になる（回避策）', p.rows.find((r) => r.id === A).status === 'quoted', h.show(p, A).slice(0, 160))
}
await t.press('4'); const in4 = (await t.viewRows()).includes(A); log('purchasing 4 has A', in4)
await t.role('design'); await t.press('1'); await t.goto(A); await t.press('Home'); await t.press('a'); await page.waitForTimeout(150); p = await t.proj()
log('a →', await t.toast(), '|', h.show(p, A).slice(0, 160))
check(`O4C-${mode}-2 設計の a で S1／S2 のどちらかを採用できる`, ['S1', 'S2'].includes(p.rows.find((r) => r.id === A).adoptedSupplierId), h.show(p, A).slice(0, 160))
log('ERRORS', JSON.stringify(t.errors)); summary(); await t.close()
