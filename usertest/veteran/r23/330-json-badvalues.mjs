// ラウンド23: JSON の読み込み（Ctrl+K →「JSON を読み込む」）で 商社の defectRate（onTimeRate は検査されるが defectRate は spread のまま）が文字・オブジェクトのとき、詳細（Space）のスコアが NaN になるか
import { open, reset, sleep, logger } from './lib22.mjs'
const port = Number(process.env.PORT ?? 5176)
const env = await open(port); const pg = env.page; const log = logger(`330-json-badvalues-${port}${process.env.RUN ?? ''}.json`)
const LSK = 'bom-pro.workspace.v2'
await reset(env)
const base = await pg.evaluate((k) => JSON.parse(localStorage.getItem(k)), LSK)
async function imp(name, mutate) {
  await reset(env); env.errs.length = 0
  const w = structuredClone(base); mutate(w)
  await pg.keyboard.press('Control+k'); await pg.getByTestId('palette-input').fill('JSON を読み込む'); await sleep(80); await pg.keyboard.press('Enter'); await sleep(150)
  await pg.evaluate((t) => { const el = document.querySelector('[data-testid="import-text"]'); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(el, t); el.dispatchEvent(new Event('input', { bubbles: true })) }, JSON.stringify(w))
  await pg.getByTestId('import-text').focus(); await pg.keyboard.press('Control+Enter'); await sleep(300)
  if (await pg.evaluate(() => !!document.querySelector('[data-testid="panel-prompt"]'))) { await pg.keyboard.press('2'); await sleep(500) }
  const toast = await pg.evaluate(() => (document.querySelector('[data-testid="toast-float"]') ?? document.querySelector('[data-testid="toast"]'))?.textContent?.slice(0, 300) ?? '')
  await pg.keyboard.press('Escape'); await sleep(100)
  await pg.locator('.gridwrap').focus(); await pg.keyboard.press('Alt+1'); await pg.keyboard.press('ArrowDown'); await pg.keyboard.press('Space'); await sleep(300)
  const text = await pg.evaluate(() => document.body.innerText)
  const m = /NaN|undefined|Infinity|\[object/.exec(text)
  const ix = m ? m.index : -1
  const stored = await pg.evaluate((k) => { const w = JSON.parse(localStorage.getItem(k)); return w.projects.find((x) => x.id === w.currentProjectId)?.settings?.selector }, LSK)
  log({ name, toast, stored: JSON.stringify(stored), nan: ix >= 0 ? text.slice(Math.max(0, ix - 50), ix + 20).replace(/\s+/g, ' ') : null, errs: env.errs.filter((e) => e.type !== 'dialog').map((e) => e.text.slice(0, 100)) })
  await pg.keyboard.press('Escape')
}

const P = (w) => w.projects.find((x) => x.id === w.currentProjectId) ?? w.projects[0]
await imp('S0 selector 正常（design）', (w) => {})
await imp('S1 selector "2026-02-30"', (w) => { P(w).settings.selector = '2026-02-30' })
await imp('S2 selector "x"', (w) => { P(w).settings.selector = 'x' })
await imp('S3 selector "pm"（役割の語・有効）', (w) => { P(w).settings.selector = 'pm' })
await imp('S4 selector 1', (w) => { P(w).settings.selector = 1 })
await imp('S5 quote leadDays 1e12', (w) => { P(w).quotes.find((q) => q.leadDays != null).leadDays = 1e12 })
await imp('S6 row quotedAt "\u0000"', (w) => { P(w).rows.find((r) => r.status === 'quoted').quotedAt = '\u0000' })
await env.browser?.close?.()
process.exit(0)
