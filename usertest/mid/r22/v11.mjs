// v11: 購買の 4 要確認（期限切れの見積・未回答）
import { launch, check, log, summary } from './lib.mjs'
const t = await launch()
const { page } = t
await t.open('purchasing')
await t.press('6')
log(await t.setCellKey('R040', 'q.validUntil@S1', '2026-10-01')); await t.press('Escape')
const r40 = (await t.quotes('R040')).find((q) => q.supplierId === 'S1' && !q.stale); log('R040 S1 validUntil', r40.validUntil, 'ball', await t.cellText('R040', 'ball'))
await t.press('Escape'); await page.getByTestId('view-4').click(); await page.locator('.gridwrap').focus()
const v4 = await t.viewRows(); log('purchasing 4:', v4.join(','))
check('M3 購買の 4 に期限切れの見積がある行が出る（§11）', v4.includes('R040'))
// 未回答: 下書き行を公開 → 依頼 → 1 社だけ回答（見積中）
await t.role('design'); await t.press('Control+Enter'); await page.waitForTimeout(100); let pn = await t.panel(); if (pn?.kind === 'prompt') { await t.press('1'); await page.waitForTimeout(100); if ((await t.panel())?.kind === 'prompt') { await page.keyboard.press('Enter'); await page.waitForTimeout(100) } }
await t.role('purchasing'); await t.cmd('概算見積を依頼'); await page.waitForTimeout(60); await t.promptFill('2026-10-26'); await t.press('Enter'); await page.waitForTimeout(800); log(await t.toast())
await t.press('6'); log(await t.setCellKey('R076', 'q.unitPrice@S1', '100')); await t.press('Escape')
await page.getByTestId('view-4').click(); await page.locator('.gridwrap').focus()
log('purchasing 4 after quoting:', (await t.viewRows()).join(','), 'R076', await t.cellText('R076', 'status'))
summary(); await t.close()
