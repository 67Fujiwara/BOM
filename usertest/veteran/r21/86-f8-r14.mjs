// ラウンド14: 4 要確認で直した・確認済みにしたあとの F8（V7-03 の修正: 行がビューから外れた・下に問題が無いときは BOM の並びで次）を、
// 絞り込み・並べ替え・最後の問題・問題の無い行・Shift+F8・連続して全部直す で
import { open, logger, sleep, state } from './lib21.mjs'
import { scenario, tok } from './run14.mjs'
const port = Number(process.env.PORT ?? 5176)
const env = await open(port); const log = logger(`86-f8-r14-${port}${process.env.RUN ?? ''}.json`)
const S = (name, o) => scenario(env, log, name, o)
await S('F1 4: Ctrl+G R061 → C:型式 → Alt+x → F8', { view: 4, toks: ['G:R061', 'C:型式', 'Alt+x', 'F8'], expect: 'R061 より下の問題（無ければ先頭へ一周）' })
await S('F2 4: Ctrl+G R041 → Alt+x → Shift+F8', { view: 4, toks: ['G:R041', 'Alt+x', 'Shift+F8'], expect: 'R041 より上の近い問題' })
await S('F3 4: 絞り込み「リレー」→ F8 → Alt+x → F8', { view: 4, toks: ['F:リレー', 'F8', 'Alt+x', 'F8'], expect: '絞り込みの中の次（絞り込みの外へ行かない）' })
await S('F4 4: 絞り込み「端子」→ F8 → Alt+x → F8 → F8', { view: 4, toks: ['F:端子', 'F8', 'Alt+x', 'F8', 'F8'], expect: '絞り込みの中' })
await S('F5 4: Ctrl+G R010（問題の無い行）→ F8', { view: 4, toks: ['G:R010', 'F8'], expect: 'R010 より下の問題' })
await S('F6 4: Ctrl+G R010 → Shift+F8', { view: 4, toks: ['G:R010', 'Shift+F8'], expect: 'R010 より上の問題' })
await S('F7 4: 並べ替え（パレット）→ F8 → Alt+x → F8', { view: 4, toks: ['PAL:並べ替え', 'Enter', 'F8', 'Alt+x', 'F8'], expect: '見えている並びで次' })
await S('F8 2: F8 → Alt+x → F8 → Alt+x → F8', { view: 2, toks: ['F8', 'Alt+x', 'F8', 'Alt+x', 'F8'], expect: '2 の並びで次' })
// 全部を順に: F8 → Alt+x を 20 回。訪れた行の並びと、同じ行に 2 回来たか・飛ばしたか
for (const v of [4, 1]) {
  const toks = []; for (let i = 0; i < 20; i++) toks.push('F8', 'Alt+x')
  const rec = await S(`F9 ${v}: (F8 → Alt+x) ×20`, { view: v, toks, expect: '問題を 1 つずつ、飛ばさず・戻らず', quiet: true })
  const visits = rec.seq.filter((s) => s.startsWith('F8→')).map((s) => s.split('/')[1]?.split(' ')[0])
  log({ name: `F9 ${v} 訪れた行`, visits, dup: visits.filter((x, i) => visits.indexOf(x) !== i) })
}
console.log('errors', JSON.stringify(env.errs.slice(0, 5)))
log.save(); await env.browser.close()
