// ラウンド11: 24 の続き。保存できないときの 公開（変更セットの理由を選ぶ）・採用（設計＝選定者）・Ctrl+Z → リロードで何が残るか
import { open, reset, sleep, logger, gotoCell, installToastLog, takeToasts, state } from './lib13.mjs'
const port = Number(process.env.PORT ?? 5176)
const env = await open(port); const pg = env.page; const log = logger(`24b-storage-actions2-${port}.json`)
const LSK = 'bom-pro.workspace.v2'
const breakSave = () => pg.evaluate((k) => { const orig = Storage.prototype.setItem; Storage.prototype.setItem = function (key, v) { if (this === window.localStorage && key === k) throw new DOMException('quota', 'QuotaExceededError'); return orig.call(this, key, v) } }, LSK)
const info = () => pg.evaluate((k) => { const w = JSON.parse(localStorage.getItem(k)); const p = w.projects.find((x) => x.id === w.currentProjectId); const r10 = p.rows.find((r) => r.id === 'R010'); const r4 = p.rows.find((r) => r.id === 'R004'); return { subs: p.submissions.length, r010: r10.working?.name ?? r10.name, r004: `${r4.status}/${r4.adoptedSupplierId ?? '-'}` } }, LSK)
async function run(name, pre, toks) {
  await reset(env); await gotoCell(pg, 1, 'R010', '部品名')
  for (const t of pre) { if (t.startsWith('T:')) await pg.keyboard.type(t.slice(2)); else if (t.startsWith('GO:')) { const [r, c] = t.slice(3).split('/'); await gotoCell(pg, 1, r, c) } else await pg.keyboard.press(t); await sleep(60) }
  await sleep(400); const before = await info()
  await breakSave(); await installToastLog(pg); await takeToasts(pg)
  for (const t of toks) { if (t.startsWith('T:')) await pg.keyboard.type(t.slice(2)); else await pg.keyboard.press(t); await sleep(150) }
  await sleep(300); const toasts = (await takeToasts(pg)).filter((x) => !x.startsWith('保存しました'))
  await pg.reload(); await pg.waitForSelector('[data-testid="grid"]'); await sleep(200)
  log({ name, before, toasts, afterReload: await info() })
}
await run('P1 公開（R010 部品名を変えて Ctrl+Enter → 1 → Enter）', ['T:PUB', 'Enter', 'ArrowUp'], ['Control+Enter', '1', 'Enter'])
await run('P2 採用 Alt+a（設計＝選定者、R004）', ['GO:R004/ID'], ['Alt+a'])
await run('P3 採用 Shift+A → 2 → 2 → Enter（1 位以外）', ['GO:R004/ID'], ['Shift+A', '2', '2', 'Enter'])
await run('P4 R010 部品名を変えたあと Ctrl+Z（保存できない）→ リロード', ['T:UNDO-ME', 'Enter', 'ArrowUp'], ['Control+z'])
console.log('errors', JSON.stringify(env.errs.slice(0, 5)))
log.save(); await env.browser.close()
