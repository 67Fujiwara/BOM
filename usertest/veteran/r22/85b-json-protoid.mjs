// ラウンド14: 行 ID が constructor・__proto__・toString の JSON を読んだあと、その行で操作（Ctrl+G・6・a・Shift+A・重み・指摘・公開）
import { open, reset, sleep, logger } from './lib22.mjs'
const port = Number(process.env.PORT ?? 5176)
const env = await open(port); const pg = env.page; const log = logger(`85b-json-protoid-${port}${process.env.RUN ?? ""}.json`)
const LSK = 'bom-pro.workspace.v2'
const toast = () => pg.evaluate(() => (document.querySelector('[data-testid="toast-float"]') ?? document.querySelector('[data-testid="toast"]'))?.textContent?.slice(0, 600) ?? '')
await reset(env)
const base = await pg.evaluate((k) => JSON.parse(localStorage.getItem(k)), LSK)
async function imp(name, mutate, pick, raw) {
  await reset(env)
  const w = structuredClone(base); const p = w.projects.find((x) => x.id === w.currentProjectId); mutate?.(p, w)
  await pg.keyboard.press('Control+k'); await pg.getByTestId('palette-input').fill('JSON を読み込む'); await sleep(80); await pg.keyboard.press('Enter'); await sleep(150)
  const text = raw ? raw(w) : JSON.stringify(w)
  await pg.evaluate((t) => { const el = document.querySelector('[data-testid="import-text"]'); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(el, t); el.dispatchEvent(new Event('input', { bubbles: true })) }, text)
  await pg.getByTestId('import-text').focus(); const t0 = Date.now(); await pg.keyboard.press('Control+Enter'); await sleep(250)
  if (await pg.evaluate(() => !!document.querySelector('[data-testid="panel-prompt"]'))) { await pg.keyboard.press('2'); await sleep(400) }
  const ms = Date.now() - t0
  const t = await toast()
  const after = await pg.evaluate(([k, ids]) => { const w = JSON.parse(localStorage.getItem(k)); const p = w.projects.find((x) => x.id === w.currentProjectId); const o = { rows: p.rows.length, issues: p.issues.length, quotes: p.quotes.length, issueIds: p.issues.slice(-2).map((i) => `${i.id}:${i.rowId}`) }; for (const id of ids) { const r = p.rows.find((x) => x.id === id); o[id] = r ? { qty: r.qtyNeeded, wq: r.working?.qtyNeeded, need: r.needDateFixed, wneed: r.working?.needDateFixed, pack: r.packQty, wpack: r.working?.packQty, order: r.orderQty, q: p.quotes.filter((q) => q.rowId === id).map((q) => q.unitPrice + '/' + q.leadDays).join(' ') } : null } return o }, [LSK, pick ?? []])
  const shown = await pg.evaluate((ids) => ids.map((id) => { const tr = document.querySelector(`[data-testid="grid"] [data-row-id="${id}"]`); return tr ? `${id}: ${tr.textContent.replace(/\s+/g, ' ').slice(0, 150)}` : `${id}: (表示なし)` }), pick ?? [])
  log({ name, ms, toast: t, after, shown, panel: await pg.evaluate(() => document.querySelector('[data-testid^="panel-"]')?.dataset.testid ?? null) })
  await pg.keyboard.press('Escape')
}
const R = (p, id) => p.rows.find((r) => r.id === id)
const grab = async (sel) => pg.evaluate((s) => [...document.querySelectorAll(s)].map((e) => e.textContent.replace(/\s+/g, ' ').slice(0, 200)).slice(0, 4), sel)
const rowText = (id) => pg.evaluate((id) => { const tr = document.querySelector(`[data-testid="grid"] [data-row-id="${id}"]`); return tr ? tr.textContent.replace(/\s+/g, ' ').slice(0, 220) : '(表示なし)' }, id)
const st = async () => { const s = await (await import('./lib22.mjs')).state(pg); return `${s.view}/${s.cursor}/${s.mode}${s.panel ? '/' + s.panel : ''} «${s.toast.slice(0, 120)}»` }
for (const id of ['constructor', '__proto__', 'toString', 'hasOwnProperty']) {
  await imp(`P ${id}`, (p) => { const r = p.rows.find((x) => x.id === 'R004'); p.rows.push({ ...structuredClone(r), id, name: 'X-' + id }); for (const q of p.quotes.filter((q) => q.rowId === 'R004')) p.quotes.push({ ...structuredClone(q), rowId: id }) }, [])
  await pg.locator('.gridwrap').focus()
  const seq = []
  for (const k of ['G', 'Alt+6', 'G', 'a', 'Shift+A', 'Escape', 'PAL:重み', 'Escape', 'Alt+1', 'G', 'Alt+Shift+I', 'T:k要確認', 'Enter', 'Control+Enter', '2', 'Enter', 'Alt+4']) {
    if (k === 'G') { await pg.keyboard.press('Control+g'); await pg.getByTestId('prompt-text').fill(id); await pg.keyboard.press('Enter') }
    else if (k.startsWith('T:')) await pg.keyboard.type(k.slice(2))
    else if (k.startsWith('PAL:')) { await pg.keyboard.press('Control+k'); await pg.getByTestId('palette-input').fill(k.slice(4)); await sleep(100); await pg.keyboard.press('Enter') }
    else await pg.keyboard.press(k)
    await sleep(200); seq.push(`${k}→${await st()}`)
  }
  log({ name: `P ${id} の行で操作`, seq, row: await rowText(id), errs: env.errs.slice(-5) })
  await pg.keyboard.press('Escape'); await pg.keyboard.press('Escape')
}
log({ name: 'console/pageerror', errs: env.errs.slice(0, 20) })
log.save(); await env.browser.close()
