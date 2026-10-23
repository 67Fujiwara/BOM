// ラウンド7: 行を選んでいない状態（起動直後・絞り込み 0 行・分類の見出し・行の無いビュー・JSON 読み込み直後）で
// 語・数字・Alt+英字・F8 を打つ（実打鍵 40ms）。語の残りが別の行・別の列に入らないか
import { open, reset, snap, diffRows, sleep, saveJson } from './lib7.mjs'
import { palette } from '../r6/rerun5/lib.mjs'
const env = await open(Number(process.env.PORT ?? 5176)); const pg = env.page; const out = []
const log = (o) => { out.push(o); console.log(JSON.stringify(o).slice(0, 520)) }
async function act(label, keys) {
  const a = await snap(pg)
  for (const k of keys) { if (k.length > 1 && !/^[A-Za-z0-9]+$/.test(k) || /^(F8|Shift\+F8|ArrowDown|Enter|Escape)$/.test(k) || k.includes('+')) await pg.keyboard.press(k); else await pg.keyboard.type(k, { delay: 40 }); await sleep(40) }
  await sleep(120)
  const b = await snap(pg)
  let c = null
  if (b.mode === '編集') { await pg.keyboard.press('Enter'); await sleep(120); c = await snap(pg) }
  log({ label, keys: keys.join(' '), cursor: [a.cursor, b.cursor], mode: b.mode, edit: b.edit, panel: b.panel, view: [a.view, b.view], chips: b.chips, diff: diffRows(a, b), afterEnter: c ? diffRows(a, c) : null, toast: b.toast.slice(0, 90) })
  await pg.keyboard.press('Escape'); await sleep(30)
}
const states = {
  '起動直後': async () => {},
  '絞り込み 0 行': async () => { await pg.keyboard.press('/'); await pg.keyboard.type('zzzzqq'); await pg.keyboard.press('Enter'); await sleep(80) },
  '分類の見出し（[ で移動）': async () => { await pg.keyboard.press('ArrowDown'); await pg.keyboard.press('Home'); await pg.keyboard.press(']'); await sleep(60) },
  'JSON 読み込み直後': async () => {
    await pg.keyboard.press('Control+s'); const text = await pg.evaluate(() => localStorage.getItem('bom-pro.workspace.v2'))
    await palette(pg, 'JSON を読み込む'); await sleep(40)
    await pg.evaluate((t) => { const el = document.querySelector('[data-testid="import-text"]'); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(el, t); el.dispatchEvent(new Event('input', { bubbles: true })) }, text)
    await pg.getByTestId('import-text').focus(); await pg.keyboard.press('Control+Enter'); await sleep(80); await pg.keyboard.press('ArrowDown'); await pg.keyboard.press('Enter'); await sleep(150)
    await pg.locator('.gridwrap').focus()
  },
  '購買 7（行の無いビュー？）': async () => { await pg.keyboard.press('7'); await sleep(60) },
}
const inputs = [['Knowles'], ['hook'], ['4'], ['Alt+h'], ['Alt+KeyN', 'coil'], ['F8', 'coil'], ['Alt+4', 'x'], ['Shift+F8', 'Alt+x']]
for (const [st, fn] of Object.entries(states)) for (const keys of inputs) {
  await reset(env, { role: st.startsWith('購買') ? 'purchasing' : 'design' })
  await fn()
  await act(st, keys)
}
log({ errors: env.errs })
saveJson('71-norow2.json', out); await env.browser.close()
