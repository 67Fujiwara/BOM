// ラウンド9: 行を選んでいない状態（数字でビューを替えた直後／別のタブの変更で選択が外れた直後）で、あらゆるキーを 1 つずつ。
// データが変わったか・どの行に効いたか・知らせ。設計・購買・PM
import { open, reset, gotoCell, snap, diffRows, sleep, saveJson, state, installToastLog, takeToasts } from './lib13.mjs'
const KEYS = ['Enter', 'F2', 'Space', 'Shift+Enter', 'Shift+Delete', 'Delete', 'Backspace', 'Control+c', 'Control+v', 'Control+.', 'Control+z', 'Control+y', 'Control+d', 'Alt+h', 'Alt+x', 'Alt+Shift+D', 'Alt+Shift+I', 'Alt+a', 'Alt+o', 'Alt+i', 'Alt+w', 'Alt+r', 'Alt+f', 'Alt+s', 'Alt+ArrowUp', 'Alt+ArrowDown', 'Home', 'End', 'Tab', 'PageDown', 'Control+End', 'F8', 'Shift+F8', 'x', 'h', 'y', 'Shift+Y', 'Escape', 'Control+Enter', 'Control+Shift+C', 'F1']
const ROLES = (process.env.ROLES ?? 'design,purchasing,pm').split(',')
const port = Number(process.env.PORT ?? 5176)
const out = []
const env = await open(port); const pg = env.page
await env.context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: env.url }).catch(() => {})
for (const role of ROLES) for (const how of ['数字 4']) for (const k of KEYS) {
  await reset(env, { role })
  await pg.evaluate(() => navigator.clipboard.writeText('PASTED\tX').catch(() => {}))
  await pg.keyboard.press(how.slice(-1)); await sleep(40)
  await installToastLog(pg); await takeToasts(pg)
  const s0 = await state(pg); const a = await snap(pg)
  await pg.keyboard.press(k); await sleep(150)
  const s1 = await state(pg); const b = await snap(pg)
  const rec = { role, how, k, before: s0.cursor, after: { cursor: s1.cursor, view: s1.view, mode: s1.mode, panel: s1.panel }, diff: diffRows(a, b), toasts: (await takeToasts(pg)).filter((t) => !t.startsWith('保存しました')).slice(0, 2) }
  out.push(rec); console.log(JSON.stringify(rec).slice(0, 500))
  for (let i = 0; i < 3; i++) await pg.keyboard.press('Escape')
}
console.log('errors', JSON.stringify(env.errs.slice(0, 5)))
saveJson(`31-norow-keys.json`, out); await env.browser.close()
