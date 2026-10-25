// ラウンド22: 商社マスタから消えた商社の id が 案件・行・見積・依頼書の番号 に残る JSON を読み込み、3 役割 × ビュー 1〜9・詳細・パレットの主な操作で
// 画面の文に 'undefined' / 'NaN' / '[object' が出ないか、例外が出ないか。
import fs from 'node:fs'
import { open, reset, sleep, logger } from './lib22.mjs'
const port = Number(process.env.PORT ?? 5176)
const env = await open(port); const pg = env.page; const log = logger(`250-removed-supplier-ui-${port}${process.env.RUN ?? ''}.json`)
const LSK = 'bom-pro.workspace.v2'
const BAD = /undefined|NaN|\[object|Infinity/
await reset(env)
const base = await pg.evaluate((k) => JSON.parse(localStorage.getItem(k)), LSK)
function variant(kind) {
  const ws = structuredClone(base); const p = ws.projects.find((x) => x.id === ws.currentProjectId) ?? ws.projects[0]
  const gone = kind.gone
  const rows = p.rows
  let i = 0
  const nextRow = (pred = () => true) => rows.filter(pred)[i++ % rows.filter(pred).length]
  const mkQuote = (r, sid, extra = {}) => ({ rowId: r.id, supplierId: sid, unitPrice: 100, leadDays: 5, moq: null, stock: '', quoteQty: 1, validUntil: '2027-01-01', note: '', formalPrice: null, formalLeadDays: null, formalValidUntil: '', formalDiffReason: '', ...extra })
  for (const g of gone) {
    p.supplierIds = [...new Set([...p.supplierIds, g])]
    p.preferredSupplierIds = [...new Set([...(p.preferredSupplierIds ?? []), g])]
    p.requestRevs = { ...(p.requestRevs ?? {}), [g]: { [rows[0].id]: 1 } }
    for (let k = 0; k < 3; k++) { const r = nextRow((x) => x.status === 'quoted' || x.status === 'quoting'); p.quotes.push(mkQuote(r, g, { unitPrice: [50, null, 80][k], leadDays: [3, -1, null][k] })); r.quoteTargets = [...(r.quoteTargets ?? []), g] }
    const a = nextRow((x) => x.status === 'selected'); a.adoptedSupplierId = g
    const b = nextRow((x) => x.status === 'quoted'); b.procurement = '客先指定品'; b.status = 'quoting'; p.quotes.push(mkQuote(b, g))
    const c = nextRow((x) => x.status === 'quoted'); c.procurement = '指定商社'; c.designated = g
    const d = nextRow((x) => x.status === 'quoted'); d.procurement = '指定商社'; d.designated = 'ゴースト商事'
    const e = nextRow((x) => x.status === 'quoted'); e.status = 'formalRequested'; e.adoptedSupplierId = g; p.quotes.push(mkQuote(e, g, { formalRequestNo: 'FR-9' }))
  }
  ws.suppliers = ws.suppliers.filter((s) => !gone.includes(s.id))
  return ws
}
const KINDS = [{ name: 'S3', gone: ['S3'] }, { name: 'S1+S2', gone: ['S1', 'S2'] }, { name: 'S1-S5', gone: ['S1', 'S2', 'S3', 'S4', 'S5'] }, { name: 'S4', gone: ['S4'] }]
const texts = () => pg.evaluate(() => document.body.innerText)
const seen = new Set()
for (const kind of KINDS) for (const role of ['design', 'purchasing', 'pm']) {
  const ws = variant(kind); ws.user = { ...(ws.user ?? {}), name: role === 'design' ? '田中' : role === 'pm' ? '鈴木' : '佐藤', role }
  env.errs.length = 0
  await pg.evaluate(([k, s]) => { localStorage.clear(); localStorage.setItem(k, s) }, [LSK, JSON.stringify(ws)])
  await pg.reload({ waitUntil: 'domcontentloaded' }); await sleep(700)
  const ok0 = await pg.evaluate(() => !!document.querySelector('[data-testid="grid"]'))
  const hits = []
  const check = async (step) => { const t = await texts(); const m = t.match(BAD); if (m) { const idx = t.search(BAD); const key = `${kind.name}/${role}/${step}/${t.slice(Math.max(0, idx - 30), idx + 30)}`; if (!seen.has(key)) { seen.add(key); hits.push({ step, around: t.slice(Math.max(0, idx - 60), idx + 40).replace(/\s+/g, ' ') }) } } if (await pg.evaluate(() => !!document.querySelector('[data-testid="crash"]'))) hits.push({ step, crash: true }) }
  if (ok0) {
    await pg.locator('.gridwrap').focus().catch(() => {})
    for (const key of ['Alt+1', 'ArrowDown', 'Space', 'Escape', 'Alt+2', 'ArrowDown', 'Space', 'Escape', 'Alt+3', 'Alt+4', 'F8', 'Alt+5', 'Alt+6', 'Alt+7', 'Alt+8', 'ArrowDown', 'ArrowDown', 'Space', 'Escape', 'Alt+9', 'Alt+1']) {
      await pg.keyboard.press(key).catch(() => {}); await sleep(90); await check(key)
    }
    for (const cmd of ['概算見積を依頼', '正式見積を依頼', '商社を集約', '未採用を推奨で一括採用', '選定記録を出力', '履歴', '案件設定', '商社を追加', '列の表示', 'ショートカット一覧', '指定先']) {
      await pg.keyboard.press('Control+k').catch(() => {}); await sleep(80)
      await pg.getByTestId('palette-input').fill(cmd).catch(() => {}); await sleep(100); await check('palette:' + cmd)
      await pg.keyboard.press('Enter').catch(() => {}); await sleep(250); await check('cmd:' + cmd)
      await pg.keyboard.press('Escape'); await pg.keyboard.press('Escape'); await sleep(60)
    }
  }
  const errs = env.errs.filter((e) => !String(e).startsWith('dialog')).map((e) => String(e).slice(0, 160))
  log({ kind: kind.name, role, grid: ok0, hits, errs: errs.slice(0, 6) })
}
log.save(); await env.browser.close()
