// ラウンド9: Undo / Redo の連鎖。いろいろな操作（値・隠す・複製・貼り付け・移動・削除・直して 4 から外れる・確認・置換）を速く続けたあと、
// Ctrl+Z を戻せなくなるまで → 最初と同じか、Ctrl+Y を最後まで → 操作後と同じか。各 Ctrl+Z / Ctrl+Y のあとのカーソル（「—」にならないか）
import { open, reset, gotoCell, snap, diffRows, sleep, saveJson, state, installToastLog, takeToasts } from './lib10.mjs'
const port = Number(process.env.PORT ?? 5176)
const env = await open(port); const pg = env.page; const out = []
await env.context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: env.url }).catch(() => {})
const rowsOf = () => pg.evaluate(() => { const w = JSON.parse(localStorage.getItem('bom-pro.workspace.v2')); const p = w.projects.find((x) => x.id === w.currentProjectId); return JSON.stringify({ rows: p.rows.map((r) => { const { statusChangedAt, ...x } = r; return x }), quotes: p.quotes, issues: p.issues.map((i) => ({ ...i, at: undefined })) }) })
async function confirm2() { await sleep(80); if (await pg.evaluate(() => !!document.querySelector('[data-testid^="panel-"]'))) { await pg.keyboard.press('2'); await sleep(60); if (await pg.evaluate(() => !!document.querySelector('[data-testid^="panel-"]'))) await pg.keyboard.press('Enter') } }
for (const variant of ['普通の間隔', '速く（間隔なし）']) {
  await reset(env); await installToastLog(pg)
  const fast = variant.startsWith('速く')
  const w = (ms) => (fast ? Promise.resolve() : sleep(ms))
  const r0 = await rowsOf(); const ops = []
  const op = async (name, fn) => { await fn(); await w(60); ops.push(`${name}→${(await state(pg)).cursor}`) }
  await op('R010 部品名 U1', async () => { await gotoCell(pg, 1, 'R010', '部品名'); await pg.keyboard.type('U1'); await pg.keyboard.press('Enter') })
  await op('R011 Alt+h', async () => { await pg.keyboard.press('Alt+h') })
  await op('Alt+Shift+D', async () => { await pg.keyboard.press('Alt+Shift+D') })
  await op('R020 貼り付け 3×2', async () => { await gotoCell(pg, 1, 'R020', '部品名'); await pg.evaluate(() => navigator.clipboard.writeText('P1\tM-1\nP2\tM-2\nP3\tM-3')); await pg.keyboard.press('Control+v'); await sleep(150) })
  await op('R030 Alt+↓', async () => { await gotoCell(pg, 1, 'R030', 'ID'); await pg.keyboard.press('Alt+ArrowDown') })
  await op('R031 Shift+Delete', async () => { await gotoCell(pg, 1, 'R031', 'ID'); await pg.keyboard.press('Shift+Delete'); await confirm2() })
  await op('R032 必要数 9', async () => { await gotoCell(pg, 1, 'R032', '必要数'); await pg.keyboard.type('9'); await pg.keyboard.press('Enter') })
  await op('4 R054 必要数 5（4 から外れる）', async () => { await gotoCell(pg, 4, 'R054', '必要数'); await pg.keyboard.type('5'); await pg.keyboard.press('Enter') })
  await op('R005 Alt+x', async () => { await gotoCell(pg, 4, 'R005', '型式'); await pg.keyboard.press('Alt+x') })
  await op('R040 h（ID）', async () => { await gotoCell(pg, 1, 'R040', 'ID'); await pg.keyboard.press('h') })
  await op('R041 備考 メモ', async () => { await gotoCell(pg, 1, 'R041', '備考'); await pg.keyboard.type('メモ'); await pg.keyboard.press('Tab'); await pg.keyboard.press('Escape') })
  await op('Shift+Enter 行追加 NEW', async () => { await gotoCell(pg, 1, 'R041', 'ID'); await pg.keyboard.press('Shift+Enter'); await sleep(60); await pg.keyboard.type('NEW'); await pg.keyboard.press('Enter') })
  const r1 = await rowsOf()
  await takeToasts(pg)
  const undo = []
  for (let i = 0; i < 40; i++) { await pg.keyboard.press('Control+z'); await w(80); const s = await state(pg); const t = (await takeToasts(pg)).filter((x) => !x.startsWith('保存しました')); undo.push(`${s.cursor}|${t.join('/').slice(0, 70)}`); if (t.some((x) => /戻せる操作がありません|取り消せる|ありません/.test(x))) break }
  const r2 = await rowsOf()
  const redo = []
  for (let i = 0; i < 40; i++) { await pg.keyboard.press('Control+y'); await w(80); const s = await state(pg); const t = (await takeToasts(pg)).filter((x) => !x.startsWith('保存しました')); redo.push(`${s.cursor}|${t.join('/').slice(0, 70)}`); if (t.some((x) => /やり直せる操作がありません|ありません/.test(x))) break }
  const r3 = await rowsOf()
  const d = (x, y) => diffRows({ rows: JSON.stringify(JSON.parse(x).rows), issues: 0, quotes: JSON.stringify(JSON.parse(x).quotes) }, { rows: JSON.stringify(JSON.parse(y).rows), issues: 0, quotes: JSON.stringify(JSON.parse(y).quotes) })
  const rec = { variant, ops, undoSteps: undo, undoEqualsStart: r0 === r2, diffStartVsUndone: d(r0, r2).slice(0, 12), redoSteps: redo, redoEqualsEnd: r1 === r3, diffEndVsRedone: d(r1, r3).slice(0, 12), cursorDash: [...undo, ...redo].filter((x) => x.startsWith('—')).length }
  out.push(rec); console.log(JSON.stringify(rec).slice(0, 3000))
}
console.log('errors', JSON.stringify(env.errs.slice(0, 5)))
saveJson('36-undo-chain.json', out); await env.browser.close()
