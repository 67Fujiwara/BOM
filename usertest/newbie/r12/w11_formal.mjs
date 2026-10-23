// 購買: 正式見積を依頼（2 で依頼書を作る）→ 状態・通知。ダウンロードの有無
import { launch, fresh, T, makeLog, proj, sleep, runPalette, shot } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('w11_formal')
const cnt = async () => { const p = await proj(page); const m = {}; for (const r of p.rows) m[r.status] = (m[r.status] ?? 0) + 1; return JSON.stringify(m) }
for (const how of ['2', 'Down Enter']) {
  await fresh(page, 'purchasing'); await sleep(200)
  log('== ' + how, 'before', await cnt())
  const dl = page.waitForEvent('download', { timeout: 4000 }).then((d) => d.suggestedFilename()).catch(() => null)
  await runPalette(page, '正式見積を依頼'); await sleep(150); log('  panel', (await T.panelText(page))?.slice(0, 200))
  if (how === '2') await page.keyboard.press('2'); else { await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter') }
  await sleep(600)
  log('  after: toast=', await T.toast(page), '| panel=', (await T.panelText(page))?.slice(0, 200), '| status', await cnt(), '| download', await dl)
  await shot(page, 'w11_formal_' + how.replace(/\W/g, ''))
}
save(errors); await browser.close()
