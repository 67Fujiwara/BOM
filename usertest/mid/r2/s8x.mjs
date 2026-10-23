import { launch, check, log } from './lib.mjs'
const t = await launch()
const { page } = t
await t.open('design')
// (a) 対応中（指摘セル未変更）は設計の 4 に残るか: R016 型式あいまい → 備考だけ変えて公開
await t.press('1'); await t.setCell('R016', '備考', '型式は確認中'); await t.goto('R016'); await t.colKey('model'); await t.press('x'); await page.waitForTimeout(40); log('ack R016 →', await t.toast())
await t.press('Control+Enter'); await page.waitForTimeout(80)
let d = await t.dialog(); if (/変更セット/.test(d)) { await t.press('Enter'); await page.waitForTimeout(80) }
d = await t.dialog(); if (/Rev/.test(d)) { await t.press('Enter'); await page.waitForTimeout(80) }
log('publish →', await t.toast())
let p = await t.proj(); log('R016 issue:', p.issues.filter((i) => i.rowId === 'R016').map((i) => i.status))
await t.press('4'); const v4 = await page.locator('[data-row-id]').evaluateAll((els) => els.map((e) => e.getAttribute('data-row-id')))
check('S8 対応中（指摘セル未変更）の行が設計の 4 に残る', v4.includes('R016'), v4.join(','))
// (b) 4 の行数とランプ「設計待ち」の差
log('design 4 count:', v4.length, 'lamps:', await t.lamps())
// (c) 廃番 R022 の提案適用 → 購買が Ctrl+. で商社ごとの 1/2/3
await t.goto('R022'); await t.colKey('model'); await t.press('Control+.'); log('qf R022:', await page.getByTestId('quickfix').textContent().catch(() => t.toast()))
await t.press('1'); await page.waitForTimeout(100)
p = await t.proj(); const nr = p.rows.find((r) => r.replaces === 'R022'); log('new', nr?.id, nr?.status, JSON.stringify(nr?.flags), 'quotes', JSON.stringify(p.quotes.filter((q) => q.rowId === nr?.id && !q.stale).map((q) => [q.supplierId, q.unitPrice, q.reconfirm])))
if ((await page.getByTestId('mode').textContent()) === '編集') await t.press('Escape')
await t.press('Control+Enter'); await page.waitForTimeout(80); d = await t.dialog(); if (/変更セット/.test(d)) { await t.press('Enter'); await page.waitForTimeout(80) } d = await t.dialog(); if (/Rev/.test(d)) { await t.press('Enter'); await page.waitForTimeout(80) }
log('publish2 →', await t.toast(), (await t.row(nr.id)).status)
await t.role('purchasing'); await t.press('5'); await t.goto(nr.id); await t.press('Control+.'); const qf = await page.getByTestId('quickfix').textContent().catch(async () => 'NO PANEL: ' + await t.toast()); log('purchasing Ctrl+. on proposal row:', qf)
check('S8 提案適用の新行で購買が Ctrl+. から商社ごとに 据え置き/再見積/提案値で確定 を選べる', /据え置き/.test(qf) && /提案値で確定/.test(qf), qf)
await t.press('Escape')
await t.press(' '); await t.press('ArrowDown'); await t.press('ArrowDown'); await t.press('Enter'); log('Space→見積→Enter panel:', await page.getByTestId('quickfix').textContent().catch(() => t.toast())); await t.press('Escape'); await t.press('Escape')
// (d) x で回答済の指摘を受け入れ → 見送り
await t.role('design'); await t.press('1'); await t.goto('R041'); await t.press(' '); await t.press('ArrowDown'); await t.press('Enter'); await t.press('2'); await page.waitForTimeout(40); await page.getByTestId('prompt-text').fill('メーカは客先支給品のため空欄'); await t.press('Enter'); await page.waitForTimeout(60); await t.press('Escape')
await t.role('purchasing'); await t.press('4'); await t.goto('R041'); log('hint:', (await t.status()).match(/x[^?]{0,20}/)?.[0]); await t.press('x'); await page.waitForTimeout(50)
p = await t.proj(); log('R041 issue after x:', p.issues.filter((i) => i.rowId === 'R041').map((i) => i.status + ':' + i.resolution))
// (e) パレット: 「JSON を書き出す」と打って Enter
await t.role('design'); await t.press('1'); await t.setCell('R045', '備考', '未公開の変更')
const subs0 = (await t.proj()).submissions.length
await t.press('Control+k'); await page.getByTestId('palette-input').fill('JSON を書き出す'); await page.waitForTimeout(80)
log('palette first:', (await page.getByTestId('palette-list').locator('.item').first().textContent()))
const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 2000 }).catch(() => null), t.press('Enter')])
await page.waitForTimeout(150)
log('Enter →', await t.toast(), '| dialog:', (await t.dialog()).slice(0, 60), '| download:', !!dl, '| subs', subs0, '→', (await t.proj()).submissions.length)
await t.shot('s8-palette-json')
if (await t.dialog()) await t.press('Escape')
// (f) 期限超過・待ち日数が列で見える（8・7 以外）
await t.press('1'); log('header cols view1:', (await page.locator('thead th').allTextContents()).join('|'))
// (g) 見積回答の取込で 2週・1,200円
await t.role('purchasing')
await t.cmd('見積回答を取り込む', '見積回答を取り込む'); await t.press('1'); await page.waitForTimeout(60)
await page.getByTestId('import-text').fill(['行ID\t型式\t単価\t納期\tMOQ\t在庫区分\t見積数量\t有効期限', 'R060\tAB150\t1,200円\t2週\t\t取寄\t\t2026-12-31'].join('\n'))
await t.press('Control+Enter'); await page.waitForTimeout(100)
p = await t.proj(); log('import →', await t.toast(), JSON.stringify(p.quotes.find((q) => q.rowId === 'R060' && q.supplierId === 'S1' && !q.stale)))
await t.press('6'); log('R060 S1 cells:', await t.cell('R060', 'q.unitPrice@S1'), await t.cell('R060', 'q.leadDays@S1'))
await t.shot('s8-import-nan')
log('ERRORS:', t.errors, 'paletteMiss:', t.paletteMiss)
await t.close()
