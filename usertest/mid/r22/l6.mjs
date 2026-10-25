// l6: 相見積の行で採用商社（ミスミ）を取引停止（JSON の読み込み）→ 外した理由（U16-03 の残りの修正）・取下げ・選び直し・正式依頼
//   選定済の行 S と、正式依頼中の行 F（ミスミに F1 を出した）を見る
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
const t = await launch(); const { page } = t; const h = helpers(t)
async function importTradable(sid, tradable) {
  const ws = await t.ws(); ws.suppliers = ws.suppliers.map((s) => (s.id === sid ? { ...s, tradable } : s))
  await t.cmd('JSON を読み込む'); await page.waitForTimeout(150)
  await page.getByTestId('import-text').fill(JSON.stringify(ws)); await page.getByTestId('import-text').press('Control+Enter'); await page.waitForTimeout(250)
  for (let g = 0; g < 3; g++) { const pn = await t.panel(); if (!pn) break; const i = (pn.options ?? []).findIndex((o) => /置き換える/.test(o)); if (i < 0) { await t.press('Escape'); break } for (let k = 0; k < i; k++) await t.press('ArrowDown'); await t.press('Enter'); await page.waitForTimeout(250) }
  await page.locator('.gridwrap').focus()
  return t.toast()
}
async function sb(role, view, id) { await t.role(role); await t.press(String(view)); await t.goto(id); await t.press('Home'); return (await t.status()).slice(0, 320) }
await t.open('design'); log('bulk →', await t.bulk())
let p = await t.proj()
const F = 'R056', S = 'R020'
log('F', h.show(p, F)); log('S', h.show(p, S))
// F だけミスミに正式依頼（S は設計が作業中にしておいて除外）
await t.press('1'); log('S note →', await t.setCellKey(S, 'note', '作業中'))
await t.role('purchasing'); log('formal F1 →', await t.requestFormal())
await t.role('design'); await t.press('1'); await t.press('Control+z'); await page.waitForTimeout(150)
p = await t.proj(); log('F st', p.rows.find((r) => r.id === F).status, 'S st', p.rows.find((r) => r.id === S).status, 'S working', JSON.stringify(p.rows.find((r) => r.id === S).working ?? null))
await t.role('purchasing'); log('import stop S3 →', await importTradable('S3', false))
p = await t.proj(); const rF = p.rows.find((r) => r.id === F), rS = p.rows.find((r) => r.id === S)
log('F after', h.show(p, F), rF.status, 'wd', rF.flags.formalWithdrawn ?? '-'); log('S after', h.show(p, S), rS.status)
const sbSd = await sb('design', 1, S), sbSp = await sb('purchasing', 1, S), sbFp = await sb('purchasing', 1, F)
log('S design sb', sbSd); log('S purch sb', sbSp); log('F purch sb', sbFp)
check('L6-1 設計（選定者）のステータスバーに、ミスミが取引停止のため採用を外した理由が出る（U16-03）', /ミスミ/.test(sbSd) && /取引停止/.test(sbSd), sbSd)
check('L6-2 正式依頼中だった行は、購買のステータスバーでミスミへの取下げの依頼No が分かる（取引停止の理由と並べて）', /取り下げ|取下げ/.test(sbFp) && /P-2026-041-S3-F/.test(sbFp), sbFp)
const d4 = await h.inView('design', 4, S); log('design 4 has S', d4, 'ball', await h.ballOf(S))
check('L6-3 採用を外した行は選定者（設計）の 4 に出る', d4)
// 設計が選び直す（a）→ 理由の表示が消える → 購買が正式見積の依頼
await t.role('design'); await t.press('1'); for (const id of [S, F]) { await t.goto(id); await t.press('a'); await page.waitForTimeout(100); log('a', id, '→', await t.toast()) }
p = await t.proj(); log('S re', h.show(p, S)); log('F re', h.show(p, F))
const sbS2 = await sb('design', 1, S); log('S design sb after a', sbS2)
check('L6-4 選び直したら取引停止の理由の表示は消える', !/取引停止/.test(sbS2), sbS2)
await t.role('purchasing'); const n0 = t.downloads.length; log('formal →', await t.requestFormal()); const f0 = await h.files(n0)
log('files', JSON.stringify(f0.map((f) => [f.sup, f.ids.filter((x) => [F, S].includes(x))])))
check('L6-5 選び直した行（F）の正式見積の依頼書が新しい商社に出て、ミスミには出ない', !f0.some((f) => f.sup === 'ミスミ') && f0.some((f) => f.ids.includes(F)), JSON.stringify(f0.map((f) => [f.sup, f.ids.length])))
p = await t.proj(); const wdF = p.rows.find((r) => r.id === F).flags.formalWithdrawn ?? ''
log('F wd after new formal', wdF)
check('L6-6 別の商社に出し直しても、ミスミへの取下げは購買が x で伝えるまで残る', wdF.includes('ミスミ'), wdF)
log('ERRORS', JSON.stringify(t.errors))
await t.shot('l6')
summary(); await t.close()
