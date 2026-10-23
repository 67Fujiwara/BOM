// N3-01 / N3-02 再検証 + 派生: Excel の癖でセルを選んでいきなり英字を打つ
import { launch, fresh, T, makeLog, shot, sel, gotoCol, ui, typeReal, proj, diff, setRole } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog(process.argv[2] ? `t01_typing_${process.argv[2]}` : 't01_typing')
const F = { 部品名: 'name', 型式: 'model', メーカ: 'maker', 回路記号: 'ref', 備考: 'note', 図面番号: 'drawing', 分類: 'category', 規格: 'tags' }
const fast = [
  // r3 の 15 語（小文字）
  ['R076', '部品名', 'relay'], ['R077', 'メーカ', 'omron'], ['R078', '型式', 'abc-123'], ['R030', '型式', 'hello'], ['R031', '部品名', 'sensor'],
  ['R032', '部品名', 'fuse'], ['R033', 'メーカ', 'idec'], ['R035', '部品名', 'cable'], ['R036', '部品名', 'wire'], ['R037', '部品名', 'x-ray'], ['R038', '部品名', 'nut'],
  // Shift つき大文字
  ['R042', 'メーカ', 'IDEC'], ['R043', 'メーカ', 'NEC'], ['R044', 'メーカ', 'SMC'], ['R045', 'メーカ', 'Keyence'], ['R046', 'メーカ', 'Denso'],
  ['R047', '部品名', 'Relay'], ['R048', 'メーカ', 'Yaskawa'], ['R049', 'メーカ', 'Analog Devices'], ['R050', '部品名', 'Jumper'], ['R051', '型式', 'XW2B-20G4'],
  ['R052', '部品名', 'Inverter'], ['R058', '部品名', 'Antenna'], ['R059', '型式', 'SJ-4'], ['R030', '型式', 'S-T21 AC200V'], ['R057', 'メーカ', 'Omron'],
  // 2 文字目が n j k
  ['R053', '部品名', 'inverter'], ['R054', '部品名', 'snubber'], ['R055', '部品名', 'ink'], ['R056', '部品名', 'anode'], ['R052', '部品名', 'noise filter'],
  ['R053', '部品名', 'knob'], ['R054', '部品名', 'jack'], ['R055', '部品名', 'kit'],
  // 新しく試す語: c・w・Shift+A・Shift+I で始まる語、回路記号（K1 J3 N2 など）
  ['R035', '部品名', 'connector'], ['R036', '部品名', 'capacitor'], ['R037', '部品名', 'washer'], ['R038', 'メーカ', 'Amphenol'], ['R039', 'メーカ', 'ABB'],
  ['R040', '部品名', 'IC socket'], ['R041', 'メーカ', 'Weidmuller'], ['R041', 'メーカ', 'Coilcraft'],
  ['R030', '回路記号', 'K1'], ['R031', '回路記号', 'J3'], ['R032', '回路記号', 'N2'], ['R033', '回路記号', 'k5'], ['R034', '回路記号', 'j2'], ['R035', '回路記号', 'KA1'], ['R036', '回路記号', 'X1'], ['R037', '回路記号', 'SW1'],
  ['R038', '備考', 'jj'], ['R039', '型式', 'NN-1'], ['R040', '型式', 'K-2'],
]
const slow = [
  ['R076', '部品名', 'relay'], ['R058', '部品名', 'heater'], ['R059', '部品名', 'switch'], ['R035', '部品名', 'cable'], ['R056', '部品名', 'anode'],
  ['R077', 'メーカ', 'omron'], ['R043', 'メーカ', 'NEC'], ['R045', 'メーカ', 'Keyence'], ['R032', '部品名', 'fuse'], ['R031', '部品名', 'sensor'], ['R044', 'メーカ', 'SMC'],
]
const which = process.argv[2] ?? 'fast'
const cases = which === 'fast' ? fast.map((c) => [...c, 40]) : which === 'slow300' ? slow.map((c) => [...c, 300]) : slow.map((c) => [...c, 450])
const strip = (r) => ({ ...r, flags: 0, statusChangedAt: 0, updatedAt: 0 })
for (const [id, col, word, delay] of cases) {
  try {
    await fresh(page); await page.keyboard.press('1')
    await sel(page, id); await gotoCol(page, col)
    const r0all = JSON.parse(JSON.stringify((await proj(page)).rows))
    await typeReal(page, word, delay)
    const u1 = await ui(page)
    const toastMid = await T.toast(page)
    const panelMid = await T.panelText(page)
    if (u1.panel) await page.keyboard.press('Escape'); else await page.keyboard.press('Enter')
    await page.waitForTimeout(100)
    const p1 = await proj(page)
    const ch = []
    for (const r of p1.rows) { const o = r0all.find((x) => x.id === r.id); if (!o) ch.push(`NEW ${r.id}(${r.name}/${r.model})`); else { const d = diff(strip(o), strip(r)); if (d) ch.push(`${r.id}: ${d}`) } }
    const tr = p1.rows.find((r) => r.id === id)
    const val = tr.working?.[F[col]] ?? tr[F[col]]
    const ok = val === word && ch.length === 1 && ch[0].startsWith(id + ':')
    const u2 = await ui(page)
    log(`${ok ? 'OK ' : 'NG '} ${id} ${col} "${word}" @${delay}ms -> value=${JSON.stringify(val)} | mid mode=${u1.mode} cur=${u1.cursorRow}/${u1.cursorCol} edit=${JSON.stringify(u1.editValue)} panel=${u1.panel} view=${u1.view}`)
    log(`     toast=${toastMid} panelText=${panelMid?.slice(0, 120)}`)
    log(`     changes: ${ch.join(' | ') || '(なし)'} ; sort=${JSON.stringify(u2.sort)} view=${u2.view} hiddenCols=${u2.hiddenCols?.length}`)
    if (!ok) await shot(page, `t01_${which}_${id}_${word.replace(/\W/g, '_')}`)
  } catch (e) { log('EXC', id, word, String(e).slice(0, 300)) }
}
save(errors)
await browser.close()
