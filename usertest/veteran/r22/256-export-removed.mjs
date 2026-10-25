// ラウンド22: 商社マスタから消えた商社の id が残る案件を Excel で出力（社内 / 商社向け共通 / 保管用）。xlsx の文に undefined / NaN が無いか。
import fs from 'node:fs'
import ExcelJS from '/home/user/BOM/node_modules/exceljs/excel.js'
import { open, reset, sleep, logger } from './lib22.mjs'
const port = Number(process.env.PORT ?? 5176)
const env = await open(port); const pg = env.page; const log = logger(`256-export-removed-${port}${process.env.RUN ?? ''}.json`)
await env.context.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {})
const LSK = 'bom-pro.workspace.v2'
await reset(env)
const base = await pg.evaluate((k) => JSON.parse(localStorage.getItem(k)), LSK)
const DL = '/home/user/BOM/usertest/veteran/r22/dl/'
function variant(gone) {
  const ws = structuredClone(base); const p = ws.projects.find((x) => x.id === ws.currentProjectId) ?? ws.projects[0]
  p.supplierIds = [...new Set([...p.supplierIds, ...gone])]
  for (const g of gone) {
    p.requestRevs = { ...(p.requestRevs ?? {}), [g]: { [p.rows[0].id]: 1 } }
    for (const r of p.rows.slice(0, 12)) { r.quoteTargets = [...(r.quoteTargets ?? []), g] }
    p.rows[2].adoptedSupplierId = g; p.rows[3].procurement = '指定商社'; p.rows[3].designated = g
  }
  ws.suppliers = ws.suppliers.filter((s) => !gone.includes(s.id)); return ws
}
for (const gone of [['S3'], ['S1', 'S2'], ['S1', 'S2', 'S3', 'S4', 'S5']]) for (const role of ['purchasing', 'design']) {
  const ws = variant(gone); ws.user = { ...(ws.user ?? {}), name: role === 'design' ? '田中' : '佐藤', role }
  env.errs.length = 0
  await pg.evaluate(([k, s]) => { localStorage.clear(); localStorage.setItem(k, s) }, [LSK, JSON.stringify(ws)])
  await pg.reload({ waitUntil: 'domcontentloaded' }); await sleep(700)
  for (const key of ['1', '2', '3', '4']) {
    await pg.locator('.gridwrap').focus().catch(() => {})
    await pg.keyboard.press('Control+k'); await sleep(80); await pg.getByTestId('palette-input').fill('Excelで出力').catch(() => {}); await sleep(100); await pg.keyboard.press('Enter'); await sleep(250)
    const dlP = pg.waitForEvent('download', { timeout: 15000 }).catch(() => null)
    await pg.keyboard.press(key); const d = await dlP
    let rec = { gone: gone.join('+'), role, key, download: !!d }
    if (d) {
      const f = DL + `256-${gone.join('')}-${role}-${key}.xlsx`; await d.saveAs(f)
      const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(f)
      const bad = []
      wb.eachSheet((sh) => sh.eachRow((row, rn) => row.eachCell((c) => { const v = String(c.value ?? ''); if (/undefined|NaN|\[object|null/.test(v) && bad.length < 5) bad.push(`${sh.name}!${c.address}=${v.slice(0, 40)}`) })))
      rec = { ...rec, name: d.suggestedFilename(), sheets: wb.worksheets.map((s) => s.name + ':' + s.rowCount), headers: wb.worksheets[0].getRow(1).values.slice(1).filter((x) => /undefined|単価|納期|MOQ/.test(String(x))).slice(0, 8), bad }
    }
    rec.toast = await pg.evaluate(() => (document.querySelector('[data-testid="toast-float"]') ?? document.querySelector('[data-testid="toast"]'))?.textContent?.slice(0, 120) ?? '')
    rec.errs = env.errs.filter((e) => !String(e).startsWith('dialog')).map((e) => String(e).slice(0, 140)).slice(0, 3)
    log(rec)
    await pg.keyboard.press('Escape'); await pg.keyboard.press('Escape'); await sleep(60)
  }
}
log.save(); await env.browser.close()
