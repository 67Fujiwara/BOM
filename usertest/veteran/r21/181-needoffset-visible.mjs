// ラウンド20: 必要日(前倒し)に 7 を入れたあと、警告が画面のどこに出るか（トースト・4 要確認・詳細）と、Alt+x で確認済みにできるか
import { open, reset, gotoCell, sleep, logger } from './lib21.mjs'
const env = await open(5176); const pg = env.page; const log = logger(`181-needoffset-visible${process.env.RUN ?? ''}.json`)
const showColumn = async (label) => {
  await pg.keyboard.press('Control+k'); await pg.getByTestId('palette-input').fill('列の表示'); await sleep(60); await pg.keyboard.press('Enter'); await sleep(150)
  const cols = await pg.locator('[data-testid="columns"] .opt').allTextContents(); const i = cols.findIndex((c) => c.includes(label))
  if (i >= 0) { for (let k = 0; k < i; k++) await pg.keyboard.press('ArrowDown'); if (cols[i].startsWith('○')) await pg.keyboard.press('Space') }
  await pg.keyboard.press('Escape'); await sleep(60); return i >= 0
}
const toast = () => pg.evaluate(() => (document.querySelector('[data-testid="toast-float"]') ?? document.querySelector('[data-testid="toast"]'))?.textContent?.slice(0, 200) ?? '')
await reset(env); await pg.locator('.gridwrap').focus(); await showColumn('前倒し')
const ok = await gotoCell(pg, 1, 'R011', '必要日(前倒し)')
await pg.keyboard.press('Enter'); await sleep(60); await pg.keyboard.press('Control+a'); await pg.keyboard.type('7'); await pg.keyboard.press('Enter'); await sleep(200)
log({ step: 'typed 7', ok, toast: await toast(), status: ((await pg.getByTestId('status').innerText().catch(() => '')) || '').replace(/\s+/g, ' ').slice(0, 260) })
await pg.keyboard.press('Space'); await sleep(200)
const body = (await pg.locator('body').innerText()).replace(/\s+/g, ' ')
log({ step: 'detail', hit: /前倒し.{0,40}後ろ|後ろになります/.test(body), snippet: (/.{40}後ろになります.{40}/.exec(body) ?? [''])[0] })
await pg.keyboard.press('Escape')
await pg.keyboard.press('Alt+4'); await sleep(200)
const n4 = await pg.locator('.gridwrap tr.row').count()
const has = await pg.evaluate(() => !!document.querySelector('[data-row-id="R011"]'))
log({ step: 'view4', rows: n4, hasR011: has })
await pg.keyboard.press('Control+g'); await pg.getByTestId('prompt-text').fill('R011'); await pg.keyboard.press('Enter'); await sleep(100)
await pg.keyboard.press('Alt+x'); await sleep(200)
log({ step: 'Alt+x', toast: await toast() })
await pg.keyboard.press('Alt+4'); await sleep(150)
log({ step: 'view4-after-ack', hasR011: await pg.evaluate(() => !!document.querySelector('[data-row-id="R011"]')) })
log.save(); await env.browser.close()
