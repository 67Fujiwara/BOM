// ラウンド7: 隠すとカーソルが動く規則のまわり（実打鍵）
// 1) 2 購買提出用で Alt+h を 5 連続 → Ctrl+Z ×5 → Ctrl+Y ×5（行と、カーソルの位置）
// 2) Alt を押したまま h ↓ ↓ h（本物の Alt の押し下げ）→ 行の並びが変わらないか。Alt を押し直して ↓ は行の移動
// 3) 2 で隠した問題の行に F8 で行くか（見えない行にカーソルが乗らないか）
// 4) 2 タブ: B が A のカーソルの行を隠す / 削除する → A で語を打つ
import { open, reset, gotoCell, snap, diffRows, sleep, saveJson } from './lib7.mjs'
const env = await open(Number(process.env.PORT ?? 5176)); const pg = env.page; const out = []
const log = (o) => { out.push(o); console.log(JSON.stringify(o).slice(0, 900)) }
const visible = () => pg.evaluate(() => [...document.querySelectorAll('.gridwrap tr.row')].map((tr) => tr.querySelector('td')?.textContent?.trim()).filter(Boolean))
// 1
{
  await reset(env); await gotoCell(pg, 2, 'R010', '部品名')
  const a = await snap(pg); const curs = [a.cursor]
  for (let i = 0; i < 5; i++) { await pg.keyboard.press('Alt+h'); await sleep(60); curs.push((await snap(pg)).cursor) }
  const b = await snap(pg)
  const z = []
  for (let i = 0; i < 5; i++) { await pg.keyboard.press('Control+z'); await sleep(60); const s = await snap(pg); z.push(s.cursor + ' / ' + s.toast.slice(0, 30)) }
  const c = await snap(pg)
  const y = []
  for (let i = 0; i < 5; i++) { await pg.keyboard.press('Control+y'); await sleep(60); const s = await snap(pg); y.push(s.cursor + ' / ' + s.toast.slice(0, 30)) }
  const d = await snap(pg)
  log({ case: '1 2 で Alt+h ×5 → Ctrl+Z ×5 → Ctrl+Y ×5', cursorsAfterHide: curs, hidden: diffRows(a, b), afterUndo: diffRows(a, c), z, afterRedoVsHide: diffRows(b, d), y })
}
// 2 本物の Alt 押し下げ
for (const [label, fn] of [
  ['Alt を押したまま h ↓ ↓ h', async () => { await pg.keyboard.down('Alt'); await pg.keyboard.press('KeyH'); await pg.keyboard.press('ArrowDown'); await pg.keyboard.press('ArrowDown'); await pg.keyboard.press('KeyH'); await pg.keyboard.up('Alt') }],
  ['Alt を押したまま x ↑（4）', async () => { await pg.keyboard.down('Alt'); await pg.keyboard.press('KeyX'); await pg.keyboard.press('ArrowUp'); await pg.keyboard.up('Alt') }],
  ['Alt を押し直して ↓（行の移動）', async () => { await pg.keyboard.down('Alt'); await pg.keyboard.press('KeyH'); await pg.keyboard.up('Alt'); await pg.keyboard.down('Alt'); await pg.keyboard.press('ArrowDown'); await pg.keyboard.up('Alt') }],
  ['Alt を押したまま 4 j j 1', async () => { await pg.keyboard.down('Alt'); await pg.keyboard.press('Digit4'); await pg.keyboard.press('KeyJ'); await pg.keyboard.press('KeyJ'); await pg.keyboard.press('Digit1'); await pg.keyboard.up('Alt') }],
  ['Alt を押したまま ↓ だけ（行の移動）', async () => { await pg.keyboard.down('Alt'); await pg.keyboard.press('ArrowDown'); await pg.keyboard.press('ArrowDown'); await pg.keyboard.up('Alt') }],
  ['Alt を押したまま Shift+D ↓', async () => { await pg.keyboard.down('Alt'); await pg.keyboard.press('Shift+KeyD'); await pg.keyboard.press('ArrowDown'); await pg.keyboard.up('Alt') }],
]) {
  await reset(env); await gotoCell(pg, label.includes('（4）') ? 4 : 1, label.includes('（4）') ? 'R016' : 'R040', '部品名')
  const a = await snap(pg)
  await fn(); await sleep(120)
  const b = await snap(pg)
  const ids = (s) => JSON.parse(s.rows).map((r) => r.id)
  const moved = ids(a).filter((id, i) => ids(b).includes(id) && ids(b).indexOf(id) !== i && !ids(b).slice(0, i + 1).some((x) => !ids(a).includes(x))).slice(0, 3)
  log({ case: '2 ' + label, cursor: [a.cursor, b.cursor], view: b.view, mode: b.mode, diff: diffRows(a, b), movedRows: moved, toast: b.toast.slice(0, 60) })
}
// 3 隠した問題の行と F8
{
  await reset(env); await gotoCell(pg, 2, 'R016', '型式')
  await pg.keyboard.press('Alt+h'); await sleep(60)
  const a = await snap(pg); const seq = [a.cursor]
  await pg.keyboard.press('Control+ArrowUp'); await sleep(40)
  for (let i = 0; i < 9; i++) { await pg.keyboard.press('F8'); await sleep(50); const s = await snap(pg); seq.push(s.cursor) }
  const vis = await visible()
  const onHidden = seq.filter((c) => c.startsWith('R016'))
  log({ case: '3 2 で R016 を隠したあと F8 を 9 回', seq, R016visibleIn2: vis.includes('R016'), cursorOnHiddenR016: onHidden.length })
  if (onHidden.length) {
    await pg.keyboard.press('Control+ArrowUp'); for (let i = 0; i < 9 && !(await snap(pg)).cursor.startsWith('R016'); i++) await pg.keyboard.press('F8')
    const b = await snap(pg)
    await pg.keyboard.type('coil', { delay: 30 }); await sleep(80); const c = await snap(pg)
    log({ case: '3b 見えない R016 の上で coil', cursor: b.cursor, mode: c.mode, edit: c.edit, toast: c.toast.slice(0, 80) })
    await pg.keyboard.press('Escape')
  }
}
// 4 2 タブ
{
  await reset(env); await gotoCell(pg, 2, 'R030', '部品名')
  const B = await env.context.newPage(); await B.goto(env.url); await B.waitForSelector('[data-testid="grid"]'); await B.locator('.gridwrap').focus()
  await gotoCell(B, 1, 'R030', '部品名'); await B.keyboard.press('Alt+h'); await sleep(300)
  await pg.bringToFront(); await sleep(300)
  const a = await snap(pg)
  await pg.keyboard.type('Knowles', { delay: 30 }); await sleep(100)
  const b = await snap(pg)
  let c = null; if (b.mode === '編集') { await pg.keyboard.press('Enter'); await sleep(100); c = await snap(pg) }
  log({ case: '4a B が A のカーソルの行（2 で R030）を隠した → A で Knowles', cursorA: [a.cursor, b.cursor], mode: b.mode, edit: b.edit, afterEnter: c ? diffRows(a, c) : null, toast: b.toast.slice(0, 80), visibleHasR030: (await visible()).includes('R030') })
  await gotoCell(B, 1, 'R031', '部品名'); await B.keyboard.press('Shift+Delete'); await sleep(80); if (await B.evaluate(() => !!document.querySelector('[data-testid^="panel-"]'))) { await B.keyboard.press('ArrowDown'); await B.keyboard.press('Enter') } await sleep(300)
  await pg.bringToFront(); await gotoCell(pg, 1, 'R032', '部品名'); await pg.keyboard.press('ArrowUp'); await sleep(50)
  const d = await snap(pg)
  log({ case: '4b B が R031 を削除 → A で R032 から ↑', cursor: d.cursor })
  await B.close()
}
log({ errors: env.errs })
saveJson('76-hide-undo.json', out); await env.browser.close()
