// ラウンド8: 記号・Option の文字で始めた編集の途中でリロード、F8 で進めた途中でリロードしてから直して F8
import { open, reset, gotoCell, snap, diffRows, sleep, saveJson, state, cdpKey } from './lib8.mjs'
const env = await open(5176); const pg = env.page; const out = []
const log = (o) => { out.push(o); console.log(JSON.stringify(o).slice(0, 600)) }
const note = () => pg.evaluate(() => { const w = JSON.parse(localStorage.getItem('bom-pro.workspace.v2')); const p = w.projects.find((x) => x.id === w.currentProjectId); const r = p.rows.find((x) => x.id === 'R040'); return r.working?.note ?? r.note })
for (const wait of [0, 30, 150]) for (const word of ['<5mm', '[代替可]']) {
  await reset(env); await gotoCell(pg, 1, 'R040', '備考')
  await pg.keyboard.type(word); await sleep(wait)
  await pg.reload(); await pg.waitForSelector('[data-testid="grid"]'); await sleep(200)
  log({ case: `${word} の途中 ${wait}ms でリロード`, note: await note(), errs: env.errs.slice(-2) })
}
{
  await reset(env); await pg.keyboard.press('Alt+4')
  for (let i = 0; i < 6; i++) await pg.keyboard.press('F8')
  const at = (await state(pg)).cursor
  await pg.reload(); await pg.waitForSelector('[data-testid="grid"]'); await pg.locator('.gridwrap').focus(); await sleep(200)
  const afterReload = (await state(pg)).cursor
  await pg.keyboard.press('Alt+x'); await pg.keyboard.press('F8'); await sleep(80)
  log({ case: 'F8 ×6 → リロード → Alt+x → F8', at, afterReload, afterF8: (await state(pg)).cursor })
}
saveJson('27-reload.json', out); await env.browser.close()
