// ラウンド12 新規スクリプトの共通の打鍵（トークン）と記録
import { reset, sleep, state, installToastLog, takeToasts, snap, diffRows, cdpKey } from './lib22.mjs'
export const visOrder = (pg) => pg.evaluate(() => [...document.querySelectorAll('[data-testid="grid"] [data-row-id]')].map((e) => e.dataset.rowId).filter((x, i, a) => a.indexOf(x) === i))
export const toastNow = (pg) => pg.evaluate(() => (document.querySelector('[data-testid="toast-float"]') ?? document.querySelector('[data-testid="toast"]'))?.textContent?.slice(0, 260) ?? '')
export const NUMPAD = { 0: 96, 1: 97, 2: 98, 3: 99, 4: 100, 5: 101, 6: 102, 7: 103, 8: 104, 9: 105 }
export async function tok(env, t) {
  const pg = env.page
  if (t.startsWith('G:')) { await pg.keyboard.press('Control+g'); await pg.getByTestId('prompt-text').fill(t.slice(2)); return pg.keyboard.press('Enter') }
  if (t.startsWith('T:')) return pg.keyboard.type(t.slice(2))
  if (t.startsWith('F:')) { await pg.keyboard.press('Control+f'); await pg.keyboard.press('Control+a'); await pg.keyboard.type(t.slice(2)); return pg.keyboard.press('Enter') }
  if (t.startsWith('C:')) { await pg.keyboard.press('Home'); for (let i = 0; i < 60 && !(await state(pg)).cursor.endsWith(' ' + t.slice(2)); i++) await pg.keyboard.press('ArrowRight'); return }
  if (t.startsWith('PAL:')) { await pg.keyboard.press('Control+k'); await pg.getByTestId('palette-input').fill(t.slice(4)); await sleep(100); return pg.keyboard.press('Enter') }
  if (t.startsWith('NP:')) { env.cdp ??= await env.context.newCDPSession(pg); const d = t.slice(3); return cdpKey(env.cdp, { key: d, code: 'Numpad' + d, text: d, vk: NUMPAD[d] }) }
  if (t.startsWith('NPALT:')) { env.cdp ??= await env.context.newCDPSession(pg); const d = t.slice(6); return cdpKey(env.cdp, { key: d, code: 'Numpad' + d, mods: 1, vk: NUMPAD[d] }) }
  if (t.startsWith('REP:')) { const [n, k] = t.slice(4).split('*'); for (let i = 0; i < Number(n); i++) await pg.keyboard.press(k); return }
  if (t.startsWith('WAIT:')) return sleep(Number(t.slice(5)))
  if (t === 'RELOAD') { await pg.reload(); await pg.waitForSelector('[data-testid="grid"]'); await pg.locator('.gridwrap').focus(); return sleep(250) }
  return pg.keyboard.press(t)
}
export const fmt = (s) => `${s.view.replace('view-', 'v')}/${s.cursor || '(行なし)'}${s.mode !== 'ナビ' ? '(' + s.mode + (s.edit != null ? ':' + s.edit : '') + ')' : ''}${s.panel ? '[' + s.panel + ']' : ''}${s.filter ? '{f=' + s.filter + '}' : ''}`
/** 1 シナリオ: reset → view → toks を順に。各キーのあとの様子・トースト・データの差分 */
export async function scenario(env, log, name, { role = 'design', view = 1, toks = [], expect = '', n300 = false, quiet = false } = {}) {
  const pg = env.page
  await reset(env, { role, n300 }); if (view) { await pg.keyboard.press(`Alt+${view}`); await sleep(60) }
  await installToastLog(pg); await takeToasts(pg)
  const a = await snap(pg)
  const seq = [`start→${fmt(await state(pg))}`]
  for (const t of toks) {
    await tok(env, t); await sleep(80)
    if (quiet && !t.startsWith('F8') && !t.startsWith('Shift+F8') && t !== 'Enter') continue
    seq.push(`${t}→${fmt(await state(pg))}`)
  }
  await sleep(150)
  const b = await snap(pg)
  const rec = { name, expect, seq, diff: diffRows(a, b).slice(0, 6), toasts: (await takeToasts(pg)).filter((x) => !x.startsWith('保存しました')).slice(-4) }
  log(rec); return rec
}
