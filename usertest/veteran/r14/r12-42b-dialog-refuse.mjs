// ラウンド12: 選ばずに Enter で断られたあと、案内どおり数字を押す（Tab・文字のあとの数字は文字になる）
import { open, reset, sleep, logger, gotoCell, installToastLog, takeToasts } from './lib14.mjs'
const port = Number(process.env.PORT ?? 5176)
const env = await open(port); const pg = env.page; const log = logger(`42b-dialog-refuse-${port}.json`)
const pi = () => pg.evaluate(() => { const p = document.querySelector('[data-testid^="panel-"]'); if (!p) return 'closed'; const sel = [...p.querySelectorAll('[aria-selected="true"], .selected, .sel')].map((e) => e.textContent.trim()).join('|'); return `sel=${sel.slice(0, 12)} text=${p.querySelector('[data-testid="prompt-text"]')?.value}` })
const subs = () => pg.evaluate(() => { const w = JSON.parse(localStorage.getItem('bom-pro.workspace.v2')); const p = w.projects.find((x) => x.id === w.currentProjectId); const r = p.rows.find((x) => x.id === 'R004'); return { last: JSON.stringify(p.submissions.at(-1)?.changeSet ?? null), r004: r.adoptReason ?? null } })
async function run(name, pre, toks) {
  await reset(env); await gotoCell(pg, 1, pre.row, pre.col); for (const t of pre.toks) { if (t.startsWith('T:')) await pg.keyboard.type(t.slice(2)); else await pg.keyboard.press(t); await sleep(40) }
  await installToastLog(pg); await takeToasts(pg); const seq = []
  for (const t of toks) { if (t.startsWith('T:')) await pg.keyboard.type(t.slice(2)); else await pg.keyboard.press(t); await sleep(100); seq.push(`${t}→${await pi()}`) }
  log({ name, seq, result: await subs(), toasts: (await takeToasts(pg)).map((x) => x.slice(0, 100)) })
}
const PUB = { row: 'R010', col: '部品名', toks: ['T:変更品', 'Enter', 'ArrowUp', 'Control+Enter'] }
const ADO = { row: 'R004', col: 'ID', toks: ['Shift+A', '2'] }
await run('R1 変更セット Tab → 2026-012 → Enter（断られる）→ 案内どおり 2 → Enter', PUB, ['Tab', 'T:2026-012', 'Enter', '2', 'Enter'])
await run('R2 変更セット 番号から「ECN-12」→ Enter（断られる）→ 2 → Enter', PUB, ['T:ECN-12', 'Enter', '2', 'Enter'])
await run('R3 採用理由 補足「急ぎ」→ Enter（断られる）→ 2 → Enter', ADO, ['T:急ぎ', 'Enter', '2', 'Enter'])
await run('R4 採用理由 補足「急ぎ」→ Enter（断られる）→ ↓ → Enter', ADO, ['T:急ぎ', 'Enter', 'ArrowDown', 'Enter'])
console.log('errors', JSON.stringify(env.errs.slice(0, 5)))
log.save(); await env.browser.close()
