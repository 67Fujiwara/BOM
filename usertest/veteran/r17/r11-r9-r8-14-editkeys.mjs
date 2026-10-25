// ラウンド8: 編集中（値を打っている途中）に F8・F1・Alt+英字・Alt+記号・Alt+数字を押したとき、入力はどうなるか
import { open, reset, gotoCell, snap, diffRows, sleep, saveJson, installToastLog, takeToasts, state, installPrevLog, takePrevLog } from './lib17.mjs'
const port = Number(process.env.PORT ?? 5176)
const env = await open(port); const pg = env.page; const out = []
for (const k of ['F8', 'Shift+F8', 'F1', 'Alt+x', 'Alt+n', 'Alt+h', 'Alt+4', 'Alt+/', 'Alt+Shift+Slash', 'Alt+BracketRight', 'Control+.', 'Control+k', 'F2', 'Alt+ArrowUp', 'Alt+ArrowDown']) for (const col of ['備考', '必要数']) {
  await reset(env); await gotoCell(pg, 1, 'R040', col)
  await installToastLog(pg); await takeToasts(pg); await installPrevLog(pg); await takePrevLog(pg)
  const a = await snap(pg)
  await pg.keyboard.type(col === '必要数' ? '42' : 'abc'); await sleep(40)
  await pg.keyboard.press(k); await sleep(120)
  const s = await state(pg)
  await pg.keyboard.type('Z'); await sleep(40)
  const s2 = await state(pg)
  const b = await snap(pg)
  const prev = (await takePrevLog(pg)).filter((x) => !['a', 'b', 'c', '4', '2', 'Z'].includes(x.key)).map((x) => `${x.key}:${x.prevented}`)
  const rec = { col, key: k, afterKey: { mode: s.mode, edit: s.edit, cursor: s.cursor, view: s.view, panel: s.panel, filter: s.filter }, afterZ: { mode: s2.mode, edit: s2.edit, cursor: s2.cursor, panel: s2.panel, filter: s2.filter }, prev, diff: diffRows(a, b), toasts: (await takeToasts(pg)).filter((x) => !x.startsWith('保存しました')) }
  out.push(rec); console.log(JSON.stringify(rec).slice(0, 800))
}
console.log('errors', JSON.stringify(env.errs.slice(0, 5)))
saveJson('r8-14-editkeys.json', out); await env.browser.close()
