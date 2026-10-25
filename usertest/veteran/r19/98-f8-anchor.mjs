// ラウンド15: F8 の「飛んだ位置」の覚え方（V14-09 の修正: Ctrl+G で来た行を x で確認済みにして 4 の後ろへ動いても、F8 はもとの位置の次から）の境目。
// 4 の並び（問題のある行を先に）: R016 → R009 → R041 → R022 → R054 → R005 → R061（r14 の F9 の 1 すべての順と同じ 7 件）
import { open, logger, sleep } from './lib19.mjs'
import { scenario } from './run14.mjs'
const port = Number(process.env.PORT ?? 5176)
const env = await open(port); const log = logger(`98-f8-anchor-${port}${process.env.RUN ?? ''}.json`)
const S = (name, o) => scenario(env, log, name, o)
// 確認済みにできる警告は R016・R005・R061（型式）。R009・R041・R022・R054 はエラー（r14 の F9 から）
await S('A1 4: Ctrl+G R005 → Alt+x → F8', { view: 4, toks: ['G:R005', 'Alt+x', 'F8'], expect: 'R061（4 の並びで R005 の次）' })
await S('A2 4: Ctrl+G R005 → Alt+x → Shift+F8', { view: 4, toks: ['G:R005', 'Alt+x', 'Shift+F8'], expect: 'R054' })
await S('A3 4: Ctrl+G R005 → Alt+x → ↓ → ↑ → F8', { view: 4, toks: ['G:R005', 'Alt+x', 'ArrowDown', 'ArrowUp', 'F8'], expect: 'R005 に戻ったので R061' })
await S('A4 4: Ctrl+G R005 → Alt+x → ↓ → F8', { view: 4, toks: ['G:R005', 'Alt+x', 'ArrowDown', 'F8'], expect: 'カーソルの行から（問題の無い行の並び → 先頭へ一周 R016）か R061' })
await S('A5 4: Ctrl+G R005 → Alt+x → Alt+1 → Alt+4 → F8', { view: 4, toks: ['G:R005', 'Alt+x', 'Alt+1', 'Alt+4', 'F8'], expect: 'R061' })
await S('A6 4: Ctrl+G R005 → Alt+x → 絞り込み「リレー」→ Esc → F8', { view: 4, toks: ['G:R005', 'Alt+x', 'F:リレー', 'Escape', 'F8'], expect: '飛ばさない' })
await S('A7 4: Ctrl+G R005 → Alt+x → Ctrl+Z → F8', { view: 4, toks: ['G:R005', 'Alt+x', 'Control+z', 'F8'], expect: 'R005 の警告が戻る → R061' })
await S('A8 4: Ctrl+G R016 → Alt+x → Ctrl+G R054 → F8', { view: 4, toks: ['G:R016', 'Alt+x', 'G:R054', 'F8'], expect: 'R005（新しく飛んだ位置から）' })
await S('A9 4: F8 ×6（R005）→ Alt+x → F8', { view: 4, toks: ['F8', 'F8', 'F8', 'F8', 'F8', 'F8', 'Alt+x', 'F8'], expect: 'R061' })
await S('A10 4: Ctrl+G R010（問題の無い行）→ F8 / Ctrl+G R010 → Shift+F8', { view: 4, toks: ['G:R010', 'F8', 'G:R010', 'Shift+F8'], expect: 'F8 と Shift+F8 で同じ数え方' })
await S('A11 1: Ctrl+G R005 → Alt+x → F8', { view: 1, toks: ['G:R005', 'Alt+x', 'F8'], expect: '1 の並びで R005 の次（R009）' })
await S('A12 4: Ctrl+G R005 → Alt+x → Ctrl+G R005 → F8', { view: 4, toks: ['G:R005', 'Alt+x', 'G:R005', 'F8'], expect: 'R061 か先頭へ一周' })
await S('A13 4: Ctrl+G R061（最後）→ Alt+x → F8', { view: 4, toks: ['G:R061', 'Alt+x', 'F8'], expect: '先頭へ一周（R016）' })
await S('A14 4: Ctrl+G R016（先頭）→ Alt+x → Shift+F8', { view: 4, toks: ['G:R016', 'Alt+x', 'Shift+F8'], expect: '最後へ一周（R061）' })
await S('A15 4: Ctrl+G R005 → Alt+x → 並べ替え（パレット）→ F8', { view: 4, toks: ['G:R005', 'Alt+x', 'PAL:並べ替え', 'Enter', 'F8'], expect: '並べ替えたあとの並びで、カーソルの行から' })
await S('A16 4: Ctrl+G R016 → Alt+x → F8 ×5 → Alt+x → F8', { view: 4, toks: ['G:R016', 'Alt+x', 'F8', 'F8', 'F8', 'F8', 'F8', 'Alt+x', 'F8'], expect: 'R009 → R041 → R022 → R054 → R005 →(x)→ R061' })
await S('A17 4: Ctrl+G R005 → Alt+x → Ctrl+G R016 → Alt+x → F8', { view: 4, toks: ['G:R005', 'Alt+x', 'G:R016', 'Alt+x', 'F8'], expect: 'R009' })
console.log('errors', JSON.stringify(env.errs.slice(0, 5)))
log({ name: 'console/pageerror', errs: env.errs.slice(0, 20) })
log.save(); await env.browser.close()
