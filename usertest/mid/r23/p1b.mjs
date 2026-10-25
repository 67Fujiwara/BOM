// p1b: 置換した行（要再確認）の見積を出した商社が、JSON 読み込みでマスタから消えた／取引停止になった。
//   直し方の候補（Ctrl+.）の文言に undefined が出ない・候補を選び終えると要再確認が外れる（固まらない）・詳細パネル／Space に undefined が出ない
//   usage: node p1b.mjs remove|stop
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
import { importWs, scanViews, errs, stuck } from './plib.mjs'
const mode = process.argv[2] ?? 'remove'; const tag = 'P1B-' + mode
const t = await launch(); const { page } = t; const h = helpers(t); await t.open('design'); await t.bulk()
let p = await t.proj(); const X = p.rows.find((r) => r.status === 'selected' && r.procurement === '相見積' && !r.flags.contested).id; await t.press('1')
log('replace', X, (await t.replace(X, 'NEW-MODEL-9')).slice(0, 60)); log('publish', (await t.publish('1')).slice(-30))
p = await t.proj(); const N = p.rows.find((r) => r.replacedFrom === X || r.replaces === X)?.id ?? X; log('new', h.show(p, N).slice(0, 180))
const gone = ['S1', 'S2']
log(mode, await importWs(t, (ws) => { ws.suppliers = mode === 'remove' ? ws.suppliers.filter((s) => !gone.includes(s.id)) : ws.suppliers.map((s) => (gone.includes(s.id) ? { ...s, tradable: false } : s)) }))
await t.role('purchasing'); await t.press('5'); await t.goto(N)
async function quick() { await page.keyboard.press('Control+.'); await page.waitForTimeout(200); return t.panel() }
let pn = await quick(); log('quickfix', JSON.stringify(pn?.options))
check(`${tag}-1 直し方の候補に undefined が出ない`, pn && !(pn.options ?? []).some((o) => /undefined/.test(o)), JSON.stringify(pn?.options))
await page.keyboard.press('Escape'); if (await t.panel()) await page.keyboard.press('Escape')
// 候補を上から順に選んでいく（据え置き）。要再確認が外れるまで
let guard = 0
while (guard++ < 8) {
  p = await t.proj(); const r = p.rows.find((x) => x.id === N); if (!r.flags.reconfirm) break
  pn = await quick(); if (!pn?.options?.length) { await page.keyboard.press('Escape'); break }
  const i = pn.options.findIndex((o) => /据え置き/.test(o)); if (i < 0) { await page.keyboard.press('Escape'); break }
  for (let k = 0; k < i; k++) await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter'); await page.waitForTimeout(200); log('  choose', pn.options[i], '→', (await t.toast()).slice(0, 80))
  if (await t.panel()) { await page.keyboard.press('Escape') }
}
p = await t.proj(); const r2 = p.rows.find((x) => x.id === N); log('after', h.show(p, N).slice(0, 220))
check(`${tag}-2 据え置きを選び終えると要再確認が外れる（消えた/停止の商社の見積で固まらない）`, !r2.flags.reconfirm, h.show(p, N).slice(0, 200))
const bad = await scanViews(t, ['purchasing', 'design'], [4, 5, 6, 9]); check(`${tag}-3 画面の文字に undefined が出ない`, bad.length === 0, bad.slice(0, 4))
await t.goto(N); await page.keyboard.press('Space'); await page.waitForTimeout(150); const tx = await page.evaluate(() => document.body.innerText); check(`${tag}-4 Space の詳細に undefined が出ない`, !/undefined/.test(tx), (tx.match(/.{0,30}undefined.{0,30}/) ?? [''])[0])
errs(t, tag + '-9'); summary(); await t.close()
