import { launch, fresh, setRole, palette, sleep, panel, toastNow, proj, URL, closeAll } from './lib.mjs'
const { browser, context, page: A } = await launch()
await fresh(A, 'pm')
const B = await context.newPage(); await B.goto(URL); await B.waitForSelector('[data-testid="grid"]'); await B.locator('.gridwrap').focus(); await setRole(B, 'pm')
const open = async (pg, label, v) => {
  await pg.bringToFront(); await closeAll(pg); await palette(pg, '案件設定'); await sleep(40)
  const f = await pg.locator('[data-testid="settings"] .opt').allTextContents(); const i = f.findIndex((x) => x.includes(label))
  console.log('fields', f.length, i, f[i])
  for (let k = 0; k < i; k++) await pg.keyboard.press('ArrowDown')
  await pg.keyboard.press('Enter'); await pg.getByTestId('settings-input').fill(v); await pg.keyboard.press('Enter'); await sleep(30)
  console.log('after field enter', (await toastNow(pg)).slice(0, 80), await pg.getByTestId('settings-input').count())
}
await open(B, '予算', '3000000')
await open(A, '案件納期', '2027-06-30'); await A.keyboard.press('Control+Enter'); await sleep(100)
for (let i = 0; i < 3 && (await panel(A)); i++) { console.log('A panel', (await A.locator('[data-testid^="panel-"]').first().innerText()).slice(0, 200).replace(/\n/g, '|')); await A.keyboard.press('ArrowDown'); await A.keyboard.press('Enter'); await sleep(80) }
console.log('A toast', (await toastNow(A)).slice(0, 120), (await proj(A)).dueDate)
await B.bringToFront(); console.log('B panel', await panel(B)); await B.keyboard.press('Control+Enter'); await sleep(150)
for (let i = 0; i < 3 && (await panel(B)); i++) { console.log('B panel', (await B.locator('[data-testid^="panel-"]').first().innerText()).slice(0, 200).replace(/\n/g, '|')); await B.keyboard.press('ArrowDown'); await B.keyboard.press('Enter'); await sleep(80) }
const p = await proj(B)
console.log('B toast', (await toastNow(B)).slice(0, 120), p.dueDate, p.settings.budget, JSON.stringify(Object.keys(p.settings)).slice(0, 300))
await browser.close()
