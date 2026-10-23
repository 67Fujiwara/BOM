// ラウンド4: おかしな瞬間のリロード、300 行の貼り付け（表の末尾から）と Undo
import { launch, fresh, goto, toColKey, mode, sleep, dumpErrors, save, panel, closeAll, toastNow, storeState, palette, URL } from './lib.mjs'
const { browser, page, errors } = await launch()
const out = {}
const rowOf = (id, k) => storeState(page, new Function('s', `const r = s.project().rows.find((x) => x.id === '${id}'); return r ? (r.working?.['${k}'] ?? r['${k}']) : null`))
const order = () => storeState(page, (s) => s.project().rows.map((r) => r.id))
async function reload() { await page.reload(); await page.waitForSelector('[data-testid="grid"], [data-testid="crash"]'); await sleep(200); await page.locator('.gridwrap').focus().catch(() => {}) }
if (!process.env.ONLY5)
// 1. 打ち始めで文字になった直後（編集中）にリロード
{
  await fresh(page); await page.keyboard.press('1'); await goto(page, 'R040'); await toColKey(page, 'name')
  for (const c of 'knob') { await page.keyboard.press(c); await sleep(45) }
  await reload()
  out.reloadMidBurst = { name: await rowOf('R040', 'name'), dialogs: errors.filter((e) => e.type === 'dialog').length, mode: await mode(page) }
  console.log('1', JSON.stringify(out.reloadMidBurst))
}
if (!process.env.ONLY5)
// 2. r のダイアログを開いたまま（型式を半分打って）リロード
{
  await fresh(page); await page.keyboard.press('1'); await goto(page, 'R040'); await toColKey(page, 'model')
  await page.keyboard.press('r'); await sleep(700); await page.keyboard.type('MY4N-HALF'); await reload()
  out.reloadInReplace = { rows: (await order()).length, R040: await rowOf('R040', 'model'), panel: await panel(page) }
  console.log('2', JSON.stringify(out.reloadInReplace))
}
if (!process.env.ONLY5)
// 3. Alt+↓ を 3 回 → すぐリロード → Ctrl+Z ×3 で元の並び
{
  await fresh(page); await page.keyboard.press('1'); await goto(page, 'R045')
  const o0 = await order()
  for (let i = 0; i < 3; i++) { await page.keyboard.press('Alt+ArrowDown'); await sleep(30) }
  const o1 = await order()
  await reload()
  const o2 = await order()
  for (let i = 0; i < 3; i++) { await page.keyboard.press('Control+z'); await sleep(60) }
  out.reloadAfterMoves = { movedPersisted: JSON.stringify(o1) === JSON.stringify(o2), undoneToStart: JSON.stringify(await order()) === JSON.stringify(o0), toast: (await toastNow(page)).slice(0, 60) }
  console.log('3', JSON.stringify(out.reloadAfterMoves))
}
if (!process.env.ONLY5)
// 4. JSON 読み込みの確認を開いたままリロード（何も変わらない）
{
  await fresh(page); await page.keyboard.press('Control+s')
  const w = await page.evaluate(() => localStorage.getItem('bom-pro.workspace.v2'))
  const j = JSON.parse(w); j.projects[0].id = 'P-X'; j.currentProjectId = 'P-X'
  await palette(page, 'JSON を読み込む'); await sleep(40)
  await page.evaluate((t) => { const el = document.querySelector('[data-testid="import-text"]'); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(el, t); el.dispatchEvent(new Event('input', { bubbles: true })) }, JSON.stringify(j))
  await page.getByTestId('import-text').focus(); await page.keyboard.press('Control+Enter'); await sleep(60)
  const p = await panel(page)
  await reload()
  out.reloadInImportConfirm = { panelBefore: p, project: await storeState(page, (s) => s.project().id) }
  console.log('4', JSON.stringify(out.reloadInImportConfirm))
}
// 5. 表の末尾（R080 の部品名）に 300 行 × 6 列を Ctrl+V → 行数・時間 → Ctrl+Z
{
  await fresh(page); await page.keyboard.press('1'); await goto(page, 'R080'); await toColKey(page, 'name')
  const lines = []; for (let i = 1; i <= 300; i++) lines.push([`貼付${i}`, `PM-${i}`, 'オムロン', String(i % 9 + 1), '個'].join('\t'))
  await page.evaluate((t) => navigator.clipboard.writeText(t), lines.join('\n'))
  const n0 = (await order()).length
  const t0 = Date.now(); await page.keyboard.press('Control+v'); await sleep(50)
  let p = await panel(page); let confirm = null
  if (p) { confirm = (await page.locator('[data-testid^="panel-"]').first().innerText()).replace(/\s+/g, ' ').slice(0, 200); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter'); await sleep(100) }
  const ms = Date.now() - t0
  const n1 = (await order()).length
  const toast = await toastNow(page)
  const last = await storeState(page, (s) => { const r = s.project().rows.at(-1); return [r.id, r.name, r.model] })
  const t1 = Date.now(); await page.keyboard.press('Control+z'); await sleep(50); const undoMs = Date.now() - t1
  out.paste300 = { n0, n1, ms, confirm, toast: toast.slice(0, 120), last, afterUndo: (await order()).length, undoMs, R080: await rowOf('R080', 'name') }
  console.log('5', JSON.stringify(out.paste300))
}
save('27-reload.json', out)
dumpErrors(errors, '27')
await browser.close()
