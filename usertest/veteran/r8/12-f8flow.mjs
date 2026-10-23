// ラウンド8: F8 / n の流れの途中で直す・確認する（V7-03 の修正「前に飛んだ位置から続ける」の範囲を調べる）
// 設計・4 要確認。各手順のあとのカーソルを記録
import { open, reset, gotoCell, snap, diffRows, sleep, saveJson, installToastLog, takeToasts, state } from './lib8.mjs'
const port = Number(process.env.PORT ?? 5176)
const env = await open(port); const pg = env.page; const out = []
const model = (id) => pg.evaluate((id) => { const w = JSON.parse(localStorage.getItem('bom-pro.workspace.v2')); const p = w.projects.find((x) => x.id === w.currentProjectId); const r = p.rows.find((x) => x.id === id); return r.working?.model ?? r.model }, id)
async function run(name, toks, expect) {
  await reset(env); await pg.keyboard.press('Alt+4'); await sleep(50)
  await installToastLog(pg); await takeToasts(pg)
  const a = await snap(pg); const seq = []
  for (const t of toks) {
    if (t.startsWith('G:')) { await pg.keyboard.press('Control+g'); await pg.getByTestId('prompt-text').fill(t.slice(2)); await pg.keyboard.press('Enter') }
    else if (t.startsWith('C:')) { await pg.keyboard.press('Home'); for (let i = 0; i < 40 && !(await state(pg)).cursor.endsWith(' ' + t.slice(2)); i++) await pg.keyboard.press('ArrowRight') }
    else if (t.startsWith('T:')) await pg.keyboard.type(t.slice(2))
    else if (t.startsWith('FIX:')) { const m = (await model(t.slice(4))).trim(); await pg.keyboard.press('F2'); await pg.keyboard.press('Control+a'); await pg.keyboard.type(m) }
    else await pg.keyboard.press(t)
    await sleep(70)
    const s = await state(pg); seq.push(`${t}→${s.cursor}${s.mode !== 'ナビ' ? '(' + s.mode + ')' : ''}${s.panel ? '[' + s.panel + ']' : ''}`)
  }
  const b = await snap(pg)
  const rec = { name, seq, expect, last: (await state(pg)).cursor, diff: diffRows(a, b), toasts: (await takeToasts(pg)).filter((x) => !x.startsWith('保存しました')).slice(-4) }
  out.push(rec); console.log(JSON.stringify(rec).slice(0, 1200))
}
await run('A 一覧の順番', ['F8', 'F8', 'F8', 'F8', 'F8', 'F8', 'F8', 'F8'], '一覧の順')
await run('B F8 で R005 → 型式を直して Enter（下へ移る）→ F8', ['F8', 'F8', 'F8', 'F8', 'F8', 'F8', 'FIX:R005', 'Enter', 'F8'], 'R061')
await run('C F8 で R005 → 型式を直して Tab（右へ移る）→ F8', ['F8', 'F8', 'F8', 'F8', 'F8', 'F8', 'FIX:R005', 'Tab', 'F8'], 'R061')
await run('D F8 で R005 → 直して Enter → ↑ で戻る → F8', ['F8', 'F8', 'F8', 'F8', 'F8', 'F8', 'FIX:R005', 'Enter', 'ArrowUp', 'F8'], 'R061')
await run('E F8 で R005 → Alt+x → F8', ['F8', 'F8', 'F8', 'F8', 'F8', 'F8', 'Alt+x', 'F8'], 'R061')
await run('F F8 で R005 → Ctrl+. → 1 → F8', ['F8', 'F8', 'F8', 'F8', 'F8', 'F8', 'Control+.', '1', 'Enter', 'F8'], 'R061')
await run('G Ctrl+G で R005 型式 → 直して Tab → Shift+Tab → F8', ['G:R005', 'C:型式', 'FIX:R005', 'Tab', 'Shift+Tab', 'F8'], 'R061')
await run('H Ctrl+G で R005 ID → x → n', ['G:R005', 'Home', 'x', 'n'], 'R061')
await run('I 4 で ↓ を押して R005 → ID で x → F8', ['Control+ArrowUp', 'ArrowDown', 'Home', 'ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowDown', 'x', 'F8'], 'カーソルの行の次')
await run('J F8 で R005 → Alt+x → Ctrl+Z → F8', ['F8', 'F8', 'F8', 'F8', 'F8', 'F8', 'Alt+x', 'Control+z', 'F8'], 'R061')
await run('K F8 で R005 → Alt+x → Shift+F8', ['F8', 'F8', 'F8', 'F8', 'F8', 'F8', 'Alt+x', 'Shift+F8'], 'R054')
await run('L F8 で R054 → 必要数を直して Enter → F8', ['F8', 'F8', 'F8', 'F8', 'F8', 'T:5', 'Enter', 'F8'], 'R005')
await run('M F8 で R061（最後）→ Alt+x → F8', ['F8', 'F8', 'F8', 'F8', 'F8', 'F8', 'F8', 'Alt+x', 'F8'], 'R016（先頭に回る）')
await run('N F8 で R041 → Ctrl+G R005 → Alt+x → F8', ['F8', 'F8', 'F8', 'G:R005', 'Alt+x', 'F8'], 'R061')
await run('O F8 で R005 → Alt+x → Alt+1 → Alt+4 → F8', ['F8', 'F8', 'F8', 'F8', 'F8', 'F8', 'Alt+x', 'Alt+1', 'Alt+4', 'F8'], 'R061?')
console.log('errors', JSON.stringify(env.errs.slice(0, 5)))
saveJson('12-f8flow.json', out); await env.browser.close()
