import { launch, check, log } from './lib.mjs'
const t = await launch()
const { page } = t
await t.open('pm')
// PM: 設計変更は PM 承認が必要 = はい
await t.cmd('案件設定'); await page.waitForTimeout(60)
for (let i = 0; i < 6; i++) await t.press('ArrowDown')
await t.press('Enter'); await page.getByTestId('settings-input').fill('はい'); await t.press('Enter'); await t.press('Control+Enter'); await page.waitForTimeout(60)
await page.getByTestId('prompt-text').fill('承認制にする'); await t.press('Enter'); await page.waitForTimeout(60)
log('changeNeedsPmApproval:', (await t.proj()).settings.changeNeedsPmApproval)
// 設計: R040 型式変更 / R041 メーカ未記入の指摘に対応（メーカ）＋R041 備考 → 混在
await t.role('design'); await t.press('1')
await t.setCell('R040', '型式', 'E32-D11 5M')
await t.setCell('R009', 'メーカ', 'IDEC') // 指摘 I-003 メーカ未記入 の対応
const nsub = (await t.proj()).submissions.length
for (let k = 0; k < 6; k++) { await t.press('Control+Enter'); await page.waitForTimeout(80); const tt = await t.toast(); if (/未確認の警告/.test(tt)) { const id = tt.match(/（(R\d+)/)[1]; await t.goto(id); await t.colKey('model'); await t.press('x') } else break }
const dlg = await t.dialog(); log('dlg', dlg.slice(0, 80)); if (/変更セット/.test(dlg)) { await t.press('Enter'); await page.waitForTimeout(100) }
log('publish →', await t.toast())
let p = await t.proj()
log('subs:', p.submissions.slice(nsub).map((s) => `Rev${s.rev} ${s.rowIds.join('/')} cs=${JSON.stringify(s.changeSet)}`))
log('R040:', JSON.stringify((await t.row('R040')).flags), (await t.row('R040')).model, 'R009 issue:', p.issues.filter((i) => i.rowId === 'R009').map((i) => i.status))
// 購買から見えるか
await t.role('purchasing'); await t.press('1')
log('purchasing R040 model:', await t.cell('R040', 'model'), 'status:', await t.cell('R040', 'status'))
check('S5b 承認待ちの変更は購買には「承認待ちの変更あり」だけ見え、新しい型式は見えない', !/5M/.test(await t.cell('R040', 'model')), await t.cell('R040', 'model'))
await t.press('5'); const v5 = await page.locator('[data-row-id]').evaluateAll((els) => els.map((e) => e.getAttribute('data-row-id'))); log('purchasing 5:', v5.join(','))
// PM 却下
await t.role('pm'); await t.press('7'); const v7 = await page.locator('[data-row-id]').evaluateAll((els) => els.map((e) => e.getAttribute('data-row-id'))); log('PM 7:', v7.join(','))
await t.goto('R040'); await t.press('Enter'); log('panel 変更セット:', await page.getByTestId('quickfix').textContent().catch(() => '')); await t.press('Escape')
await t.goto('R040'); await t.press('Shift+Y'); await page.waitForTimeout(50); await page.getByTestId('prompt-text').fill('今回は不要'); await t.press('Enter'); await page.waitForTimeout(80)
p = await t.proj(); const r40 = p.rows.find((r) => r.id === 'R040')
log('却下 →', await t.toast(), 'R040 model', r40.model, 'working', JSON.stringify(r40.working), 'flags', JSON.stringify(r40.flags), 'publishedRev', r40.publishedRev, 'sub', JSON.stringify(p.submissions.at(-1).changeSet), 'revoked', p.submissions.at(-1).revoked)
log('R040 quotes after 却下:', JSON.stringify(p.quotes.filter((q) => q.rowId === 'R040').map((q) => [q.supplierId, q.unitPrice, q.stale ? 'stale' : 'live'])), 'adopted', r40.adoptedSupplierId, 'status', r40.status)
check('S5b 却下後に元の見積が有効に戻る', p.quotes.filter((q) => q.rowId === 'R040' && !q.stale && q.unitPrice != null).length >= 2)
check('S5b 却下で公開を取り消し、作業中に戻る（型式は旧値、作業中に新値）', /2M/.test(r40.model) && /5M/.test(r40.working?.model ?? ''))
check('S5b 却下で再見積要フラグが残らない', !r40.flags.requote)
// ---- Undo/Redo が自分の操作だけか
await t.role('design'); await t.press('1')
await t.setCell('R050', '備考', '設計メモ1')
await t.role('purchasing'); await t.press('6'); await t.setCellKey('R050', 'q.unitPrice@S1', '999')
await t.role('design'); await t.press('1'); await t.press('Control+z'); await page.waitForTimeout(60)
log('design Ctrl+Z →', await t.toast(), 'R050 note:', JSON.stringify((await t.row('R050')).note), 'S1 price:', (await t.proj()).quotes.find((q) => q.rowId === 'R050' && q.supplierId === 'S1' && !q.stale).unitPrice)
await t.role('purchasing'); await t.press('Control+z'); await page.waitForTimeout(60)
log('purchasing Ctrl+Z →', await t.toast(), 'R050 note:', JSON.stringify((await t.row('R050')).note), 'S1 price:', (await t.proj()).quotes.find((q) => q.rowId === 'R050' && q.supplierId === 'S1' && !q.stale).unitPrice)
await t.press('Control+y'); await page.waitForTimeout(60); log('purchasing Ctrl+Y →', await t.toast(), (await t.proj()).quotes.find((q) => q.rowId === 'R050' && q.supplierId === 'S1' && !q.stale).unitPrice)
await t.press('Control+Shift+z'); await page.waitForTimeout(60); log('purchasing Ctrl+Shift+Z →', await t.toast())
// 他人が後から同じ行を変えた: 設計 R060 型式 → 購買 R060 発注数 → 設計 Ctrl+Z
await t.role('design'); await t.press('1'); await t.setCell('R060', '備考', 'X'); await t.role('purchasing'); await t.press('9'); await t.showCol('orderQty'); await t.press('9'); await t.setCellKey('R060', 'orderQty', '7')
await t.role('design'); await t.press('Control+z'); await page.waitForTimeout(60); log('design Ctrl+Z after other changed row →', await t.toast(), 'note', JSON.stringify((await t.row('R060')).note), 'oq', (await t.row('R060')).orderQty)
// PM 担当者未設定の新規案件で役割を切替えると PM の氏名は？
log('ERRORS:', t.errors, 'paletteMiss:', t.paletteMiss)
await t.close()
