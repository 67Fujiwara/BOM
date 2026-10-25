// ラウンド23: 順番に直すモード。1 行に問題が 2 つ（【削除？】の備考＋読めない数量）ある行を並べ、2（あとで）/1 で押したとき、全行を 1 回ずつ訪れるか
import { launch, fresh, sleep, toastNow, ws, wizardCreate, panel, palette } from '../r8/rerun7/rerun6/lib.mjs'
import { saveJson } from './lib22.mjs'
const N = Number(process.env.NROWS ?? 30)
const lines = ['部品名\t型式\t変更後型式\tメーカ\t数量']
const nCopy = Math.ceil(N * 1.9), nNew = Math.ceil(N * 0.45)
const BADQTY = process.env.BADQTY !== '0'
for (let k = 1; k <= nCopy + nNew + N; k++) lines.push(`部品${k}\tOLD-${k}\t${k <= nCopy ? `OLD-${k}` : k <= nCopy + nNew ? `NEW-${k}` : ''}\tオムロン\t${k > nCopy + nNew && BADQTY ? 'abc' : (k % 7) + 1}`)
const { browser, page, errors } = await launch()
const out = []
const log = (o) => { out.push(o); console.log(JSON.stringify(o).slice(0, 900)) }
for (const pattern of (process.env.PATTERNS ?? '2,1,12,21').split(',')) {
  await fresh(page)
  await wizardCreate(page, 'P-SEQ', lines.join('\n'))
  await page.keyboard.press('Escape'); await page.keyboard.press('Alt+1'); await sleep(100)
  await palette(page, '順番に直すモード'); await sleep(300)
  const visited = []
  let presses = 0, gone = 0
  const keys = pattern.split('')
  for (let i = 0; i < 400 && gone < 8; i++) {
    const p = await panel(page)
    if (!p) { gone++; await sleep(120); continue }
    gone = 0
    const cur = (await page.getByTestId('cursor').textContent().catch(() => '')) ?? ''
    visited.push(cur.replace(/\s+/g, ' ').slice(0, 60))
    await page.keyboard.press(keys[presses % keys.length]); presses++
    await sleep(40)
  }
  const w = await ws(page); const pr = w.projects.find((x) => x.id === w.currentProjectId)
  const ids = visited.map((v) => (/部品\d+|R\d+|\d{3,}/.exec(v) ?? [v])[0])
  const dup = ids.length - new Set(ids).size
  log({ pattern, presses, flaggedLeft: pr.rows.filter((x) => (x.note ?? '').startsWith('【削除？】')).length, visitedDistinct: new Set(ids).size, dup, first: visited.slice(0, 4), last: visited.slice(-3), toast: (await toastNow(page)).slice(0, 120) })
}
saveJson(`312-seq-multi-${process.env.PORT ?? 5176}.json`, out)
console.log('errors', JSON.stringify(errors.filter((e) => e.type !== 'dialog').slice(0, 3)))
await browser.close()
