// ラウンド22: 重複した ID を持つ JSON（同じ行×商社の見積が 2 つ・行 ID の重複・商社 ID の重複・supplierIds / quoteTargets の重複）。画面の例外・React の key 警告・白い画面。
import { open, reset, sleep, logger } from './lib22.mjs'
const port = Number(process.env.PORT ?? 5176)
const env = await open(port); const pg = env.page; const log = logger(`251-json-dupes-${port}${process.env.RUN ?? ''}.json`)
const LSK = 'bom-pro.workspace.v2'
await reset(env)
const base = await pg.evaluate((k) => JSON.parse(localStorage.getItem(k)), LSK)
const P = (ws) => ws.projects.find((x) => x.id === ws.currentProjectId) ?? ws.projects[0]
const VARS = {
  none: (ws) => ws,
  dupQuote: (ws) => { const p = P(ws); const q = p.quotes.find((x) => x.unitPrice != null); p.quotes.push({ ...q, unitPrice: (q.unitPrice ?? 1) + 5 }); return ws },
  dupQuoteMany: (ws) => { const p = P(ws); for (const q of p.quotes.slice(0, 40)) p.quotes.push({ ...q }); return ws },
  dupRowId: (ws) => { const p = P(ws); p.rows.push({ ...structuredClone(p.rows[3]) }); return ws },
  dupSupplier: (ws) => { ws.suppliers.push({ ...structuredClone(ws.suppliers[0]) }); return ws },
  dupSupplierIds: (ws) => { const p = P(ws); p.supplierIds = [...p.supplierIds, ...p.supplierIds]; return ws },
  dupTargets: (ws) => { const p = P(ws); for (const r of p.rows.slice(0, 30)) r.quoteTargets = ['S1', 'S1', 'S2']; return ws },
}
const texts = () => pg.evaluate(() => document.body.innerText)
for (const [vn, mk] of Object.entries(VARS)) for (const role of ['design', 'purchasing', 'pm']) {
  const ws = mk(structuredClone(base)); ws.user = { ...(ws.user ?? {}), name: role === 'design' ? '田中' : role === 'pm' ? '鈴木' : '佐藤', role }
  env.errs.length = 0
  await pg.evaluate(([k, s]) => { localStorage.clear(); localStorage.setItem(k, s) }, [LSK, JSON.stringify(ws)])
  await pg.reload({ waitUntil: 'domcontentloaded' }); await sleep(600)
  const ok0 = await pg.evaluate(() => !!document.querySelector('[data-testid="grid"]'))
  const steps = []
  if (ok0) {
    await pg.locator('.gridwrap').focus().catch(() => {})
    for (const key of ['Alt+1', 'Alt+2', 'Alt+3', 'Alt+4', 'Alt+5', 'Alt+6', 'Alt+7', 'Alt+8', 'Alt+9']) { await pg.keyboard.press(key).catch(() => {}); await sleep(80) }
    for (const cmd of ['概算見積を依頼', '商社を集約', '正式見積を依頼', '未採用を推奨で一括採用']) {
      await pg.keyboard.press('Control+k'); await sleep(60); await pg.getByTestId('palette-input').fill(cmd).catch(() => {}); await sleep(80)
      await pg.keyboard.press('Enter'); await sleep(250)
      const t = await texts(); if (/undefined|NaN|\[object/.test(t)) steps.push(`bad text after ${cmd}`)
      await pg.keyboard.press('Escape'); await pg.keyboard.press('Escape'); await sleep(50)
    }
  }
  const crash = await pg.evaluate(() => (document.querySelector('[data-testid="crash"]')?.textContent ?? '').slice(0, 160))
  log({ variant: vn, role, grid: ok0, crash, steps, errs: env.errs.filter((e) => !String(e).startsWith('dialog')).map((e) => String(e).slice(0, 140)).slice(0, 4) })
}
log.save(); await env.browser.close()
