// ラウンド12: 表への貼り付け（Ctrl+V）で、見出しの 6 割ルール（未定の行）・合計のセルの重い正規表現・2,500 行
import { open, reset, sleep, logger, gotoCell, installToastLog, takeToasts, state } from './lib14.mjs'
const port = Number(process.env.PORT ?? 5176)
const env = await open(port); const pg = env.page; const log = logger(`48-paste-new-${port}.json`)
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
const H = '部品名\t型式\tメーカ\t数量'
await paste('P1 見出しつき 4 行: リレー / 名称未定・型式未定・メーカ未定 / 部品取付板・品番未定・メーカ不問 / 端子台', [H, 'リレー\tMY4N\tオムロン\t12', '名称未定\t型式未定\tメーカ未定\t2', '部品取付板\t品番未定\tメーカ不問\t1', '端子台\tXW2B\tオムロン\t2'].join('\n'))
await paste('P2 見出しなし 3 行: 名称未定・型式未定・メーカ未定 を含む', ['リレー\tMY4N\tオムロン\t12', '名称未定\t型式未定\tメーカ未定\t2', '端子台\tXW2B\tオムロン\t2'].join('\n'))
for (const n of [20, 24, 26, 28]) await paste(`P3 合計のセルに数字 ${n} 桁 + kg`, [H, 'リレー\tMY4N\tオムロン\t12', `合計 ${'1'.repeat(n)} kg\t\t\t`].join('\n'))
await paste('P4 合計 ¥1,234,567,890,123,456,789,012 USD（数字とカンマ 29 文字）', [H, 'リレー\tMY4N\tオムロン\t12', '合計金額 ¥1,234,567,890,123,456,789,012 USD\t\t\t'].join('\n'))
console.log('errors', JSON.stringify(env.errs.slice(0, 5)))
log.save(); await env.browser.close()
