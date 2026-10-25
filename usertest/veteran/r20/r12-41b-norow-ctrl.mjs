// ラウンド12: 行を選んでいないときの Shift+Enter の案内「Ctrl+↓ で最後の行へ」が効くか。Ctrl+Home/End・Ctrl+↑↓
import { open, logger } from './lib20.mjs'
import { scenario } from './run14.mjs'
const port = Number(process.env.PORT ?? 5176)
const env = await open(port); const log = logger(`41b-norow-ctrl-${port}.json`)
const PRE = ['G:R054', 'C:必要数', 'T:5', 'ArrowRight']
for (const k of ['Control+ArrowDown', 'Control+ArrowUp', 'Control+Home', 'Control+End', 'End', 'PageDown'])
  await scenario(env, log, `外れる → ${k} → Shift+Enter`, { view: 4, toks: [...PRE, k, 'Shift+Enter'], expect: '行が選ばれ、その下に足す' })
await scenario(env, log, '起動直後（行なし）→ Ctrl+↓ → Shift+Enter', { view: 0, toks: ['Control+ArrowDown', 'Shift+Enter'], expect: '最後の行の下に足す' })
log.save(); await env.browser.close()
