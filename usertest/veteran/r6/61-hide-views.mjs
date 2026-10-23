// ラウンド6: 隠した行が消えるビュー（4・9・3）で Alt+h → カーソルはどこへ行くか。続けて Alt+h・Alt+j、語（Knowles・coil）を打つと何が起きるか（実打鍵）
import { open, reset, gotoCell, snap, diffRows, sleep, saveJson } from './lib6.mjs'
const env = await open(Number(process.env.PORT ?? 5173)); const pg = env.page; const out = []
const log = (o) => { out.push(o); console.log(JSON.stringify(o).slice(0, 700)) }
for (const [role, view, row, col] of [['design', 4, 'R016', '型式'], ['design', 1, 'R040', '部品名'], ['purchasing', 9, null, '単価'], ['purchasing', 3, 'R013', 'ロット']]) {
  for (const after of ['Alt+KeyH', 'Alt+KeyJ', 'Knowles', 'coil']) {
    await reset(env, { role })
    if (row) await gotoCell(pg, view, row, col)
    else { await pg.keyboard.press(String(view)); await sleep(30); await pg.keyboard.press('ArrowDown'); await pg.keyboard.press('Home'); for (let i = 0; i < 60 && !(await pg.getByTestId('cursor').textContent()).endsWith(' ' + col); i++) await pg.keyboard.press('ArrowRight') }
    const a = await snap(pg)
    await pg.keyboard.press('Alt+KeyH'); await sleep(80)
    const m = await snap(pg)
    if (after.startsWith('Alt')) await pg.keyboard.press(after); else await pg.keyboard.type(after, { delay: 30 })
    await sleep(120)
    const b = await snap(pg)
    let c = null
    if (b.mode === '編集') { await pg.keyboard.press('Enter'); await sleep(100); c = await snap(pg) }
    log({ role, view, start: a.cursor, afterHide: m.cursor, then: after, cursor: b.cursor, mode: b.mode, edit: b.edit, panel: b.panel, chips: b.chips, view2: b.view, diff: diffRows(a, b), afterEnter: c ? diffRows(a, c) : null, toast: b.toast.slice(0, 80) })
  }
}
log({ errors: env.errs })
saveJson('61-hide-views.json', out); await env.browser.close()
