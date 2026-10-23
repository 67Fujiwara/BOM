// R10: セルを選んで（Enter を押さずに）英字の値をいきなり打つ新人（Excel 習慣）
import { launch, fresh, T, makeLog, shot, sel, gotoCol, store, clearToast, setRole } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('r10_typing')
const rowOf = async (id) => (await store(page))?.projects[0].rows.find((r) => r.id === id)
try {
  const cases = [
    ['design', 'R076', '部品名', 'relay'],
    ['design', 'R077', 'メーカ', 'omron'],
    ['design', 'R078', '型式', 'abc-123'],
    ['design', 'R079', '型式', 'AC100V'],
    ['design', 'R030', '型式', 'hello'],
    ['design', 'R031', '部品名', 'sensor'],
    ['design', 'R032', '部品名', 'fuse'],
    ['design', 'R033', 'メーカ', 'idec'],
    ['design', 'R034', 'メーカ', 'Panasonic'],
    ['design', 'R035', '部品名', 'cable'],
    ['design', 'R036', '部品名', 'wire'],
    ['design', 'R037', '部品名', 'x-ray'],
    ['design', 'R038', '部品名', 'nut'],
    ['purchasing', 'R040', '備考', 'ok'],
    ['purchasing', 'R041', '備考', 'yes'],
  ]
  for (const [role, id, col, word] of cases) {
    await fresh(page, role); await page.keyboard.press('1')
    await sel(page, id); const okCol = await gotoCol(page, col)
    const before = JSON.stringify(await rowOf(id) ?? null)
    const rowsBefore = await T.rows(page)
    await page.keyboard.type(word, { delay: 30 })
    const mode = await T.mode(page)
    const editor = await page.getByTestId('cell-editor').inputValue().catch(() => '-')
    const panel = await T.panel(page)
    await page.keyboard.press('Enter'); await page.waitForTimeout(50)
    const after = await rowOf(id)
    const st = after?.status
    log(`${role} ${id} ${col}(${okCol}) type "${word}": mode`, mode, 'editor', editor, 'panel', panel, '| row status', st, 'adopted', after?.adoptedSupplierId ?? '-', 'hidden', after?.hidden ?? after?.flags?.hidden ?? '-', 'ordered', after?.ordered ?? '-', 'rows', rowsBefore, '->', await T.rows(page), 'filter chips', (await page.locator('.toolbar .chip').allTextContents()).join(','), 'cursor', await T.cursor(page), 'toast', await T.toast(page))
    log('   changed fields:', diff(before && before !== 'undefined' ? JSON.parse(before) : null, after))
    await shot(page, `r10_${id}_${word}`)
  }
} catch (e) { log('EXC', String(e).slice(0, 400)) }
function diff(a, b) { if (!b) return 'n/a'; a = a ?? {}; const out = []; for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) { const x = JSON.stringify(a[k]), y = JSON.stringify(b[k]); if (x !== y) out.push(`${k}: ${(x ?? '').slice(0, 60)} -> ${(y ?? '').slice(0, 60)}`) } return out.join('; ') }
save(errors)
await browser.close()
