// ラウンド9: 修正で足されたキーの周り。絞り込み欄の F1、Ctrl+F をもう一度（絞り込み欄・パレット・ダイアログ・編集中）、
// 日本語配列（JIS）の Alt+@（物理キーは US の [ の位置）・Alt+[（US の ] の位置）、F1 の既定動作
import { open, reset, gotoCell, snap, diffRows, sleep, saveJson, state, cdpKey, installToastLog, takeToasts, installPrevLog, takePrevLog } from './lib20.mjs'
const port = Number(process.env.PORT ?? 5176)
const out = []
const env = await open(port); const pg = env.page
const cdp = await env.context.newCDPSession(pg)
const CTRLF = { key: 'f', code: 'KeyF', mods: 2, vk: 70 }
const F1 = { key: 'F1', code: 'F1', mods: 0, vk: 112 }
const CASES = [
  ['絞り込み欄で ab → F1', async () => { await pg.keyboard.press('Control+f'); await pg.keyboard.type('ab') }, F1],
  ['絞り込み欄で Ctrl+F（2 回目）', async () => { await pg.keyboard.press('Control+f'); await pg.keyboard.type('ab') }, CTRLF],
  ['パレットで Ctrl+F', async () => { await pg.keyboard.press('Control+k'); await pg.keyboard.type('ab') }, CTRLF],
  ['Ctrl+G の入力欄で Ctrl+F', async () => { await pg.keyboard.press('Control+g') }, CTRLF],
  ['編集中に Ctrl+F', async () => { await pg.keyboard.press('Enter'); await pg.keyboard.type('xy') }, CTRLF],
  ['ヘルプを開いて Ctrl+F', async () => { await pg.keyboard.press('F1') }, CTRLF],
  ['表で Ctrl+F', async () => {}, CTRLF],
  ['JIS Alt+@（code BracketLeft）', async () => {}, { key: '@', code: 'BracketLeft', mods: 1, vk: 192 }],
  ['JIS Alt+Shift+@（`）', async () => {}, { key: '`', code: 'BracketLeft', mods: 9, vk: 192 }],
  ['JIS Alt+[（code BracketRight）', async () => {}, { key: '[', code: 'BracketRight', mods: 1, vk: 219 }],
  ['JIS Alt+]（code Backslash）', async () => {}, { key: ']', code: 'Backslash', mods: 1, vk: 221 }],
  ['JIS Alt+:（code Quote）', async () => {}, { key: ':', code: 'Quote', mods: 1, vk: 186 }],
  ['US Alt+\\', async () => {}, { key: '\\', code: 'Backslash', mods: 1, vk: 220 }],
]
for (const [name, setup, k] of CASES) {
  await reset(env); await gotoCell(pg, 1, 'R040', '部品名')
  await setup(); await sleep(80)
  await installPrevLog(pg); await takePrevLog(pg); await installToastLog(pg); await takeToasts(pg)
  const a = await snap(pg); const s0 = await state(pg)
  await cdpKey(cdp, k); await sleep(150)
  const s1 = await state(pg); const b = await snap(pg)
  const prev = (await takePrevLog(pg)).find((x) => x.code === k.code)
  const rec = { name, before: `${s0.cursor}/${s0.mode}/${s0.panel}/${s0.active}/f=${s0.filter}`, after: `${s1.cursor}/${s1.mode}/${s1.panel}/${s1.active}/f=${s1.filter}${s1.edit != null ? '[' + s1.edit + ']' : ''}`, prevented: prev?.prevented, target: prev?.target, diff: diffRows(a, b), toasts: (await takeToasts(pg)).filter((t) => !t.startsWith('保存しました')) }
  out.push(rec); console.log(JSON.stringify(rec).slice(0, 600))
  for (let i = 0; i < 3; i++) await pg.keyboard.press('Escape')
}
console.log('errors', JSON.stringify(env.errs.slice(0, 5)))
saveJson('38-misc-keys.json', out); await env.browser.close()
