// 06 の深掘り: 型式変更後の発注、発注済行の削除、同名担当者の Undo
import { launch, fresh, setRole, goto, toCol, cursor, mode, sleep, dumpErrors, save2, proj, row, panel, closeAll, palette, toastNow, ws } from './lib.mjs'
const { browser, page, errors } = await launch()
const out = []
const log = (o) => { out.push(o); console.log(JSON.stringify(o).slice(0, 900)) }
const opts = async () => page.getByTestId('prompt-options').textContent().catch(() => null)
// A: R013（正式見積済・差分超過）を設計が型式変更 → 公開 → PM 受入 → 購買が o
await fresh(page)
await goto(page, 'R013'); await toCol(page, '型式'); await page.keyboard.press('Enter'); await page.keyboard.press('Control+a'); await page.keyboard.type('NEW-013'); await page.keyboard.press('Enter')
await page.keyboard.press('Control+Enter'); await sleep(50); if (await opts()) await page.keyboard.press('Enter'); await sleep(80)
await setRole(page, 'pm'); await page.keyboard.press('7'); await goto(page, 'R013')
await page.keyboard.press('Enter'); await sleep(30)
const decisionPanel = await page.locator('[data-testid^="panel-"]').textContent().catch(() => null)
await page.keyboard.press('Escape')
await page.keyboard.press('y'); await sleep(30); const ptitle = await page.locator('[data-testid^="panel-"]').textContent().catch(() => null); await page.keyboard.type('OK'); await page.keyboard.press('Enter'); await sleep(40)
await setRole(page, 'purchasing'); await page.keyboard.press('3'); await goto(page, 'R013'); await page.keyboard.press('o'); await sleep(30)
const r = await row(page, 'R013')
const p = await proj(page)
log({ case: 'A: model changed after formal quote → order', decisionPanel: decisionPanel?.slice(0, 300), pmPromptTitle: ptitle?.slice(0, 120), oToast: (await toastNow(page)).slice(0, 120), status: r.status, ordered: r.ordered, model: r.model, adopted: r.adoptedSupplierId, flags: r.flags, validQuotes: p.quotes.filter((q) => q.rowId === 'R013' && !q.stale && q.unitPrice != null).length, amountCell: await page.locator('[data-row-id="R013"] td[data-col="amount"]').textContent().catch(() => null) })
// B: Alt+A 先行採用 → 型式変更 → PM 許可 → 購買 o
await fresh(page)
await goto(page, 'R076'); await toCol(page, '型式'); await page.keyboard.press('Enter'); await page.keyboard.type('M76'); await page.keyboard.press('Enter'); await goto(page, 'R076'); await toCol(page, 'メーカ'); await page.keyboard.press('Enter'); await page.keyboard.type('オムロン'); await page.keyboard.press('Enter'); await goto(page, 'R076'); await toCol(page, '部品名'); await page.keyboard.press('Enter'); await page.keyboard.type('N76'); await page.keyboard.press('Enter')
await page.keyboard.press('Control+Enter'); await sleep(50); if (await opts()) await page.keyboard.press('Enter'); await sleep(80)
await setRole(page, 'purchasing'); await page.keyboard.press('9'); await goto(page, 'R076'); await page.keyboard.press('Home'); for (let i = 0; i < 40; i++) { if ((await cursor(page)).endsWith('単価')) break; await page.keyboard.press('ArrowRight') } await page.keyboard.press('Enter'); await page.keyboard.type('100'); await page.keyboard.press('Tab'); await page.keyboard.type('5'); await page.keyboard.press('Enter')
await setRole(page, 'design'); await page.keyboard.press('1'); await goto(page, 'R076'); await page.keyboard.press('Alt+a'); await sleep(30)
await goto(page, 'R076'); await toCol(page, '型式'); await page.keyboard.press('Enter'); await page.keyboard.press('Control+a'); await page.keyboard.type('M76-CHANGED'); await page.keyboard.press('Enter'); await page.keyboard.press('Control+Enter'); await sleep(50); if (await opts()) await page.keyboard.press('Enter'); await sleep(80)
await setRole(page, 'pm'); await page.keyboard.press('7'); await goto(page, 'R076'); await page.keyboard.press('y'); await sleep(30); const t2 = await page.locator('[data-testid^="panel-"]').textContent().catch(() => null); await page.keyboard.type('OK'); await page.keyboard.press('Enter'); await sleep(40)
await setRole(page, 'purchasing'); await page.keyboard.press('3'); await goto(page, 'R076'); await page.keyboard.press('o'); await sleep(30)
const r2 = await row(page, 'R076')
log({ case: 'B: early adopt, model changed, PM allows, purchasing orders', pmPrompt: t2?.slice(0, 160), oToast: (await toastNow(page)).slice(0, 100), status: r2.status, ordered: r2.ordered, adopted: r2.adoptedSupplierId, model: r2.model, flags: r2.flags })
// C: 発注済の行を設計が Shift+Delete
await fresh(page)
await page.keyboard.press('Control+s')
{ const w = await ws(page); const rr = w.projects[0].rows.find((x) => x.id === 'R001'); rr.status = 'ordered'; rr.ordered = true; await page.evaluate((s) => localStorage.setItem('bom-pro.workspace.v2', s), JSON.stringify(w)); await page.reload(); await page.waitForSelector('[data-testid="grid"]'); await page.locator('.gridwrap').focus() }
await page.keyboard.press('1'); await goto(page, 'R001'); await page.keyboard.press('Shift+Delete'); await sleep(50)
log({ case: 'C: design Shift+Delete ordered R001', panel: await panel(page), opts: await opts(), toast: (await toastNow(page)).slice(0, 120), status: (await row(page, 'R001')).status })
await closeAll(page)
await setRole(page, 'purchasing'); await page.keyboard.press('1'); await goto(page, 'R001'); await page.keyboard.press('Shift+Delete'); await sleep(50)
log({ case: 'C2: purchasing Shift+Delete ordered R001', panel: await panel(page), opts: await opts(), toast: (await toastNow(page)).slice(0, 120), status: (await row(page, 'R001')).status })
await closeAll(page)
// D: 担当者「山田,佐藤,山田」→ 設計に切替 → PM に切替（名前）→ PM が決定 → 設計に切替 → Ctrl+Z
await fresh(page, 'pm')
await palette(page, '案件設定'); await sleep(40)
{ const f = await page.locator('[data-testid="settings"] .opt').allTextContents(); const i = f.findIndex((x) => x.includes('担当者')); for (let k = 0; k < i; k++) await page.keyboard.press('ArrowDown') }
await page.keyboard.press('Enter'); await page.getByTestId('settings-input').fill('山田,佐藤,山田'); await page.keyboard.press('Enter'); await page.keyboard.press('Control+Enter'); await sleep(60)
await closeAll(page)
await setRole(page, 'design'); await setRole(page, 'pm'); const pmName = (await ws(page)).user.name
await page.keyboard.press('7'); await goto(page, 'R013'); await page.keyboard.press('y'); await sleep(30); await page.keyboard.type('PM 承認'); await page.keyboard.press('Enter'); await sleep(30)
const d1 = (await proj(page)).decisions.length
await setRole(page, 'design'); await page.keyboard.press('1'); await page.keyboard.press('Control+z'); await sleep(40)
const d2 = (await proj(page)).decisions.length
log({ case: 'D: members same name, design Ctrl+Z', pmName, members: (await proj(page)).members, d1, d2, toast: (await toastNow(page)).slice(0, 100) })
save2('06b-abnormal.json', out)
dumpErrors(errors, '06b')
await browser.close()
