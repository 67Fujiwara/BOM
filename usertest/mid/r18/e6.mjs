// e6: 承認 ON の変更セットで足した行（PM 承認待ち）が、購買の「どこにも」見えないか（M11-07 の修正: どのビューでも出さない）
// ビュー以外: ヘッダー・ステータスバー・受信箱・パレット・絞り込み・Excel（社内 / 商社向け / 保管用）
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
import ExcelJS from '/home/user/BOM/node_modules/exceljs/excel.js'
const t = await launch(); const { page } = t; const h = helpers(t)
await t.open('pm'); log('approval ON →', await h.setting('changeNeedsPmApproval', 'はい', '承認制'))
await t.role('design'); await t.press('1')
const A = await h.addRow('R080', '承認待ちヒミツ部品', 'SECRET-123', 'オムロン', '相見積')
log('publish →', await t.publish('1'))
let p = await t.proj(); log('A', h.show(p, A), 'publishedRev', p.rows.find((r) => r.id === A).publishedRev)
await t.role('purchasing'); await t.press('1')
const hdr = await t.header(); const sb = await t.status(); log('header', hdr.slice(0, 250)); log('status', sb.slice(0, 200))
// 絞り込み
await page.keyboard.press('Alt+/'); await page.waitForTimeout(80); const fin = page.getByTestId('filter-input'); let filt = 'n/a'
if (await fin.count()) { await fin.fill('ヒミツ'); await page.waitForTimeout(150); filt = JSON.stringify(await t.viewRows()); await page.keyboard.press('Escape') }
log('filter ヒミツ →', filt)
// パレット
await page.keyboard.press('Control+k'); await page.getByTestId('palette-input').fill(A); await page.waitForTimeout(150)
const pal = await page.getByTestId('palette-list').locator('.item').allTextContents(); await page.keyboard.press('Escape'); log('palette', A, JSON.stringify(pal.slice(0, 6)))
await page.keyboard.press('Control+k'); await page.getByTestId('palette-input').fill('ヒミツ'); await page.waitForTimeout(150)
const pal2 = await page.getByTestId('palette-list').locator('.item').allTextContents(); await page.keyboard.press('Escape'); log('palette ヒミツ', JSON.stringify(pal2.slice(0, 6)))
// 受信箱
await page.keyboard.press('Control+p'); await page.waitForTimeout(150); const inbox = await t.dialog(); await page.keyboard.press('Escape'); log('inbox', inbox.slice(0, 300))
// Excel
const sheets = {}
for (const [label, idx] of [['社内', 0], ['商社向け全', 1], ['保管用', 2]]) {
  const n0 = t.downloads.length
  await page.locator('.gridwrap').focus(); await page.keyboard.press('Control+e'); await page.waitForTimeout(120)
  for (let k = 0; k < idx; k++) await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter'); await page.waitForTimeout(1500)
  const dl = t.downloads[n0]; if (!dl) { log('no download', label); continue }
  const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(dl.name)
  const found = []
  wb.eachSheet((sh) => sh.eachRow((r) => { const txt = JSON.stringify(r.values); if (txt.includes('ヒミツ') || txt.includes('SECRET-123')) found.push(sh.name + ': ' + txt.slice(0, 120)) }))
  sheets[label] = found; log('excel', label, dl.suggested, JSON.stringify(found))
}
const leakView = /ヒミツ|SECRET/.test(hdr + sb + filt + pal.join() + pal2.join() + inbox)
check('E6-1 購買のヘッダー・ステータスバー・絞り込み・パレット・受信箱に、承認待ちの追加行の部品名・型式が出ない', !leakView, `filter=${filt} palette=${pal2.slice(0, 2)}`)
check('E6-2 購買が出す社内 Excel（BOM・変更点）に、承認待ちの追加行の部品名・型式が出ない', !(sheets['社内'] ?? []).length, JSON.stringify(sheets['社内']))
check('E6-3 商社向け Excel（全商社共通・社外）に、PM 承認前の追加行を載せない', !(sheets['商社向け全'] ?? []).length, JSON.stringify(sheets['商社向け全']))
// パレットから「R081 を発注」「R081 を開く」を実行
for (const lab of ['を発注', 'を開く', 'を隠す']) {
  await page.locator('.gridwrap').focus(); await page.keyboard.press('Control+k'); await page.getByTestId('palette-input').fill(A); await page.waitForTimeout(150)
  const items = await page.getByTestId('palette-list').locator('.item').allTextContents(); const i = items.findIndex((x) => x.includes(lab))
  for (let k = 0; k < i; k++) await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter'); await page.waitForTimeout(200)
  const pn = await t.panel(); const dlg = (await t.dialog()).slice(0, 200)
  p = await t.proj(); const r = p.rows.find((x) => x.id === A)
  log('palette', lab, '→ toast', await t.toast(), '| panel', JSON.stringify(pn?.kind), dlg, '| ordered', r.ordered, 'hidden', r.hidden, 'status', r.status, 'cursor', await t.curRow())
  if (pn) { await page.keyboard.press('Escape'); await page.keyboard.press('Escape') }
}
p = await t.proj(); log('R004 hidden?', p.rows.find((x) => x.id === 'R004').hidden)
// 正式見積済の行にカーソルを置いて、パレットで「R081 を発注」
const fq = p.rows.find((x) => x.status === 'formalQuoted' && !x.ordered && !x.flags.formalDiff && !x.flags.pmPending)
log('formalQuoted row', fq?.id)
if (fq) {
  await t.goto(fq.id); await page.keyboard.press('Control+k'); await page.getByTestId('palette-input').fill(A); await page.waitForTimeout(150)
  const items = await page.getByTestId('palette-list').locator('.item').allTextContents(); const i = items.findIndex((x) => x.includes('を発注'))
  for (let k = 0; k < i; k++) await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter'); await page.waitForTimeout(200)
  p = await t.proj(); log('palette R081 を発注 with cursor on', fq.id, '→', await t.toast(), '| fq ordered', p.rows.find((x) => x.id === fq.id).ordered, '| A ordered', p.rows.find((x) => x.id === A).ordered)
  check('E6-5 パレットで承認待ちの行（見えない行）の「発注」を選んでも、カーソルの別の行を発注しない', !p.rows.find((x) => x.id === fq.id).ordered, fq.id)
}
p = await t.proj(); check('E6-6 パレットで見えない行の「隠す」を選んでも、カーソルの別の行（R004）を隠さない', !p.rows.find((x) => x.id === 'R004').hidden)
const rA = p.rows.find((x) => x.id === A)
check('E6-4 購買がパレットから承認待ちの追加行を発注・隠すなどの操作をできない', !rA.ordered && !rA.hidden, `ordered=${rA.ordered} hidden=${rA.hidden}`)
await t.shot('e6')
summary(); await t.close()
