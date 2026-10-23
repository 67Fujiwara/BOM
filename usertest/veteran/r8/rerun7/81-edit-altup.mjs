// ラウンド7: 編集中に Alt+↑ / Alt+↓ / Alt+← を押したとき（編集欄が消えて「編集」のまま？）。続けて打った文字と Enter の行き先
import { open, reset, gotoCell, snap, diffRows, sleep, saveJson } from './lib7.mjs'
const env = await open(Number(process.env.PORT ?? 5176)); const pg = env.page; const out = []
for (const k of ['Alt+ArrowUp', 'Alt+ArrowDown', 'Alt+ArrowLeft', 'Alt+ArrowRight', 'Alt+ArrowUp']) {
  await reset(env); await gotoCell(pg, 1, 'R040', '部品名')
  const a = await snap(pg)
  await pg.keyboard.type('abc'); await sleep(30)
  await pg.keyboard.press(k); await sleep(150)
  const b = await snap(pg)
  const focus = await pg.evaluate(() => ({ tag: document.activeElement?.tagName, cls: document.activeElement?.className, editor: !!document.querySelector('[data-testid="cell-editor"]'), url: location.href }))
  await pg.keyboard.type('XY'); await sleep(50)
  const c = await snap(pg)
  await pg.keyboard.press('Enter'); await sleep(150)
  const d = await snap(pg)
  const rec = { key: k, afterKey: { mode: b.mode, edit: b.edit, cursor: b.cursor, focus }, afterTypingXY: { mode: c.mode, edit: c.edit }, afterEnter: { cursor: d.cursor, diff: diffRows(a, d), toast: d.toast.slice(0, 60) } }
  out.push(rec); console.log(JSON.stringify(rec))
}
saveJson('81-edit-altup.json', out); await env.browser.close()
