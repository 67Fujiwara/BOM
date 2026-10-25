// ラウンド15: N15-01 の続き。見積書風の表（品名｜規格｜メーカー｜単価｜数量｜金額）を貼った新人が、知らせのとおり「カーソルのセルから直す」→ 1 行目が見出しだと気づいて Shift+Delete で消す → Ctrl+Enter。購買には何個で渡るか
import { launch, T, makeLog, ui, sleep, shot, proj, setRole } from './lib.mjs'
import { wizardPaste, rowsText } from './w15.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog(process.env.LOGNAME2 || 'r07_estimate_follow')
const st = async (tag) => { const u = await ui(page); log(`  [${tag}] mode=${u.mode} view=${u.view} cur=${u.cursorRow}/${u.cursorCol} panel=${u.panel} | ${((await T.panelText(page)) ?? '').slice(0, 160)} | toast: ${(await T.toast(page))?.slice(0, 200)}`) }
const pv = await wizardPaste(page, 'No\t品名\t規格\tメーカー\t単価\t数量\t金額\n1\tリレー\tMY4N-D2 DC24\tオムロン\t1200\t4\t4800\n2\tタイマ\tH3CR-A8\tオムロン\t3000\t2\t6000\n3\tブレーカ\tNF32-SV 2P 10A\t三菱電機\t2500\t1\t2500')
log('preview: ' + pv.slice(0, 700))
await page.keyboard.press('Enter'); await sleep(350); await st('created')
log('  rows: ' + rowsText(await proj(page)))
await page.keyboard.press('Shift+Delete'); await sleep(200); await st('Shift+Delete')
if (await T.panel(page)) { await page.keyboard.press('Enter'); await sleep(200); await st('Enter') }
log('  rows: ' + rowsText(await proj(page)) + ' status=' + (await proj(page)).rows.map((r) => r.status).join(','))
await page.keyboard.press('Control+Enter'); await sleep(300); await st('Ctrl+Enter')
const p = await proj(page)
log('  published: ' + p.rows.map((r) => `${r.id}:${r.status}:${r.name}/${r.model}/${r.qtyNeeded}${r.unit}/ref=${r.ref}/cat=${r.category}`).join(' '))
await setRole(page, 'purchasing'); await sleep(200)
await page.keyboard.press('1'); await sleep(150)
log('  purch view1: ' + (await page.getByTestId('row').evaluateAll((els) => els.map((e) => e.innerText.replace(/\s+/g, ' ').slice(0, 120)).join(' || '))))
await shot(page, 'r07_purch')
save(errors); await browser.close()
