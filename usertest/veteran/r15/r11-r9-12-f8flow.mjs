// ラウンド9: F8 / n の流れ（V7-03 の残りの再確認）。一覧の順番は r8 と同じ（R016 → R009 → R041 → R022 → R054 → R005 → R061）
// 「F8 を n 回」ではなく「その行に来るまで F8」で手順を作る。各手順のあとのカーソル（行・列）を記録
import { open, reset, snap, diffRows, sleep, saveJson, installToastLog, takeToasts, state } from './lib15.mjs'
const port = Number(process.env.PORT ?? 5176)
const env = await open(port); const pg = env.page; const out = []
const model = (id) => pg.evaluate((id) => { const w = JSON.parse(localStorage.getItem('bom-pro.workspace.v2')); const p = w.projects.find((x) => x.id === w.currentProjectId); const r = p.rows.find((x) => x.id === id); return r.working?.model ?? r.model }, id)
const visOrder = () => pg.evaluate(() => [...document.querySelectorAll('[data-testid="grid"] [data-row-id]')].map((e) => e.dataset.rowId).filter((x, i, a) => a.indexOf(x) === i).slice(0, 40))
async function run(name, view, toks, expect) {
  await reset(env); await pg.keyboard.press(`Alt+${view}`); await sleep(60)
  await installToastLog(pg); await takeToasts(pg)
  const a = await snap(pg); const seq = [`start→${(await state(pg)).cursor}`]
  for (const t of toks) {
    if (t.startsWith('G:')) { await pg.keyboard.press('Control+g'); await pg.getByTestId('prompt-text').fill(t.slice(2)); await pg.keyboard.press('Enter') }
    else if (t.startsWith('C:')) { await pg.keyboard.press('Home'); for (let i = 0; i < 40 && !(await state(pg)).cursor.endsWith(' ' + t.slice(2)); i++) await pg.keyboard.press('ArrowRight') }
    else if (t.startsWith('T:')) await pg.keyboard.type(t.slice(2))
    else if (t.startsWith('F8TO:')) { for (let i = 0; i < 12 && !(await state(pg)).cursor.startsWith(t.slice(5) + ' '); i++) await pg.keyboard.press('F8') }
    else if (t.startsWith('FIX:')) { const m = (await model(t.slice(4))).trim(); await pg.keyboard.press('F2'); await pg.keyboard.press('Control+a'); await pg.keyboard.type(m) }
    else if (t === 'RELOAD') { await pg.reload(); await pg.waitForSelector('[data-testid="grid"]'); await pg.locator('.gridwrap').focus(); await sleep(200) }
    else await pg.keyboard.press(t)
    await sleep(80)
    const s = await state(pg); seq.push(`${t}→${s.cursor}${s.mode !== 'ナビ' ? '(' + s.mode + ')' : ''}${s.panel ? '[' + s.panel + ']' : ''}`)
  }
  const b = await snap(pg)
  const rec = { name, seq, expect, last: (await state(pg)).cursor, diff: diffRows(a, b), toasts: (await takeToasts(pg)).filter((x) => !x.startsWith('保存しました')).slice(-4) }
  out.push(rec); console.log(JSON.stringify(rec).slice(0, 1400))
}
// 表示順（4・1）と F8 の一覧
await reset(env); await pg.keyboard.press('Alt+4'); await sleep(60)
out.push({ name: 'visual order view4', rows: await visOrder(), cursor: (await state(pg)).cursor }); console.log(JSON.stringify(out.at(-1)))
await run('A0 4 を開いた直後に F8 ×8', 4, ['F8', 'F8', 'F8', 'F8', 'F8', 'F8', 'F8', 'F8'], 'R016 から一覧の順（4 の先頭の行の問題から）')
await run('A1 1 で Ctrl+Home（R001）→ F8', 1, ['Control+Home', 'F8', 'F8'], 'R005（R001 より下で最初の問題）')
await run('A2 1 で Ctrl+G R001 → F8', 1, ['G:R001', 'F8'], 'R005')
await run('A3 1 で Ctrl+G R010 → F8', 1, ['G:R010', 'F8'], 'R016（R010 より下で最初）')
await run('A4 1 で Ctrl+G R042 → F8', 1, ['G:R042', 'F8'], 'R054')
await run('A5 1 で Ctrl+G R042 → Shift+F8', 1, ['G:R042', 'Shift+F8'], 'R041（R042 より上で最初）')
await run('A6 1 で Ctrl+G R005（部品名）→ F8', 1, ['G:R005', 'F8'], 'R005 型式（同じ行の問題）か R009')
await run('B F8 で R005 → 直して Enter → F8', 4, ['F8TO:R005', 'FIX:R005', 'Enter', 'F8'], 'R061')
await run('C F8 で R005 → 直して Tab → F8', 4, ['F8TO:R005', 'FIX:R005', 'Tab', 'F8'], 'R061')
await run('D F8 で R005 → 直して Enter → ↑ → F8', 4, ['F8TO:R005', 'FIX:R005', 'Enter', 'ArrowUp', 'F8'], 'R061')
await run('E F8 で R005 → Alt+x → F8', 4, ['F8TO:R005', 'Alt+x', 'F8'], 'R061')
await run('F F8 で R005 → Ctrl+. → 1 → Enter → F8', 4, ['F8TO:R005', 'Control+.', '1', 'Enter', 'F8'], 'R061')
await run('G Ctrl+G R005 型式 → 直して Tab → Shift+Tab → F8', 4, ['G:R005', 'C:型式', 'FIX:R005', 'Tab', 'Shift+Tab', 'F8'], 'R009 か R061（R005 より下）')
await run('H Ctrl+G R005 ID → x → n', 4, ['G:R005', 'Home', 'x', 'n'], 'R009 / R061（R005 より下）')
await run('I 4 で ↓ を押して R005 → ID で x → F8', 4, ['Control+ArrowUp', 'ArrowDown', 'Home', 'F8TO:R005', 'x', 'F8'], 'R061')
await run('J F8 で R005 → Alt+x → Ctrl+Z → F8', 4, ['F8TO:R005', 'Alt+x', 'Control+z', 'F8'], 'R061')
await run('K F8 で R005 → Alt+x → Shift+F8', 4, ['F8TO:R005', 'Alt+x', 'Shift+F8'], 'R054')
await run('L F8 で R054 → 必要数を直して Enter → F8', 4, ['F8TO:R054', 'T:5', 'Enter', 'F8'], 'R005')
await run('L2 F8 で R054 → 5 Enter のあとカーソル', 4, ['F8TO:R054', 'T:5', 'Enter'], '4 の R054 の次の行')
await run('M F8 で R061（最後）→ Alt+x → F8', 4, ['F8TO:R061', 'Alt+x', 'F8'], 'R016（先頭に回る）')
await run('N F8 で R041 → Ctrl+G R005 → Alt+x → F8', 4, ['F8TO:R041', 'G:R005', 'Alt+x', 'F8'], 'R005 より下')
await run('P F8 で R005 → リロード → F8', 4, ['F8TO:R005', 'RELOAD', 'F8'], 'R005 より下（R009?）')
await run('Q F8 で R005 → ↓↓↓ → F8', 4, ['F8TO:R005', 'ArrowDown', 'ArrowDown', 'ArrowDown', 'F8'], 'カーソルより下 or R061')
await run('R F8 で R022 → PageDown → F8', 1, ['F8TO:R022', 'PageDown', 'PageDown', 'F8'], '画面の先の問題（R054/R061）')
await run('S F8 で R005 → Alt+1 → Ctrl+End → F8', 4, ['F8TO:R005', 'Alt+1', 'Control+End', 'F8'], '先頭へ回る（R005 以降は無い）?')
console.log('errors', JSON.stringify(env.errs.slice(0, 5)))
saveJson(`12-f8flow-${port}.json`, out); await env.browser.close()
