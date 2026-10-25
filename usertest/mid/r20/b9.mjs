// b9: 客先指定品の全社辞退 → 商社マスタから次の依頼先（M8-07 の修正）。取引不可の商社・メーカを扱わない直販に黙って頼まないか、最後まで辞退したときの案内
// 商社マスタの RS を「取引不可」にした状態（JSON の読み込みと同じ。アプリを開く前に保存データに入れる）
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
const t = await launch(); const { page } = t; const h = helpers(t)
await t.open('design')
const ws = await t.ws(); ws.suppliers = ws.suppliers.map((s) => (s.id === 'S4' ? { ...s, tradable: false } : s))
await t.open('design', ws); await t.press('1')
log('suppliers', JSON.stringify((await t.ws()).suppliers.map((s) => [s.id, s.name, s.tradable, s.handledMakers.join('/')])))
const K = await h.addRow('R080', '客先指定パナ', 'WTP5001', 'パナソニック', '客先指定品', '客先承認 KS-9')
log('publish →', await t.publish('1'))
await t.role('purchasing'); await h.requestTo(null)
const chain = []
for (let n = 0; n < 6; n++) {
  let p = await t.proj(); const cur = p.quotes.filter((q) => q.rowId === K && !q.stale && q.leadDays !== -1)[0]
  if (!cur) break
  chain.push(cur.supplierId)
  await t.press('6'); await t.setCellKey(K, `q.leadDays@${cur.supplierId}`, '取扱なし'); await t.press('Escape')
  await t.press('4'); await t.goto(K); await t.press('Home'); const sb = await t.status(); await t.press('Control+.'); await page.waitForTimeout(80); const qf = await t.panel()
  log(`after ${cur.supplierId} declined: sb hint=${/Ctrl\+\.[^?]*$/.exec(sb)?.[0] ?? sb.slice(-40)} Ctrl+.=${JSON.stringify(qf?.options)}`)
  if (!qf) { log('no quickfix; toast', await t.toast()); break }
  await t.press('Enter'); await page.waitForTimeout(100)
  const pr = await t.panel(); const name = /次の商社 (\S+) に依頼/.exec(qf.options[0])?.[1]; const i = pr.options.findIndex((o) => o.endsWith(' ' + name))
  log('  request panel options', JSON.stringify(pr.options), 'choose', name, i)
  if (i < 0) log('  named supplier is not in the request panel → 先頭の「相見積先すべて」で Enter')
  for (let k = 0; k < i; k++) await t.press('ArrowDown')
  await t.press('Enter'); await page.waitForTimeout(1300); log('  request →', await t.toast())
}
let p = await t.proj(); log('chain', chain.join(' → '), h.show(p, K), 'ball', await h.ballOf(K))
check('B9-1 取引不可の RS には次の依頼先として案内しない・依頼しない', !chain.includes('S4') && !p.quotes.some((q) => q.rowId === K && q.supplierId === 'S4'), chain.join(' → ') + ' / RS quote ' + p.quotes.some((q) => q.rowId === K && q.supplierId === 'S4'))
check('B9-2 パナソニックを扱わないと登録された直販（オムロン直販）に黙って頼まない（頼むなら扱わない旨を示す）', !chain.includes('S5'), chain.join(' → '))
for (const [role, v] of [['purchasing', 4], ['design', 4], ['pm', 7]]) log(`${role} ${v} has K`, await h.inView(role, v, K))
await t.role('purchasing'); await t.press('4'); await t.goto(K); await t.press('Home'); log('final status bar', await t.status())
summary(); await t.close()
