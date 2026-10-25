// ラウンド22: React の「同じ key の子が 2 つ」警告の出どころ。消えた商社(S3)を残す JSON と、重複した quote / supplierIds の組み合わせ。
import { open, reset, sleep, logger } from './lib22.mjs'
const port = Number(process.env.PORT ?? 5176)
const env = await open(port); const pg = env.page; const log = logger(`253-keydup-${port}${process.env.RUN ?? ''}.json`)
const LSK = 'bom-pro.workspace.v2'
await reset(env)
const base = await pg.evaluate((k) => JSON.parse(localStorage.getItem(k)), LSK)
const P = (ws) => ws.projects.find((x) => x.id === ws.currentProjectId) ?? ws.projects[0]
const V = {
  removeS3: (ws) => { ws.suppliers = ws.suppliers.filter((s) => s.id !== 'S3'); return ws },
  removeS3AndS1: (ws) => { ws.suppliers = ws.suppliers.filter((s) => !['S1', 'S3'].includes(s.id)); return ws },
  removeAll: (ws) => { ws.suppliers = []; return ws },
  dupSupplierIdsOnly: (ws) => { const p = P(ws); p.supplierIds = ['S1', 'S1', 'S2']; return ws },
  dupSupplierIdsRemoved: (ws) => { const p = P(ws); ws.suppliers = ws.suppliers.filter((s) => s.id !== 'S3'); p.supplierIds = ['S1', 'S3', 'S3']; return ws },
  dupPreferred: (ws) => { const p = P(ws); p.preferredSupplierIds = ['S1', 'S1']; return ws },
  dupQuoteRemoved: (ws) => { const p = P(ws); ws.suppliers = ws.suppliers.filter((s) => s.id !== 'S3'); const q = p.quotes.find((x) => x.supplierId === 'S3'); p.quotes.push({ ...q }); return ws },
  dupTargetsRemoved: (ws) => { const p = P(ws); ws.suppliers = ws.suppliers.filter((s) => s.id !== 'S3'); for (const r of p.rows.slice(0, 10)) r.quoteTargets = ['S3', 'S3']; return ws },
  dupSupplierMaster: (ws) => { ws.suppliers.push(structuredClone(ws.suppliers[0])); return ws },
}
for (const [vn, mk] of Object.entries(V)) for (const role of ['design', 'purchasing']) {
  const ws = mk(structuredClone(base)); ws.user = { ...(ws.user ?? {}), name: role === 'design' ? '田中' : '佐藤', role }
  env.errs.length = 0
  await pg.evaluate(([k, s]) => { localStorage.clear(); localStorage.setItem(k, s) }, [LSK, JSON.stringify(ws)])
  await pg.reload({ waitUntil: 'domcontentloaded' }); await sleep(600)
  const after = {}
  after.load = env.errs.length
  for (const key of ['Alt+1', 'Alt+2', 'Alt+3', 'Alt+4']) { await pg.keyboard.press(key).catch(() => {}); await sleep(80) }
  after.views = env.errs.length
  for (const cmd of ['概算見積を依頼', '商社を集約']) {
    await pg.keyboard.press('Control+k'); await sleep(60); await pg.getByTestId('palette-input').fill(cmd).catch(() => {}); await sleep(80)
    await pg.keyboard.press('Enter'); await sleep(300); after[cmd] = env.errs.length
    await pg.keyboard.press('Escape'); await pg.keyboard.press('Escape'); await sleep(50)
  }
  log({ variant: vn, role, after, first: (env.errs.find((e) => /key/.test(e)) ?? '').slice(0, 60) })
}
log.save(); await env.browser.close()
