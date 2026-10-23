// 行を選んでいない（カーソル「—」）ときに語を打つ（実打鍵）。起動直後・JSON 読み込み直後・案件の切り替え直後・絞り込み 0 行
import { open, reset, snap, diffRows, sleep, saveJson } from './lib7.mjs'
import { palette } from '../../r6/rerun5/lib.mjs'
const env = await open(Number(process.env.PORT ?? 5176)); const pg = env.page; const out = []
const log = (o) => { out.push(o); console.log(JSON.stringify(o).slice(0, 600)) }
async function typeWord(label, word, enter = true) {
  const a = await snap(pg)
  await pg.keyboard.type(word, { delay: 40 }); await sleep(120)
  const b = await snap(pg)
  let c = null
  if (enter && b.mode === '編集') { await pg.keyboard.press('Enter'); await sleep(120); c = await snap(pg) }
  log({ label, word, cursor: [a.cursor, b.cursor], mode: b.mode, edit: b.edit, panel: b.panel, view: [a.view, b.view], chips: b.chips, diffBeforeEnter: diffRows(a, b), afterEnter: c ? diffRows(a, c) : null, toast: b.toast })
}
for (const w of ['Analog', 'Knowles', 'snubber', 'nxp', 'hook']) { await reset(env); await typeWord('起動直後', w) }
// JSON 読み込み直後
await reset(env); await pg.locator('.gridwrap').focus(); await pg.keyboard.press('Control+s')
const text = await pg.evaluate(() => localStorage.getItem('bom-pro.workspace.v2'))
await palette(pg, 'JSON を読み込む'); await sleep(40)
await pg.evaluate((t) => { const el = document.querySelector('[data-testid="import-text"]'); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(el, t); el.dispatchEvent(new Event('input', { bubbles: true })) }, text)
await pg.getByTestId('import-text').focus(); await pg.keyboard.press('Control+Enter'); await sleep(80); await pg.keyboard.press('ArrowDown'); await pg.keyboard.press('Enter'); await sleep(150)
await pg.locator('.gridwrap').focus()
await typeWord('JSON 読み込み直後', 'Analog')
// 案件の切り替え（Ctrl+P）直後
await reset(env)
await pg.keyboard.press('ArrowDown'); await pg.keyboard.press('Control+p'); await sleep(80)
const projPanel = (await pg.locator('[data-testid^="panel-"]').first().innerText().catch(() => '')).slice(0, 200)
await pg.keyboard.press('ArrowDown'); await pg.keyboard.press('Enter'); await sleep(150)
log({ label: '案件切替', projPanel, cursor: (await snap(pg)).cursor })
await typeWord('案件の切り替え直後', 'Analog')
// ビュー切替直後（カーソルの行が新しいビューに無い）
await reset(env); await pg.keyboard.press('ArrowDown'); await pg.keyboard.press('7'); await sleep(80)
await typeWord('ビュー 7 に切り替えた直後（設計）', 'Analog')
log({ errors: env.errs })
saveJson('57-norow.json', out); await env.browser.close()
