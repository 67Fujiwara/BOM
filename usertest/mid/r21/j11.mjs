// j11: 選定前（見積済）の行の最小ロット（閾値超）を PM が承認（M15-05 の修正: 状態はそのまま）→ 選定者が選ぶ → 指摘と発注数
//   因幡の MOQ 100 で起票 → PM y → 設計 a（推奨）→ 採用商社・発注数・最小ロットの指摘はどうなるか
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
const t = await launch(); const { page } = t; const h = helpers(t)
const iss = (p, id) => JSON.stringify(p.issues.filter((i) => i.rowId === id).map((i) => [i.id, i.kind, i.status, (i.text ?? '').slice(0, 50), i.resolution ?? '']))
await t.open('design')
let p = await t.proj()
const Q = p.rows.find((r) => r.status === 'quoted' && r.procurement === '相見積' && r.qtyNeeded <= 4 && p.quotes.filter((q) => q.rowId === r.id && !q.stale && q.unitPrice > 2000 && q.leadDays >= 0).length === 3).id
log('Q', h.show(p, Q))
await t.role('purchasing'); await t.press('6'); log('moq →', await t.setCellKey(Q, 'q.moq@S1', '100')); await t.press('Escape')
await t.press('1'); await t.goto(Q); await t.press('Shift+I'); await page.waitForTimeout(60); await t.press('l'); await page.waitForTimeout(60)
if (await page.getByTestId('issue-text').count()) { log('text', await page.getByTestId('issue-text').inputValue()); await page.getByTestId('issue-text').press('Enter'); await page.waitForTimeout(80) }
log('publish →', await t.publish())
await t.role('pm'); await t.press('7'); const y = await t.yes(Q, '余剰を受け入れる'); log('PM y →', y.toast)
p = await t.proj(); const s0 = await h.status(Q); log('Q after y', h.show(p, Q), '|', s0, 'ball', await h.ballOf(Q), 'issues', iss(p, Q))
check('J11-1 選定前の行は PM の承認のあとも見積済・選定者のボール（M15-05）', p.rows.find((r) => r.id === Q).status === 'quoted' && (await h.ballOf(Q)) === 'design', `${s0} ball=${await h.ballOf(Q)}`)
await t.role('design'); await t.press('4'); const d4 = (await t.viewRows()).includes(Q); log('design 4 has Q', d4)
await t.press('1'); await t.goto(Q); await t.press('Space'); await page.waitForTimeout(150); const det = ((await page.locator('[data-testid=detail]').count()) ? await page.getByTestId('detail').textContent() : await t.dialog()) ?? ''; await t.press('Escape')
log('design Space detail', det.slice(0, 600))
await t.goto(Q); await t.press('a'); await page.waitForTimeout(80); const ma = await t.toast(); p = await t.proj(); const rQ = p.rows.find((r) => r.id === Q)
log('design a →', ma, '|', h.show(p, Q), '|', await h.status(Q), 'ball', await h.ballOf(Q), 'issues', iss(p, Q))
const minOpen = p.issues.some((i) => i.rowId === Q && i.kind === '最小ロット' && ['open', 'inProgress'].includes(i.status))
if (rQ.adoptedSupplierId === 'S1') {
  check('J11-2 PM が余剰を受け入れた因幡で採用したら、発注数は丸め数量（100）', rQ.orderQty === 100, h.show(p, Q))
} else {
  log('INFO 推奨は', rQ.adoptedSupplierId, '（PM が受け入れた因幡 MOQ 100 とは別の商社）発注数', rQ.orderQty, '最小ロットの指摘', minOpen ? '開いたまま' : '閉じた')
  check('J11-3 別の商社（MOQ の効かない商社）で採用したら、因幡の最小ロットの指摘が購買の用事として残り続けない（閉じる・知らせる）', !minOpen || (await h.ballOf(Q)) !== 'purchasing' || /最小ロット/.test(ma), `issues=${iss(p, Q)} ball=${await h.ballOf(Q)} toast=${ma}`)
}
log('ERRORS', JSON.stringify(t.errors))
await t.shot('j11')
summary(); await t.close()
