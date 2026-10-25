// ラウンド10: Undo / Redo の長い連鎖とリロード。60 回の編集 → リロード → Ctrl+Z ×60、2,500 行の貼り付け → 編集 5 → リロード → Ctrl+Z ×6、
// 打って矢印で確定した値の Undo、ページ内 0ms の Ctrl+Z 連打
import { open, reset, gotoCell, snap, sleep, logger, state, installToastLog, takeToasts, typeSeqM } from './lib21.mjs'
const port = Number(process.env.PORT ?? 5176)
const env = await open(port); const pg = env.page; const log = logger(`05-undo-reload-${port}.json`)
await env.context.grantPermissions(['clipboard-read', 'clipboard-write'])
const proj = () => pg.evaluate(() => { const w = JSON.parse(localStorage.getItem('bom-pro.workspace.v2')); const p = w.projects.find((x) => x.id === w.currentProjectId); return { n: p.rows.length, names: p.rows.slice(0, 70).map((r) => r.working?.name ?? r.name), hist: (sessionStorage.getItem('bom-pro.history') ?? '').length } })
const reload = async () => { await pg.reload(); await pg.waitForSelector('[data-testid="grid"]'); await pg.locator('.gridwrap').focus(); await sleep(300) }
// U1: 60 回の編集（R001〜R060 の部品名）→ リロード → Ctrl+Z ×60
{
  await reset(env); await gotoCell(pg, 1, 'R001', '部品名'); const p0 = await proj()
  for (let i = 0; i < 60; i++) { await pg.keyboard.type('U' + i); await pg.keyboard.press('Enter') }
  await sleep(500); const p1 = await proj(); await reload(); await installToastLog(pg); await takeToasts(pg)
  let undone = 0, lastToast = ''
  for (let i = 0; i < 62; i++) { await pg.keyboard.press('Control+z'); await sleep(30) }
  const p2 = await proj(); const toasts = await takeToasts(pg)
  undone = p2.names.filter((n, i) => n === p0.names[i]).length - p0.names.filter((n, i) => n === p1.names[i]).length
  log({ case: 'U1 60 編集 → リロード → Ctrl+Z ×62', histLen: p1.hist, restoredNames: p2.names.slice(0, 12), stillEdited: p2.names.filter((n) => /^U\d+$/.test(n)).length, lastToasts: toasts.filter((t) => !t.startsWith('保存')).slice(-2) })
}
// U1b: 同じ 60 回 → リロードなしで Ctrl+Z ×62
{
  await reset(env); await gotoCell(pg, 1, 'R001', '部品名')
  for (let i = 0; i < 60; i++) { await pg.keyboard.type('U' + i); await pg.keyboard.press('Enter') }
  await installToastLog(pg); await takeToasts(pg)
  for (let i = 0; i < 62; i++) { await pg.keyboard.press('Control+z'); await sleep(30) }
  const p2 = await proj(); const toasts = await takeToasts(pg)
  log({ case: 'U1b 60 編集 → Ctrl+Z ×62（リロードなし）', stillEdited: p2.names.filter((n) => /^U\d+$/.test(n)).length, lastToasts: toasts.filter((t) => !t.startsWith('保存')).slice(-2) })
}
// U2: 2,500 行の貼り付け → 5 編集 → リロード → Ctrl+Z ×6
{
  await reset(env); await gotoCell(pg, 1, 'R080', '部品名')
  const tsv = Array.from({ length: 2500 }, (_, i) => `貼付${i}\tPM-${i}\tオムロン\t${(i % 9) + 1}`).join('\n')
  await pg.evaluate((t) => navigator.clipboard.writeText(t), tsv); const n0 = (await proj()).n
  await pg.keyboard.press('Control+v'); await pg.waitForFunction((n0) => { const w = JSON.parse(localStorage.getItem('bom-pro.workspace.v2')); const p = w.projects.find((x) => x.id === w.currentProjectId); return p.rows.length !== n0 }, n0, { timeout: 60000 }).catch(() => {})
  await sleep(500); const n1 = (await proj()).n
  await gotoCell(pg, 1, 'R010', '部品名'); for (let i = 0; i < 5; i++) { await pg.keyboard.type('V' + i); await pg.keyboard.press('Enter') }
  await sleep(600); const h1 = (await proj()).hist
  await reload(); await installToastLog(pg); await takeToasts(pg)
  const steps = []
  for (let i = 0; i < 7; i++) { await pg.keyboard.press('Control+z'); await sleep(400); const p = await proj(); steps.push(`${p.n}行/${p.names.slice(9, 14).join(',')}`) }
  log({ case: 'U2 2,500 行貼り付け → 5 編集 → リロード → Ctrl+Z ×7', n0, n1, histLenBeforeReload: h1, steps, toasts: (await takeToasts(pg)).filter((t) => !t.startsWith('保存')).slice(-3) })
}
// U3: 打って矢印で確定（→ ↓ ← ↑）した 4 つの値 → Ctrl+Z ×4 → Ctrl+Y ×4（カーソルの位置も）
{
  await reset(env); await gotoCell(pg, 1, 'R020', '部品名'); await installToastLog(pg); await takeToasts(pg)
  const seq = []
  for (const [v, k] of [['a1', 'ArrowRight'], ['b2', 'ArrowDown'], ['c3', 'ArrowLeft'], ['d4', 'ArrowUp']]) { await pg.keyboard.type(v); await pg.keyboard.press(k); await sleep(60); seq.push(`${v}${k}→${(await state(pg)).cursor}`) }
  const s1 = await snap(pg)
  for (let i = 0; i < 4; i++) { await pg.keyboard.press('Control+z'); await sleep(60); seq.push(`Z→${(await state(pg)).cursor}`) }
  const s2 = await snap(pg)
  for (let i = 0; i < 4; i++) { await pg.keyboard.press('Control+y'); await sleep(60); seq.push(`Y→${(await state(pg)).cursor}`) }
  const s3 = await snap(pg)
  log({ case: 'U3 打って矢印で確定 ×4 → Z×4 → Y×4', seq, sameAfterRedo: s1.rows === s3.rows, undoneAll: !/a1|b2|c3|d4/.test(s2.rows) })
}
// U4: ページ内 0ms で 値 Enter ×10 → Ctrl+Z ×10 → Ctrl+Y ×10
{
  await reset(env); await gotoCell(pg, 1, 'R030', '必要数'); const a = await snap(pg)
  const seq = []; for (let i = 0; i < 10; i++) seq.push([String((i % 9) + 1), 0], [String(i % 10), 0], ['Enter', 0])
  await typeSeqM(pg, seq); await sleep(300); const b = await snap(pg)
  await typeSeqM(pg, Array.from({ length: 10 }, () => ['C-z', 0])); await sleep(500); const c = await snap(pg)
  await typeSeqM(pg, Array.from({ length: 10 }, () => ['C-y', 0])); await sleep(500); const d = await snap(pg)
  log({ case: 'U4 0ms 値 Enter ×10 → Z×10 → Y×10', changed: a.rows !== b.rows, undoneToStart: a.rows === c.rows, redoneToEdited: b.rows === d.rows })
}
console.log('errors', JSON.stringify(env.errs.slice(0, 5)))
log.save(); await env.browser.close()
