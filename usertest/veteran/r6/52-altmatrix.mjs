// ラウンド6: Alt+英字 / Alt+Shift+英字 / Ctrl+Alt+英字 / F8 / Shift+F8 を 3 役割 × 文字を打てるセル・打てないセル で全部押す（実打鍵）。
// 何が起きたか（データの差分・パネル・ビュー・並び・絞り込み・編集）と、ブラウザの既定動作を止めたか（defaultPrevented）を記録。
// あわせて編集中・絞り込み欄・パレット・指摘の本文で Alt+英字を押したときの入力欄の中身。
import { open, reset, gotoCell, snap, diffRows, sleep, saveJson } from './lib6.mjs'
import { installPrevLog, takePrevLog } from './lib6.mjs'
const port = Number(process.env.PORT ?? 5173)
const env = await open(port)
const pg = env.page
const letters = 'abcdefghijklmnopqrstuvwxyz'.split('')
const SPOTS = [
  ['design', 1, 'R040', '部品名', '設計・文字を打てる列'],
  ['design', 1, 'R040', 'ID', '設計・ID 列'],
  ['purchasing', 9, 'first', '単価', '購買・9 単価'],
  ['purchasing', 3, 'first', 'ロット', '購買・3 ロット'],
  ['pm', 7, 'first', null, 'PM・7'],
]
const out = { matrix: [], edit: [], inputs: [] }
async function place(role, view, rowId, col) {
  await reset(env, { role })
  if (rowId !== 'first') await gotoCell(pg, view, rowId, col)
  else {
    await pg.keyboard.press(String(view)); await sleep(40); await pg.keyboard.press('ArrowDown'); await sleep(20)
    if (col) { await pg.keyboard.press('Home'); for (let i = 0; i < 70 && !(await pg.getByTestId('cursor').textContent()).endsWith(' ' + col); i++) await pg.keyboard.press('ArrowRight') }
  }
  await installPrevLog(pg); await takePrevLog(pg)
}
const ONLY = process.env.ONLY_SPOT ? Number(process.env.ONLY_SPOT) : null
for (const [si, [role, view, rowId, col, label]] of SPOTS.entries()) {
  if (ONLY !== null && ONLY !== si) continue
  const keys = [...letters.map((l) => `Alt+Key${l.toUpperCase()}`), ...letters.map((l) => `Alt+Shift+Key${l.toUpperCase()}`), ...letters.map((l) => `Control+Alt+Key${l.toUpperCase()}`), 'F8', 'Shift+F8', 'Alt+F8', 'Alt+Digit4', 'Alt+ArrowDown', 'Alt+ArrowRight', 'Alt+Home', 'Alt+Enter', 'Alt+Space', 'Alt+Slash']
  for (const k of keys) {
    await place(role, view, rowId, col)
    const a = await snap(pg)
    await pg.keyboard.press(k); await sleep(120)
    const b = await snap(pg)
    const prev = (await takePrevLog(pg)).filter((x) => !['Alt', 'Shift', 'Control'].includes(x.key))
    const d = diffRows(a, b)
    const effect = [d.length ? 'diff:' + d.join(';').slice(0, 160) : '', b.panel ? 'panel:' + b.panel : '', a.view !== b.view ? 'view:' + b.view : '', a.chips !== b.chips ? 'chips:' + b.chips : '', b.mode === '編集' ? 'EDIT:' + b.edit : '', a.cursor !== b.cursor ? 'cursor:' + b.cursor : ''].filter(Boolean).join(' | ')
    const rec = { spot: label, key: k, prevented: prev[0]?.prevented ?? null, effect: effect || '(なし)', toast: b.toast.slice(0, 90) }
    out.matrix.push(rec)
    console.log(label, '|', k, '| prevented', rec.prevented, '|', rec.effect, '| toast', rec.toast)
  }
}
// 編集中・入力欄で Alt+英字
if (ONLY === null || ONLY === 99) {
  for (const k of ['Alt+KeyX', 'Alt+KeyH', 'Alt+KeyD', 'Alt+KeyE', 'Alt+KeyF', 'Alt+KeyN', 'Alt+Shift+KeyI', 'Control+Alt+KeyA', 'Alt+KeyA', 'F8', 'Alt+ArrowDown', 'Alt+ArrowUp']) {
    await place('design', 1, 'R040', '部品名')
    const a = await snap(pg)
    await pg.keyboard.type('abc'); await sleep(50)
    await pg.keyboard.press(k); await sleep(120)
    const b = await snap(pg)
    const prev = (await takePrevLog(pg)).filter((x) => !['Alt', 'Shift', 'Control', 'a', 'b', 'c'].includes(x.key))
    const rec = { where: '編集中（部品名に abc）', key: k, prevented: prev[0]?.prevented ?? null, mode: b.mode, edit: b.edit, panel: b.panel, cursor: b.cursor, diff: diffRows(a, b), toast: b.toast.slice(0, 90) }
    out.edit.push(rec)
    console.log('EDIT', k, JSON.stringify(rec))
  }
  for (const [where, openIt, sel] of [
    ['絞り込み欄', async () => { await pg.keyboard.press('/'); await sleep(40); await pg.keyboard.type('abc') }, '.filter'],
    ['パレット', async () => { await pg.keyboard.press('Control+k'); await sleep(40); await pg.keyboard.type('abc') }, '[data-testid="palette-input"]'],
    ['指摘の本文（購買）', async () => { await reset(env, { role: 'purchasing' }); await gotoCell(pg, 1, 'R040', '部品名'); await pg.keyboard.press('Shift+I'); await sleep(60); await pg.keyboard.press('h'); await sleep(60); await pg.keyboard.type('abc') }, 'textarea, [data-testid="panel-issue"] input'],
  ]) {
    for (const k of ['Alt+KeyX', 'Alt+KeyH', 'Alt+KeyN', 'Alt+KeyD', 'F8', 'Control+Alt+KeyA']) {
      await place('design', 1, 'R040', '部品名')
      await openIt()
      await installPrevLog(pg); await sleep(20); await takePrevLog(pg)
      const a = await snap(pg)
      await pg.keyboard.press(k); await sleep(120)
      const b = await snap(pg)
      const val = await pg.evaluate((s) => [...document.querySelectorAll(s)].map((e) => e.value).join('|'), sel)
      const prev = (await takePrevLog(pg)).filter((x) => !['Alt', 'Shift', 'Control', 'a', 'b', 'c', 'h', 'I', '/', 'k'].includes(x.key))
      const rec = { where, key: k, prevented: prev.at(-1)?.prevented ?? null, value: val, panel: b.panel, mode: b.mode, diff: diffRows(a, b), toast: b.toast.slice(0, 90) }
      out.inputs.push(rec)
      console.log('INPUT', where, k, JSON.stringify(rec))
    }
  }
}
console.log('errors', env.errs.slice(0, 8))
out.errors = env.errs
await env.browser.close()
saveJson(process.env.OUT ?? `52-altmatrix-${port}.json`, out)
