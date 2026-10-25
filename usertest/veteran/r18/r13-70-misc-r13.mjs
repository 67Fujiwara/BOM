// ラウンド13: ラウンド12 で足したキー（Ctrl+Home/End・Ctrl+D・Shift+矢印・F2 の案内）の境目を、ビュー・役割・編集中で
import { open, logger, sleep, installPrevLog, takePrevLog } from './lib18.mjs'
import { scenario } from './run14.mjs'
const port = Number(process.env.PORT ?? 5176)
const env = await open(port); const log = logger(`70-misc-r13-${port}.json`)
const S = async (name, o) => { const r = await scenario(env, log, name, o); return r }
await S('K1 4: F8 → Shift+→（あとで）', { view: 4, toks: ['F8', 'Shift+ArrowRight', 'Shift+ArrowRight'], expect: '今の問題をあとで（次へ）' })
await S('K2 4: F8 → Shift+←', { view: 4, toks: ['F8', 'Shift+ArrowLeft'], expect: '範囲選択はない（知らせ）' })
await S('K3 1: R010 部品名 入力中 Shift+→', { view: 1, toks: ['G:R010', 'T:abc', 'Shift+ArrowRight', 'Enter'], expect: '入力の中の文字選択（ブラウザ）or 確定' })
await S('K4 1: R010 部品名 入力中 Ctrl+D', { view: 1, toks: ['G:R010', 'T:abc', 'Control+d', 'Enter'], expect: 'ブックマークにしない' })
await S('K5 1: 行なし Ctrl+End → 7 → Enter', { view: 0, toks: ['Control+End', 'T:7', 'Enter'], expect: '最後の行へ（行を選ぶ操作）' })
await S('K6 1: 行なし Ctrl+Home', { view: 0, toks: ['Control+Home'], expect: '先頭の行へ' })
await S('K7 7（PM）: Shift+↓', { role: 'pm', view: 7, toks: ['ArrowDown', 'Shift+ArrowDown'], expect: '知らせ' })
await S('K8 9（購買）: Ctrl+D（ID の列）', { role: 'purchasing', view: 9, toks: ['ArrowDown', 'Home', 'Control+d'], expect: '行の複製の案内（購買は？）' })
await S('K9 1: R010 Shift+D（ID の列）→ Ctrl+Z', { view: 1, toks: ['G:R010', 'Home', 'Shift+D', 'Control+z'], expect: '複製 → 戻す' })
await S('K10 4: F8 → Alt+Shift+→', { view: 4, toks: ['F8', 'Alt+Shift+ArrowRight'], expect: '?' })
// 実打鍵で既定動作を止めたか（Ctrl+D はブラウザのブックマーク）
{
  const pg = env.page; await installPrevLog(pg); await takePrevLog(pg)
  await pg.keyboard.press('Control+d'); await sleep(100)
  await pg.keyboard.press('Control+g'); await pg.getByTestId('prompt-text').fill('R010'); await pg.keyboard.press('Enter'); await pg.keyboard.type('x'); await pg.keyboard.press('Control+d'); await sleep(100); await pg.keyboard.press('Escape')
  log({ name: 'K11 Ctrl+D の既定動作（ナビ / 入力中）', prev: (await takePrevLog(pg)).filter((x) => x.key === 'd' && x.ctrl) })
}
console.log('errors', JSON.stringify(env.errs.slice(0, 5)))
log.save(); await env.browser.close()
