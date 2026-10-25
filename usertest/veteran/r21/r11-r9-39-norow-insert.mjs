import { open, reset, sleep, state } from '/home/user/BOM/usertest/veteran/r21/lib14.mjs'
const env = await open(5176); const pg = env.page
for (const pre of ['', '4']) {
  await reset(env); if (pre) await pg.keyboard.press(pre); await sleep(50)
  const s0 = await state(pg)
  await pg.keyboard.press('Shift+Enter'); await sleep(100); await pg.keyboard.type('NEWROW'); await pg.keyboard.press('Enter'); await sleep(100)
  const pos = await pg.evaluate(() => { const w = JSON.parse(localStorage.getItem('bom-pro.workspace.v2')); const p = w.projects.find((x) => x.id === w.currentProjectId); const i = p.rows.findIndex((r) => (r.working?.name ?? r.name) === 'NEWROW'); return { i, n: p.rows.length, prev: p.rows[i - 1]?.id, cat: p.rows[i]?.category, prevCat: p.rows[i - 1]?.category } })
  console.log(pre || '起動直後', s0.cursor, s0.view, JSON.stringify(pos), (await state(pg)).toast)
}
await env.browser.close()
