// ラウンド10: 役割 3 × ビュー 1〜9 × Alt+英字 26・Alt+Shift+英字 26・Alt+数字 10・Alt+記号 8（文字を打てる列で）。
// 既定動作を止めたか・pageerror / console error・画面が壊れないか・パネルが開いたまま残らないか（各キーの後 Esc×2）
import { open, reset, sleep, logger, state, installPrevLog, takePrevLog } from './lib21.mjs'
const port = Number(process.env.PORT ?? 5176)
const env = await open(port); const pg = env.page; const log = logger(`13-alt-sweep-${port}.json`)
const letters = 'abcdefghijklmnopqrstuvwxyz'.split('')
const KEYS = [...letters.map((c) => 'Alt+' + c), ...letters.map((c) => 'Alt+Shift+' + c.toUpperCase()), ...'0123456789'.split('').map((d) => 'Alt+' + d), 'Alt+/', 'Alt+[', 'Alt+]', 'Alt+Shift+/', 'Alt+Shift+,', 'Alt+Shift+.', 'Alt+ArrowUp', 'Alt+ArrowDown']
let total = 0
for (const role of ['design', 'purchasing', 'pm']) for (let v = 1; v <= 9; v++) {
  await reset(env, { role }); await pg.keyboard.press(`Alt+${v}`); await sleep(60); await pg.keyboard.press('ArrowDown'); await sleep(30)
  await installPrevLog(pg); await takePrevLog(pg)
  const notPrevented = []; const n0 = env.errs.length
  for (const k of KEYS) {
    await pg.keyboard.press(k); await sleep(15); total++
    const pv = (await takePrevLog(pg)).filter((x) => x.alt && !['Alt', 'Shift'].includes(x.key))
    if (pv.some((x) => !x.prevented)) notPrevented.push(k)
    for (let i = 0; i < 2; i++) await pg.keyboard.press('Escape')
    if ((await state(pg)).view !== `view-${v}`) { await pg.keyboard.press(`Alt+${v}`); await sleep(20) }
  }
  const alive = await pg.evaluate(() => !!document.querySelector('[data-testid="grid"]') && !document.body.innerText.includes('問題が起きました'))
  log({ role, view: v, notPrevented, alive, errs: env.errs.slice(n0).filter((e) => !e.startsWith('dialog')).slice(0, 3) })
}
console.log('total', total, 'errors', JSON.stringify(env.errs.slice(0, 5)))
log.save(); await env.browser.close()
