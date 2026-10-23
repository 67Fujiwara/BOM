// ラウンド7: 新しい規則の穴を探る
// A) 記号で始まる値（? / [ ] < > など）を文字を打てる列で打つ（実打鍵）
// B) macOS の Option+英字（µ Ω ° …）・Windows の AltGr（Ctrl+Alt）で入る文字を、編集中のセル・パレット・絞り込み・ガイドで打つ（CDP の実キー）
//    現行（5176 開発）と ラウンド6 時点のビルド（5198）を比べる
import { open, reset, gotoCell, snap, diffRows, sleep, saveJson } from './lib7.mjs'
const PORTS = (process.env.PORTS ?? '5176,5198').split(',').map(Number)
const out = {}
const log = (tag, o) => { (out[tag] ??= []).push(o); console.log(tag, JSON.stringify(o).slice(0, 500)) }

async function cdpKey(cdp, { key, code, text, mods, vk }) {
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', modifiers: mods, key, code, text, unmodifiedText: text, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk })
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', modifiers: mods, key, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk })
}
// macOS US 配列の Option+英字 / Option+Shift+数字、Windows ドイツ語配列の AltGr（Ctrl+Alt）
const SPECIAL = [
  ['mac Option+m → µ', { key: 'µ', code: 'KeyM', text: 'µ', mods: 1, vk: 77 }],
  ['mac Option+z → Ω', { key: 'Ω', code: 'KeyZ', text: 'Ω', mods: 1, vk: 90 }],
  ['mac Option+Shift+8 → °', { key: '°', code: 'Digit8', text: '°', mods: 1 | 8, vk: 56 }],
  ['mac Option+5 → ∞', { key: '∞', code: 'Digit5', text: '∞', mods: 1, vk: 53 }],
  ['mac Option+r → ®', { key: '®', code: 'KeyR', text: '®', mods: 1, vk: 82 }],
  ['win AltGr+m（独）→ µ', { key: 'µ', code: 'KeyM', text: 'µ', mods: 1 | 2, vk: 77 }],
  ['win AltGr+q（独）→ @', { key: '@', code: 'KeyQ', text: '@', mods: 1 | 2, vk: 81 }],
  ['win AltGr+e（独）→ €', { key: '€', code: 'KeyE', text: '€', mods: 1 | 2, vk: 69 }],
  ['win AltGr+7（独）→ {', { key: '{', code: 'Digit7', text: '{', mods: 1 | 2, vk: 55 }],
]
for (const port of PORTS) {
  const tag = `p${port}`
  const env = await open(port); const pg = env.page
  const cdp = await env.context.newCDPSession(pg)
  // A) 記号で始まる値
  if (port === PORTS[0]) for (const [col, word] of [['備考', '?要確認'], ['備考', '/N 指定'], ['備考', '[代替可]'], ['備考', '<5mm'], ['備考', '>85℃'], ['型式', '[A]CN-12'], ['部品名', '<高さ制限>'], ['必要数', '<10'], ['備考', ' 先頭空白'], ['備考', '#2 ロット'], ['備考', '-40℃']]) {
    await reset(env); await gotoCell(pg, 1, 'R040', col)
    const a = await snap(pg)
    await pg.keyboard.type(word, { delay: 40 }); await sleep(150)
    const b = await snap(pg)
    let c = null
    if (b.mode === '編集') { await pg.keyboard.press('Enter'); await sleep(100); c = await snap(pg) }
    log(tag, { case: 'A 記号で始まる値', col, word, cursor: [a.cursor, b.cursor], mode: b.mode, edit: b.edit, panel: b.panel, view: b.view, chips: b.chips, toast: b.toast.slice(0, 80), saved: c ? diffRows(a, c) : diffRows(a, b) })
    await pg.keyboard.press('Escape'); await pg.keyboard.press('Escape')
  }
  // B) 編集中のセル（備考）・パレット・絞り込み に特殊文字
  for (const [name, k] of SPECIAL) {
    await reset(env); await gotoCell(pg, 1, 'R040', '備考')
    await pg.keyboard.press('Enter'); await sleep(50); await pg.keyboard.press('Control+a'); await pg.keyboard.type('10'); await sleep(30)
    await cdpKey(cdp, k); await sleep(60)
    await pg.keyboard.type('F'); await sleep(60)
    const cell = await pg.evaluate(() => document.querySelector('[data-testid="cell-editor"]')?.value ?? null)
    await pg.keyboard.press('Escape'); await sleep(30)
    // パレット
    await pg.keyboard.press('Control+k'); await sleep(80)
    await pg.keyboard.type('10'); await cdpKey(cdp, k); await sleep(60)
    const pal = await pg.evaluate(() => document.activeElement?.value ?? null)
    await pg.keyboard.press('Escape'); await sleep(50); await pg.keyboard.press('Escape')
    // 絞り込み
    await pg.locator('.gridwrap').focus(); await pg.keyboard.press('/'); await sleep(50)
    await pg.keyboard.type('10'); await cdpKey(cdp, k); await sleep(60)
    const flt = await pg.evaluate(() => document.activeElement?.value ?? null)
    await pg.keyboard.press('Escape')
    log(tag, { case: 'B 特殊文字', name, cell, palette: pal, filter: flt })
  }
  log(tag, { errors: env.errs.slice(0, 5) })
  await env.browser.close()
}
saveJson('70-probe.json', out)
