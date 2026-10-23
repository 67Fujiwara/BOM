// ラウンド11: 行の選択を外したあと（4 で R054 を直して外れた／別のタブ）の全キー。↓ の「続きの行」が古いまま残らないか
import { open, reset, sleep, logger, gotoCell, installToastLog, takeToasts, state, snap, diffRows } from './lib14.mjs'
const port = Number(process.env.PORT ?? 5176)
const env = await open(port); const pg = env.page; const log = logger(`23-norow-keys-${port}.json`)
await env.context.grantPermissions(['clipboard-read', 'clipboard-write'])
async function key(t) {
  if (t.startsWith('T:')) return pg.keyboard.type(t.slice(2))
  if (t.startsWith('G:')) { await pg.keyboard.press('Control+g'); await pg.getByTestId('prompt-text').fill(t.slice(2)); return pg.keyboard.press('Enter') }
  if (t.startsWith('CLIP:')) return pg.evaluate((x) => navigator.clipboard.writeText(x), t.slice(5).replace(/\\t/g, '\t').replace(/\\n/g, '\n'))
  return pg.keyboard.press(t)
}
async function run(name, toks, { pre = ['T:5', 'ArrowRight'], view = 4, row = 'R054', col = '必要数', expect = '' } = {}) {
  await reset(env); await gotoCell(pg, view, row, col)
  for (const t of pre) { await key(t); await sleep(40) }
  await installToastLog(pg); await takeToasts(pg); const a = await snap(pg)
  const seq = [`pre→${(await state(pg)).cursor}`]
  for (const t of toks) { await key(t); await sleep(80); const s = await state(pg); seq.push(`${t}→${s.view.replace('view-', 'v')}/${s.cursor}/${s.mode}${s.panel ? '{' + s.panel + '}' : ''}`) }
  const b = await snap(pg)
  log({ name, expect, seq, diff: diffRows(a, b).slice(0, 5), toasts: (await takeToasts(pg)).filter((x) => !x.startsWith('保存しました')).slice(-3) })
}
const KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', 'Shift+Tab', 'Home', 'End', 'PageDown', 'PageUp', 'Control+ArrowDown', 'Control+ArrowUp', 'j', 'k', ' ', 'Enter', 'F2', 'Delete', 'Backspace', 'Control+c', 'Control+v', 'Alt+x', 'x', 'Control+.', 'Shift+Enter', 'Shift+D', 'Shift+Delete', 'Alt+h', 'Alt+r', 'Alt+s', 'Alt+f', 'Alt+w', 'Alt+Shift+I', 'Shift+ArrowRight', '[', ']', 'F8', 'Alt+ArrowDown', 'Escape', 'Control+Shift+C']
for (const k of KEYS) await run(`外れたあと ${k}`, [k, 'Escape'], { pre: ['CLIP:クリップ\\tCLIP-1', 'T:5', 'ArrowRight'] })
// 続きの行（resume）の残り
await run('S1 外れる → Ctrl+G R030（1 へ）→ Alt+4（R030 は 4 に無い）→ ↓', ['G:R030', 'Alt+4', 'ArrowDown'], { expect: '4 の先頭の行（R016）' })
await run('S2 外れる → Alt+1 → ↓', ['Alt+1', 'ArrowDown'], { expect: '?（1 の先頭か R005）' })
await run('S3 外れる → ↑', ['ArrowUp'], { expect: '外れた行の上（R022）か続きの行' })
await run('S4 外れる → Ctrl+F「リレー」→ Esc → ↓', ['Control+f', 'T:リレー', 'Enter', 'Escape', 'ArrowDown'], { expect: '?' })
await run('S5 外れる → ↓ → ↓ → ↓', ['ArrowDown', 'ArrowDown', 'ArrowDown'], { expect: 'R005 → R061 → R004' })
await run('S6 外れる → 2 回目の直し（R005 型式 を直して外れる）→ ↓', ['ArrowDown', 'Home', 'ArrowRight', 'ArrowRight', 'F2', 'Control+a', 'T:MY4N-D2 DC24', 'F2', 'ArrowRight', 'Escape', 'ArrowDown'], { expect: '?' })
console.log('errors', JSON.stringify(env.errs.slice(0, 5)))
log.save(); await env.browser.close()
