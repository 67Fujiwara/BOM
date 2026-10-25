// ラウンド20: 【削除？】の行（sys.importDel）を画面で直す。90 行の【削除？】をキーだけで片付けられるか。
import fs from 'node:fs'
import { launch, fresh, palette, sleep, toastNow, ws, wizardCreate, panel, closeAll } from '../r8/rerun7/rerun6/lib.mjs'
import { saveJson } from './lib21.mjs'
const N = Number(process.env.NN ?? 300), COPY = Number(process.env.COPY ?? 170), CHG = Number(process.env.CHG ?? 40)
const lines = ['部品名\t型式\t変更後型式\tメーカ\t数量']
for (let k = 1; k <= N; k++) lines.push(`部品${k}\tOLD-${k}\t${k <= COPY ? `OLD-${k}` : k <= COPY + CHG ? `NEW-${k}` : ''}\tオムロン\t${(k % 7) + 1}`)
const { browser, page, errors } = await launch()
await fresh(page)
const out = []
const log = (o) => { out.push(o); console.log(JSON.stringify(o).slice(0, 700)) }
const r = await wizardCreate(page, 'P-DEL1', lines.join('\n'))
log({ step: 'create', ...r })
const stat = async () => { const w = await ws(page); const p = w.projects.find((x) => x.id === w.currentProjectId); return { rows: p.rows.length, flagged: p.rows.filter((x) => (x.note ?? '').startsWith('【削除？】')).length } }
log({ step: 'after-create', ...(await stat()) })
// 4 要確認
await page.keyboard.press('4'); await sleep(150)
const body = async () => (await page.locator('body').innerText()).replace(/\s+/g, ' ')
const bar = async () => ((await page.getByTestId('status').innerText().catch(() => '')) || '').replace(/\s+/g, ' ').slice(0, 500)
log({ step: 'view4', bar: await bar(), n: await page.locator('.gridwrap tr.row').count() })
await page.keyboard.press('F8'); await sleep(100)
log({ step: 'F8', bar: await bar(), cursor: await page.getByTestId('cursor').textContent() })
// 詳細・修正の候補
log({ step: 'detail', text: ((await page.getByTestId('detail').innerText().catch(() => '')) || '').replace(/\s+/g, ' ').slice(0, 500) })
await page.keyboard.press('Control+.'); await sleep(120)
log({ step: 'Ctrl+.', panel: await panel(page), text: ((await page.locator('.dialog').first().innerText().catch(() => '')) || '').replace(/\s+/g, ' ').slice(0, 700) })
await page.keyboard.press('Escape')
// Ctrl+Enter（公開）がエラーで止まるか
await page.keyboard.press('Control+Enter'); await sleep(200)
log({ step: 'publish-with-errors', panel: await panel(page), toast: (await toastNow(page)).slice(0, 300), text: ((await page.locator('[data-testid^="panel-"]').first().innerText().catch(() => '')) || '').replace(/\s+/g, ' ').slice(0, 400) })
await closeAll(page)
fs.writeFileSync('/dev/null', '')
saveJson(`151-importdel-ui${process.env.RUN ?? ''}.json`, out)
console.log('errors', errors.filter((e) => e.type !== 'dialog').length)
await browser.close()
