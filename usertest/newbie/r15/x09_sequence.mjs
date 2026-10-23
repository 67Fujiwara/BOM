// 順番に直すモード（Ctrl+Shift+F）で直していくと、問題を飛ばさないか。Ctrl+. → 直す → F8
import { launch, fresh, T, makeLog, shot, sel, gotoCol, ui, typeReal, proj, sleep } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('x09_sequence')
const fixes = { model: 'NEW-1 10A', maker: 'オムロン', qtyNeeded: '3' }
const plist = async () => page.evaluate(async () => { const u = performance.getEntriesByType('resource').map((e) => e.name).find((n) => n.includes('/src/commands/registry.ts')); return null })
log('== F8 だけで一覧')
await fresh(page); const seen = []; for (let i = 0; i < 8; i++) { await page.keyboard.press('F8'); await sleep(60); const u = await ui(page); seen.push(`${u.cursorRow}/${u.cursorCol}`) } log('  ', seen.join(' → '))
log('== 順番に直すモード: 編集できる候補は直す、それ以外は「あとで」')
await fresh(page); await sleep(100)
await page.keyboard.press('Control+Shift+F'); await sleep(150)
const visited = []
for (let i = 0; i < 12; i++) {
  const u0 = await ui(page)
  if (u0.panel !== 'quickfix') { log('  end:', u0.panel, await T.toast(page)); break }
  visited.push(`${u0.cursorRow}/${u0.cursorCol}`)
  const txt = (await T.panelText(page)).slice(0, 160)
  if (fixes[u0.cursorCol] && /編集する/.test(txt)) {
    await page.keyboard.press('Enter'); await sleep(80)
    const u1 = await ui(page)
    if (u1.mode === 'edit') { await page.keyboard.press('Control+a'); await page.keyboard.insertText(fixes[u0.cursorCol]); await page.keyboard.press('Enter'); await sleep(150); log(`  fixed ${u0.cursorRow}/${u0.cursorCol}`) }
    else log('  Enter ->', u1.mode, u1.panel)
  } else { log(`  skip ${u0.cursorRow}/${u0.cursorCol}: ${txt}`); await page.keyboard.press('Shift+ArrowRight'); await sleep(120) }
}
log('  visited:', visited.join(' → '))
await page.keyboard.press('Escape'); await sleep(80)
log('== そのあと F8 で残りを確認')
const rest = []; await page.keyboard.press('Control+ArrowUp'); for (let i = 0; i < 8; i++) { await page.keyboard.press('F8'); await sleep(60); const u = await ui(page); rest.push(`${u.cursorRow}/${u.cursorCol}`) } log('  ', rest.join(' → '))
const p = await proj(page); log('  R009 maker', p.rows.find((r) => r.id === 'R009').working, 'R022', p.rows.find((r) => r.id === 'R022').working)
log('== Ctrl+. → 編集する → 直す → Enter → F8（期待: 次の問題）')
await fresh(page); await page.keyboard.press('F8'); await page.keyboard.press('F8'); await sleep(60); log('  at', JSON.stringify(await T.cursor(page)))
await page.keyboard.press('Control+.'); await sleep(120); log('  panel', (await T.panelText(page))?.slice(0, 200))
await page.keyboard.press('Enter'); await sleep(80); let u = await ui(page); log('  mode', u.mode, u.editValue)
if (u.mode === 'edit') { await page.keyboard.insertText('オムロン'); await page.keyboard.press('Enter'); await sleep(120) }
u = await ui(page); log('  after', u.mode, u.cursorRow, u.cursorCol, await T.toast(page))
await page.keyboard.press('F8'); await sleep(80); log('  F8 ->', await T.cursor(page))
save(errors); await browser.close()
