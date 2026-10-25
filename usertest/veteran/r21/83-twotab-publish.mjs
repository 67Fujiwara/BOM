// ラウンド14: 公開のダイアログの別タブの確かめ（V13-07 の修正）を、中身が同じに戻った・B を開いただけ・B が先に公開・B が Ctrl+Z・B が隠す・指摘を足す で
import { open, reset, gotoCell, snap, diffRows, sleep, logger, installToastLog, takeToasts, state } from './lib21.mjs'
const port = Number(process.env.PORT ?? 5176)
const env = await open(port); const A = env.page; const log = logger(`83-twotab-publish-${port}${process.env.RUN ?? ""}.json`)
async function tabB(role) {
  const B = await env.context.newPage(); await B.goto(env.url); await B.waitForSelector('[data-testid="grid"]')
  if (role) { await B.getByTestId(role === 'purchasing' ? 'role-purchasing' : 'role-pm').click(); for (let i = 0; i < 3; i++) { if (!(await B.evaluate(() => !!document.querySelector('[data-testid^="panel-"]')))) break; await B.keyboard.press('Enter') } }
  await B.locator('.gridwrap').focus(); return B
}
const S = async (pg) => { const s = await state(pg); return `${s.view}/${s.cursor}/${s.mode}${s.edit != null ? '[' + s.edit + ']' : ''}${s.panel ? '/' + s.panel : ''}` }
async function press(pg, k) { if (k.startsWith('T:')) return pg.keyboard.type(k.slice(2)); if (k.startsWith('PAL:')) { await pg.keyboard.press('Control+k'); await pg.getByTestId('palette-input').fill(k.slice(4)); await sleep(100); return pg.keyboard.press('Enter') } if (k === 'RELOAD') { await pg.reload(); await pg.waitForSelector('[data-testid="grid"]'); await pg.locator('.gridwrap').focus(); return sleep(200) } return pg.keyboard.press(k) }
const rowInfo = (pg, id) => pg.evaluate((id) => { const w = JSON.parse(localStorage.getItem('bom-pro.workspace.v2')); const p = w.projects.find((x) => x.id === w.currentProjectId); const r = p.rows.find((x) => x.id === id); const sup = (sid) => w.suppliers.find((s) => s.id === sid)?.name ?? sid; return { status: r.status, adopted: sup(r.adoptedSupplierId), reason: r.adoptReason ?? null, pm: r.flags?.pmPending ? r.flags.pmReason : null, hidden: !!r.hidden, requote: !!r.flags?.requote, model: r.working?.model ?? r.model, name: r.working?.name ?? r.name, stale: p.quotes.filter((q) => q.rowId === id && q.stale).length, revs: p.submissions.map((s) => s.rev).join(','), events: p.events.slice(-3).map((e) => e.text.slice(0, 40)) } }, id)
async function caseRun(name, { aRole, bRole, setupA, actB, actA, row = 'R004', expect }) {
  await reset(env, { role: aRole }); await setupA(); await installToastLog(A); await takeToasts(A)
  const a = await snap(A); const s0 = await S(A)
  const B = await tabB(bRole); await actB(B); await sleep(500)
  const afterB = await rowInfo(A, row)
  await A.bringToFront(); await sleep(300); const s1 = await S(A)
  const steps = []
  for (const k of actA) { await press(A, k); await sleep(200); steps.push(`${k}→${await S(A)}`) }
  const b = await snap(A)
  log({ case: name, expect, A0: s0, afterB: s1, rowAfterB: afterB, steps, rowFinal: await rowInfo(A, row), diff: diffRows(a, b).slice(0, 8), toastsA: (await takeToasts(A)).filter((t) => !t.startsWith('保存しました')).slice(-3) })
  for (let i = 0; i < 3; i++) await A.keyboard.press('Escape')
  await B.close()
}

const pubA = async () => { await gotoCell(A, 1, 'R010', '部品名'); await A.keyboard.type('PUB-A'); await A.keyboard.press('Enter'); await A.keyboard.press('Control+Enter'); await sleep(150) }
const subInfo = (pg) => pg.evaluate(() => { const w = JSON.parse(localStorage.getItem('bom-pro.workspace.v2')); const p = w.projects.find((x) => x.id === w.currentProjectId); const s = p.submissions.at(-1); return { revs: p.submissions.map((x) => x.rev).join(','), last: { rev: s.rev, rowIds: s.rowIds, causes: s.causes, reason: s.changeSet?.reason }, unpublished: p.rows.filter((r) => r.working && Object.keys(r.working).length).map((r) => r.id) } })
const sig = (pg) => pg.evaluate(() => { const w = JSON.parse(localStorage.getItem('bom-pro.workspace.v2')); const p = w.projects.find((x) => x.id === w.currentProjectId); const r = p.rows.find((x) => x.id === 'R010'); return JSON.stringify([r.status, r.working ?? null, r.removal ?? null, r.pendingRemoval ?? null, r.hidden ?? false]) })
async function q(name, actB, expect) {
  await caseRun(name, { row: 'R010', setupA: pubA, actB: async (B) => { const s0 = await sig(B); await actB(B); await sleep(400); log({ case: name + '（R010 の中身 B の前後）', before: s0, after: await sig(B) }) }, actA: ['2', 'Enter'], expect })
  log({ case: name + '（公開の記録）', sub: await subInfo(A) })
}
await q('Q1 B が R010 部品名を PUB-B → Ctrl+Z（PUB-A に戻る）', async (B) => { await gotoCell(B, 1, 'R010', '部品名'); await B.keyboard.type('PUB-B'); await B.keyboard.press('Enter'); await sleep(200); await B.keyboard.press('Control+z'); await sleep(200) }, '中身が同じなら公開する')
await q('Q2 B を開いただけ（何もしない）', async () => {}, '公開する')
await q('Q3 B を開いてリロード', async (B) => { await B.reload(); await B.waitForSelector('[data-testid="grid"]') }, '公開する')
await q('Q4 B が先に同じ行を公開（Ctrl+Enter 2 Enter）', async (B) => { await B.keyboard.press('Control+Enter'); await sleep(200); await B.keyboard.press('2'); await B.keyboard.press('Enter'); await sleep(300) }, 'A は公開しない（または二重の Rev を作らない）')
await q('Q5 B が R010 を隠す（Alt+h）', async (B) => { await gotoCell(B, 1, 'R010', 'ID'); await B.keyboard.press('Alt+h'); await sleep(200) }, '?（隠すのは表示だけ）')
await q('Q6 B が R010 に指摘を足す（Alt+Shift+I k 本文 Enter）', async (B) => { await gotoCell(B, 1, 'R010', 'ID'); await B.keyboard.press('Alt+Shift+I'); await sleep(150); await B.keyboard.type('k確認してください'); await B.keyboard.press('Enter'); await sleep(200) }, '公開する（指摘は公開の中身ではない）')
await q('Q7 B が R010 の必要数を 9 に', async (B) => { await gotoCell(B, 1, 'R010', '必要数'); await B.keyboard.type('9'); await B.keyboard.press('Enter') }, '止めて知らせる')
await q('Q8 B が R010 部品名を PUB-A のまま再入力（同じ値で Enter）', async (B) => { await gotoCell(B, 1, 'R010', '部品名'); await B.keyboard.press('F2'); await B.keyboard.press('Enter') }, '公開する（中身は同じ）')
console.log('errors', JSON.stringify(env.errs.slice(0, 5)))
log.save(); await env.browser.close()
