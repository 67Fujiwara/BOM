// ラウンド20: 【削除？】の直しの案内、グリッドに「旧→新」を直接打つ、Ctrl+V で貼る
import fs from 'node:fs'
import { launch, makeLog, T, sleep, shot, proj, ui, sel, gotoCol, fresh, palette, typeReal } from './lib.mjs'
import { wizardPaste, probs, rowsText } from './w15.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog(process.env.LOGNAME2 || 'r57_misc20')
const cases = Object.fromEntries(JSON.parse(fs.readFileSync('cases/p20.json', 'utf8')).map(([t, x]) => [t.split(' ')[0], x]))
const U = async (tag) => { const u = await ui(page); log(`  [${tag}] mode=${u.mode} view=${u.view} cur=${u.cursorRow}/${u.cursorCol} panel=${u.panel} | ${((await T.panelText(page)) ?? '').slice(0, 260)} | toast=${(await T.toast(page))?.slice(0, 260)}`) }
log('== A 【削除？】の行: 表の見出し（備考の列は見えるか）')
await wizardPaste(page, cases.C2); await page.keyboard.press('Enter'); await sleep(500)
log('  header cells: ' + (await page.locator('thead th').allInnerTexts()).join('|').replace(/\s+/g, ' '))
await sel(page, 'R005'); await U('R005'); log('  hints: ' + await T.hints(page))
log('  row text: ' + await T.rowText(page, 'R005'))
await page.keyboard.press('Shift+Delete'); await sleep(300); await U('Shift+Delete'); log('  rows: ' + (await proj(page)).rows.length)
await page.keyboard.press('Control+z'); await sleep(300); await U('Ctrl+Z'); log('  rows: ' + (await proj(page)).rows.length)
log('== B グリッドに直接 旧→新 を打つ')
await fresh(page); await sleep(150)
await sel(page, 'R039'); await gotoCol(page, '型式')
for (const v of ['E3X-HD11→E3X-HD41', 'USB-A→USB-C']) { await page.keyboard.press('Enter'); await page.keyboard.press('Control+a'); await page.keyboard.insertText(v); await page.keyboard.press('Enter'); await sleep(250); log(`  「${v}」 -> toast=${(await T.toast(page))?.slice(0, 200)} | problems ${(await probs(page)).slice(0, 300)}`) }
log('== C Ctrl+V で 5 行を貼る（半角カナ・矢印を含む）')
await fresh(page); await sleep(150)
await sel(page, 'R039'); await gotoCol(page, '型式')
await page.evaluate(() => navigator.clipboard.writeText('MY4N-D2\nUSB-A→USB-C 変換ケーブル\nﾀｲﾏ H3CR\n削除\nMY2N→MY4N-D2'))
await page.keyboard.press('Control+v'); await sleep(500); await U('Ctrl+V')
log('  rows: ' + (await proj(page)).rows.filter((r) => ['R039', 'R040', 'R041', 'R042', 'R043'].includes(r.id)).map((r) => `${r.id}:${JSON.stringify(r.working ?? {})}`).join(' '))
save(errors); await browser.close()
