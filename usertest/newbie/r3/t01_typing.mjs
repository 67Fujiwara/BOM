// N2-02 再検証 + 派生: 英字でいきなり打つ（小文字・大文字始まり・ゆっくり打つ・2 文字目もコマンド）
import { launch, fresh, T, makeLog, shot, sel, gotoCol, store, row, diff, setRole } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save, finding } = makeLog('t01_typing')
const cases = [
  // [role, id, col, word, delay(ms)]
  ['design', 'R076', '部品名', 'relay', 30],
  ['design', 'R077', 'メーカ', 'omron', 30],
  ['design', 'R078', '型式', 'abc-123', 30],
  ['design', 'R079', '型式', 'AC100V', 30],
  ['design', 'R030', '型式', 'hello', 30],
  ['design', 'R031', '部品名', 'sensor', 30],
  ['design', 'R032', '部品名', 'fuse', 30],
  ['design', 'R033', 'メーカ', 'idec', 30],
  ['design', 'R034', 'メーカ', 'Panasonic', 30],
  ['design', 'R035', '部品名', 'cable', 30],
  ['design', 'R036', '部品名', 'wire', 30],
  ['design', 'R037', '部品名', 'x-ray', 30],
  ['design', 'R038', '部品名', 'nut', 30],
  ['purchasing', 'R040', '備考', 'ok', 30],
  ['purchasing', 'R041', '備考', 'yes', 30],
  // 大文字始まり（Shift+英字に割り当てがあるもの）
  ['design', 'R042', 'メーカ', 'IDEC', 30],
  ['design', 'R043', 'メーカ', 'NEC', 30],
  ['design', 'R044', 'メーカ', 'SMC', 30],
  ['design', 'R045', 'メーカ', 'Keyence', 30],
  ['design', 'R046', 'メーカ', 'Denso', 30],
  ['design', 'R047', '部品名', 'Relay', 30],
  ['design', 'R048', 'メーカ', 'Yaskawa', 30],
  ['design', 'R049', 'メーカ', 'Analog Devices', 30],
  ['design', 'R050', '部品名', 'Jumper', 30],
  ['design', 'R051', '型式', 'XW2B-20G4', 30],
  // 2 文字目もコマンド（n/j/k の後）
  ['design', 'R052', '部品名', 'noise filter', 30],
  ['design', 'R053', '部品名', 'knob', 30],
  ['design', 'R054', '部品名', 'jack', 30],
  ['design', 'R055', '部品名', 'kit', 30],
  // ゆっくり打つ新人（1 文字 400ms / 250ms）
  ['design', 'R056', '部品名', 'relay', 400],
  ['design', 'R057', 'メーカ', 'omron', 250],
  ['design', 'R058', '部品名', 'heater', 250],
  ['design', 'R059', '部品名', 'switch', 400],
]
for (const [role, id, col, word, delay] of cases) {
  try {
    await fresh(page, role); await page.keyboard.press('1')
    await sel(page, id); const okCol = await gotoCol(page, col)
    const ws0 = await store(page)
    const p0 = ws0.projects.find((x) => x.id === ws0.currentProjectId)
    const snap0 = JSON.stringify(p0.rows)
    const before = await row(page, id)
    await page.keyboard.type(word, { delay })
    const mode = await T.mode(page)
    const editor = await page.getByTestId('cell-editor').inputValue().catch(() => '-')
    const panel = await T.panel(page)
    const toastMid = await T.toast(page)
    if (await T.panel(page)) await page.keyboard.press('Escape')
    else await page.keyboard.press('Enter')
    await page.waitForTimeout(60)
    const after = await row(page, id)
    const ws1 = await store(page)
    const p1 = ws1.projects.find((x) => x.id === ws1.currentProjectId)
    const others = []
    const r0 = JSON.parse(snap0)
    for (const r of p1.rows) { const o = r0.find((x) => x.id === r.id); if (!o) others.push(`NEW ${r.id} ${r.name}/${r.model}`); else if (r.id !== id && JSON.stringify(o) !== JSON.stringify(r)) others.push(`${r.id}: ${diff(o, r)}`) }
    log(`${role} ${id} ${col}(${okCol}) "${word}" d=${delay}: mode=${mode} editor=${JSON.stringify(editor)} panel=${panel} toastMid=${toastMid}`)
    log(`   self: ${diff(before, after)}`)
    log(`   others: ${others.join(' | ') || '-'}  filterChips=${(await page.locator('.toolbar .chip').allTextContents()).join(',')} cursor=${await T.cursor(page)} hidden=${after?.hidden ?? '-'}`)
    await shot(page, `t01_${id}_${word.replace(/\W/g, '_')}_${delay}`)
  } catch (e) { log('EXC', id, String(e).slice(0, 300)) }
}
save(errors)
await browser.close()
