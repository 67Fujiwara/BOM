// ラウンド13: テンキー（NumLock）の数字を、役割 × ビュー × 列（ID・値の列・書けない列）で（V12-01 の修正の副作用の確認）
import { open, logger } from './lib16.mjs'
import { scenario } from './run14.mjs'
const port = Number(process.env.PORT ?? 5176)
const env = await open(port); const log = logger(`71-numpad-roles-${port}.json`)
const cases = [
  ['design', 1, ['G:R010', 'Home'], 'ID の列: テンキー 4 → ビュー 4'],
  ['design', 1, ['G:R010', 'C:必要数'], '必要数: テンキー 4 → 入力 4'],
  ['design', 1, ['G:R010', 'C:単価'], '書けない列（単価）: テンキー 4 → 知らせ'],
  ['purchasing', 9, ['ArrowDown', 'C:単価'], '購買 単価: テンキー 4 → 入力 4'],
  ['purchasing', 9, ['ArrowDown', 'C:部品名'], '購買 部品名（書けない）: テンキー 4 → 知らせ'],
  ['pm', 7, ['ArrowDown'], 'PM: テンキー 4 → ビュー 4'],
  ['design', 4, ['F8'], '4 F8 の型式: テンキー 1 → 入力 1'],
]
for (const [role, view, pre, name] of cases) await scenario(env, log, `${role}/${view} ${name}`, { role, view, toks: [...pre, 'NP:4', 'Escape'], expect: name })
console.log('errors', JSON.stringify(env.errs.slice(0, 5)))
log.save(); await env.browser.close()
