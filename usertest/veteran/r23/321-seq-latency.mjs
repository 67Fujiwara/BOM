// ラウンド23: 順番に直すモードの 1 キーあたりの時間（【削除？】 N 行）。現行(5197)と r22 ビルド(5198)を交互に
import { launch, fresh, sleep, ws, wizardCreate, panel, palette } from '../r8/rerun7/rerun6/lib.mjs'
import { saveJson } from './lib22.mjs'
const N = Number(process.env.NROWS ?? 300)
const lines = ['部品名\t型式\t変更後型式\tメーカ\t数量']
const nCopy = Math.ceil(N * 1.9), nNew = Math.ceil(N * 0.45)
for (let k = 1; k <= nCopy + nNew + N; k++) lines.push(`部品${k}\tOLD-${k}\t${k <= nCopy ? `OLD-${k}` : k <= nCopy + nNew ? `NEW-${k}` : ''}\tオムロン\t${(k % 7) + 1}`)
const out = []
{
  const port = process.env.BOM_URL.match(/:(\d+)/)[1], key = process.env.KEY
  const { browser, page, errors } = await launch()
  await fresh(page)
  await wizardCreate(page, 'P-SEQ', lines.join('\n'))
  await page.keyboard.press('Escape'); await page.keyboard.press('Alt+1'); await sleep(100)
  await palette(page, '順番に直すモード'); await sleep(500)
  const times = []
  for (let i = 0; i < 25; i++) {
    const before = await page.getByTestId('cursor').textContent()
    const t0 = Date.now()
    await page.keyboard.press(key)
    await page.waitForFunction((b) => document.querySelector('[data-testid="cursor"]')?.textContent !== b || !document.querySelector('[data-testid="panel-quickfix"]'), before, { timeout: 20000 }).catch(() => {})
    times.push(Date.now() - t0)
  }
  times.sort((a, b) => a - b)
  const rec = { port, key, N, median: times[12], p90: times[22], max: times[24], errs: errors.filter((e) => e.type !== 'dialog').length }
  out.push(rec); console.log(JSON.stringify(rec))
  await browser.close()
}
saveJson(`321-seq-latency-${process.env.BOM_URL.match(/:(\d+)/)[1]}-${process.env.KEY}.json`, out)
