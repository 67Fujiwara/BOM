import { launch, check, log } from './lib.mjs'
const t = await launch()
const { page } = t
await t.open('design')
// 4 要確認でのセル編集
await t.press('4'); await t.goto('R031'); await t.col('メーカ'); log('cursor:', await t.cursor(), 'cell:', await t.cell('R031', 'maker'))
await t.press('Enter'); log('mode:', await page.getByTestId('mode').textContent(), 'editor count:', await page.getByTestId('cell-editor').count())
await t.press('Control+a'); await t.type('オムロン'); log('editor value:', await page.getByTestId('cell-editor').inputValue().catch(() => 'n/a'))
await t.press('Enter'); await page.waitForTimeout(50)
log('after Enter: working=', JSON.stringify((await t.row('R031')).working), 'cell:', await t.cell('R031', 'maker').catch(() => '-'), 'toast:', await t.toast(), 'cursor:', await t.cursor())
check('DBG 4 要確認ビューでメーカを編集して確定できる', (await t.row('R031')).working?.maker === 'オムロン')
// 同じことを R016（型式あいまい）で
await t.goto('R016'); await t.col('型式'); await t.press('Enter'); await t.press('Control+a'); await t.type('CP30-BA 2P 1-M 10A'); await t.press('Enter'); await page.waitForTimeout(50)
log('R016 working=', JSON.stringify((await t.row('R016')).working))
// Shift+I の対象セルが計算列（状態）のとき
await t.role('purchasing'); await t.press('1'); await t.goto('R020'); await t.colKey('status'); await t.press('Shift+I'); await t.press('k'); await page.getByTestId('issue-text').fill('状態列で起票'); await t.press('Enter'); await page.waitForTimeout(50)
const iss = (await t.proj()).issues.at(-1); log('issue on status col:', iss.id, iss.field)
check('DBG 計算列（状態）にカーソルがあっても指摘セルは設計列（型式など）になる', iss.field !== 'status', String(iss.field))
// 要決定の期限列
await t.role('pm'); await t.press('7'); const due = await t.cell('R013', 'due').catch(() => '-'); const wait = await t.cell('R013', 'waiting').catch(() => '-'); log('R013 (差分超過) 期限:', JSON.stringify(due), '待ち:', wait)
check('DBG 7 の行に期限（載ってから 1 営業日）が出る', due.trim() !== '', JSON.stringify(due))
// Ctrl+P 受信箱
await t.press('Control+p'); await page.waitForTimeout(50); log('inbox:', (await page.getByTestId('inbox').textContent()).slice(0, 200)); await t.press('Enter'); await page.waitForTimeout(80); log('after Enter: view7?', await page.getByTestId('view-7').getAttribute('aria-current'), 'cursor:', await t.cursor())
// 役割切り替え（パレット）で氏名が入れられるか
await t.press('Control+k'); await page.getByTestId('palette-input').fill('役割を切り替え'); await t.press('Enter'); await page.waitForTimeout(50); log('role prompt:', await page.locator('[role=dialog]').textContent(), 'text input:', await page.getByTestId('prompt-text').count()); await t.press('Escape')
// 発注後変更依頼: 購買が発注済の行に h
await t.role('purchasing'); await t.press('1'); await t.goto('R013'); await t.press('o'); await page.waitForTimeout(50); await t.press('Shift+I'); await t.press('h'); await page.getByTestId('issue-text').fill('型式変更したい'); await t.press('Enter'); await t.press('Control+Enter'); await page.waitForTimeout(80)
log('h issue → ball:', await t.cell('R013', 'ball'), 'status:', await t.cell('R013', 'status'))
log('ERRORS:', t.errors)
await t.close()
