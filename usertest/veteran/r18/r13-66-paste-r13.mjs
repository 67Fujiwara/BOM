// ラウンド13: 表への貼り付け（Ctrl+V）でも、見出しに似た部品の行・旧／新の見出しの繰り返し・新の列が空の行が同じか
import { open, reset, sleep, logger, gotoCell, installToastLog, takeToasts, state } from './lib18.mjs'
const port = Number(process.env.PORT ?? 5176)
const env = await open(port); const pg = env.page; const log = logger(`66-paste-r13-${port}.json`)
await env.context.grantPermissions(['clipboard-read', 'clipboard-write'])
const rowsNow = () => pg.evaluate(() => { const w = JSON.parse(localStorage.getItem('bom-pro.workspace.v2')); const p = w.projects.find((x) => x.id === w.currentProjectId); return { n: p.rows.length, tail: p.rows.slice(80, 86).map((r) => [r.id, r.working?.name ?? r.name, r.working?.model ?? r.model, r.working?.maker ?? r.maker, r.working?.qtyNeeded ?? r.qtyNeeded].join('|')) } })
async function paste(name, tsv, { row = 'R080', col = '部品名', reload = false } = {}) {
  await reset(env); await gotoCell(pg, 1, row, col); await pg.keyboard.press('ArrowDown')
  await pg.evaluate((x) => navigator.clipboard.writeText(x), tsv); await installToastLog(pg); await takeToasts(pg)
  const t0 = Date.now(); await pg.keyboard.press('Control+v'); await pg.waitForFunction(() => !!(document.querySelector('[data-testid="toast-float"]') ?? document.querySelector('[data-testid="toast"]'))?.textContent, null, { timeout: 120000 }).catch(() => {}); await sleep(200)
  // 確認のダイアログが出たら Enter
  let panel = await pg.evaluate(() => document.querySelector('[data-testid^="panel-"]')?.dataset.testid ?? null)
  const panelText = panel ? (await pg.evaluate(() => document.querySelector('[data-testid^="panel-"]')?.textContent?.slice(0, 500))) : null
  if (panel) { await pg.keyboard.press('Enter'); await sleep(500) }
  const ms = Date.now() - t0
  log({ name, ms, panel, panelText, toasts: (await takeToasts(pg)).map((x) => x.slice(0, 250)), after: await rowsNow(), cursor: (await state(pg)).cursor })
}
const tsv = (rows) => rows.map((r) => r.join('\t')).join('\n')
const H = ['部品名', '型式', 'メーカ', '数量']
await paste('Q1 見出し＋「部品取付板 / 品番なし / メーカ不問 / 1」＋ 3 部品', tsv([H, ['リレー', 'MY4N', 'オムロン', 12], ['部品取付板', '品番なし', 'メーカ不問', 1], ['結束バンド', 'T18R', 'ヘラマン', 50], ['端子台', 'XW2B', 'オムロン', 2], ['ヒューズ', 'F-10', 'ミスミ', 4]]))
await paste('Q2 旧／新の見出しを繰り返す', tsv([['部品名', '型式(旧)', '型式(新)', '数量'], ['リレー', 'MY2N', 'MY4N', 12], ['部品名', '型式(旧)', '型式(新)', '数量'], ['ヒューズ', 'F-OLD', 'F-NEW', 4]]))
await paste('Q3 数量・変更後数量（変えた行だけ）', tsv([['部品名', '型式', '数量', '変更後数量'], ['リレー', 'MY4N', 10, 12], ['端子台', 'XW2B', 2, ''], ['ヒューズ', 'F-10', 4, '']]))
console.log('errors', JSON.stringify(env.errs.slice(0, 5)))
log.save(); await env.browser.close()
