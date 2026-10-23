// ラウンド9: macOS の Option で作る文字（µ ø ≈ • ™ ∞ ° Ω ®）を、ナビ（編集を始める前）の文字を打てるセルで 1 文字目に打つ。【macOS】
// CDP の実キー（key＝作られた文字・code＝物理キー・Alt・text 付き）。続けて残りを打って Enter。値・状態・知らせ
import { open, reset, gotoCell, snap, diffRows, sleep, saveJson, state, cdpKey, installToastLog, takeToasts } from './lib11.mjs'
const port = Number(process.env.PORT ?? 5176)
const CASES = [
  ['design', '型式', { key: 'µ', code: 'KeyM', mods: 1, vk: 77, text: 'µ' }, 'PD720', 'µPD720（NEC の型番）'],
  ['design', '備考', { key: 'ø', code: 'KeyO', mods: 1, vk: 79, text: 'ø' }, '6 チューブ', 'ø6 チューブ'],
  ['design', '備考', { key: '≈', code: 'KeyX', mods: 1, vk: 88, text: '≈' }, '10mm', '≈10mm'],
  ['design', '備考', { key: '•', code: 'Digit8', mods: 1, vk: 56, text: '•' }, '予備', '• 予備'],
  ['design', '備考', { key: '™', code: 'Digit2', mods: 1, vk: 50, text: '™' }, 'X', '™X'],
  ['design', '規格', { key: 'Ω', code: 'KeyZ', mods: 1, vk: 90, text: 'Ω' }, '10', 'Ω10'],
  ['design', '規格', { key: '°', code: 'Digit8', mods: 9, vk: 56, text: '°' }, 'C', '°C'],
  ['design', '備考', { key: '®', code: 'KeyR', mods: 1, vk: 82, text: '®' }, 'mark', '®mark'],
  ['design', '備考', { key: '˙', code: 'KeyH', mods: 1, vk: 72, text: '˙' }, 'x', '˙x'],
  ['purchasing', 'ロット', { key: 'ø', code: 'KeyO', mods: 1, vk: 79, text: 'ø' }, '6', 'ø6'],
  ['design', '型式（編集中）', { key: 'µ', code: 'KeyM', mods: 1, vk: 77, text: 'µ' }, 'PD720', '編集中なら µ が入る（r8 で確認済）'],
]
const out = []
const env = await open(port); const pg = env.page
const cdp = await env.context.newCDPSession(pg)
for (const [role, col, k, rest, note] of CASES) {
  await reset(env, { role })
  const editing = col.endsWith('（編集中）')
  const ok = await gotoCell(pg, role === 'purchasing' ? 3 : 1, role === 'purchasing' ? 'R001' : 'R040', editing ? '型式' : col)
  if (editing) { await pg.keyboard.press('Enter'); await pg.keyboard.press('Control+a'); await pg.keyboard.press('Backspace') }
  await installToastLog(pg); await takeToasts(pg)
  const a = await snap(pg); const s0 = await state(pg)
  await cdpKey(cdp, k); await sleep(120)
  const s1 = await state(pg)
  await pg.keyboard.type(rest); await pg.keyboard.press('Enter'); await sleep(150)
  const b = await snap(pg); const s2 = await state(pg)
  const rec = { role, col, char: k.key, note, found: ok, start: s0.cursor, afterOption: `${s1.view}/${s1.cursor}/${s1.mode}${s1.edit != null ? '[' + s1.edit + ']' : ''}${s1.panel ? '/' + s1.panel : ''}`, after: `${s2.view}/${s2.cursor}/${s2.mode}`, diff: diffRows(a, b), toasts: (await takeToasts(pg)).filter((t) => !t.startsWith('保存しました')).slice(0, 3) }
  out.push(rec); console.log(JSON.stringify(rec).slice(0, 700))
  for (let i = 0; i < 3; i++) await pg.keyboard.press('Escape')
}
console.log('errors', JSON.stringify(env.errs.slice(0, 5)))
saveJson(`37-mac-option-nav-${port}.json`, out); await env.browser.close()
