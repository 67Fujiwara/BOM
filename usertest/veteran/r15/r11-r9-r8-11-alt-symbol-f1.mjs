// ラウンド8: Alt+記号・F1 を場面ごとに（表の文字の列 / ID 列 / 編集中 / パレット / 絞り込み欄 / ヘルプ / 確認ダイアログ）。
// Windows・Linux の Alt+記号（key が記号のまま）と、macOS の Option+記号（key が ÷ ¿ “ ‘ ¯ ˘ に変わる）を CDP の実キーで。
import { open, reset, gotoCell, snap, diffRows, sleep, saveJson, installToastLog, takeToasts, state, cdpKey, installPrevLog, takePrevLog } from './lib15.mjs'
const port = Number(process.env.PORT ?? 5176)
const KEYS = [
  ['F1', { key: 'F1', code: 'F1', mods: 0, vk: 112 }],
  ['Alt+/', { key: '/', code: 'Slash', mods: 1, vk: 191 }],
  ['Alt+Shift+/ (?)', { key: '?', code: 'Slash', mods: 1 | 8, vk: 191 }],
  ['Alt+[', { key: '[', code: 'BracketLeft', mods: 1, vk: 219 }],
  ['Alt+]', { key: ']', code: 'BracketRight', mods: 1, vk: 221 }],
  ['Alt+Shift+, (<)', { key: '<', code: 'Comma', mods: 1 | 8, vk: 188 }],
  ['Alt+Shift+. (>)', { key: '>', code: 'Period', mods: 1 | 8, vk: 190 }],
  ['mac Option+/ (÷)', { key: '÷', code: 'Slash', mods: 1, vk: 191 }],
  ['mac Option+Shift+/ (¿)', { key: '¿', code: 'Slash', mods: 1 | 8, vk: 191 }],
  ['mac Option+[ (“)', { key: '“', code: 'BracketLeft', mods: 1, vk: 219 }],
  ['mac Option+] (‘)', { key: '‘', code: 'BracketRight', mods: 1, vk: 221 }],
  ['mac Option+Shift+, (¯)', { key: '¯', code: 'Comma', mods: 1 | 8, vk: 188 }],
  ['mac Option+Shift+. (˘)', { key: '˘', code: 'Period', mods: 1 | 8, vk: 190 }],
]
const CTX = ['部品名', 'ID', '編集中', 'パレット', '絞り込み欄', 'ヘルプ', '5 で部品名']
const out = []
const env = await open(port); const pg = env.page
const cdp = await env.context.newCDPSession(pg)
for (const ctx of CTX) for (const [name, k] of KEYS) {
  await reset(env)
  if (ctx === '5 で部品名') await gotoCell(pg, 5, 'R005', '部品名').catch(() => {})
  else await gotoCell(pg, 1, 'R040', ctx === 'ID' ? 'ID' : '部品名')
  if (ctx === '編集中') { await pg.keyboard.press('Enter'); await pg.keyboard.press('End'); await pg.keyboard.type('ab'); await sleep(30) }
  if (ctx === 'パレット') { await pg.keyboard.press('Control+k'); await sleep(60); await pg.keyboard.type('ab') }
  if (ctx === '絞り込み欄') { await pg.keyboard.press('Alt+/'); await sleep(60); await pg.keyboard.type('ab') }
  if (ctx === 'ヘルプ') { await pg.keyboard.press('F1'); await sleep(80) }
  await installPrevLog(pg); await takePrevLog(pg); await installToastLog(pg); await takeToasts(pg)
  const a = await snap(pg); const s0 = await state(pg)
  await cdpKey(cdp, k); await sleep(100)
  const s1 = await state(pg); const b = await snap(pg)
  const prev = (await takePrevLog(pg)).find((x) => x.key === k.key)
  const rec = { ctx, name, before: { cursor: s0.cursor, view: s0.view, panel: s0.panel, edit: s0.edit, active: s0.active }, after: { cursor: s1.cursor, view: s1.view, panel: s1.panel, mode: s1.mode, edit: s1.edit, filter: s1.filter, active: s1.active }, inputValue: await pg.evaluate(() => document.activeElement?.value ?? null), prevented: prev?.prevented ?? null, toasts: await takeToasts(pg), diff: diffRows(a, b) }
  out.push(rec); console.log(JSON.stringify(rec).slice(0, 700))
}
console.log('errors', JSON.stringify(env.errs.slice(0, 5)))
saveJson('r8-11-alt-symbol-f1.json', out); await env.browser.close()
