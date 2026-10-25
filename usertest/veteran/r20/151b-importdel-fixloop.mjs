// ラウンド20: 【削除？】90 行を F8 → Ctrl+. → 1 で片付ける（キー数と時間）。そのあと公開できるか。
import { launch, fresh, sleep, toastNow, ws, wizardCreate, panel, closeAll } from '../r8/rerun7/rerun6/lib.mjs'
import { saveJson } from './lib20.mjs'
const lines = ['部品名\t型式\t変更後型式\tメーカ\t数量']
for (let k = 1; k <= 300; k++) lines.push(`部品${k}\tOLD-${k}\t${k <= 170 ? `OLD-${k}` : k <= 210 ? `NEW-${k}` : ''}\tオムロン\t${(k % 7) + 1}`)
const { browser, page, errors } = await launch()
await fresh(page)
const out = []
const log = (o) => { out.push(o); console.log(JSON.stringify(o).slice(0, 600)) }
await wizardCreate(page, 'P-DEL2', lines.join('\n'))
const stat = async () => { const w = await ws(page); const p = w.projects.find((x) => x.id === w.currentProjectId); return { rows: p.rows.length, flagged: p.rows.filter((x) => (x.note ?? '').startsWith('【削除？】')).length } }
log({ step: 'created', ...(await stat()) })
await page.keyboard.press('Escape'); await sleep(50)
let keys = 0, t0 = Date.now()
for (let i = 0; i < 100; i++) {
  const st = await stat()
  if (!st.flagged) break
  await page.keyboard.press('F8'); await sleep(25)
  await page.keyboard.press('Control+.'); await sleep(40)
  const p = await panel(page)
  if (p !== 'panel-quickfix') { log({ step: 'no-quickfix', i, p, cursor: await page.getByTestId('cursor').textContent() }); break }
  await page.keyboard.press('1'); await sleep(40)
  keys += 3
}
log({ step: 'loop-done', keys, ms: Date.now() - t0, ...(await stat()) })
const toast = await publishTry(page)
log({ step: 'publish', toast })
async function publishTry(page) { await page.keyboard.press('Control+Enter'); await sleep(300); const p = await panel(page); const t = await toastNow(page); return { p, t: t.slice(0, 300), text: p ? ((await page.locator('.dialog').first().innerText().catch(() => '')) || '').replace(/\s+/g, ' ').slice(0, 300) : '' } }
await closeAll(page)
saveJson(`151b-importdel-fixloop${process.env.RUN ?? ''}.json`, out)
console.log('errors', errors.filter((e) => e.type !== 'dialog').length, JSON.stringify(errors.filter((e) => e.type !== 'dialog').slice(0, 3)))
await browser.close()
