// ラウンド13: 2 タブの衝突の続き（公開のダイアログを開いたあとに、ダイアログの行そのものが変わる・取消・隠す・公開される／理由つき採用と a・Ctrl+Alt+A／PM の決定パネル）
import { open, reset, gotoCell, snap, diffRows, sleep, logger, installToastLog, takeToasts, state } from './lib15.mjs'
const port = Number(process.env.PORT ?? 5176)
const env = await open(port); const A = env.page; const log = logger(`62-twotab-r13-${port}${process.env.ONLY_U ? "-u" : ""}.json`)
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
async function pubCase(name, actB, expect) {
  await caseRun(name, { row: 'R010', setupA: pubA, actB, actA: ['2', 'Enter'], expect })
  log({ case: name + '（公開の記録）', sub: await subInfo(A) })
}
if (!process.env.ONLY_U) await pubCase('P4 A 公開のダイアログ（R010 PUB-A を含む）→ B が R010 部品名をさらに PUB-B に → A 2 Enter', async (B) => { await gotoCell(B, 1, 'R010', '部品名'); await B.keyboard.type('PUB-B'); await B.keyboard.press('Enter') }, '公開する値が変わったことを知らせる（または B の値で公開と知らせる）')
if (!process.env.ONLY_U) await pubCase('P5 A 公開のダイアログ → B が R010（ダイアログの行）を取消（Shift+Delete）→ A 2 Enter', async (B) => { await gotoCell(B, 1, 'R010', 'ID'); await B.keyboard.press('Shift+Delete'); await sleep(150); await B.keyboard.press('Enter') }, '名前の変更として開いた行が取消として公開されるなら知らせる')
if (!process.env.ONLY_U) await pubCase('P6 A 公開のダイアログ → B が R076（追加の行）を隠す → A 2 Enter', async (B) => { await gotoCell(B, 1, 'R076', 'ID'); await B.keyboard.press('Alt+h') }, '?')
if (!process.env.ONLY_U) await pubCase('P7 A 公開のダイアログ → B が R010 部品名を元（端子台エンドカバー）に戻す → A 2 Enter', async (B) => { await gotoCell(B, 1, 'R010', '部品名'); await B.keyboard.press('Control+a').catch(() => {}); await B.keyboard.type('端子台エンドカバー'); await B.keyboard.press('Enter') }, '変更の無くなった行は公開しない')
if (!process.env.ONLY_U) await pubCase('P8 A 公開のダイアログ → B（購買）が R076 の発注数を入れる → A 2 Enter', async (B) => { await B.getByTestId('role-purchasing').click(); for (let i = 0; i < 3; i++) { if (!(await B.evaluate(() => !!document.querySelector('[data-testid^="panel-"]')))) break; await B.keyboard.press('Enter') } await B.locator('.gridwrap').focus(); await gotoCell(B, 1, 'R076', 'ID') }, '影響なし')
// 理由つきの採用と a / Ctrl+Alt+A（M12-07 の修正）
const toR004 = async () => { await gotoCell(A, 1, 'R004', 'ID') }
const bReason = async (B) => { await gotoCell(B, 1, 'R004', 'ID'); await B.keyboard.press('Shift+A'); await sleep(100); await B.keyboard.press('2'); await sleep(100); await B.keyboard.press('1'); await B.keyboard.press('Enter'); await sleep(200) }
await caseRun('U2 B（購買）が R004 を理由つきで 2 位を採用 → A（購買）が R004 で a', { aRole: 'design', setupA: toR004, actB: bReason, actA: ['a'], expect: '推奨で上書きしない（Alt+Shift+A を案内）' })
await caseRun('U3 B が理由つきで採用 → A が Ctrl+Alt+A（最安）', { aRole: 'design', setupA: toR004, actB: bReason, actA: ['Control+Alt+a'], expect: '上書きするなら理由の採用が消えると知らせる' })
await caseRun('U4 B が理由つきで採用 → A がパレット「未採用を推奨で一括採用」', { aRole: 'design', setupA: toR004, actB: bReason, actA: ['PAL:未採用を推奨で一括採用', 'Enter'], expect: 'R004 は上書きしない' })
await caseRun('U5 A が R004 で Shift+A のパネル（商社を選ぶ）を開いたまま → B が理由つきで採用 → A 1（推奨）', { aRole: 'design', setupA: async () => { await toR004(); await A.keyboard.press('Shift+A'); await sleep(150) }, actB: bReason, actA: ['1', 'Enter'], expect: '別のタブの理由つき採用を黙って上書きしない' })
await caseRun('U6 同じタブ: 理由つきで 2 位を採用 → a', { aRole: 'design', setupA: async () => { await toR004(); await A.keyboard.press('Shift+A'); await sleep(100); await A.keyboard.press('2'); await sleep(100); await A.keyboard.press('1'); await A.keyboard.press('Enter'); await sleep(200) }, actB: async () => {}, actA: ['a'], expect: '上書きしない（案内）' })
console.log('errors', JSON.stringify(env.errs.slice(0, 5)))
log.save(); await env.browser.close()
