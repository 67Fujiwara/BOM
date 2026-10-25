// ラウンド21: 【削除？】90 行の片付けに安い方法があるか。(a) 備考の列を範囲選択して Delete (b) パレットの名前 (c) 絞り込みで【削除？】だけを出して (d) Ctrl+. の一括。F8 → Ctrl+. → 1 の 3 キー × 90 との比較
import { launch, fresh, sleep, toastNow, ws, wizardCreate, panel, paletteItems, closeAll } from '../r8/rerun7/rerun6/lib.mjs'
import { saveJson } from './lib22.mjs'
const lines = ['部品名\t型式\t変更後型式\tメーカ\t数量\t備考']
for (let k = 1; k <= 300; k++) lines.push(`部品${k}\tOLD-${k}\t${k <= 170 ? `OLD-${k}` : k <= 210 ? `NEW-${k}` : ''}\tオムロン\t${(k % 7) + 1}\t${k > 210 && k % 10 === 0 ? '元からの備考' + k : ''}`)
const { browser, context, page, errors } = await launch()
await fresh(page)
const out = []
const log = (o) => { out.push(o); console.log(JSON.stringify(o).slice(0, 700)) }
await wizardCreate(page, 'P-BULK', lines.join('\n'))
const stat = async () => { const w = await ws(page); const p = w.projects.find((x) => x.id === w.currentProjectId); return { rows: p.rows.length, flagged: p.rows.filter((x) => (x.note ?? '').startsWith('【削除？】')).length, notes: p.rows.filter((x) => (x.note ?? '').trim()).length } }
log({ step: 'created', ...(await stat()) })
await page.keyboard.press('Escape'); await page.keyboard.press('Alt+1'); await sleep(100)
// (b) パレット
for (const q of ['削除？', '要る部品', '削除', '取り込み', '一括', 'すべて', '全部', '問題', '直す', 'importDel', '印を消す', '備考']) log({ step: 'palette', q, items: (await paletteItems(page, q)).slice(0, 8) })
// (a) 備考の列で範囲選択
await page.keyboard.press('Control+g'); await page.getByTestId('prompt-text').fill('R211'); await page.keyboard.press('Enter'); await sleep(80)
await page.keyboard.press('Home')
for (let i = 0; i < 40; i++) { const c = (await page.getByTestId('cursor').textContent()) ?? ''; if (/R211\s*備考/.test(c)) break; await page.keyboard.press('ArrowRight') }
log({ step: 'at-note', cursor: await page.getByTestId('cursor').textContent() })
const t0 = Date.now()
for (let i = 0; i < 89; i++) await page.keyboard.press('Shift+ArrowDown')
log({ step: 'shift-down-89', ms: Date.now() - t0, cursor: await page.getByTestId('cursor').textContent(), mode: await page.getByTestId('mode').textContent().catch(() => '') })
await page.keyboard.press('Delete'); await sleep(500)
log({ step: 'delete-range', ...(await stat()), toast: (await toastNow(page)).slice(0, 200) })
await page.keyboard.press('Control+z'); await sleep(400)
log({ step: 'undo', ...(await stat()), toast: (await toastNow(page)).slice(0, 160) })
// (c) 絞り込み
await page.keyboard.press('Escape')
await page.keyboard.press('Control+f'); await sleep(80)
await page.keyboard.type('【削除？】'); await sleep(300)
log({ step: 'filter', filterInput: await page.evaluate(() => document.activeElement?.tagName + ':' + (document.activeElement?.value ?? '')), rowsShown: await page.evaluate(() => document.querySelectorAll('[data-testid="grid"] [data-row-id], [data-testid="grid"] tbody tr').length) })
await page.keyboard.press('Enter'); await sleep(200)
log({ step: 'after-filter-enter', mode: await page.getByTestId('mode').textContent().catch(() => ''), cursor: await page.getByTestId('cursor').textContent().catch(() => '') })
// Ctrl+A（全選択）
await page.keyboard.press('Control+a'); await sleep(200)
log({ step: 'ctrl-a', cursor: await page.getByTestId('cursor').textContent().catch(() => ''), toast: (await toastNow(page)).slice(0, 160) })
await page.keyboard.press('Control+.'); await sleep(300)
log({ step: 'ctrl-dot-after-select', panel: await panel(page) })
await closeAll(page)
// 3 キー × 90 の所要
await page.keyboard.press('Escape'); await page.keyboard.press('Control+f'); await page.keyboard.press('Escape')
log({ step: 'final', ...(await stat()) })
saveJson(`202-bulkclear-${process.env.PORT ?? 5176}.json`, out)
console.log('errors', JSON.stringify(errors.filter((e) => e.type !== 'dialog').slice(0, 3)))
await browser.close()
