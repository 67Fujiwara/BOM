// 英字の打ち始め その 2: Shift つきの大文字・2 文字目が n/j/k・inverter 等。データの変化を全行で比較
import { launch, fresh, T, makeLog, shot, sel, gotoCol, store, row, diff, ui, typeReal, proj } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('t04_typing2')
const cases = [
  ['R042', 'メーカ', 'IDEC'], ['R043', 'メーカ', 'NEC'], ['R044', 'メーカ', 'SMC'], ['R045', 'メーカ', 'Keyence'], ['R046', 'メーカ', 'Denso'],
  ['R047', '部品名', 'Relay'], ['R048', 'メーカ', 'Yaskawa'], ['R049', 'メーカ', 'Analog'], ['R050', '部品名', 'Jumper'], ['R051', '型式', 'XW2B-20G4'],
  ['R052', '部品名', 'Inverter'], ['R053', '部品名', 'inverter'], ['R054', '部品名', 'snubber'], ['R055', '部品名', 'ink'], ['R056', '部品名', 'anode'],
  ['R057', 'メーカ', 'Omron'], ['R058', '部品名', 'Antenna'], ['R059', '型式', 'SJ-4'], ['R060', '部品名', 'on/off switch'],
]
const NOISE = (o, r) => { const a = { ...o, flags: undefined, statusChangedAt: undefined }, b = { ...r, flags: undefined, statusChangedAt: undefined }; if (o.id === 'R034') { a.status = b.status } return JSON.stringify(a) !== JSON.stringify(b) }
for (const [id, col, word] of cases) {
  try {
    await fresh(page); await page.keyboard.press('1')
    // 一度だけ無害な確定をして、派生値（flags 等）の再計算を済ませておく
    await sel(page, id); await gotoCol(page, col)
    const r0all = JSON.parse(JSON.stringify((await proj(page)).rows))
    const u0 = await ui(page)
    await typeReal(page, word, 40)
    const u1 = await ui(page)
    const toastMid = await T.toast(page)
    if (u1.panel) await page.keyboard.press('Escape'); else await page.keyboard.press('Enter')
    await page.waitForTimeout(80)
    const p1 = await proj(page)
    const ch = []
    for (const r of p1.rows) { const o = r0all.find((x) => x.id === r.id); if (!o) ch.push(`NEW ${r.id}(${r.name}/${r.model})`); else if (NOISE(o, r)) ch.push(`${r.id}: ${diff({ ...o, flags: 0, statusChangedAt: 0 }, { ...r, flags: 0, statusChangedAt: 0 })}`) }
    const u2 = await ui(page)
    log(`${id} ${col} "${word}": before-enter mode=${u1.mode} cursor=${u1.cursorRow}/${u1.cursorCol} edit=${JSON.stringify(u1.editValue)} panel=${u1.panel} toast=${toastMid}`)
    log(`   changes: ${ch.join(' | ') || '(なし)'} ; sort=${JSON.stringify(u2.sort)} filter=${JSON.stringify(u2.cellFilter)} rows=${p1.rows.length}/${r0all.length}`)
    await shot(page, `t04_${id}_${word.replace(/\W/g, '_')}`)
  } catch (e) { log('EXC', id, String(e).slice(0, 300)) }
}
save(errors)
await browser.close()
