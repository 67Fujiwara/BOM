// ラウンド5: 新人が Excel の癖で、セルを選んでいきなり値を打つ（3 役割・速さ別）。打ったあとは新人らしく Enter
// 使い方: node t21_typing5.mjs <delayMs> [set]
import { launch, fresh, T, makeLog, shot, sel, gotoCol, ui, typeReal, proj, diff } from './lib.mjs'
const delay = Number(process.argv[2] ?? 40)
const set = process.argv[3] ?? 'all'
const { browser, page, errors } = await launch()
const { log, save } = makeLog(`t21_typing5_${set}_${delay}`)
const F = { 部品名: 'name', 型式: 'model', メーカ: 'maker', 回路記号: 'ref', 備考: 'note', 図面番号: 'drawing', 分類: 'category', 規格: 'tags', 指定先: 'designated', ロット: 'receivedLot' }
const design = [
  ['R030', '部品名', 'relay'], ['R031', '部品名', 'sensor'], ['R032', '部品名', 'fuse'], ['R033', '部品名', 'heater'], ['R034', '部品名', 'snubber'],
  ['R035', '部品名', 'nut'], ['R036', '部品名', 'knob'], ['R037', '部品名', 'cable'], ['R038', '部品名', 'terminal'], ['R039', '部品名', 'Inverter'],
  ['R040', '部品名', 'Encoder'], ['R041', '部品名', 'hex nut'],
  ['R042', 'メーカ', 'Infineon'], ['R043', 'メーカ', 'Analog Devices'], ['R044', 'メーカ', 'Anritsu'], ['R045', 'メーカ', 'Omron'], ['R046', 'メーカ', 'IDEC'], ['R047', 'メーカ', 'Phoenix'],
  ['R048', '型式', 'AC100V'], ['R049', '型式', 'MY4N-D2'], ['R050', '型式', 'S8VK-G06024'], ['R051', '型式', 'snap-1'],
  ['R052', '回路記号', 'K1'], ['R053', '回路記号', 'J3'], ['R054', '回路記号', 'k1'], ['R055', '回路記号', 'r1'], ['R056', '回路記号', 'c12'], ['R057', '回路記号', 'SW1'], ['R058', '回路記号', 'CB1'], ['R059', '回路記号', 'x1'],
  ['R060', '備考', 'ok'], ['R061', '備考', 'hold'], ['R062', '備考', 'use spare'], ['R063', '図面番号', 'ED-001'], ['R064', '規格', 'UL'], ['R065', '分類', 'relay'],
]
const purch = [
  ['R013', 'ロット', 'ok'], ['R013', 'ロット', 'in stock'], ['R013', 'ロット', 'LOT-2026'], ['R013', 'ロット', 'na'], ['R013', 'ロット', 'hold'], ['R013', 'ロット', 'x12'],
]
let cases = []
if (set === 'all' || set === 'design') cases.push(...design.map((c) => ['design', 1, ...c]))
if (set === 'all' || set === 'purch') cases.push(...purch.map((c) => ['purchasing', 3, ...c]))
const strip = (r) => ({ ...r, flags: 0, statusChangedAt: 0, updatedAt: 0, dueAt: 0 })
let ng = 0
for (const [role, view, id, col, word] of cases) {
  try {
    await fresh(page, role); await page.keyboard.press(String(view))
    await sel(page, id); const okc = await gotoCol(page, col)
    const p0 = await proj(page); const r0all = JSON.parse(JSON.stringify(p0.rows)); const i0 = p0.issues.length; const u0 = await ui(page)
    await typeReal(page, word, delay)
    await page.waitForTimeout(Math.max(0, delay - 30))
    const u1 = await ui(page); const toastMid = await T.toast(page); const panelMid = await T.panelText(page)
    await page.keyboard.press('Enter'); await page.waitForTimeout(150)
    const panelAfter = await T.panelText(page); const toastAfter = await T.toast(page)
    if (await T.panel(page)) { await page.keyboard.press('Escape'); await page.waitForTimeout(80) }
    if (await T.panel(page)) { await page.keyboard.press('Escape'); await page.waitForTimeout(80) }
    const p1 = await proj(page); const u2 = await ui(page)
    const ch = []
    for (const r of p1.rows) { const o = r0all.find((x) => x.id === r.id); if (!o) ch.push(`NEW ${r.id}(${r.name}/${r.model})`); else { const d = diff(strip(o), strip(r)); if (d) ch.push(`${r.id}: ${d}`) } }
    const tr = p1.rows.find((r) => r.id === id)
    const val = tr.working?.[F[col]] ?? tr[F[col]]
    const newIssues = p1.issues.slice(i0).map((x) => `${x.id}/${x.rowId}/${x.kind}/${x.status}/"${x.body}"`)
    const sideUi = []
    if (JSON.stringify(u2.sort) !== JSON.stringify(u0.sort)) sideUi.push('sort=' + JSON.stringify(u2.sort))
    if (u2.hiddenCols.length !== u0.hiddenCols.length) sideUi.push(`hiddenCols ${u0.hiddenCols.length}->${u2.hiddenCols.length}`)
    if (u2.view !== u0.view) sideUi.push(`view ${u0.view}->${u2.view}`)
    if ((u2.filter ?? '') !== (u0.filter ?? '') || JSON.stringify(u2.cellFilter) !== JSON.stringify(u0.cellFilter)) sideUi.push('filter=' + JSON.stringify(u2.filter) + JSON.stringify(u2.cellFilter))
    const ok = val === word && ch.length === 1 && ch[0].startsWith(id + ':') && !newIssues.length && !sideUi.length
    if (!ok) ng++
    log(`${ok ? 'OK ' : 'NG '} [${role}/${view}] ${id} ${col}(${okc}) "${word}" @${delay}ms -> value=${JSON.stringify(val)}`)
    if (!ok) {
      log(`     mid: mode=${u1.mode} cur=${u1.cursorRow}/${u1.cursorCol} edit=${JSON.stringify(u1.editValue)} panel=${u1.panel} toast=${toastMid} panelText=${panelMid?.slice(0, 140)}`)
      log(`     after Enter: panel=${panelAfter?.slice(0, 140)} toast=${toastAfter}`)
      log(`     changes: ${ch.join(' | ') || '(なし)'} ; issues+ ${newIssues.join(',') || '-'} ; ui: ${sideUi.join(' ') || '-'} cur=${u2.cursorRow}/${u2.cursorCol}`)
      await shot(page, `t21_${delay}_${id}_${word.replace(/\W/g, '_')}`)
    }
  } catch (e) { log('EXC', id, word, String(e).slice(0, 300)) }
}
log(`TOTAL NG ${ng}/${cases.length}`)
save(errors)
await browser.close()
