// ラウンド14: 自分で書き出した Excel（社内・保管用）を、新しい BOM のガイド「ファイルから」で読み直す（見出しの作り直しの影響）。
// サンプル 80 行と、2,500 行（m5 を読んだ案件）。行ごとに 部品名・型式・メーカ・必要数・単位・回路記号・図面番号・分類・備考 を突き合わせる
import path from 'node:path'
import { launch, fresh, palette, sleep, toastNow, ws } from '../r8/rerun7/rerun6/lib.mjs'
import { saveJson } from './lib15.mjs'
const DL = '/home/user/BOM/usertest/veteran/r15/dl'
const TAG = process.env.TAG ?? ''
const { browser, page, errors } = await launch()
const out = []
const cur = async () => { let w = await ws(page); if (!w) { await page.locator('.gridwrap').focus(); await page.keyboard.press('Control+s'); await sleep(300); w = await ws(page) } return w.projects.find((x) => x.id === w.currentProjectId) }
const F = ['name', 'model', 'maker', 'qtyNeeded', 'unit', 'ref', 'drawing', 'category', 'note']
async function exportAs(digit, file) {
  await page.locator('.gridwrap').focus()
  const dlP = page.waitForEvent('download', { timeout: 60000 })
  await page.keyboard.press('Control+e'); await sleep(200); await page.keyboard.press(digit); await sleep(100)
  if (await page.evaluate(() => !!document.querySelector('[data-testid="panel-export"]'))) await page.keyboard.press('Enter')
  const d = await dlP; await d.saveAs(path.join(DL, file)); await sleep(300)
}
async function wizardFile(file, id) {
  await palette(page, '新しいBOM'); await sleep(60)
  await page.getByTestId('wizard-id').fill(id); await page.keyboard.press('Enter')
  for (let i = 0; i < 6; i++) { await page.keyboard.press('Enter'); await sleep(20) }
  await page.keyboard.press('2'); await sleep(60)
  await page.getByTestId('wizard-file').setInputFiles(path.join(DL, file))
  for (let i = 0; i < 400; i++) { if (/読み込みました|読めませんでした|読めません/.test(await toastNow(page))) break; await sleep(100) }
  const toast = (await toastNow(page)).slice(0, 400)
  if (/読み込みました/.test(toast)) { await page.keyboard.press('Enter'); await sleep(300) }
  const prev = (await page.getByTestId('wizard-preview').textContent({ timeout: 3000 }).catch(() => '')) ?? ''
  if (prev) { await page.keyboard.press('Enter'); await page.waitForFunction(() => !document.querySelector('[data-testid="panel-wizard"]'), null, { timeout: 60000 }).catch(() => {}) }
  return { toast, prev: prev.slice(0, 1200) }
}
function compare(src, dst) {
  const diffs = []; const n = Math.max(src.length, dst.length)
  const cnt = Object.fromEntries(F.map((f) => [f, 0]))
  for (let i = 0; i < n; i++) {
    const a = src[i], b = dst[i]
    if (!a || !b) { diffs.push({ i, src: a?.id, dst: b?.name }); continue }
    for (const f of F) { const x = a[f] ?? '', y = b[f] ?? ''; if (String(x) !== String(y)) { cnt[f]++; if (diffs.length < 12) diffs.push({ i, id: a.id, f, src: x, dst: y }) } }
  }
  return { srcRows: src.length, dstRows: dst.length, diffCount: cnt, diffs }
}
// サンプル 80 行（取消の行・Rev・採用・指摘を含む）
for (const [digit, kind] of [['1', 'internal'], ['3', 'archive']]) {
  await fresh(page)
  const src = (await cur()).rows.map((r) => ({ ...r, ...(r.working ?? {}) }))
  await exportAs(digit, `rt-sample-${kind}${TAG}.xlsx`)
  const w = await wizardFile(`rt-sample-${kind}${TAG}.xlsx`, `P-RT-${kind}`)
  const dst = (await cur()).rows
  const rec = { case: `サンプル 80 行 → ${kind} → 読み直し`, ...w, ...compare(src, dst), cancelledSrc: src.filter((r) => r.status === 'cancelled').map((r) => r.id) }
  out.push(rec); console.log(JSON.stringify(rec).slice(0, 2500))
}
// 2,500 行
await fresh(page)
await wizardFile('m5-2500-pages.xlsx', 'P-RT-BIG')
const big = (await cur()).rows
await exportAs('1', `rt-2500-internal${TAG}.xlsx`)
const w2 = await wizardFile(`rt-2500-internal${TAG}.xlsx`, 'P-RT-BIG2')
const dst2 = (await cur()).rows
const rec2 = { case: '2,500 行 → 社内 → 読み直し', ...w2, ...compare(big, dst2) }
out.push(rec2); console.log(JSON.stringify(rec2).slice(0, 2500))
out.push({ errors: errors.filter((e) => e.type !== 'dialog').slice(0, 10) })
saveJson(`87-roundtrip${TAG}.json`, out)
await browser.close()
