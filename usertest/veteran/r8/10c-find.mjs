import { open, reset, gotoCell, snap, diffRows, sleep, state } from './lib8.mjs'
const env = await open(5176); const pg = env.page
await reset(env)
const st = await pg.evaluate(() => { const w = JSON.parse(localStorage.getItem('bom-pro.workspace.v2')); const p = w.projects.find((x) => x.id === w.currentProjectId); return p.rows.map((r) => r.id + ':' + r.status).join(' ') })
console.log(st)
await env.browser.close()
