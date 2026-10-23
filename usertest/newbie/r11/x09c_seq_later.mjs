import { launch, fresh, T, makeLog, ui, sleep, proj } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('x09c_seq_later')
const fixes = { model: 'NEW-1 10A', maker: 'オムロン' }
await fresh(page); await page.keyboard.press('Control+Shift+F'); await sleep(150)
const visited = []
for (let i = 0; i < 14; i++) {
  const u0 = await ui(page)
  if (u0.panel !== 'quickfix') { log('  end:', u0.mode, u0.panel, await T.toast(page)); break }
  visited.push(`${u0.cursorRow}/${u0.cursorCol}`)
  const txt = (await T.panelText(page))
  if (fixes[u0.cursorCol] && /1 [^2]*編集する/.test(txt)) {
    await page.keyboard.press('Enter'); await sleep(80)
    await page.keyboard.press('Control+a'); await page.keyboard.insertText(fixes[u0.cursorCol]); await page.keyboard.press('Enter'); await sleep(200)
    visited.push('(fixed)')
  } else {
    // 「あとで（Shift+→）」の案内どおり Shift+→、効かなければ番号で
    const before = `${u0.cursorRow}/${u0.cursorCol}`
    await page.keyboard.press('Shift+ArrowRight'); await sleep(150)
    const u1 = await ui(page)
    if (`${u1.cursorRow}/${u1.cursorCol}` === before && u1.panel === 'quickfix') {
      visited.push('(Shift+→ 効かず)')
      const m = /(\d) [^ ]*: あとで/.exec(txt); await page.keyboard.press(m ? m[1] : 'Escape'); await sleep(200)
      const u2 = await ui(page); visited.push(`(${m?.[1]}→${u2.cursorRow})`)
    }
  }
}
log('  visited:', visited.join(' → '))
log('  toast:', await T.toast(page))
const rest = []; for (let i = 0; i < 6; i++) { await page.keyboard.press('Escape'); } await page.keyboard.press('Control+ArrowUp'); for (let i = 0; i < 7; i++) { await page.keyboard.press('F8'); await sleep(50); const u = await ui(page); rest.push(`${u.cursorRow}/${u.cursorCol}`) } log('  F8 rest:', rest.join(' → '))
save(errors); await browser.close()
