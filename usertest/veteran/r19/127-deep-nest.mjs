// ラウンド17: 46-json-new の K13（案件に 5,000 段の入れ子の配列）を読み込んだあと、編集・リロードできるか（起動時の structuredClone）。深さ 500・2,000・5,000
import { open, reset, sleep, logger, gotoCell, state } from './lib19.mjs'
const port = Number(process.env.PORT ?? 5176)
const env = await open(port); const pg = env.page; const log = logger(`127-deep-nest-${port}${process.env.RUN ?? ''}.json`)
const LSK = 'bom-pro.workspace.v2'
for (const depth of [500, 2000, 5000]) {
  await reset(env); env.errs.length = 0
  const w = await pg.evaluate((k) => localStorage.getItem(k), LSK)
  const text = w.replace('"rows":[', `"junk":${'['.repeat(depth) + ']'.repeat(depth)},"rows":[`)
  await pg.keyboard.press('Control+k'); await pg.getByTestId('palette-input').fill('JSON を読み込む'); await sleep(80); await pg.keyboard.press('Enter'); await sleep(150)
  await pg.evaluate((t) => { const el = document.querySelector('[data-testid="import-text"]'); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(el, t); el.dispatchEvent(new Event('input', { bubbles: true })) }, text)
  await pg.getByTestId('import-text').focus(); await pg.keyboard.press('Control+Enter'); await sleep(300)
  if (await pg.evaluate(() => !!document.querySelector('[data-testid="panel-prompt"]'))) { await pg.keyboard.press('2'); await sleep(400) }
  const imp = (await state(pg)).toast
  const junkStored = await pg.evaluate((k) => (localStorage.getItem(k) ?? '').includes('"junk":[['), LSK)
  // 編集（部品名を打って Enter）
  await pg.keyboard.press('Escape'); await pg.locator('.gridwrap').focus()
  await gotoCell(pg, 1, 'R010', '部品名'); await pg.keyboard.type('DEEP'); await pg.keyboard.press('Enter'); await sleep(300)
  const afterEdit = await pg.evaluate((k) => ({ stored: JSON.parse(localStorage.getItem(k)).projects[0].rows.find((r) => r.id === 'R010')?.working ?? null, shown: document.querySelector('[data-testid="grid"] [data-row-id="R010"]')?.textContent?.slice(0, 60) }), LSK)
  const errEdit = env.errs.slice()
  await pg.reload(); await sleep(1500)
  const afterReload = await pg.evaluate(() => ({ grid: !!document.querySelector('[data-testid="grid"]'), root: document.getElementById('root')?.childElementCount ?? -1 }))
  log({ name: `深さ ${depth}`, importToast: imp, junkStored, afterEdit, errEdit: errEdit.slice(0, 3), afterReload, errAll: env.errs.slice(0, 5) })
}
log.save(); await env.browser.close()
