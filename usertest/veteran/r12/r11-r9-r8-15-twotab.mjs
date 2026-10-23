// ラウンド8: 2 タブ。別のタブ（B）の操作で A のカーソルの行がビューから消えた・動いたとき、A の続きの入力・コマンドはどの行に効くか
import { open, reset, gotoCell, snap, diffRows, sleep, saveJson, installToastLog, takeToasts, state } from './lib12.mjs'
const port = Number(process.env.PORT ?? 5176)
const env = await open(port); const A = env.page; const out = []
const log = (o) => { out.push(o); console.log(JSON.stringify(o).slice(0, 1200)) }
async function tabB() { const B = await env.context.newPage(); await B.goto(env.url); await B.waitForSelector('[data-testid="grid"]'); await B.locator('.gridwrap').focus(); return B }
async function back() { await A.bringToFront(); await sleep(300) }
const model = (pg, id) => pg.evaluate((id) => { const w = JSON.parse(localStorage.getItem('bom-pro.workspace.v2')); const p = w.projects.find((x) => x.id === w.currentProjectId); const r = p.rows.find((x) => x.id === id); return r.working?.model ?? r.model }, id)

// T1: A は 4 要確認の R005 型式。B が R005 の警告を確認済みに → R005 が A の 4 から消える → A が型式を打って Enter
{
  await reset(env); await gotoCell(A, 4, 'R005', '型式'); await installToastLog(A); await takeToasts(A)
  const B = await tabB(); await gotoCell(B, 1, 'R005', '型式'); await B.keyboard.press('Alt+x'); await sleep(300)
  await back(); const s0 = await state(A); const a = await snap(A)
  await A.keyboard.type('MY4N-D2 DC24', { delay: 30 }); await A.keyboard.press('Enter'); await sleep(150)
  const b = await snap(A)
  log({ case: 'T1 B が R005 を確認済み（A の 4 から消える）→ A が型式を打って Enter', cursorBeforeTyping: s0.cursor, diff: diffRows(a, b), toasts: await takeToasts(A) })
  await B.close()
}
// T2: A は 4 の R005 ID で x n を続けるつもり。B が先に R005 を確認済み → A の x はどの行に効くか
{
  await reset(env); await gotoCell(A, 4, 'R005', 'ID'); await installToastLog(A); await takeToasts(A)
  const B = await tabB(); await gotoCell(B, 1, 'R005', 'ID'); await B.keyboard.press('x'); await sleep(300)
  await back(); const s0 = await state(A); const a = await snap(A)
  await A.keyboard.press('x'); await sleep(100)
  const b = await snap(A)
  log({ case: 'T2 B が R005 を確認済み → A の ID 列で x', cursorBefore: s0.cursor, cursorAfter: (await state(A)).cursor, diff: diffRows(a, b), toasts: await takeToasts(A) })
  await B.close()
}
// T3: A は 2 の R030 部品名でナビ。B が R030 を隠す → A が Alt+Shift+D（複製）・Alt+h
for (const k of ['Alt+Shift+D', 'Alt+h', 'Shift+Delete']) {
  await reset(env); await gotoCell(A, 2, 'R030', '部品名'); await installToastLog(A); await takeToasts(A)
  const B = await tabB(); await gotoCell(B, 1, 'R030', '部品名'); await B.keyboard.press('Alt+h'); await sleep(300)
  await back(); const s0 = await state(A); const a = await snap(A)
  await A.keyboard.press(k); await sleep(150)
  const p = await state(A)
  const b = await snap(A)
  log({ case: `T3 B が R030 を隠す → A で ${k}`, cursorBefore: s0.cursor, panel: p.panel, cursorAfter: p.cursor, diff: diffRows(a, b), toasts: await takeToasts(A) })
  if (p.panel) await A.keyboard.press('Escape')
  await B.close()
}
// T4: A が R030 部品名を編集中（abc）。B が R030 を隠す → A が def Enter
{
  await reset(env); await gotoCell(A, 2, 'R030', '部品名'); await installToastLog(A); await takeToasts(A)
  const a = await snap(A)
  await A.keyboard.type('abc'); await sleep(50)
  const B = await tabB(); await gotoCell(B, 1, 'R030', '部品名'); await B.keyboard.press('Alt+h'); await sleep(300)
  await back(); const s0 = await state(A)
  await A.keyboard.type('def'); await sleep(50); const s1 = await state(A)
  await A.keyboard.press('Enter'); await sleep(150)
  const b = await snap(A); const s2 = await state(A)
  log({ case: 'T4 A が R030 を編集中 → B が R030 を隠す → A が def Enter', whileHidden: { mode: s0.mode, edit: s0.edit, cursor: s0.cursor }, afterDef: { mode: s1.mode, edit: s1.edit, editorVisible: await A.evaluate(() => !!document.querySelector('[data-testid="cell-editor"]')) }, afterEnter: { cursor: s2.cursor, mode: s2.mode }, diff: diffRows(a, b), toasts: await takeToasts(A) })
  await B.close()
}
// T5: A が R030 部品名を編集中。B が R030 を 1 つ下へ（Alt+↓）・R029 を削除 → A Enter
for (const op of ['move', 'delete-above']) {
  await reset(env); await gotoCell(A, 1, 'R030', '部品名'); await installToastLog(A); await takeToasts(A)
  const a = await snap(A)
  await A.keyboard.type('abc'); await sleep(50)
  const B = await tabB()
  if (op === 'move') { await gotoCell(B, 1, 'R030', 'ID'); await B.keyboard.press('Alt+ArrowDown') }
  else { await gotoCell(B, 1, 'R029', 'ID'); await B.keyboard.press('Shift+Delete'); await sleep(100); if (await B.evaluate(() => !!document.querySelector('[data-testid^="panel-"]'))) { await B.keyboard.press('2'); await B.keyboard.press('Enter') } }
  await sleep(300)
  await back(); await A.keyboard.type('def'); await A.keyboard.press('Enter'); await sleep(150)
  const b = await snap(A)
  log({ case: `T5 A が R030 を編集中 → B が ${op} → A が def Enter`, cursorAfter: (await state(A)).cursor, diff: diffRows(a, b), toasts: await takeToasts(A) })
  await B.close()
}
// T6: 4 で B が R054（必要数のエラー）を直す → A は R054 必要数の上で 7 Enter のつもり
{
  await reset(env); await gotoCell(A, 4, 'R054', '必要数'); await installToastLog(A); await takeToasts(A)
  const B = await tabB(); await gotoCell(B, 1, 'R054', '必要数'); await B.keyboard.type('5'); await B.keyboard.press('Enter'); await sleep(300)
  await back(); const s0 = await state(A); const a = await snap(A)
  await A.keyboard.type('7'); await A.keyboard.press('Enter'); await sleep(150)
  const b = await snap(A)
  log({ case: 'T6 B が R054 必要数を直す（A の 4 から消える）→ A が 7 Enter', cursorBefore: s0.cursor, diff: diffRows(a, b), toasts: await takeToasts(A) })
  await B.close()
}
// T7: A が R040 を隠す → B が R040 の部品名を変える → A Ctrl+Z → Ctrl+Y
{
  await reset(env); await gotoCell(A, 1, 'R040', 'ID'); await installToastLog(A); await takeToasts(A)
  const a = await snap(A)
  await A.keyboard.press('h'); await sleep(200)
  const B = await tabB(); await gotoCell(B, 1, 'R040', '部品名'); await B.keyboard.type('B-edit'); await B.keyboard.press('Enter'); await sleep(300)
  await back(); await A.keyboard.press('Control+z'); await sleep(150); const z = await snap(A)
  await A.keyboard.press('Control+y'); await sleep(150); const y = await snap(A)
  log({ case: 'T7 A 隠す → B 部品名 → A Ctrl+Z / Ctrl+Y', afterZ: diffRows(a, z), afterY: diffRows(a, y), toasts: await takeToasts(A) })
  await B.close()
}
log({ errors: env.errs.slice(0, 5) })
saveJson('r8-15-twotab.json', out); await env.browser.close()
