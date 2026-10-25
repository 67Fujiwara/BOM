// ラウンド18: JSON の読み込みで R006 の needOffset を -1e12 / 400 にしたとき、画面の必要日・詳細のスコア・知らせ（138 の画面の確かめ）
import { open, reset, sleep, logger } from './lib21.mjs'
const port = Number(process.env.PORT ?? 5176)
const env = await open(port); const pg = env.page; const log = logger(`139-needoffset-ui-${port}${process.env.RUN ?? ''}.json`)
const LSK = 'bom-pro.workspace.v2'
await reset(env)
const base = await pg.evaluate((k) => JSON.parse(localStorage.getItem(k)), LSK)
for (const off of [-1e12, 400]) {
  await reset(env); env.errs.length = 0
  const w = structuredClone(base); w.projects.find((x) => x.id === w.currentProjectId).rows.find((r) => r.id === 'R006').needOffset = off
  await pg.keyboard.press('Control+k'); await pg.getByTestId('palette-input').fill('JSON を読み込む'); await sleep(80); await pg.keyboard.press('Enter'); await sleep(150)
  await pg.evaluate((t) => { const el = document.querySelector('[data-testid="import-text"]'); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(el, t); el.dispatchEvent(new Event('input', { bubbles: true })) }, JSON.stringify(w))
  await pg.getByTestId('import-text').focus(); await pg.keyboard.press('Control+Enter'); await sleep(300)
  if (await pg.evaluate(() => !!document.querySelector('[data-testid="panel-prompt"]'))) { await pg.keyboard.press('2'); await sleep(500) }
  const toast = await pg.evaluate(() => (document.querySelector('[data-testid="toast-float"]') ?? document.querySelector('[data-testid="toast"]'))?.textContent?.slice(0, 300) ?? '')
  await pg.locator('.gridwrap').focus(); await pg.keyboard.press('Control+g'); await pg.getByTestId('prompt-text').fill('R006'); await pg.keyboard.press('Enter'); await sleep(200)
  const row = await pg.evaluate(() => document.querySelector('[data-testid="grid"] [data-row-id="R006"]')?.textContent?.replace(/\s+/g, ' ').slice(0, 200) ?? '')
  await pg.keyboard.press('Space'); await sleep(300)
  const detail = await pg.evaluate(() => (document.querySelector('[data-testid="detail"]') ?? document.querySelector('.detail'))?.textContent?.replace(/\s+/g, ' ').slice(0, 300) ?? '')
  await pg.keyboard.press('Escape')
  log({ off, toast, row, detail, errs: env.errs.filter((e) => e.type !== 'dialog').map((e) => JSON.stringify(e).slice(0, 200)).slice(0, 4) })
}
log.save(); await env.browser.close()
