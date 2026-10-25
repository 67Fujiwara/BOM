// ラウンド20: 2,500 行の変更表で 【削除？】が 750 行（コピー 57%・変更 13%・空 30%）ある案件と、フラグの無い案件（同じ行数）の F8・Ctrl+.・修正・Ctrl+Z の反応時間
import { launch, fresh, sleep, toastNow, ws, wizardCreate, panel, closeAll } from '../r8/rerun7/rerun6/lib.mjs'
import { saveJson } from './lib22.mjs'
const N = Number(process.env.NN ?? 2500)
const mk = (flag) => { const L = ['部品名\t型式\t変更後型式\tメーカ\t数量']; for (let k = 1; k <= N; k++) L.push(`部品${k}\tOLD-${k}\t${flag ? (k <= N * 0.57 ? `OLD-${k}` : k <= N * 0.7 ? `NEW-${k}` : '') : (k % 10 === 1 ? `NEW-${k}` : '')}\tオムロン\t${(k % 7) + 1}`); return L.join('\n') }
const { browser, page, errors } = await launch()
const out = []
const log = (o) => { out.push(o); console.log(JSON.stringify(o).slice(0, 500)) }
const frame = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
const med = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)]
for (const flag of [true, false]) {
  await fresh(page)
  const t0 = Date.now()
  const r = await wizardCreate(page, 'P-LAT' + (flag ? 'F' : 'N'), mk(flag))
  const w = await ws(page); const p = w.projects.find((x) => x.id === w.currentProjectId)
  const flagged = p.rows.filter((x) => (x.note ?? '').startsWith('【削除？】')).length
  await page.keyboard.press('Escape'); await sleep(200)
  const f8 = [], fix = [], undo = []
  for (let i = 0; i < 12; i++) {
    let t = performance.now(); await page.keyboard.press('F8'); await frame(); f8.push(performance.now() - t)
    if (flag) {
      t = performance.now(); await page.keyboard.press('Control+.'); await frame(); const p1 = await panel(page); const d1 = performance.now() - t
      t = performance.now(); await page.keyboard.press('1'); await frame(); fix.push(d1 + performance.now() - t)
      t = performance.now(); await page.keyboard.press('Control+z'); await frame(); undo.push(performance.now() - t)
      await page.keyboard.press('Control+y'); await frame()
    }
  }
  log({ flag, createMs: r.ms, total: Date.now() - t0, rows: p.rows.length, flagged, f8Med: Math.round(med(f8)), fixMed: fix.length ? Math.round(med(fix)) : null, undoMed: undo.length ? Math.round(med(undo)) : null })
  const t1 = performance.now(); await page.keyboard.press('Control+Enter'); await sleep(50); await frame()
  log({ flag, publishKeyMs: Math.round(performance.now() - t1), toast: (await toastNow(page)).slice(0, 120) })
  await closeAll(page)
}
saveJson(`174-flagged-latency${process.env.RUN ?? ''}.json`, out)
console.log('errors', JSON.stringify(errors.filter((e) => e.type !== 'dialog').slice(0, 3)))
await browser.close()
