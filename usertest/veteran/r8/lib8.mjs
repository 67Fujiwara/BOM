// ラウンド8（ベテラン）共通部品。r7 の lib7（rerun7/ にコピー）を使い、出力先だけ r8 に。
import fs from 'node:fs'
export { open, reset, snap, diffRows, panelOf, cursorText, sleep, LS, evInit, typeSeqM, installPrevLog, takePrevLog, gotoCell } from './rerun7/lib7.mjs'
export const OUT = '/home/user/BOM/usertest/veteran/r8'
export const saveJson = (name, data) => fs.writeFileSync(`${OUT}/${name}`, JSON.stringify(data, null, 2))
export function logger(name) {
  const out = []
  const log = (o) => { out.push(o); console.log(JSON.stringify(o).slice(0, 700)) }
  log.save = () => saveJson(name, out)
  return log
}
/** CDP の実キー（text 付き）。mods: 1=Alt 2=Ctrl 4=Meta 8=Shift */
export async function cdpKey(cdp, { key, code, text, mods = 0, vk }) {
  await cdp.send('Input.dispatchKeyEvent', { type: text ? 'keyDown' : 'rawKeyDown', modifiers: mods, key, code, text, unmodifiedText: text, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk })
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', modifiers: mods, key, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk })
}
export async function state(page) {
  return page.evaluate(() => ({
    mode: document.querySelector('[data-testid="mode"]')?.textContent ?? '',
    edit: document.querySelector('[data-testid="cell-editor"]')?.value ?? null,
    cursor: document.querySelector('[data-testid="cursor"]')?.textContent ?? '',
    view: document.querySelector('[data-testid^="view-"][aria-current="true"]')?.dataset.testid ?? '',
    panel: document.querySelector('[data-testid^="panel-"]')?.dataset.testid ?? null,
    toast: ((document.querySelector('[data-testid="toast-float"]') ?? document.querySelector('[data-testid="toast"]'))?.textContent ?? '').slice(0, 160),
    active: document.activeElement?.tagName + '.' + (document.activeElement?.className ?? ''),
    filter: document.querySelector('input.filter')?.value ?? null,
  }))
}
/** トーストの出た文を全部記録する（古いトーストと区別するため） */
export async function installToastLog(page) {
  await page.evaluate(() => {
    if (window.__toasts) return
    window.__toasts = []
    let last = ''
    const tick = () => {
      const t = ((document.querySelector('[data-testid="toast-float"]') ?? document.querySelector('[data-testid="toast"]'))?.textContent ?? '')
      if (t && t !== last) window.__toasts.push(t.slice(0, 200))
      last = t
    }
    new MutationObserver(tick).observe(document.body, { subtree: true, childList: true, characterData: true })
  })
}
export async function takeToasts(page) { return page.evaluate(() => { const l = window.__toasts ?? []; window.__toasts = []; return l }) }
