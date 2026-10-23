// ラウンド9: 2 タブ。別のタブの変更で行の選択が外れた直後の続きのキー（数字・↓）と、確認ダイアログを開いたまま行が外れたとき
import { open, reset, gotoCell, snap, diffRows, sleep, saveJson, installToastLog, takeToasts, state } from './lib13.mjs'
const env = await open(Number(process.env.PORT ?? 5176)); const A = env.page; const out = []
const log = (o) => { out.push(o); console.log(JSON.stringify(o).slice(0, 1200)) }
async function tabB() { const B = await env.context.newPage(); await B.goto(env.url); await B.waitForSelector('[data-testid="grid"]'); await B.locator('.gridwrap').focus(); return B }
const S = async (pg) => { const s = await state(pg); return `${s.view}/${s.cursor}/${s.mode}${s.edit != null ? '[' + s.edit + ']' : ''}${s.panel ? '/' + s.panel : ''}` }
const panelText = () => A.evaluate(() => document.querySelector('[data-testid^="panel-"]')?.innerText?.replace(/\s+/g, ' ').slice(0, 160) ?? null)
// X1
{
  await reset(env); await gotoCell(A, 2, 'R030', 'ID'); await installToastLog(A); await takeToasts(A)
  await A.keyboard.press('Shift+Delete'); await sleep(150)
  const p0 = await panelText(); const a = await snap(A)
  const B = await tabB(); await gotoCell(B, 1, 'R030', 'ID'); await B.keyboard.press('h'); await sleep(300)
  await A.bringToFront(); await sleep(300); const s1 = await S(A); const p1 = await panelText()
  await A.keyboard.press('2'); await sleep(100); const p2 = await panelText(); if (p2) { await A.keyboard.press('Enter'); await sleep(100) }
  const b = await snap(A)
  log({ case: 'X1 A が R030 で Shift+Delete の確認を開いたまま → B が R030 を隠す → A 2', panelBefore: p0, afterB: s1, panelAfterB: p1, panelAfter2: p2, afterA: await S(A), diff: diffRows(a, b), toasts: (await takeToasts(A)).filter((t) => !t.startsWith('保存しました')) })
  await B.close()
}
// X2 / X3
for (const [name, keys] of [['X2 選択が外れた直後に 12 Enter（必要数のつもり）', ['1', '2', 'Enter']], ['X3 選択が外れた直後に ↓', ['ArrowDown']], ['X4 選択が外れた直後に Alt+h', ['Alt+h']]]) {
  await reset(env); await gotoCell(A, 2, 'R030', '必要数'); await installToastLog(A); await takeToasts(A)
  const a = await snap(A)
  const B = await tabB(); await gotoCell(B, 1, 'R030', 'ID'); await B.keyboard.press('h'); await sleep(300)
  await A.bringToFront(); await sleep(300); const s1 = await S(A)
  const seq = []
  for (const k of keys) { await A.keyboard.press(k); await sleep(80); seq.push(`${k}→${await S(A)}`) }
  const b = await snap(A)
  log({ case: name, afterB: s1, seq, diff: diffRows(a, b).filter((d) => !d.startsWith('R030.hidden')), toasts: (await takeToasts(A)).filter((t) => !t.startsWith('保存しました')) })
  await B.close()
}
saveJson('40-twotab3.json', out); await env.browser.close()
