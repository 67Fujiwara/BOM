// ラウンド20: 【削除？】の印（あいまいな変更図）を新人が画面で片づける流れ。
// A C2 を貼る → 作成 → 問題 → そのまま Ctrl+Enter（公開できるか）→ F8 → Ctrl+. →「要る部品」で消す → もう一度 Ctrl+Enter
// B 同じ表で 1 行を Shift+Delete（削除）、残りは備考を手で消す
// C ふつうの表（印が出ない）の確認
import fs from 'node:fs'
import { launch, makeLog, T, sleep, shot, proj, ui } from './lib.mjs'
import { wizardPaste, createAndPublish, probs, rowsText } from './w15.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog(process.env.LOGNAME2 || 'r53_markdel_ui')
const cases = Object.fromEntries(JSON.parse(fs.readFileSync('cases/p20.json', 'utf8')).map(([t, x]) => [t.split(' ')[0], x]))
const U = async (tag) => { const u = await ui(page); log(`  [${tag}] mode=${u.mode} view=${u.view} cur=${u.cursorRow}/${u.cursorCol} panel=${u.panel} | ${((await T.panelText(page)) ?? '').slice(0, 300)} | toast=${(await T.toast(page))?.slice(0, 240)}`) }
log('== A: C2 を貼って作成')
let pv = await wizardPaste(page, cases.C2); log('preview: ' + pv.slice(0, 900))
await page.keyboard.press('Enter'); await sleep(400)
let p = await proj(page); log('rows: ' + rowsText(p)); log('problems: ' + await probs(page)); await U('created')
await page.keyboard.press('Control+Enter'); await sleep(400); await U('Ctrl+Enter 1')
if (await T.panel(page)) { await page.keyboard.press('Escape'); await sleep(150) }
log('published: ' + (await proj(page)).rows.map((r) => `${r.id}:${r.status}:${r.publishedRev ?? '-'}`).join(' '))
await page.locator('.gridwrap').focus(); await page.keyboard.press('F8'); await sleep(250); await U('F8')
await page.keyboard.press('Control+.'); await sleep(250); await U('Ctrl+.')
await shot(page, 'r53_A_fix_panel')
const txt = (await T.panelText(page)) ?? ''
if (/要る部品/.test(txt)) { await page.keyboard.press('1'); await sleep(250); await U('1 (要る部品)') } else { await page.keyboard.press('Enter'); await sleep(250); await U('Enter') }
log('problems after 1 fix: ' + await probs(page))
for (let i = 0; i < 3; i++) { await page.keyboard.press('F8'); await sleep(200); await page.keyboard.press('Control+.'); await sleep(200); if (/要る部品/.test((await T.panelText(page)) ?? '')) await page.keyboard.press('1'); else await page.keyboard.press('Escape'); await sleep(200) }
log('problems after F8 x3: ' + await probs(page))
await page.keyboard.press('Control+Enter'); await sleep(400); await U('Ctrl+Enter 2')
if (await T.panel(page)) { await page.keyboard.press('Enter'); await sleep(400); await U('Enter in panel') }
log('published: ' + (await proj(page)).rows.map((r) => `${r.id}:${r.status}:${r.publishedRev ?? '-'}:${(r.note ?? '').slice(0, 8)}`).join(' '))
log('== B: 同じ表で Shift+Delete と手で消す')
pv = await wizardPaste(page, cases.C2); await page.keyboard.press('Enter'); await sleep(400)
p = await proj(page); const marked = p.rows.filter((r) => (r.note ?? '').startsWith('【削除？】')).map((r) => r.id); log('marked: ' + marked.join(','))
const { sel, gotoCol } = await import('./lib.mjs')
await sel(page, marked[0]); await page.keyboard.press('Shift+Delete'); await sleep(300); await U('Shift+Delete'); if (await T.panel(page)) { await page.keyboard.press('Enter'); await sleep(300) }
log('rows now: ' + rowsText(await proj(page)))
await sel(page, marked[1]); log('goto 備考: ' + await gotoCol(page, '備考')); await page.keyboard.press('Enter'); await sleep(150); await page.keyboard.press('Control+a'); await page.keyboard.press('Delete'); await page.keyboard.press('Enter'); await sleep(250); await U('note cleared')
log('problems: ' + await probs(page))
await page.keyboard.press('Control+Enter'); await sleep(400); await U('Ctrl+Enter')
if (await T.panel(page)) { await page.keyboard.press('Escape') }
log('== C: ふつうの旧/新の表（印が出ないはず）')
for (const k of ['C1', 'C3', 'C5', 'C9', 'C10']) { pv = await wizardPaste(page, cases[k]); await page.keyboard.press('Enter'); await sleep(300); p = await proj(page); log(`${k}: marked=${p.rows.filter((r) => (r.note ?? '').startsWith('【削除？】')).length}/${p.rows.length} | ${await probs(page)}`) }
save(errors); await browser.close()
