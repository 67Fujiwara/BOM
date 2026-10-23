// PM の新人: 7 要決定で y / Shift+Y / Enter → 決定パネル。サンプルの初回正規化で 7 が変わるか
import { launch, fresh, T, makeLog, shot, sel, gotoCol, row, proj, ui, palette, runPalette, setRole } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('t11_pm')
const v7 = () => page.evaluate(() => [...document.querySelectorAll('[data-row-id], [data-testid=case-row]')].map((tr) => (tr.dataset.rowId ?? 'CASE') + ':' + tr.innerText.replace(/\s+/g, ' ').slice(0, 70)))
const st = async (id) => { const r = await row(page, id); return `${r.id}:${r.status}@${r.adoptedSupplierId ?? '-'} flags=${JSON.stringify(Object.fromEntries(Object.entries(r.flags).filter(([, v]) => v)))}` }
await fresh(page, 'pm')
log('PM 7 on fresh sample:', JSON.stringify(await v7()), '| header', (await T.header(page)).replace(/\s+/g, ' ').match(/設計待ち.*PM待ち \d+/)?.[0])
log('  R003', await st('R003'), 'R013', await st('R013'), 'R034', await st('R034'))
// 設計が無関係なセルを 1 つ直す
await setRole(page, 'design'); await page.keyboard.press('1'); await sel(page, 'R070'); await gotoCol(page, '備考'); await page.keyboard.press('Enter'); await page.keyboard.insertText('メモ'); await page.keyboard.press('Enter')
await setRole(page, 'pm')
log('PM 7 after design edits R070 備考:', JSON.stringify(await v7()), '| header', (await T.header(page)).replace(/\s+/g, ' ').match(/設計待ち.*PM待ち \d+/)?.[0])
log('  R003', await st('R003'), 'R013', await st('R013'), 'R034', await st('R034'))
// 案件設定確定の行
await page.keyboard.press('Control+ArrowUp'); log('top cursor', (await ui(page)).cursorRow, 'hints', await T.hints(page))
// R003 で y（納期NG は y 無効のはず）
await sel(page, 'R003'); log('R003 hints', await T.hints(page))
await page.keyboard.press('y'); await page.waitForTimeout(80); log('  y ->', await T.panelText(page), '|', await T.toast(page))
if (await T.panel(page)) await page.keyboard.press('Escape')
await page.keyboard.press('Enter'); await page.waitForTimeout(80); log('  Enter ->', await T.panelText(page))
await page.keyboard.press('b'); await page.waitForTimeout(100); log('  b ->', await T.panelText(page), '|', await T.toast(page))
for (let i = 0; i < 3 && (await T.panel(page)); i++) { await page.keyboard.press('Enter'); await page.waitForTimeout(100); log('  Enter ->', await T.panelText(page), '|', await T.toast(page)) }
if (await T.panel(page)) { await page.keyboard.press('1'); await page.waitForTimeout(100); log('  1 ->', await T.panelText(page), '|', await T.toast(page)) }
if (await T.panel(page)) { await page.keyboard.press('Enter'); await page.waitForTimeout(100); log('  Enter ->', await T.panelText(page), '|', await T.toast(page)) }
log('  R003 after', await st('R003'), 'decisions', JSON.stringify((await proj(page)).decisions.slice(-1)))
await page.keyboard.press('Control+z'); await page.waitForTimeout(80); log('  Ctrl+Z', await T.toast(page), await st('R003'))
// Shift+Y 受入
await sel(page, 'R003'); await page.keyboard.press('Shift+Y'); await page.waitForTimeout(80); log('  Shift+Y ->', await T.panelText(page), '|', await T.toast(page))
for (let i = 0; i < 3 && (await T.panel(page)); i++) { await page.keyboard.press('Enter'); await page.waitForTimeout(100); log('  Enter ->', await T.panelText(page), '|', await T.toast(page)) }
if (await T.panel(page)) { await page.keyboard.press('1'); await page.waitForTimeout(80); await page.keyboard.press('Enter'); await page.waitForTimeout(100); log('  1 Enter ->', await T.panelText(page), '|', await T.toast(page)) }
log('  R003 after Shift+Y', await st('R003'))
// PM が編集しようとする
await page.keyboard.press('1'); await sel(page, 'R040'); await page.keyboard.press('Enter'); log('PM Enter on R040', await T.toast(page), (await ui(page)).mode)
await page.keyboard.press('Escape')
await page.keyboard.press('7'); log('PM 7 final', JSON.stringify(await v7()))
await shot(page, 't11_pm')

// N3-09: Enter 連打
await fresh(page, 'pm'); const rows7 = await v7(); log('PM 7 rows', JSON.stringify(rows7))
await page.keyboard.press('Control+ArrowUp'); await page.keyboard.press('ArrowDown'); log('cursor', (await ui(page)).cursorRow)
for (let i = 0; i < 6; i++) { await page.keyboard.press('Enter'); await page.waitForTimeout(100); log(`  Enter#${i + 1} -> panel=${(await T.panelText(page))?.slice(0, 200)} | toast=${await T.toast(page)}`) }
log('  decisions', JSON.stringify((await proj(page)).decisions.map((d) => [d.rowId, d.kind ?? d.choice, d.reason])))
if (await T.panel(page)) await page.keyboard.press('Escape')
// 決定パネルで数字（U3-02 中堅）
for (const id of rows7.map((x) => x.split(':')[0]).filter((x) => x.startsWith('R'))) {
  await sel(page, id); await page.keyboard.press('Enter'); await page.waitForTimeout(80)
  const pt = await T.panelText(page); log(`  ${id} panel: ${pt?.slice(0, 260)}`)
  if (!pt) continue
  await page.keyboard.press('1'); await page.waitForTimeout(80); log(`    1 -> view=${(await ui(page)).view} panel=${(await T.panelText(page))?.slice(0, 120)} toast=${await T.toast(page)}`)
  await page.keyboard.press('ArrowDown'); await page.waitForTimeout(50); log(`    ↓ -> ${(await T.panelText(page))?.slice(0, 200)}`)
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape')
}
await shot(page, 't11_pm_panel')
save(errors)
await browser.close()
