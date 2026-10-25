// ラウンド13: Undo / Redo とリロード・2 タブ（公開・採用・隠す・Redo をリロードの後で・別のタブが同じセルを変えたあとの Ctrl+Z）
import { open, reset, gotoCell, sleep, logger, state, installToastLog, takeToasts } from './lib22.mjs'
const port = Number(process.env.PORT ?? 5176)
const env = await open(port); const pg = env.page; const log = logger(`67-undo-r13-${port}.json`)
const LSK = 'bom-pro.workspace.v2'
const info = (p = pg) => p.evaluate((k) => { const w = JSON.parse(localStorage.getItem(k)); const p = w.projects.find((x) => x.id === w.currentProjectId); const r = (id) => p.rows.find((x) => x.id === id); const nm = (id) => r(id)?.working?.name ?? r(id)?.name; return { proj: w.currentProjectId, nproj: w.projects.length, revs: p.submissions.map((s) => s.rev).join(','), r010: nm('R010'), r010pub: r('R010')?.name, r011: nm('R011'), r010hidden: !!r('R010')?.hidden, r004: r('R004')?.status, hist: (sessionStorage.getItem('bom-pro.history.v1') ?? sessionStorage.getItem(Object.keys(sessionStorage).find((x) => /hist|undo/i.test(x)) ?? '') ?? '').length } }, LSK)
const reload = async (p = pg) => { await p.reload(); await p.waitForSelector('[data-testid="grid"]'); await p.locator('.gridwrap').focus(); await sleep(300) }
async function step(p, k) {
  if (k === 'RELOAD') return reload(p)
  if (k.startsWith('T:')) return p.keyboard.type(k.slice(2))
  if (k.startsWith('G:')) { await p.keyboard.press('Control+g'); await p.getByTestId('prompt-text').fill(k.slice(2)); return p.keyboard.press('Enter') }
  if (k.startsWith('PAL:')) { await p.keyboard.press('Control+k'); await p.getByTestId('palette-input').fill(k.slice(4)); await sleep(100); return p.keyboard.press('Enter') }
  return p.keyboard.press(k)
}
async function run(name, toks, expect) {
  await reset(env); await gotoCell(pg, 1, 'R010', '部品名'); await installToastLog(pg); await takeToasts(pg)
  const seq = []
  for (const k of toks) { await step(pg, k); await sleep(200); if (k === 'RELOAD') await installToastLog(pg); const s = await state(pg); const i = await info(); seq.push(`${k}→${s.cursor}${s.panel ? '{' + s.panel + '}' : ''} r010=${i.r010}${i.r010hidden ? '(隠)' : ''} r004=${i.r004} revs=${i.revs} proj=${i.proj}/${i.nproj} «${s.toast.slice(0, 90)}»`) }
  log({ name, expect, seq })
}
await run('W1 R010 編集 → 公開 → リロード → Ctrl+Z → Ctrl+Z', ['T:PUB1', 'Enter', 'Control+Enter', '2', 'Enter', 'RELOAD', 'Control+z', 'Control+z'], '公開は戻せないと知らせる（または公開前の編集を戻さない）')
await run('W2 R010 編集 → リロード → Ctrl+Z → リロード → Ctrl+Y', ['T:EDIT1', 'Enter', 'RELOAD', 'Control+z', 'RELOAD', 'Control+y'], 'EDIT1 に戻る')
await run('W3 R010 を隠す（Alt+h）→ すぐリロード → Ctrl+Z → Ctrl+Y → リロード', ['ArrowUp', 'Alt+h', 'RELOAD', 'Control+z', 'Control+y', 'RELOAD'], '隠す → 戻す → 隠す')
await run('W4 R004 a（採用）→ リロード → Ctrl+Z → リロード → Ctrl+Y', ['G:R004', 'Home', 'a', 'RELOAD', 'Control+z', 'RELOAD', 'Control+y'], 'quoted → selected')
await run('W5 新しいBOM（1 つずつ）→ リロード → Ctrl+Z', ['PAL:新しいBOM', 'T:P-UNDO', 'Enter', 'Enter', 'Enter', 'Enter', 'Enter', 'Enter', 'Enter', '3', 'Enter', 'Enter', 'T:X1', 'Enter', 'RELOAD', 'Control+z', 'Control+z', 'Control+z'], '新しい案件の中だけ戻す（前の案件の操作を戻さない）')
// 2 タブ
{
  await reset(env); await gotoCell(pg, 1, 'R010', '部品名'); await installToastLog(pg); await takeToasts(pg)
  await pg.keyboard.type('A1'); await pg.keyboard.press('Enter'); await sleep(200)
  const B = await env.context.newPage(); await B.goto(env.url); await B.waitForSelector('[data-testid="grid"]'); await B.locator('.gridwrap').focus()
  await gotoCell(B, 1, 'R010', '部品名'); await B.keyboard.type('B1'); await B.keyboard.press('Enter'); await sleep(400)
  await pg.bringToFront(); await sleep(200)
  const before = await info()
  await pg.keyboard.press('Control+z'); await sleep(300)
  const after = await info(); const s = await state(pg)
  log({ name: 'W6 A が R010 を A1 → B が R010 を B1 → A で Ctrl+Z', expect: '別のタブが変えたセルを黙って戻さない（知らせる）', before, after, toast: s.toast, toasts: (await takeToasts(pg)).slice(-3) })
  await B.close()
}
{
  await reset(env); await gotoCell(pg, 1, 'R010', '部品名'); await installToastLog(pg); await takeToasts(pg)
  await pg.keyboard.type('A1'); await pg.keyboard.press('Enter'); await sleep(200)
  const B = await env.context.newPage(); await B.goto(env.url); await B.waitForSelector('[data-testid="grid"]'); await B.locator('.gridwrap').focus()
  await gotoCell(B, 1, 'R010', 'ID'); await B.keyboard.press('Control+Enter'); await sleep(200); await B.keyboard.press('2'); await B.keyboard.press('Enter'); await sleep(400)
  await pg.bringToFront(); await sleep(200)
  const before = await info()
  await pg.keyboard.press('Control+z'); await sleep(300)
  const after = await info(); const s = await state(pg)
  log({ name: 'W7 A が R010 を A1 → B が公開（A1 が Rev.2 に）→ A で Ctrl+Z', expect: '公開済みの変更は戻せない（知らせる）', before, after, toast: s.toast, toasts: (await takeToasts(pg)).slice(-3) })
  await B.close()
}
console.log('errors', JSON.stringify(env.errs.slice(0, 5)))
log.save(); await env.browser.close()
