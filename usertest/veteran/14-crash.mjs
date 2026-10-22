import { launch, fresh, setRole, goto, toCol, cursor, mode, toast, dumpErrors, shot, save, sleep } from './lib.mjs'
import { stateSafe } from './lib2.mjs'
const { browser, page, errors } = await launch()
const out = []
const log = (o) => { out.push(o); console.log(JSON.stringify(o).slice(0, 600)) }
const proj = async () => { const ws = await stateSafe(page); return ws.projects.find((x) => x.id === ws.currentProjectId) }
const panel = () => page.evaluate(() => document.querySelector('[data-testid^="panel-"]')?.dataset.testid ?? null)
// budget NaN via settings (PM)
await fresh(page, 'pm')
await page.keyboard.press('Control+k'); await page.getByTestId('palette-input').fill('案件設定'); await page.keyboard.press('Enter'); await sleep(50)
for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter'); await page.getByTestId('settings-input').fill('百万'); await page.keyboard.press('Enter'); await page.keyboard.press('Control+Enter'); await sleep(50); await page.getByTestId('prompt-text').fill('予算'); await page.keyboard.press('Enter'); await sleep(300)
log({ case: 'budget 百万 via settings', root: await page.evaluate(() => document.getElementById('root').innerHTML.length), pageerrors: errors.filter((e) => e.type === 'pageerror').map((e) => e.text + ' | ' + e.stack.split('\n').slice(0, 3).join(' / ')) })
await shot(page, '14-budget-nan')
await page.reload(); await page.waitForSelector('[data-testid="grid"]', { timeout: 5000 }).catch(() => {})
log({ case: 'reload after budget NaN', grid: await page.getByTestId('grid').count(), budget: (await stateSafe(page)).projects[0].settings.budget })
// budget NaN via wizard
await fresh(page)
await page.keyboard.press('Control+k'); await page.getByTestId('palette-input').fill('新しいBOM'); await page.keyboard.press('Enter')
await page.getByTestId('wizard-id').fill(' '); await page.keyboard.press('Enter'); await page.getByTestId('wizard-name').fill('<b>名</b>'); await page.keyboard.press('Enter'); await page.getByTestId('wizard-due').fill('2026/13/45'); await page.keyboard.press('Enter'); await page.getByTestId('wizard-processDays').fill('abc'); await page.keyboard.press('Enter'); await page.getByTestId('wizard-budget').fill('1e6'); await page.keyboard.press('Enter'); await page.keyboard.press('Enter'); await page.keyboard.press('Enter')
await page.getByTestId('wizard-paste').fill('部品名\t型式\n' + 'リレー\tMY4N\n' + '\t\n' + 'ソケット'); await page.keyboard.press('Control+Enter'); await page.keyboard.press('Enter'); await sleep(200)
const pw = await proj()
log({ case: 'wizard weird inputs (budget 1e6)', id: JSON.stringify(pw.id), name: pw.name, due: pw.dueDate, processDays: pw.settings.processDays, budget: pw.settings.budget, rows: pw.rows.map((r) => [r.name, r.model, r.qtyNeeded]), header: (await page.getByTestId('header').textContent()).slice(0, 90), pageerrors: errors.filter((e) => e.type === 'pageerror').length })
await shot(page, '14-wizard-weird')
// due 2026/13/45 effects: needDate column, daysLeft
await page.keyboard.press('1'); log({ case: 'needDate cell with due 2026/13/45', cell: await page.locator('[data-row-id="R001"] td[data-col="needDate"]').textContent().catch(() => null), due: (await page.getByTestId('due').textContent()) })
// wizard id with slash / existing sample id lowercase
await page.keyboard.press('Control+k'); await page.getByTestId('palette-input').fill('新しいBOM'); await page.keyboard.press('Enter')
await page.getByTestId('wizard-id').fill('p-2026-041'); await page.keyboard.press('Enter'); await page.getByTestId('wizard-name').fill('小文字'); await page.keyboard.press('Enter'); for (let i = 0; i < 5; i++) await page.keyboard.press('Enter'); await page.keyboard.press('Tab'); await page.keyboard.press('3'); await page.keyboard.press('Enter'); await page.keyboard.press('Enter'); await sleep(100)
log({ case: 'wizard id lowercase dup', projects: (await stateSafe(page)).projects.map((p) => p.id) })
// weights abc via settings
await setRole(page, 'pm'); await page.keyboard.press('Control+k'); await page.getByTestId('palette-input').fill('案件設定'); await page.keyboard.press('Enter'); await sleep(50)
for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter'); await page.getByTestId('settings-input').fill('abc'); await page.keyboard.press('Enter'); await page.keyboard.press('Control+Enter'); await sleep(100); await page.keyboard.press('Enter'); await sleep(50); await page.getByTestId('prompt-text').fill('重み').catch(() => {}); await page.keyboard.press('Enter'); await sleep(200)
log({ case: 'weights abc', weights: (await proj()).weights, root: await page.evaluate(() => document.getElementById('root').innerHTML.length), pageerrors: errors.filter((e) => e.type === 'pageerror').map((e) => e.text.slice(0, 100)) })
for (let i = 0; i < 3 && (await panel()); i++) await page.keyboard.press('Escape')
await page.keyboard.press('Control+p'); await sleep(50); await page.keyboard.press('Enter'); await sleep(50); await page.keyboard.press('1'); await goto(page, 'R020'); await page.keyboard.press('Space'); await sleep(50)
log({ case: 'detail with NaN weights', scores: (await page.locator('table.quotes tbody tr').allTextContents()).slice(0, 2), header: (await page.getByTestId('header').textContent()).slice(0, 60) })
await page.keyboard.press('a'); log({ case: 'a with NaN weights', toast: await toast(page), adopted: (await proj()).rows.find((r) => r.id === 'R020').adoptedSupplierId, score: (await proj()).rows.find((r) => r.id === 'R020').scoreSnapshot })
// processDays huge / negative / holidays garbage
await page.keyboard.press('Control+k'); await page.getByTestId('palette-input').fill('案件設定'); await page.keyboard.press('Enter'); await sleep(50)
for (let i = 0; i < 2; i++) await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter'); await page.getByTestId('settings-input').fill('-5'); await page.keyboard.press('Enter'); await page.keyboard.press('Control+Enter'); await sleep(100); await page.keyboard.press('Enter'); await sleep(50); await page.getByTestId('prompt-text').fill('工程').catch(() => {}); await page.keyboard.press('Enter'); await sleep(200)
log({ case: 'processDays -5', pd: (await proj()).settings.processDays, due: await page.getByTestId('due').textContent(), pageerrors: errors.filter((e) => e.type === 'pageerror').length })
for (let i = 0; i < 3 && (await panel()); i++) await page.keyboard.press('Escape')
await setRole(page, 'purchasing'); await page.keyboard.press('Control+k'); await page.getByTestId('palette-input').fill('案件設定'); await page.keyboard.press('Enter'); await sleep(50)
const fields = await page.locator('[data-testid="settings"] .opt').allTextContents(); const hi = fields.findIndex((f) => f.includes('休日')); for (let i = 0; i < hi; i++) await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter'); await page.getByTestId('settings-input').fill('あした, 2026-13-01,,x'); await page.keyboard.press('Enter'); await page.keyboard.press('Control+Enter'); await sleep(100); await page.getByTestId('prompt-text').fill('休日').catch(() => {}); await page.keyboard.press('Enter'); await sleep(200)
log({ case: 'holidays garbage', h: (await proj()).settings.holidays, pageerrors: errors.filter((e) => e.type === 'pageerror').length })
for (let i = 0; i < 3 && (await panel()); i++) await page.keyboard.press('Escape')
const ci = fields.findIndex((f) => f.includes('通貨')); await page.keyboard.press('Control+k'); await page.getByTestId('palette-input').fill('案件設定'); await page.keyboard.press('Enter'); await sleep(50); for (let i = 0; i < ci; i++) await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter'); await page.getByTestId('settings-input').fill('<script>x</script>'); await page.keyboard.press('Enter'); await page.keyboard.press('Control+Enter'); await sleep(100); await page.getByTestId('prompt-text').fill('通貨').catch(() => {}); await page.keyboard.press('Enter'); await sleep(200)
log({ case: 'currency script', money: await page.getByTestId('money').textContent(), title: await page.title() })
for (let i = 0; i < 3 && (await panel()); i++) await page.keyboard.press('Escape')
const qi = fields.findIndex((f) => f.includes('見積完了条件')); await page.keyboard.press('Control+k'); await page.getByTestId('palette-input').fill('案件設定'); await page.keyboard.press('Enter'); await sleep(50); for (let i = 0; i < qi; i++) await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter'); await page.getByTestId('settings-input').fill('nonsense'); await page.keyboard.press('Enter'); await page.keyboard.press('Control+Enter'); await sleep(100); await page.getByTestId('prompt-text').fill('x').catch(() => {}); await page.keyboard.press('Enter'); await sleep(200)
log({ case: 'quoteCompleteRule nonsense', v: (await proj()).settings.quoteCompleteRule, pageerrors: errors.filter((e) => e.type === 'pageerror').length })
save('14-crash.json', out)
dumpErrors(errors, 'crash')
await browser.close()
