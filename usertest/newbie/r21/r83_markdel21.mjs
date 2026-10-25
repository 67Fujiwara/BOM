// ラウンド21: 【削除？】のエラーの案内（Shift+Delete / Ctrl+. /「列の表示」）を、書いてあるとおり新人が順に試す。
// 表: 書き写し 3 行＋空 3 行＋「削除に変更」の備考 1 行（ask）。
import { launch, T, makeLog, ui, sleep, shot, proj, palette, sel, gotoCol } from './lib.mjs'
import { wizardPaste, probs, rowsText } from './w15.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog(process.env.LOGNAME2 || 'r83_markdel21')
const U = async (tag) => { const u = await ui(page); log(`  [${tag}] mode=${u.mode} view=${u.view} cur=${u.cursorRow}/${u.cursorCol} panel=${u.panel} | ${((await T.panelText(page)) ?? '').slice(0, 260)} | toast=${((await T.toast(page)) ?? '').slice(0, 330)}`) }
const text = `品名\t型式（旧）\t型式（新）\tメーカー\t数量\t備考
リレー\tMY2N\tMY4N-D2\tオムロン\t2\t
C1\tC-1\tC-1\tオムロン\t1\t
C2\tC-2\tC-2\tオムロン\t1\t
C3\tC-3\tC-3\tオムロン\t1\t
E1\tE-1\t\tオムロン\t1\t
E2\tE-2\t\tオムロン\t1\t
E3\tE-3\t\tオムロン\t1\t削除に変更`
const pv = await wizardPaste(page, text); log('preview: ' + pv.slice(0, 1200))
await page.keyboard.press('Enter'); await sleep(400)
let p = await proj(page); log('rows: ' + rowsText(p)); log('problems: ' + await probs(page))
await page.keyboard.press('Control+Enter'); await sleep(400); await U('Ctrl+Enter 1')
if (await T.panel(page)) { await page.keyboard.press('Escape'); await sleep(150) }
await page.locator('.gridwrap').focus()
log('== F8 → エラーの文')
await page.keyboard.press('F8'); await sleep(250); await U('F8')
log('  status: ' + (await T.status(page)))
log('== Ctrl+. （直し方）')
await page.keyboard.press('Control+.'); await sleep(250); await U('Ctrl+.')
await shot(page, 'r83_fixpanel')
log('== 案内の「列の表示」を Ctrl+K で')
await page.keyboard.press('Escape'); await sleep(100)
await palette(page, '列の表示'); log('  palette top: ' + (await page.getByTestId('palette-list').locator('.item').evaluateAll((els) => els.slice(0, 4).map((e) => e.textContent.replace(/\s+/g, ' ').trim()))).join(' / '))
await page.keyboard.press('Enter'); await sleep(250); await U('列の表示')
const items = await page.getByTestId('columns').locator('.opt').allTextContents().catch(() => [])
log('  columns: ' + items.map((t) => t.replace(/\s+/g, ' ').trim()).join(' | '))
const bi = items.findIndex((t) => t.includes('備考'))
log('  備考 index ' + bi)
if (bi >= 0) { for (let k = 0; k < bi; k++) await page.keyboard.press('ArrowDown'); await page.keyboard.press(' '); await sleep(150) }
await page.keyboard.press('Escape'); await sleep(150); await U('closed')
const hdr = await page.locator('thead th').allInnerTexts(); log('  header: ' + hdr.join('|'))
log('== 備考を手で消す（Enter → 全消し → Enter）')
const marked = (await proj(page)).rows.filter((r) => (r.note ?? '').startsWith('【削除？】')).map((r) => r.id); log('  marked: ' + marked.join(','))
await sel(page, marked[0]); log('  goto 備考: ' + await gotoCol(page, '備考'))
await page.keyboard.press('Enter'); await sleep(150); await U('Enter (edit)')
await page.keyboard.press('Control+a'); await page.keyboard.press('Delete'); await page.keyboard.press('Enter'); await sleep(250); await U('after clear')
log('  note now: ' + JSON.stringify((await proj(page)).rows.find((r) => r.id === marked[0])?.note))
log('== Shift+Delete （案内: 削除なら行を取消し）')
await sel(page, marked[1]); await page.keyboard.press('Shift+Delete'); await sleep(300); await U('Shift+Delete')
if (await T.panel(page)) { await page.keyboard.press('Enter'); await sleep(300); await U('Enter in panel') }
log('  rows: ' + rowsText(await proj(page)))
log('== 残りを Ctrl+. → 1 で')
for (let i = 0; i < 6; i++) { await page.keyboard.press('F8'); await sleep(200); if (/要る部品/.test((await T.panelText(page)) ?? '')) {} ; await page.keyboard.press('Control+.'); await sleep(200); if (/要る部品/.test((await T.panelText(page)) ?? '')) { await page.keyboard.press('1'); await sleep(200) } else { await page.keyboard.press('Escape') } }
log('problems: ' + await probs(page))
await page.keyboard.press('Control+Enter'); await sleep(400); await U('Ctrl+Enter 2')
if (await T.panel(page)) { await page.keyboard.press('Enter'); await sleep(400); await U('Enter in panel') }
log('published: ' + (await proj(page)).rows.map((r) => `${r.id}:${r.status}:${r.publishedRev ?? '-'}:${(r.note ?? '').slice(0, 8)}`).join(' '))
save(errors); await browser.close()
