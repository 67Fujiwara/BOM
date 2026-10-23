// ラウンド6（ベテラン）共通部品。letterlib（r5）の open/reset/gotoCell/snap/diffRows に、修飾キー付きのページ内打鍵と
// 「既定動作を止めたか（defaultPrevented）」の記録を足したもの。
import fs from 'node:fs'
import { reset as reset0 } from './rerun5/letterlib.mjs'
export async function reset(env, o) { for (let i = 0; ; i++) { try { await env.page.keyboard.press("Escape").catch(() => {}); await env.page.keyboard.press("Escape").catch(() => {}); return await reset0(env, o) } catch (e) { if (i >= 3) throw e; await new Promise((r) => setTimeout(r, 500)) } } }
export { open, gotoCell, snap, diffRows, panelOf, cursorText, sleep, LS } from './rerun5/letterlib.mjs'
export const OUT = '/home/user/BOM/usertest/veteran/r6'
export const saveJson = (name, data) => fs.writeFileSync(`${OUT}/${name}`, JSON.stringify(data, null, 2))

/** トークン: 'x'（英字・数字）、'A-x'（Alt+x）、'A-S-i'（Alt+Shift+I）、'C-A-a'（Ctrl+Alt+A）、'F8'、'S-F8'、'Enter' など */
export function evInit(tok) {
  const parts = tok.split('-')
  let base = parts.pop()
  if (base === '' ) base = '-'
  const mods = new Set(parts)
  const alt = mods.has('A'), ctrl = mods.has('C'), shift = mods.has('S') || /^[A-Z]$/.test(base)
  let key = base, code = base
  if (/^[a-zA-Z]$/.test(base)) { code = 'Key' + base.toUpperCase(); key = shift ? base.toUpperCase() : base.toLowerCase() }
  else if (/^\d$/.test(base)) code = 'Digit' + base
  else if (base === ' ') code = 'Space'
  else if (base === '-') code = 'Minus'
  return { key, code, altKey: alt, ctrlKey: ctrl, shiftKey: shift, bubbles: true, cancelable: true }
}
/** ページ内で予定時刻にキーを発生させる（seq: [[tok, gapBeforeMs], ...]）。各キーの defaultPrevented も返す */
export async function typeSeqM(page, seq) {
  const inits = seq.map(([t, g]) => [evInit(t), g])
  return page.evaluate(async (seq) => {
    const t0 = performance.now()
    let acc = 0
    const res = []
    await new Promise((resolve) => {
      seq.forEach(([init, gap], i) => {
        acc += gap
        setTimeout(() => {
          const e = new KeyboardEvent('keydown', init)
          document.body.dispatchEvent(e)
          res.push({ key: init.key, alt: init.altKey, prevented: e.defaultPrevented })
          if (i === seq.length - 1) setTimeout(resolve, 30)
        }, acc)
      })
    })
    return res
  }, inits)
}
/** 実打鍵（Playwright）の各キーで defaultPrevented を記録する仕掛けを入れる */
export async function installPrevLog(page) {
  await page.evaluate(() => {
    if (window.__prevLog) return
    window.__prevLog = []
    window.addEventListener('keydown', (e) => setTimeout(() => window.__prevLog.push({ key: e.key, code: e.code, alt: e.altKey, ctrl: e.ctrlKey, shift: e.shiftKey, prevented: e.defaultPrevented, target: e.target?.tagName }), 0))
  })
}
export async function takePrevLog(page) { return page.evaluate(() => { const l = window.__prevLog ?? []; window.__prevLog = []; return l }) }
