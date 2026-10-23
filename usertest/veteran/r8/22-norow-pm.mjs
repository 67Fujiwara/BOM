// ラウンド8: 行を選んでいない状態 × 入力、PM・購買の「書ける列が無いビュー」で語を打ったとき（どの列でも 1 キー操作）
import { open, reset, gotoCell, snap, diffRows, sleep, saveJson, state, installToastLog, takeToasts } from './lib8.mjs'
const port = Number(process.env.PORT ?? 5176)
const env = await open(port); const pg = env.page; const out = []
const log = (o) => { out.push(o); console.log(JSON.stringify(o).slice(0, 900)) }
const INPUTS = [['語 Knowles', 'T:Knowles'], ['数字 4', '4'], ['記号 ?', '?'], ['記号 /x', 'T:/x'], ['記号 [', '['], ['記号 <5', 'T:<5'], ['F1', 'F1'], ['F8', 'F8'], ['Alt+h', 'Alt+h'], ['Enter', 'Enter'], ['Space', ' '], ['Delete', 'Delete'], ['Alt+/', 'Alt+/']]
async function setupState(name) {
  await reset(env)
  if (name === '起動直後') return
  if (name === '絞り込み 0 行') { await pg.keyboard.press('Alt+/'); await pg.keyboard.type('zzzzzz'); await pg.keyboard.press('Enter'); await sleep(50); return }
  if (name === '分類の見出し') { await pg.keyboard.press('ArrowDown'); await pg.keyboard.press('Home'); await pg.keyboard.press('['); await sleep(50); return }
  if (name === '1 で ↓ のあと Ctrl+↑（先頭）') { await pg.keyboard.press('Alt+1'); await pg.keyboard.press('ArrowDown'); await pg.keyboard.press('Control+ArrowUp'); return }
}
for (const st0 of ['起動直後', '絞り込み 0 行', '分類の見出し']) for (const [label, tok] of INPUTS) {
  await setupState(st0); await installToastLog(pg); await takeToasts(pg)
  const a = await snap(pg); const s0 = await state(pg)
  if (tok.startsWith('T:')) await pg.keyboard.type(tok.slice(2), { delay: 30 }); else await pg.keyboard.press(tok)
  await sleep(100); const s = await state(pg); const b = await snap(pg)
  log({ case: 'norow', st0, label, before: s0.cursor, after: { cursor: s.cursor, mode: s.mode, edit: s.edit, view: s.view, panel: s.panel, filter: s.filter }, diff: diffRows(a, b), toasts: (await takeToasts(pg)).filter((x) => !x.startsWith('保存しました')).slice(-2) })
  await pg.keyboard.press('Escape'); await pg.keyboard.press('Escape')
}
// PM: 7 の部品名、1 の部品名で y / Shift+Y / 4 / ? / 語
for (const [role, view, col, toks] of [['pm', 7, '部品名', ['y', 'Shift+Y', 'Enter', '4', '?', 'F1']], ['pm', 1, '部品名', ['T:Knowles']], ['pm', 1, '備考', ['T:hold']], ['purchasing', 4, '部品名', ['T:Knowles']], ['purchasing', 4, '型式', ['T:a1']], ['purchasing', 2, '部品名', ['T:hdx']], ['purchasing', 1, '部品名', ['T:Knowles']]]) {
  for (const t of toks) {
    await reset(env, { role }); await pg.keyboard.press(`Alt+${view}`); await sleep(40); await pg.keyboard.press('ArrowDown'); await pg.keyboard.press('Home')
    for (let i = 0; i < 40 && !(await state(pg)).cursor.endsWith(' ' + col); i++) await pg.keyboard.press('ArrowRight')
    await installToastLog(pg); await takeToasts(pg)
    const a = await snap(pg); const s0 = await state(pg)
    if (t.startsWith('T:')) await pg.keyboard.type(t.slice(2), { delay: 40 }); else await pg.keyboard.press(t)
    await sleep(120); const s = await state(pg); const b = await snap(pg)
    log({ case: 'role', role, view, col, key: t, before: s0.cursor, after: { cursor: s.cursor, mode: s.mode, view: s.view, panel: s.panel, filter: s.filter }, diff: diffRows(a, b), toasts: (await takeToasts(pg)).filter((x) => !x.startsWith('保存しました')).slice(-6) })
    await pg.keyboard.press('Escape'); await pg.keyboard.press('Escape')
  }
}
log({ errors: env.errs.slice(0, 5) })
saveJson('22-norow-pm.json', out); await env.browser.close()
