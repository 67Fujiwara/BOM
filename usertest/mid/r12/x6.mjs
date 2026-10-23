// x6: 要再確認で「採用していない商社」を再見積にしたときの状態（選定済・正式依頼中）、購買の 4（発注数要確認・下書き指摘）
import { launch, check, log, summary } from './lib.mjs'
const t = await launch()
const { page } = t
await t.open('design')
log('bulk →', await t.bulk())
let p = await t.proj()
const st = (p, id) => { const r = p.rows.find((x) => x.id === id); return `${id}:${r.status}:adopt=${r.adoptedSupplierId ?? '-'}:${JSON.stringify(r.flags)}:q=${JSON.stringify(p.quotes.filter((q) => q.rowId === id && !q.stale).map((q) => [q.supplierId, q.unitPrice, q.formalRequestNo ?? null, q.reconfirm ?? '']))}` }
async function pick(id, label) { await t.goto(id); await t.press('Control+.'); await page.waitForTimeout(60); const o = (await t.panel())?.options ?? []; const i = o.findIndex((x) => x.includes(label)); if (i < 0) { log('NO OPTION', label, o); await t.press('Escape'); return } for (let k = 0; k < i; k++) await t.press('ArrowDown'); await t.press('Enter'); await page.waitForTimeout(80) }
const good = p.rows.filter((r) => r.status === 'selected' && !r.flags.contested && !r.flags.leadNG && r.procurement === '相見積' && p.quotes.filter((q) => q.rowId === r.id && !q.stale && q.unitPrice != null).length === 3 && !p.issues.some((i) => i.rowId === r.id)).map((r) => r.id)
const [D, E] = good; log('D(selected) E(formalRequested)', D, E)
// E を正式依頼中にする（他の行も）
await t.role('purchasing'); log('formal →', await t.requestFormal())
p = await t.proj(); log('E', st(p, E)); log('D', st(p, D))
// D は formal 後に選定済のままにしたいので、formal 前の状態にはできない → D も正式依頼中。D は選定済の別の行を探す
const sups = (await t.ws()).suppliers.filter((s) => ['S1', 'S2', 'S3'].includes(s.id))
for (const id of [E]) {
  await t.press('1'); await t.goto(id); await t.press('Shift+I'); await t.press('k'); await page.waitForTimeout(60); await page.getByTestId('issue-text').fill('型式を正確に'); await page.getByTestId('issue-text').press('Enter'); await page.waitForTimeout(60); log('issue →', await t.publish())
  await t.role('design'); await t.press('1'); await t.setCellKey(id, 'model', 'FIX-' + id); log('publish →', await t.publish())
  p = await t.proj(); const ad = p.rows.find((r) => r.id === id).adoptedSupplierId; log(id, 'after fix', st(p, id))
  await t.role('purchasing'); await t.press('5')
  const other = sups.find((s) => s.id !== ad)
  for (const s of sups) await pick(id, `${s.name}: ${s.id === other.id ? '再見積' : '据え置き'}`)
  p = await t.proj(); log(id, 'after reconfirm (adopted keep, other requote)', st(p, id), 'ball', await t.cellText(id, 'ball'))
  await t.press('1'); await t.goto(id); await t.shot('x6-formal-back-to-quoting')
  check('X6-1 採用商社を据え置き・他社を再見積にした正式依頼中の行は、採用と正式依頼を保ったまま（見積中に戻らない）', p.rows.find((r) => r.id === id).status === 'formalRequested', st(p, id))
  log('rough →', await t.requestRough())
  await t.press('6'); await t.setCellKey(id, 'q.unitPrice@' + other.id, '99999'); await t.press('Escape'); await t.setCellKey(id, 'q.leadDays@' + other.id, '9'); await t.press('Escape')
  p = await t.proj(); log(id, 'after other answers', st(p, id), 'ball', await t.cellText(id, 'ball'))
  await t.press('1'); await t.goto(id); await t.press('x'); await page.waitForTimeout(60)
  p = await t.proj(); log(id, 'after purch x', st(p, id), 'ball', await t.cellText(id, 'ball'))
  await t.press('8'); log('purch 8 has', id, (await t.viewRows()).includes(id))
  await t.role('design'); await t.press('4'); log('design 4 has', id, (await t.viewRows()).includes(id)); await t.press('1'); await t.goto(id); await t.press('a'); await page.waitForTimeout(80); log('design a →', await t.toast())
  await t.role('purchasing'); log('formal →', await t.requestFormal()); p = await t.proj(); log(id, 'after formal', st(p, id))
}
// 購買の 4: 発注数要確認・未発行の下書き指摘
p = await t.proj(); const G = p.rows.find((r) => r.status === 'formalRequested' && !r.flags.contested && r.id !== E && r.id !== D).id
await t.press('3'); log('orderQty', await t.setCellKey(G, 'orderQty', String((p.rows.find((r) => r.id === G).orderQty ?? 1) + 5))); await t.press('Escape')
await t.role('design'); await t.press('1'); await t.setCellKey(G, 'qtyNeeded', String(p.rows.find((r) => r.id === G).qtyNeeded + 1)); log('publish →', await t.publish('1'))
p = await t.proj(); log('G', st(p, G))
await t.role('purchasing'); await t.press('1'); await t.goto('R030'); await t.press('Shift+I'); await t.press('q'); await page.waitForTimeout(60); await page.getByTestId('issue-text').fill('下書きのまま'); await page.getByTestId('issue-text').press('Enter'); await page.waitForTimeout(60)
await t.press('4'); const v4 = await t.viewRows(); log('purch 4', v4.length, 'has G(orderQtyCheck)?', v4.includes(G), 'has R030(draft issue)?', v4.includes('R030'))
check('X6-2 購買の 4 に発注数要確認・未発行の下書き指摘が出る（§11）', v4.includes(G) && v4.includes('R030'))
summary(); await t.close()
