// ラウンド23: 順番に直すモード（seqSeen・行ごとの一周判定）を、【削除？】150 行で 1 / 2 / 3 / 混ぜて押して確かめる
import { launch, fresh, sleep, toastNow, ws, wizardCreate, panel, palette } from '../r8/rerun7/rerun6/lib.mjs'
import { saveJson } from './lib22.mjs'
const N = Number(process.env.NROWS ?? 150)
const lines = ['部品名\t型式\t変更後型式\tメーカ\t数量']
const nCopy = Math.ceil(N * 1.9), nNew = Math.ceil(N * 0.45)
for (let k = 1; k <= nCopy + nNew + N; k++) lines.push(`部品${k}\tOLD-${k}\t${k <= nCopy ? `OLD-${k}` : k <= nCopy + nNew ? `NEW-${k}` : ''}\tオムロン\t${(k % 7) + 1}`)
const { browser, page, errors } = await launch()
const out = []
const log = (o) => { out.push(o); console.log(JSON.stringify(o).slice(0, 700)) }
const stat = async () => { const w = await ws(page); const p = w.projects.find((x) => x.id === w.currentProjectId); return { rows: p.rows.length, flagged: p.rows.filter((x) => (x.note ?? '').startsWith('【削除？】')).length, cancelled: p.rows.filter((x) => x.hidden || x.status === 'cancelled').length } }
for (const pattern of (process.env.PATTERNS ?? '1,2,3,12,13,123,32,22,33').split(',')) {
  await fresh(page)
  // 削除？ を付けるため 21 行目以降は「新が空」、書き写し行(11-20)を作って ambiguous にする
  await wizardCreate(page, 'P-SEQ', lines.join('\n'))
  const s0 = await stat()
  await page.keyboard.press('Escape'); await page.keyboard.press('Alt+1'); await sleep(100)
  await palette(page, '順番に直すモード'); await sleep(300)
  const first = await panel(page)
  let presses = 0, gone = 0, lastPanel = first
  const seenPanels = new Map()
  const t0 = Date.now()
  const keys = pattern.split('')
  for (let i = 0; i < 1200 && gone < 8; i++) {
    const p = await panel(page)
    if (!p) { gone++; await sleep(120); continue }
    gone = 0
    seenPanels.set(p.slice(0, 40), (seenPanels.get(p.slice(0, 40)) ?? 0) + 1)
    await page.keyboard.press(keys[presses % keys.length]); presses++
    await sleep(40)
  }
  const s1 = await stat()
  log({ pattern, start: s0, presses, ms: Date.now() - t0, end: s1, toast: (await toastNow(page)).slice(0, 160), firstPanel: (first ?? '').replace(/\s+/g, ' ').slice(0, 200), distinct: seenPanels.size, maxRepeat: Math.max(0, ...seenPanels.values()) })
}
saveJson(`311-seq-keys-${process.env.PORT ?? 5176}.json`, out)
console.log('errors', JSON.stringify(errors.filter((e) => e.type !== 'dialog').slice(0, 3)))
await browser.close()
