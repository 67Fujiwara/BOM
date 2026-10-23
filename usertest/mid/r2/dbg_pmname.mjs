import { launch, log } from './lib.mjs'
const t = await launch(); const { page } = t
await t.open('design')
await t.cmd('新しいBOM')
await page.getByTestId('wizard-id').fill('P-2026-201'); await t.press('Enter'); await page.getByTestId('wizard-name').fill('名前確認'); await t.press('Enter')
await page.getByTestId('wizard-due').fill('2026-12-25'); await t.press('Enter'); await page.getByTestId('wizard-processDays').fill('7'); await t.press('Enter'); await t.press('Enter')
await page.getByTestId('wizard-buyer').fill('佐藤'); await t.press('Enter'); await t.press(' '); await t.press('Enter'); await t.press('1')
await page.getByTestId('wizard-paste').fill('制御\tリレー\tMY4N-D2 DC24\tオムロン\t4\t個\tKA1'); await t.press('Control+Enter'); await t.press('Enter'); await page.waitForTimeout(100)
await t.press('1'); await t.setCell('R001', '備考', '設計が書いた')
await t.role('pm'); log('PM user:', JSON.stringify((await t.ws()).user))
await t.press('Control+z'); await page.waitForTimeout(60)
log('PM Ctrl+Z →', await t.toast(), 'R001 note:', JSON.stringify((await t.row('R001')).note))
await t.close()
