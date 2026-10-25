// ラウンド23: 商社マスタから消えた商社を採用していた行：ステータスバーの文（lifecycle.ts:77 の droppedStopped と StatusBar.tsx:77）
import { open, reset, sleep } from './lib22.mjs'
const port = Number(process.env.PORT ?? 5176)
const env = await open(port); const pg = env.page
const LSK = 'bom-pro.workspace.v2'
await reset(env)
const base = await pg.evaluate((k) => JSON.parse(localStorage.getItem(k)), LSK)
for (const how of ['removed', 'stopped']) {
  const ws = structuredClone(base); const p = ws.projects.find((x) => x.id === ws.currentProjectId) ?? ws.projects[0]
  const a = p.rows.filter((x) => x.status === 'selected')[0]
  const idx = p.rows.findIndex((x) => x.id === a.id)
  a.adoptedSupplierId = 'S3'
  if (how === 'removed') ws.suppliers = ws.suppliers.filter((s) => s.id !== 'S3'); else ws.suppliers.find((s) => s.id === 'S3').tradable = false
  await pg.evaluate(([k, s]) => { localStorage.clear(); localStorage.setItem(k, s) }, [LSK, JSON.stringify(ws)])
  await pg.reload({ waitUntil: 'domcontentloaded' }); await sleep(800)
  await pg.locator('.gridwrap').focus(); await pg.keyboard.press('Escape'); await pg.keyboard.press('Alt+1'); await pg.keyboard.press('Control+g'); await sleep(150); await pg.keyboard.type(a.id); await pg.keyboard.press('Enter')
  await sleep(300)
  const st = await pg.getByTestId('status').innerText()
  console.log(JSON.stringify({ how, row: a.id, idx, status: st.replace(/\s+/g, ' ').slice(0, 260) }))
}
await env.browser?.close?.()
process.exit(0)
