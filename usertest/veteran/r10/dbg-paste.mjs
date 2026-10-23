import { open, reset, gotoCell, snap, sleep, state } from './lib10.mjs'
const env = await open(5176); const pg = env.page
await env.context.grantPermissions(['clipboard-read', 'clipboard-write'])
for (const cols of [4, 5]) {
  await reset(env); await gotoCell(pg, 1, 'R080', '部品名')
  const tsv = Array.from({ length: 2500 }, (_, i) => [`貼付${i}`, `PM-${i}`, 'オムロン', String((i % 9) + 1), '備考 ' + 'x'.repeat(40)].slice(0, cols).join('\t')).join('\n')
  await pg.evaluate((t) => navigator.clipboard.writeText(t), tsv)
  await pg.keyboard.press('Control+v'); await sleep(2500)
  const s = await state(pg); const n = await pg.evaluate(() => { const w = JSON.parse(localStorage.getItem('bom-pro.workspace.v2')); return w.projects.find((x) => x.id === w.currentProjectId).rows.length })
  console.log(cols, n, JSON.stringify(s), await pg.evaluate(() => document.querySelector('[data-testid^="panel-"]')?.textContent?.slice(0, 300)))
  await pg.screenshot({ path: `shots/dbg-paste-${cols}.png` })
}
console.log(env.errs); await env.browser.close()
