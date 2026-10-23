// ラウンド13: 公開のあとの Ctrl+Z の連打（リロードあり／なし）。現行と r12 ビルド
import { open, reset, gotoCell, sleep, logger, state } from './lib16.mjs'
const port = Number(process.env.PORT ?? 5176)
const env = await open(port); const pg = env.page; const log = logger(`67b-undo-publish-${port}.json`)
const info = () => pg.evaluate(() => { const w = JSON.parse(localStorage.getItem('bom-pro.workspace.v2')); const p = w.projects.find((x) => x.id === w.currentProjectId); const r = p.rows.find((x) => x.id === 'R010'); return `R010 公開=${r.name} 作業中=${r.working?.name ?? '-'} revs=${p.submissions.map((s) => s.rev).join(',')}` })
for (const withReload of [false, true]) {
  await reset(env); await gotoCell(pg, 1, 'R010', '部品名')
  await pg.keyboard.type('E1'); await pg.keyboard.press('Enter'); await pg.keyboard.press('ArrowUp'); await pg.keyboard.type('E2'); await pg.keyboard.press('Enter')
  await pg.keyboard.press('Control+Enter'); await sleep(150); await pg.keyboard.press('2'); await pg.keyboard.press('Enter'); await sleep(300)
  if (withReload) { await pg.reload(); await pg.waitForSelector('[data-testid="grid"]'); await pg.locator('.gridwrap').focus(); await sleep(300) }
  const seq = [`公開後→${await info()}`]
  for (let i = 0; i < 5; i++) { await pg.keyboard.press('Control+z'); await sleep(250); seq.push(`Ctrl+Z#${i + 1}→${await info()} «${(await state(pg)).toast.slice(0, 70)}»`) }
  for (let i = 0; i < 2; i++) { await pg.keyboard.press('Control+y'); await sleep(250); seq.push(`Ctrl+Y#${i + 1}→${await info()} «${(await state(pg)).toast.slice(0, 70)}»`) }
  log({ name: `E1 → E2 → 公開${withReload ? ' → リロード' : ''} → Ctrl+Z ×5 → Ctrl+Y ×2`, seq })
}
log.save(); await env.browser.close()
