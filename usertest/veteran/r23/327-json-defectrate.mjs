// ラウンド23: JSON の読み込み（Ctrl+K →「JSON を読み込む」）で 商社の defectRate（onTimeRate は検査されるが defectRate は spread のまま）が文字・オブジェクトのとき、詳細（Space）のスコアが NaN になるか
import { open, reset, sleep, logger } from './lib22.mjs'
const port = Number(process.env.PORT ?? 5176)
const env = await open(port); const pg = env.page; const log = logger(`327-json-defectrate-${port}${process.env.RUN ?? ''}.json`)
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
  const ix = text.indexOf('NaN')
  const stored = await pg.evaluate((k) => JSON.parse(localStorage.getItem(k)).suppliers.find((s) => s.id === 'S1')?.defectRate, LSK)
  log({ name, toast, stored: JSON.stringify(stored), nan: ix >= 0 ? text.slice(Math.max(0, ix - 50), ix + 20).replace(/\s+/g, ' ') : null, errs: env.errs.filter((e) => e.type !== 'dialog').map((e) => e.text.slice(0, 100)) })
  await pg.keyboard.press('Escape')
}
await imp('D0 正常 0.005', (w) => { w.suppliers.find((s) => s.id === 'S1').defectRate = 0.005 })
await imp('D1 文字 "abc"', (w) => { w.suppliers.find((s) => s.id === 'S1').defectRate = 'abc' })
await imp('D2 オブジェクト {}', (w) => { w.suppliers.find((s) => s.id === 'S1').defectRate = {} })
await imp('D3 配列 [1,2]', (w) => { w.suppliers.find((s) => s.id === 'S1').defectRate = [1, 2] })
await imp('D4 true', (w) => { w.suppliers.find((s) => s.id === 'S1').defectRate = true })
await imp('D5 数字の文字 "0.1"', (w) => { w.suppliers.find((s) => s.id === 'S1').defectRate = '0.1' })
await imp('D6 onTimeRate 文字（検査される）', (w) => { w.suppliers.find((s) => s.id === 'S1').onTimeRate = 'abc' })
await imp('D7 avl/tradable 文字', (w) => { const s = w.suppliers.find((x) => x.id === 'S1'); s.tradable = 'no'; s.avl = 'no' })
await env.browser?.close?.()
process.exit(0)
