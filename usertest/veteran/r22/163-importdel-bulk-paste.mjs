// ラウンド20: 【削除？】90 行を、空のセル 90 個の貼り付け（備考の列）で一度に片付けられるか。Ctrl+Z で戻せるか
import { launch, fresh, sleep, toastNow, ws, wizardCreate, panel, closeAll } from '../r8/rerun7/rerun6/lib.mjs'
import { saveJson } from './lib22.mjs'
const lines = ['部品名\t型式\t変更後型式\tメーカ\t数量']
for (let k = 1; k <= 300; k++) lines.push(`部品${k}\tOLD-${k}\t${k <= 170 ? `OLD-${k}` : k <= 210 ? `NEW-${k}` : ''}\tオムロン\t${(k % 7) + 1}`)
const { browser, context, page, errors } = await launch()
await context.grantPermissions(['clipboard-read', 'clipboard-write'])
await fresh(page)
const out = []
const log = (o) => { out.push(o); console.log(JSON.stringify(o).slice(0, 600)) }
await wizardCreate(page, 'P-DEL5', lines.join('\n'))
const stat = async () => { const w = await ws(page); const p = w.projects.find((x) => x.id === w.currentProjectId); return { rows: p.rows.length, flagged: p.rows.filter((x) => (x.note ?? '').startsWith('【削除？】')).length, notes: p.rows.filter((x) => (x.note ?? '').trim()).length } }
log({ step: 'created', ...(await stat()) })
await page.keyboard.press('Escape'); await page.keyboard.press('Alt+1'); await sleep(100)
// R211 の備考へ
await page.keyboard.press('Control+g'); await page.getByTestId('prompt-text').fill('R211'); await page.keyboard.press('Enter'); await sleep(80)
await page.keyboard.press('Home')
let ok = false
for (let i = 0; i < 40; i++) { const c = (await page.getByTestId('cursor').textContent()) ?? ''; if (/R211\s*備考/.test(c)) { ok = true; break } await page.keyboard.press('ArrowRight') }
log({ step: 'at-note', ok, cursor: await page.getByTestId('cursor').textContent() })
await page.evaluate((t) => navigator.clipboard.writeText(t), '\n'.repeat(90))
const t0 = Date.now()
await page.keyboard.press('Control+v'); await sleep(600)
log({ step: 'paste-empty-90', ms: Date.now() - t0, ...(await stat()), toast: (await toastNow(page)).slice(0, 200) })
await page.keyboard.press('Control+z'); await sleep(300)
log({ step: 'undo', ...(await stat()), toast: (await toastNow(page)).slice(0, 160) })
await page.keyboard.press('Control+y'); await sleep(300)
log({ step: 'redo', ...(await stat()) })
await page.keyboard.press('Control+Enter'); await sleep(300)
log({ step: 'publish', toast: (await toastNow(page)).slice(0, 200), panel: await panel(page) })
saveJson(`163-importdel-bulk-paste${process.env.RUN ?? ''}.json`, out)
console.log('errors', JSON.stringify(errors.filter((e) => e.type !== 'dialog').slice(0, 3)))
await browser.close()
