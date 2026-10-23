// ラウンド10: パレットで操作の名前をそのまま打つ（ベテランは名前で叩く）。全コマンドの名前 × 先頭の候補がその操作か。
// 打ってすぐ Enter（Playwright 実打鍵・間隔なし）で別の操作が走らないか（先頭がずれている名前だけ）
import fs from 'node:fs'
import { open, reset, sleep, logger } from './lib15.mjs'
const port = Number(process.env.PORT ?? 5176)
const env = await open(port); const pg = env.page; const log = logger(`17-palette-exact-${port}.json`)
const src = fs.readFileSync('/home/user/BOM/src/commands/registry.ts', 'utf8')
const st = src.slice(src.indexOf('export const STATIC'))
const labels = [...st.matchAll(/\{ id: '([^']+)', label: '([^']+)'/g)].map((m) => [m[1], m[2]])
await reset(env)
let mism = 0
for (const [id, label] of labels) {
  await pg.locator('.gridwrap').focus(); await pg.keyboard.press('Control+k'); await sleep(30)
  await pg.keyboard.type(label); await sleep(60)
  const top = await pg.evaluate(() => [...document.querySelectorAll('[data-testid="palette-list"] .item')].slice(0, 3).map((e) => e.children[1]?.textContent ?? e.textContent))
  const ok = top[0] === label
  if (!ok) mism++
  log({ id, label, ok, top })
  await pg.keyboard.press('Escape'); await pg.keyboard.press('Escape')
}
console.log('labels', labels.length, 'mismatch', mism, 'errors', JSON.stringify(env.errs.slice(0, 5)))
log.save(); await env.browser.close()
