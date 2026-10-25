// ラウンド19: 表への貼り付け（Ctrl+V）も parseTable。ラウンド18 の修正（改行をまたぐ囲みを断るのは、タブ区切りでは中にタブがあるときだけ）で、
// 「"」（〃の代わり）の次の行に、閉じる「"」に見える文字（インチの 1/2"）があるとどうなるか。現行と r18 ビルド
import { open, reset, gotoCell, sleep, logger } from './lib21.mjs'
const port = Number(process.env.PORT ?? 5176)
const env = await open(port); const pg = env.page; const log = logger(`147-grid-paste-inch-${port}${process.env.RUN ?? ''}.json`)
await env.context.grantPermissions(['clipboard-read', 'clipboard-write'])
const rowsOf = (ids) => pg.evaluate((ids) => { const w = JSON.parse(localStorage.getItem('bom-pro.workspace.v2')); const p = w.projects.find((x) => x.id === w.currentProjectId); return { n: p.rows.length, rows: ids.map((id) => { const r = p.rows.find((x) => x.id === id); return r ? `${id}: ${r.working?.name ?? r.name} / ${r.working?.model ?? r.model}` : `${id}: なし` }), tail: p.rows.slice(-2).map((r) => `${r.id}: ${r.working?.name ?? r.name} / ${r.working?.model ?? r.model}`) } }, ids)
const toast = () => pg.evaluate(() => (document.querySelector('[data-testid="toast-float"]') ?? document.querySelector('[data-testid="toast"]'))?.textContent?.slice(0, 300) ?? '')
const CASES = [
  { id: 'H1', note: '3 行 × 部品名・型式・メーカ。2 行目のメーカが「"」（上と同じ）、3 行目の部品名が「グランド 1/2"」（インチ）', text: 'リレーA\tMY2N\tオムロン\nリレーB\tMY4N\t"\nグランド 1/2"\tOA-W1609\tオーム電機\n', expect: 'R078〜R080 の 3 行（R080 はグランド 1/2"）、R079 のメーカはオムロン' },
  { id: 'H2', note: '3 行 × 部品名・型式。2 行目の型式が「"」、3 行目の部品名が「パイプ 3/4"」', text: 'リレーA\tMY2N\nリレーB\t"\nパイプ 3/4"\tSGP-20\n', expect: '3 行' },
  { id: 'H3', note: '2 行 × 部品名・型式。1 行目の部品名が「"」（いちばん上の〃）、2 行目の型式の最後が「"」', text: '"\tMY2N\nリレーB\tPF-1/2"\n', expect: '2 行' },
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
