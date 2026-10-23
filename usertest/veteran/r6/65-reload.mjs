// ラウンド6: 変なタイミングのリロード。英字で始めた編集の途中（0 / 30 / 150ms 後）・Alt+h の直後・Alt+Shift+D の直後にリロード → 値は残るか、Ctrl+Z で戻せるか
import { open, reset, gotoCell, snap, diffRows, sleep, saveJson } from './lib6.mjs'
const env = await open(Number(process.env.PORT ?? 5173)); const pg = env.page; const out = []
const log = (o) => { out.push(o); console.log(JSON.stringify(o).slice(0, 600)) }
const row = (id) => pg.evaluate((id) => { const w = JSON.parse(localStorage.getItem('bom-pro.workspace.v2')); const p = w.projects.find((x) => x.id === w.currentProjectId); const r = p.rows.find((x) => x.id === id); return r ? { name: r.working?.name ?? r.name, hidden: !!r.hidden, n: p.rows.length } : null }, id)
for (const wait of [0, 30, 150]) {
  await reset(env); await gotoCell(pg, 1, 'R040', '部品名')
  await pg.keyboard.type('Coil-R6'); await sleep(wait)
  await pg.reload(); await pg.waitForSelector('[data-testid="grid"]'); await sleep(200)
  log({ case: `英字で始めた編集の途中で ${wait}ms 後にリロード`, r040: await row('R040'), errs: env.errs.slice(-2) })
}
for (const [k, label] of [['Alt+KeyH', 'Alt+h'], ['Alt+Shift+KeyD', 'Alt+Shift+D']]) {
  for (const wait of [0, 100]) {
    await reset(env); await gotoCell(pg, 1, 'R040', '部品名')
    const before = await row('R040')
    await pg.keyboard.press(k); await sleep(wait)
    await pg.reload(); await pg.waitForSelector('[data-testid="grid"]'); await pg.locator('.gridwrap').focus(); await sleep(150)
    const mid = await row('R040')
    await pg.keyboard.press('Control+z'); await sleep(150)
    const toast = await pg.evaluate(() => (document.querySelector('[data-testid="toast-float"]') ?? document.querySelector('[data-testid="toast"]'))?.textContent ?? '')
    log({ case: `${label} の ${wait}ms 後にリロード → Ctrl+Z`, before, afterReload: mid, afterUndo: await row('R040'), toast })
  }
}
saveJson('65-reload.json', out); await env.browser.close()
