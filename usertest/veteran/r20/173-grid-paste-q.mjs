// ラウンド20: 表への貼り付け（Ctrl+V、タブ区切り）の引用符の境目（最後の列の「"」、連続する「"」、閉じない「"」、複数行のセル＋インチ）。部品名・型式・メーカの 3 列を R078 から
import { open, reset, gotoCell, sleep, logger } from './lib20.mjs'
const port = Number(process.env.PORT ?? 5176)
const env = await open(port); const pg = env.page; const log = logger(`173-grid-paste-q-${port}${process.env.RUN ?? ''}.json`)
await env.context.grantPermissions(['clipboard-read', 'clipboard-write'])
const rowsOf = () => pg.evaluate(() => { const w = JSON.parse(localStorage.getItem('bom-pro.workspace.v2')); const p = w.projects.find((x) => x.id === w.currentProjectId); const i = p.rows.findIndex((x) => x.id === 'R078'); return { n: p.rows.length, rows: p.rows.slice(i, i + 6).map((r) => [r.name, r.model, r.maker].join('|')) } })
const toast = () => pg.evaluate(() => (document.querySelector('[data-testid="toast-float"]') ?? document.querySelector('[data-testid="toast"]'))?.textContent?.slice(0, 200) ?? '')
const CASES = [
  ['G1', '連続する最後の列の「"」', 'A\tM-1\t"\nB\tM-2\t"\nC\tM-3\tmk\n', '3 行（A B C）'],
  ['G2', '最後の列の「"」の次の行の最後がインチ', 'A\tM-1\t"\nB\tM-2\t3/4"\n', '2 行'],
  ['G3', '部品名が複数行のセル、次の行に普通の行', '"A\nB"\tM-1\tmk\nC\tM-2\tmk2\n', '2 行（部品名「A B」と C）'],
  ['G4', '先頭の列が「"」', '"\tM-1\tmk\nB\tM-2\tmk2\n', '2 行'],
  ['G5', '閉じない「"」で始まるセル', 'A\t"x\tmk\nB\tM-2\tmk2\n', '2 行'],
  ['G6', '中のセルが「"」で、次の行の先頭がインチ', 'A\t"\tmk\n1/2" pipe\tM-2\tmk2\n', '2 行'],
  ['G7', '1 行に 3 セルで 2 番目が複数行のセル、3 番目がコンマ入り', 'A\t"M\n1"\tOmron, Inc.\nB\tM-2\tmk2\n', '2 行'],
  ['G8', '空のセルが続く行と「"」', 'A\t\t"\n\t\t\nB\tM-2\tmk\n', '3 行（2 行目は空）'],
]
for (const [id, note, text, expect] of CASES) {
  await reset(env); await gotoCell(pg, 1, 'R078', '部品名')
  const before = await rowsOf()
  await pg.evaluate((t) => navigator.clipboard.writeText(t), text)
  await pg.keyboard.press('Control+v'); await sleep(500)
  const after = await rowsOf()
  log({ id, note, expect, before: before.n, after, toast: await toast(), errs: env.errs.filter((e) => e.type !== 'dialog').slice(-2).map((e) => e.text.slice(0, 120)) })
}
log({ name: 'console/pageerror', errs: env.errs.slice(0, 20) })
log.save(); await env.browser.close()
