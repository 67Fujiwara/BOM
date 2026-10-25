// ラウンド12: 行を選んでいないときのビュー切替（V11-08 の修正: Alt+数字も行を選ばない）を、数字・Alt+数字・テンキー・Alt+テンキー・パレット・F 系で
// 外れ方: 4 で R054 の必要数を 5 にして → で確定（R054 が 4 から外れる）
import { open, logger, sleep } from './lib20.mjs'
import { scenario } from './run14.mjs'
const port = Number(process.env.PORT ?? 5176)
const env = await open(port); const log = logger(`41-norow-view-${port}.json`)
const PRE = ['G:R054', 'C:必要数', 'T:5', 'ArrowRight']
const S = (name, toks, expect, o = {}) => scenario(env, log, name, { view: 4, toks: [...PRE, ...toks], expect, ...o })
await S('N1 外れる → 1（数字）→ 7 → Enter', ['1', '7', 'Enter'], '行を選ばない・何も入らない')
await S('N2 外れる → Alt+1 → 7 → Enter', ['Alt+1', '7', 'Enter'], '行を選ばない・何も入らない')
await S('N3 外れる → Alt+2 → ZZ', ['Alt+2', 'T:ZZ'], '行を選ばない')
await S('N4 外れる → テンキー 1（NumLock）→ 7 → Enter', ['NP:1', 'NP:7', 'Enter'], '行を選ばない・何も入らない（数字キーと同じ）')
await S('N5 外れる → テンキー 2 → T:ZZ', ['NP:2', 'T:ZZ'], '行を選ばない')
await S('N6 外れる → Alt+テンキー 1 → 7', ['NPALT:1', 'NP:7', 'Enter'], '行を選ばない')
await S('N7 外れる → パレット「1 すべて」→ 7 → Enter', ['PAL:すべて', 'T:7', 'Enter'], '?（パレットは行を選んでもよいが、選ぶなら見える）')
await S('N8 外れる → Shift+Enter', ['Shift+Enter'], '行を選んでください（行を足さない）')
await S('N9 外れる → Shift+Enter → T:abc → Enter', ['Shift+Enter', 'T:abc', 'Enter'], '何も足さない・入らない')
await S('N10 外れる → Alt+1 → ↓', ['Alt+1', 'ArrowDown'], '↓ で表へ（続きの行か先頭）')
await S('N11 外れる → テンキー 1 → ↓ → 7 → Enter', ['NP:1', 'ArrowDown', 'NP:7', 'Enter'], '↓ で選んだ行に 7')
await S('N12 外れる → Alt+Shift+1?（記号）', ['Alt+Shift+1', 'T:7', 'Enter'], '?')
await S('N13 外れる → Ctrl+Home → 7 → Enter', ['Control+Home', 'T:7', 'Enter'], '先頭の行（行を選ぶ操作なので入ってよい）')
await S('N14 行あり → テンキー 1 → 7（ナビで）', ['ArrowDown', 'Escape', 'NP:1', 'NP:7', 'Escape'], 'ビュー切替後の行の選択はそのまま')
// 起動直後（行を選んでいない）
await scenario(env, log, 'N15 起動直後（1）→ テンキー 4 → 7 → Enter', { view: 0, toks: ['NP:4', 'NP:7', 'Enter'], expect: '数字キーと同じ' })
await scenario(env, log, 'N16 起動直後（1）→ 4 → 7 → Enter', { view: 0, toks: ['4', '7', 'Enter'], expect: '行を選ばない' })
await scenario(env, log, 'N17 起動直後（1）→ Alt+4 → 7 → Enter', { view: 0, toks: ['Alt+4', '7', 'Enter'], expect: '行を選ばない' })
console.log('errors', JSON.stringify(env.errs.slice(0, 5)))
log.save(); await env.browser.close()
