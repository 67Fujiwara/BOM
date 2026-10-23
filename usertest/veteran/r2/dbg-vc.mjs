import { launch, fresh, setRole, goto, toCol, cursor, sleep, palette, toastNow, proj } from './lib.mjs'
const { browser, page, errors } = await launch()
await fresh(page)
await goto(page, 'R030'); await toCol(page, '部品名'); await page.keyboard.press('Enter'); await page.keyboard.press('Control+a'); await page.keyboard.type('設計の編集'); await page.keyboard.press('Enter')
const u = await page.evaluate(async () => { const m = await import('/src/model/store.ts'); const s = m.useStore.getState(); return Object.fromEntries(Object.entries(s.undo).map(([k, v]) => [k, v.map((e) => ({ label: e.label, rows: e.rows.map((c) => c.key), quotes: e.quotes.map((c) => c.key), proj: e.proj.map((c) => c.key), issues: e.issues.map((c) => c.key) }))])) })
console.log('after design edit', JSON.stringify(u))
await setRole(page, 'pm'); await page.keyboard.press('7'); await goto(page, 'R013'); await page.keyboard.press('y'); await sleep(50); await page.keyboard.type('受入OK'); await page.keyboard.press('Enter'); await sleep(50)
const u2 = await page.evaluate(async () => { const m = await import('/src/model/store.ts'); const s = m.useStore.getState(); return Object.fromEntries(Object.entries(s.undo).map(([k, v]) => [k, v.map((e) => ({ label: e.label, by: e.by, rows: e.rows.map((c) => c.key), quotes: e.quotes.map((c) => c.key), proj: e.proj.map((c) => c.key) }))])) })
console.log('after pm', JSON.stringify(u2))
await setRole(page, 'design'); await page.keyboard.press('1'); await page.keyboard.press('Control+z'); await sleep(50)
console.log(await toastNow(page))
// palette exact match check
await fresh(page, 'purchasing')
for (const q of ['見積回答を取り込む', '正式見積を依頼', '案件設定を確定', '行を削除', 'JSON を読み込む', '元に戻す', '公開', 'サンプルデータに戻す', '商社を追加', '先行発注を申請', 'ルールを追加', '履歴']) {
  await page.keyboard.press('Control+k'); await page.getByTestId('palette-input').fill(q); await sleep(30)
  const first = (await page.getByTestId('palette-list').locator('.item').first().textContent().catch(() => '')).slice(0, 50)
  console.log(q, '=>', first)
  await page.keyboard.press('Escape')
}
await browser.close()
