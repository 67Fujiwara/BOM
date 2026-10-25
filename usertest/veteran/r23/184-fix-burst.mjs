// ラウンド20: 速く打つ人: F8 → Ctrl+. → 1 を待ち時間 0 で 90 回続ける。1 が直し方の選択でなく「打ち始め」としてセルに入らないか（部品名などが「1」にならないか）
import { launch, fresh, sleep, toastNow, ws, wizardCreate, panel, closeAll } from '../r8/rerun7/rerun6/lib.mjs'
import { saveJson } from './lib22.mjs'
const lines = ['部品名\t型式\t変更後型式\tメーカ\t数量']
for (let k = 1; k <= 300; k++) lines.push(`部品${k}\tOLD-${k}\t${k <= 170 ? `OLD-${k}` : k <= 210 ? `NEW-${k}` : ''}\tオムロン\t${(k % 7) + 1}`)
const { browser, page, errors } = await launch()
await fresh(page)
const out = []
const log = (o) => { out.push(o); console.log(JSON.stringify(o).slice(0, 600)) }
await wizardCreate(page, 'P-BURST', lines.join('\n'))
await page.keyboard.press('Escape')
const stat = async () => { const w = await ws(page); const p = w.projects.find((x) => x.id === w.currentProjectId); return { rows: p.rows.length, flagged: p.rows.filter((x) => (x.note ?? '').startsWith('【削除？】')).length, nameOne: p.rows.filter((x) => x.name === '1' || x.model === '1' || x.maker === '1').length, noteOne: p.rows.filter((x) => (x.note ?? '') === '1').length, deferred: p.rows.filter((x) => (x.deferredRules ?? []).length).length } }
log({ step: 'created', ...(await stat()) })
const t0 = Date.now()
for (let i = 0; i < 90; i++) { await page.keyboard.press('F8'); await page.keyboard.press('Control+.'); await page.keyboard.press('1') }
await sleep(800)
log({ step: 'burst-done', ms: Date.now() - t0, ...(await stat()), panel: await panel(page), mode: await page.getByTestId('mode').textContent() })
// もう一度、まだ残りがあれば続ける
for (let i = 0; i < 40; i++) { const s = await stat(); if (!s.flagged) break; await page.keyboard.press('F8'); await sleep(30); await page.keyboard.press('Control+.'); await sleep(60); await page.keyboard.press('1'); await sleep(60) }
log({ step: 'after-cleanup', ...(await stat()), panel: await panel(page), mode: await page.getByTestId('mode').textContent() })
saveJson(`184-fix-burst${process.env.RUN ?? ''}.json`, out)
console.log('errors', JSON.stringify(errors.filter((e) => e.type !== 'dialog').slice(0, 3)))
await browser.close()
