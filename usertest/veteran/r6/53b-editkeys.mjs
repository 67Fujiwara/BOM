// 編集中の Alt+Enter / F8 / Alt+x / Alt+n / Backspace（実打鍵、ASCII で）
import { open, reset, gotoCell, snap, diffRows, sleep, saveJson } from './lib6.mjs'
const env = await open(Number(process.env.PORT ?? 5173)); const pg = env.page; const out = []
for (const k of ['Alt+Enter', 'F8', 'Shift+F8', 'Alt+KeyX', 'Alt+KeyN', 'Alt+KeyH', 'Control+Alt+KeyA', 'Alt+ArrowDown']) {
  await reset(env); await gotoCell(pg, 1, 'R040', '備考')
  const a = await snap(pg)
  await pg.keyboard.type('abc'); await pg.keyboard.press(k); await pg.keyboard.type('de'); await sleep(100)
  const b = await snap(pg)
  const o = { key: k, mode: b.mode, edit: b.edit, cursor: b.cursor, diff: diffRows(a, b), toast: b.toast }
  out.push(o); console.log(JSON.stringify(o))
}
// 実打鍵: 英字 1 字 → Backspace / Esc（V5-05）
for (const [w, k] of [['h', 'Backspace'], ['h', 'Escape'], ['A', 'Enter'], ['h', 'Delete']]) {
  await reset(env); await gotoCell(pg, 1, 'R040', '備考')
  const a = await snap(pg)
  await pg.keyboard.press(w === 'A' ? 'Shift+KeyA' : 'KeyH'); await pg.keyboard.press(k); await sleep(100)
  const b = await snap(pg)
  const o = { seq: w + ' ' + k, mode: b.mode, edit: b.edit, cursor: b.cursor, diff: diffRows(a, b), toast: b.toast }
  out.push(o); console.log(JSON.stringify(o))
}
saveJson('53b-editkeys.json', out); console.log(env.errs); await env.browser.close()
