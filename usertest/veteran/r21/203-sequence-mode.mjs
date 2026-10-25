// ラウンド21: 「順番に直すモード」で【削除？】90 行を 1 キー × 90 で片付けられるか（V20 §3-1 の一括クリアの代わり）
import { launch, fresh, sleep, toastNow, ws, wizardCreate, panel, palette, closeAll } from '../r8/rerun7/rerun6/lib.mjs'
import { saveJson } from './lib21.mjs'
const lines = ['部品名\t型式\t変更後型式\tメーカ\t数量']
for (let k = 1; k <= 300; k++) lines.push(`部品${k}\tOLD-${k}\t${k <= 170 ? `OLD-${k}` : k <= 210 ? `NEW-${k}` : ''}\tオムロン\t${(k % 7) + 1}`)
const { browser, page, errors } = await launch()
await fresh(page)
const out = []
const log = (o) => { out.push(o); console.log(JSON.stringify(o).slice(0, 600)) }
await wizardCreate(page, 'P-SEQ', lines.join('\n'))
const stat = async () => { const w = await ws(page); const p = w.projects.find((x) => x.id === w.currentProjectId); return { rows: p.rows.length, flagged: p.rows.filter((x) => (x.note ?? '').startsWith('【削除？】')).length } }
log({ step: 'created', ...(await stat()) })
await page.keyboard.press('Escape'); await page.keyboard.press('Alt+1'); await sleep(100)
await palette(page, '順番に直すモード'); await sleep(300)
log({ step: 'sequence-start', panel: await panel(page), cursor: await page.getByTestId('cursor').textContent() })
let presses = 0
const t0 = Date.now()
let gone = 0
for (let i = 0; i < 400 && gone < 8; i++) {
  const p = await panel(page)
  if (!p) { gone++; await sleep(150); continue }
  gone = 0
  await page.keyboard.press('1'); presses++
  await sleep(60)
}
log({ step: 'done', presses, ms: Date.now() - t0, ...(await stat()), panel: await panel(page), toast: (await toastNow(page)).slice(0, 200) })
await page.keyboard.press('Control+z'); await sleep(300)
log({ step: 'undo-once', ...(await stat()), toast: (await toastNow(page)).slice(0, 160) })
saveJson(`203-sequence-mode-${process.env.PORT ?? 5176}.json`, out)
console.log('errors', JSON.stringify(errors.filter((e) => e.type !== 'dialog').slice(0, 3)))
await browser.close()
