// ラウンド23: 順番に直すモード × 絞り込み（問題のある行の一部だけが見えている）
import { launch, fresh, sleep, toastNow, ws, wizardCreate, panel, palette } from '../r8/rerun7/rerun6/lib.mjs'
import { saveJson } from './lib22.mjs'
const N = 40
const lines = ['部品名\t型式\t変更後型式\tメーカ\t数量']
const nCopy = Math.ceil(N * 1.9), nNew = Math.ceil(N * 0.45)
for (let k = 1; k <= nCopy + nNew + N; k++) lines.push(`部品${k}\tOLD-${k}\t${k <= nCopy ? `OLD-${k}` : k <= nCopy + nNew ? `NEW-${k}` : ''}\tオムロン\t${(k % 7) + 1}`)
const { browser, page, errors } = await launch()
const out = []
const log = (o) => { out.push(o); console.log(JSON.stringify(o).slice(0, 700)) }
for (const key of ['2', '1']) {
  await fresh(page)
  await wizardCreate(page, 'P-SEQ', lines.join('\n'))
  await page.keyboard.press('Escape'); await page.keyboard.press('Alt+1'); await sleep(100)
  // 絞り込み: 部品名に「部品11」を含む行（部品11・部品110〜119 のうち問題行だけ）
  await page.keyboard.press('Alt+/'); await sleep(200)
  await page.keyboard.type('部品10'); await sleep(200); await page.keyboard.press('Enter'); await sleep(300)
  const vis = await page.locator('[data-testid="grid"] tbody tr, [data-testid="grid"] [role="row"]').count().catch(() => -1)
  await palette(page, '順番に直すモード'); await sleep(400)
  const visited = []
  let presses = 0, gone = 0
  for (let i = 0; i < 100 && gone < 6; i++) {
    const p = await panel(page)
    if (!p) { gone++; await sleep(150); continue }
    gone = 0
    visited.push(((await page.getByTestId('cursor').textContent()) ?? '').replace(/\s+/g, ' ').slice(0, 40))
    await page.keyboard.press(key); presses++; await sleep(60)
  }
  const w = await ws(page); const pr = w.projects.find((x) => x.id === w.currentProjectId)
  log({ key, visibleRowsApprox: vis, presses, visited: visited.slice(0, 12), flaggedLeft: pr.rows.filter((x) => (x.note ?? '').startsWith('【削除？】')).length, toast: (await toastNow(page)).slice(0, 140) })
}
saveJson('323-seq-filter.json', out)
console.log('errors', JSON.stringify(errors.filter((e) => e.type !== 'dialog').slice(0, 3)))
await browser.close()
