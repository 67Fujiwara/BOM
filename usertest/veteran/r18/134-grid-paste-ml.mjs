// ラウンド18: 表への貼り付け（Ctrl+V、タブ区切り）も parseTable を使う。ラウンド17 の修正（改行をまたぐ囲みは中に区切りが無く、改行の前後に文字があるときだけ）で、
// Excel の複数行のセル（セルの最後・先頭の改行、中のタブ）・「"」（〃の代わり）を表に貼るとどうなるか。現行と r17 ビルド
import { open, reset, gotoCell, sleep, logger } from './lib18.mjs'
const port = Number(process.env.PORT ?? 5176)
const env = await open(port); const pg = env.page; const log = logger(`134-grid-paste-ml-${port}${process.env.RUN ?? ''}.json`)
await env.context.grantPermissions(['clipboard-read', 'clipboard-write'])
const rowsOf = (ids) => pg.evaluate((ids) => { const w = JSON.parse(localStorage.getItem('bom-pro.workspace.v2')); const p = w.projects.find((x) => x.id === w.currentProjectId); return { n: p.rows.length, rows: ids.map((id) => { const r = p.rows.find((x) => x.id === id); return r ? `${id}: ${r.working?.name ?? r.name} / ${r.working?.model ?? r.model}` : `${id}: なし` }), tail: p.rows.slice(-2).map((r) => `${r.id}: ${r.working?.name ?? r.name} / ${r.working?.model ?? r.model}`) } }, ids)
const toast = () => pg.evaluate(() => (document.querySelector('[data-testid="toast-float"]') ?? document.querySelector('[data-testid="toast"]'))?.textContent?.slice(0, 300) ?? '')
const CASES = [
  { id: 'G1', note: '3 行 × 部品名・型式。2 行目の部品名のセルの最後に改行（Alt+Enter の打ち間違い）', text: 'リレーA\tMY2N\n"リレーB\n"\tMY4N\nリレーC\tMY3N\n', expect: 'R078〜R080 の 3 行（リレーB の名前は「リレーB」）、行は増えない' },
  { id: 'G2', note: '3 行 × 部品名・型式。2 行目の型式のセルの頭に改行', text: 'リレーA\tMY2N\nリレーB\t"\nMY4N"\nリレーC\tMY3N\n', expect: '3 行、行は増えない' },
  { id: 'G3', note: '3 行 × 部品名・型式。2 行目の部品名が複数行のセル（中に改行、前後に文字）', text: 'リレーA\tMY2N\n"リレーB\n予備"\tMY4N\nリレーC\tMY3N\n', expect: '3 行（リレーB 予備）' },
  { id: 'G4', note: '3 行 × 部品名・型式。部品名が「"」（〃の代わり）2 か所', text: 'リレーA\tMY2N\n"\tMY4N\n"\tMY3N\n', expect: '3 行（部品名は「"」のまま、つながらない）' },
  { id: 'G5', note: '最後の行の型式のセルが改行だけ（"\\n"）', text: 'リレーA\tMY2N\nリレーB\t"\n"\n', expect: '2 行、行は増えない' },
]
for (const c of CASES) {
  await reset(env); await gotoCell(pg, 1, 'R078', '部品名')
  const before = await rowsOf(['R078', 'R079', 'R080', 'R081'])
  await pg.evaluate((t) => navigator.clipboard.writeText(t), c.text)
  await pg.keyboard.press('Control+v'); await sleep(500)
  const after = await rowsOf(['R078', 'R079', 'R080', 'R081'])
  log({ id: c.id, note: c.note, expect: c.expect, before: before.n, after, toast: await toast(), errs: env.errs.filter((e) => e.type !== 'dialog').slice(-2).map((e) => e.text.slice(0, 120)) })
}
log({ name: 'console/pageerror', errs: env.errs.slice(0, 20) })
log.save(); await env.browser.close()
