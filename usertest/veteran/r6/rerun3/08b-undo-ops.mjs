// 08 B の切り分け: 操作ごとに Ctrl+Z 1〜2 回で元に戻るか / Ctrl+Y で戻るか
import { launch, fresh, goto, toColKey, sleep, dumpErrors, save, proj, closeAll, toastNow, storeState } from './lib.mjs'
const { browser, page, errors } = await launch()
const out = []
const sig = async () => { const p = await proj(page); return p.rows.map((r) => JSON.stringify([r.id, r.status, r.hidden ?? false, r.working ?? null, r.name, r.note ?? ''])) }
const diff = (a, b) => { const A = new Set(a), B = new Set(b); return { onlyBefore: a.filter((x) => !B.has(x)).slice(0, 3), onlyAfter: b.filter((x) => !A.has(x)).slice(0, 3), orderSame: a.join() === b.join() } }
const OPS = {
  edit: async () => { await toColKey(page, 'name'); await page.keyboard.press('Enter'); await page.keyboard.press('Control+a'); await page.keyboard.type('U'); await page.keyboard.press('Enter') },
  insertTyped: async () => { await page.keyboard.press('Shift+Enter'); await sleep(20); await page.keyboard.type('追加'); await page.keyboard.press('Enter') },
  insertEsc: async () => { await page.keyboard.press('Shift+Enter'); await sleep(20); await page.keyboard.press('Escape') },
  dup: async () => { await page.keyboard.press('Shift+D') },
  moveDown: async () => { await page.keyboard.press('Alt+ArrowDown') },
  moveUp: async () => { await page.keyboard.press('Alt+ArrowUp') },
  hide: async () => { await page.keyboard.press('h'); await sleep(400) },
  clear: async () => { await toColKey(page, 'note'); await page.keyboard.press('Delete') },
  delete: async () => { await page.keyboard.press('Shift+Delete'); await sleep(40); for (let i = 0; i < 2; i++) { const t = await page.locator('[data-testid^="panel-"]').first().innerText().catch(() => ''); if (!t) break; if (/理由/.test(t)) await page.keyboard.press('2'); else await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter'); await sleep(40) } },
}
for (const [name, op] of Object.entries(OPS)) {
  for (const id of ['R045', 'R076']) { // R045 = 提出済、R076 = 下書き
    await fresh(page); await page.keyboard.press('1')
    await goto(page, id)
    const s0 = await sig()
    const u0 = await storeState(page, (s) => Object.values(s.undo).reduce((a, b) => a + b.length, 0))
    await op(); await sleep(40); await closeAll(page)
    const s1 = await sig()
    const u1 = await storeState(page, (s) => Object.values(s.undo).reduce((a, b) => a + b.length, 0))
    const toasts = []
    for (let i = 0; i < u1 - u0; i++) { await page.keyboard.press('Control+z'); await sleep(30); toasts.push((await toastNow(page)).slice(0, 50)) }
    const s2 = await sig()
    for (let i = 0; i < u1 - u0; i++) { await page.keyboard.press('Control+y'); await sleep(30) }
    const s3 = await sig()
    const rec = { op: name, row: id, entries: u1 - u0, changed: s1.join() !== s0.join(), undoOk: s2.join() === s0.join(), redoOk: s3.join() === s1.join(), undoDiff: s2.join() === s0.join() ? null : diff(s0, s2), redoDiff: s3.join() === s1.join() ? null : diff(s1, s3), toasts }
    out.push(rec)
    console.log(name, id, rec.entries, rec.changed, rec.undoOk, rec.redoOk, rec.undoDiff ? JSON.stringify(rec.undoDiff).slice(0, 300) : '', rec.redoDiff ? 'REDO ' + JSON.stringify(rec.redoDiff).slice(0, 300) : '', toasts.join(' | '))
  }
}
save('08b-undo-ops.json', out)
dumpErrors(errors, '08b')
await browser.close()
