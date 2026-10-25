// 打てるセルから Alt 付きでダイアログを開き、迷って Ctrl+K / Esc
import { launch, fresh, T, makeLog, sel, gotoCol, ui, proj, sleep, setRole } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('t39_alt_dialogs')
const cases = [['design', 'Alt+Shift+I', 'R030'], ['design', 'Alt+Shift+A', 'R030'], ['design', 'Alt+c', 'R030'], ['design', 'Alt+w', 'R030'], ['design', 'Alt+r', 'R030'], ['design', 'Alt+Shift+R', 'R016'], ['design', 'Alt+f', 'R030'], ['design', 'Alt+s', 'R030'], ['design', 'Alt+h', 'R030'], ['design', 'Alt+Shift+X', 'R016'], ['design', 'Alt+j', 'R030'], ['design', 'Alt+n', 'R030'], ['purchasing', 'Alt+Shift+I', 'R030'], ['pm', 'Alt+y', 'R003']]
for (const [role, key, id] of cases) {
  await fresh(page, role); await page.keyboard.press(role === 'pm' ? '7' : '1'); await sel(page, id); await gotoCol(page, role === 'design' ? '型式' : '部品名'); await sleep(80)
  const u0 = await ui(page)
  await page.keyboard.press(key); await sleep(150)
  const u1 = await ui(page); const pt = await T.panelText(page); const t = await T.toast(page)
  log(`[${role}] ${key} on ${u0.cursorRow}/${u0.cursorCol} -> mode=${u1.mode} panel=${u1.panel} cur=${u1.cursorRow}/${u1.cursorCol} sort=${JSON.stringify(u1.sort)} filter=${JSON.stringify(u1.cellFilter)} | ${pt?.slice(0, 100) ?? ''} | toast=${t}`)
  if (u1.panel) { await page.keyboard.press('Control+k'); await sleep(100); log(`    Ctrl+K -> ${await T.panel(page)} | ${await T.toast(page)}`); await page.keyboard.press('Escape'); await page.keyboard.press('Escape') }
}
save(errors); await browser.close()
