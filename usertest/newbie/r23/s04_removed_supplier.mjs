// ラウンド23 s04: 商社マスタから消えた商社の表示（採用の列・状態バーの知らせ・見直し・選定記録の Excel）。商社マスタを消す画面操作は無いので、保存データ（JSON の取り込みと同じ形）を書き換えて開く
import ExcelJS from '/home/user/BOM/node_modules/exceljs/excel.js'
import { chromium } from '/home/user/BOM/node_modules/playwright/index.mjs'
import { launch, fresh, T, makeLog, ui, proj, sleep, shot, palette, setRole, sel, store, URL } from './lib.mjs'
const { browser, page, errors, context } = await launch()
const { log, save } = makeLog(process.env.LOGNAME2 || ('s04_removed_supplier' + (process.env.VICTIM ? '_' + process.env.VICTIM : '')))
await fresh(page, 'purchasing')
await sleep(500)
const KEY = 'bom-pro.workspace.v2'
const ws0 = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)), KEY)
const p0 = ws0.projects.find((x) => x.id === ws0.currentProjectId) ?? ws0.projects[0]
const cnt = {}
for (const r of p0.rows) if (r.adoptedSupplierId) cnt[r.adoptedSupplierId] = (cnt[r.adoptedSupplierId] ?? 0) + 1
log('採用の数: ' + JSON.stringify(cnt) + ' suppliers=' + ws0.suppliers.map((s) => s.id + ':' + s.name).join(','))
const victim = process.env.VICTIM || Object.entries(cnt).sort((a, b) => b[1] - a[1])[0][0]
const vrows = p0.rows.filter((r) => r.adoptedSupplierId === victim).map((r) => `${r.id}:${r.status}:${r.procurement}`)
log(`消す商社 ${victim}（${ws0.suppliers.find((s) => s.id === victim)?.name}）を採用している行: ${vrows.join(' ')}`)
const ws1 = JSON.parse(JSON.stringify(ws0))
ws1.suppliers = ws1.suppliers.filter((s) => s.id !== victim)
await page.close()
for (const role of ['purchasing', 'pm', 'design']) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true, permissions: ['clipboard-read', 'clipboard-write'] })
  await ctx.addInitScript(({ k, v }) => { try { if (!localStorage.getItem('__seeded')) { localStorage.setItem(k, v); localStorage.setItem('__seeded', '1') } } catch {} }, { k: KEY, v: JSON.stringify(ws1) })
  const pg = await ctx.newPage()
  pg.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push({ tag: role, type: m.type(), text: m.text().slice(0, 300) }) })
  pg.on('pageerror', (e) => errors.push({ tag: role, type: 'pageerror', text: String(e.message ?? e).slice(0, 300) }))
  await pg.goto(URL); await pg.getByTestId('grid').waitFor(); await sleep(400)
  if (role !== 'design') { await pg.getByTestId(`role-${role}`).click(); await sleep(200) } else { await pg.getByTestId('role-design').click() }
  await pg.locator('.gridwrap').focus()
  const w = await pg.evaluate(async () => { const u = performance.getEntriesByType('resource').map((e) => e.name).find((n) => n.includes('/src/model/store.ts')); const m = await import(u); const s = m.useStore.getState(); const p = s.ws.projects.find((x) => x.id === s.ws.currentProjectId); return { sup: s.ws.suppliers.length, rows: p.rows.map((r) => ({ id: r.id, st: r.status, a: r.adoptedSupplierId ?? null, d: r.flags.droppedStopped ?? null, proc: r.procurement })) } })
  const hit = w.rows.filter((r) => vrows.some((v) => v.startsWith(r.id + ':')))
  log(`[${role}] 商社 ${w.sup} 社。元の採用行 → ${hit.map((r) => `${r.id}:${r.st}:adopt=${r.a ?? '-'}:dropped=${r.d ?? '-'}`).join(' ')}`)
  for (const v of [3, 7, 8, 9, 1]) {
    await pg.keyboard.press(`Alt+${v}`).catch(() => {}); await sleep(250)
    const cols = (await pg.locator('thead th').allInnerTexts()).map((t) => t.replace(/\s+/g, ''))
    const ids = await pg.getByTestId('row').evaluateAll((els) => els.map((e) => e.getAttribute('data-row-id')))
    const ai = cols.findIndex((c) => c.includes('採用'))
    const cells = []
    for (const r of hit) {
      const loc = pg.locator(`[data-row-id="${r.id}"]`)
      if (!(await loc.count())) continue
      const tds = await loc.first().locator('td').allInnerTexts()
      cells.push(`${r.id}:採用列=${ai >= 0 ? tds[ai] : '(列なし)'}`)
    }
    const u = await ui(pg)
    log(`   view ${u.view}: 行 ${ids.length} / 該当行の表示 ${cells.join(' ') || '(該当行なし)'}`)
  }
  // 状態バー（カーソルを該当行に）
  for (const r of hit.slice(0, 3)) {
    await pg.keyboard.press('Alt+1'); await sleep(150)
    await pg.keyboard.press('Control+g'); await pg.getByTestId('prompt-text').fill(r.id); await pg.keyboard.press('Enter'); await sleep(200)
    const stt = (await pg.getByTestId('status').innerText()).replace(/\s+/g, ' ')
    log(`   [状態バー ${r.id}] ${stt.slice(0, 300)}`)
  }
  if (role === 'pm') {
    // 選定記録の出力
    await pg.keyboard.press('Control+k'); await pg.getByTestId('palette-input').fill('選定記録'); await sleep(100)
    const dl = pg.waitForEvent('download', { timeout: 8000 }).catch(() => null)
    await pg.keyboard.press('Enter'); await sleep(200)
    if ((await ui(pg)).panel) { await pg.keyboard.press('Enter'); await sleep(200) }
    const d = await dl
    if (d) {
      const f = '/home/user/BOM/usertest/newbie/r23/dl/s04_selection.xlsx'; await d.saveAs(f)
      const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(f)
      for (const sh of wb.worksheets) { const rows = []; sh.eachRow((r) => rows.push((r.values ?? []).slice(1).map((v) => (v && typeof v === 'object' ? (v.text ?? v.result ?? JSON.stringify(v)) : v ?? '')).join(' | '))); log(`   選定記録 sheet「${sh.name}」${rows.length} 行: ` + rows.filter((r) => r.includes(victim) || /マスタ/.test(r)).slice(0, 4).join(' // ')) }
    } else log('   選定記録: ダウンロードなし toast=' + (await T.toast(pg)))
  }
  await ctx.close()
}
save(errors); await browser.close()
