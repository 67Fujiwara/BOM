// 2 タブ（PM 同士）: B が下書きを持ったまま A が納期を保存 → B が予算を保存。A の納期は残るか
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
for (let i = 0; i < 3 && (await panel(A)); i++) { console.log('A panel', (await A.locator('[data-testid^="panel-"]').first().innerText()).slice(0, 200).replace(/\n/g, '|')); if (/変更理由/.test(await A.locator('[data-testid^="panel-"]').first().innerText())) await A.keyboard.type('A の理由'); await A.keyboard.press('Enter'); await sleep(80) }
console.log('A toast', (await toastNow(A)).slice(0, 120), (await proj(A)).dueDate)
await B.bringToFront(); console.log('B panel', await panel(B)); await B.keyboard.press('Control+Enter'); await sleep(150)
for (let i = 0; i < 3 && (await panel(B)); i++) { console.log('B panel', (await B.locator('[data-testid^="panel-"]').first().innerText()).slice(0, 200).replace(/\n/g, '|')); if (/変更理由/.test(await B.locator('[data-testid^="panel-"]').first().innerText())) await B.keyboard.type('B の理由'); await B.keyboard.press('Enter'); await sleep(80) }
const p = await proj(B)
console.log('B toast', 'events', JSON.stringify((await proj(B)).events.slice(-4).map(e=>e.text.slice(0,80))));console.log('B toast', (await toastNow(B)).slice(0, 120), p.dueDate, p.settings.budget, JSON.stringify(Object.keys(p.settings)).slice(0, 300))
await browser.close()
