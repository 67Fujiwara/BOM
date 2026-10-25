// ラウンド8: IME。ナビで IME をオンのまま打ち始める（compositionstart → insertText）、記号で始めた編集のあと IME、Option の文字のあと IME
import { open, reset, gotoCell, snap, diffRows, sleep, saveJson, state, cdpKey } from './lib18.mjs'
const env = await open(5176); const pg = env.page; const out = []
const cdp = await env.context.newCDPSession(pg)
async function ime(text) {
  // 変換中のキー（keyCode 229）→ 組み立て中 → 確定
  await cdp.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Process', code: 'KeyR', windowsVirtualKeyCode: 229, nativeVirtualKeyCode: 229 })
  await cdp.send('Input.imeSetComposition', { text: text.slice(0, 1), selectionStart: 1, selectionEnd: 1 })
  await cdp.send('Input.imeSetComposition', { text, selectionStart: text.length, selectionEnd: text.length })
  await cdp.send('Input.insertText', { text })
}
for (const [name, pre, col] of [['ナビで IME から打ち始め', null, '部品名'], ['< で始めてから IME', '<', '備考'], ['[ で始めてから IME', '[', '備考'], ['1 で始めてから IME', '1', '部品名'], ['Enter で編集してから IME', 'Enter', '部品名']]) {
  await reset(env); await gotoCell(pg, 1, 'R040', col)
  const a = await snap(pg)
  if (pre === 'Enter') { await pg.keyboard.press('Enter'); await pg.keyboard.press('Control+a') } else if (pre) await pg.keyboard.type(pre)
  await sleep(50); await ime('リレー'); await sleep(80)
  const s = await state(pg)
  await pg.keyboard.press('Enter'); await sleep(100)
  const b = await snap(pg)
  const rec = { name, afterIme: { mode: s.mode, edit: s.edit, cursor: s.cursor, view: s.view }, diff: diffRows(a, b) }
  out.push(rec); console.log(JSON.stringify(rec))
}
saveJson('r8-25-ime.json', out); await env.browser.close()
