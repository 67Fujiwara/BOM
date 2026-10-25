// ラウンド20: 【削除？】の行の修正・削除を Ctrl+Z / Ctrl+Y し、再読み込みをまたいでも戻せるか。2 タブで片方が直したとき。
import { launch, fresh, sleep, toastNow, ws, wizardCreate, panel, closeAll } from '../r8/rerun7/rerun6/lib.mjs'
import { saveJson } from './lib21.mjs'
const lines = ['部品名\t型式\t変更後型式\tメーカ\t数量']
for (let k = 1; k <= 12; k++) lines.push(`部品${k}\tOLD-${k}\t${k <= 6 ? `OLD-${k}` : k <= 8 ? `NEW-${k}` : ''}\tオムロン\t${(k % 7) + 1}`)
const { browser, context, page, errors } = await launch()
await fresh(page)
const out = []
const log = (o) => { out.push(o); console.log(JSON.stringify(o).slice(0, 700)) }
await wizardCreate(page, 'P-DEL3', lines.join('\n'))
const snap = async (pg = page) => { const w = await pg.evaluate(() => JSON.parse(localStorage.getItem('bom-pro.workspace.v2'))); const p = w.projects.find((x) => x.id === w.currentProjectId); return { rows: p.rows.length, flagged: p.rows.filter((x) => (x.note ?? '').startsWith('【削除？】')).map((x) => x.id), ids: p.rows.map((x) => x.id).join(',') } }
log({ step: 'created', ...(await snap()) })
await page.keyboard.press('Escape'); await sleep(50)
// 1 行目を直す (F8, Ctrl+., 1)
await page.keyboard.press('F8'); await sleep(40); await page.keyboard.press('Control+.'); await sleep(60); await page.keyboard.press('1'); await sleep(100)
log({ step: 'fix-1', ...(await snap()), toast: (await toastNow(page)).slice(0, 120) })
// Shift+Delete で 1 行消す
await page.keyboard.press('F8'); await sleep(40)
log({ step: 'at', cursor: await page.getByTestId('cursor').textContent() })
await page.keyboard.press('Shift+Delete'); await sleep(150)
log({ step: 'shift-delete', ...(await snap()), p: await panel(page), toast: (await toastNow(page)).slice(0, 160) })
await closeAll(page)
await page.keyboard.press('Control+z'); await sleep(100)
log({ step: 'undo1', ...(await snap()), toast: (await toastNow(page)).slice(0, 120) })
await page.keyboard.press('Control+z'); await sleep(100)
log({ step: 'undo2', ...(await snap()), toast: (await toastNow(page)).slice(0, 120) })
// 再読み込み
await page.reload(); await page.waitForSelector('[data-testid="grid"]'); await page.locator('.gridwrap').focus(); await sleep(200)
log({ step: 'reloaded', ...(await snap()) })
await page.keyboard.press('Control+z'); await sleep(100)
log({ step: 'undo-after-reload', ...(await snap()), toast: (await toastNow(page)).slice(0, 120) })
await page.keyboard.press('Control+y'); await sleep(100)
log({ step: 'redo', ...(await snap()), toast: (await toastNow(page)).slice(0, 120) })
await page.keyboard.press('Control+y'); await sleep(100)
log({ step: 'redo2', ...(await snap()), toast: (await toastNow(page)).slice(0, 120) })
// 2 タブ: B が残りを全部直す
const b = await context.newPage(); await b.goto(page.url()); await b.waitForSelector('[data-testid="grid"]'); await sleep(300)
log({ step: 'tabB-open', ...(await snap(b)) })
await b.locator('.gridwrap').focus(); await b.keyboard.press('Escape')
for (let i = 0; i < 6; i++) { const s = await snap(b); if (!s.flagged.length) break; await b.keyboard.press('F8'); await sleep(40); await b.keyboard.press('Control+.'); await sleep(60); await b.keyboard.press('1'); await sleep(100) }
log({ step: 'tabB-fixed', ...(await snap(b)) })
await sleep(500)
log({ step: 'tabA-sees', ...(await snap(page)), toast: (await toastNow(page)).slice(0, 160) })
// A でもまだ F8 → Ctrl+. しても安全か
await page.bringToFront(); await page.locator('.gridwrap').focus(); await page.keyboard.press('F8'); await sleep(60); await page.keyboard.press('Control+.'); await sleep(80)
log({ step: 'tabA-fix-after-B', p: await panel(page), toast: (await toastNow(page)).slice(0, 160), ...(await snap(page)) })
await closeAll(page)
saveJson(`158-importdel-undo${process.env.RUN ?? ''}.json`, out)
console.log('errors', JSON.stringify(errors.filter((e) => e.type !== 'dialog').slice(0, 4)))
await browser.close()
