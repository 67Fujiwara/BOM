// ラウンド12: 2 タブの衝突（採用・編集・隠す・公開）。V11-06 の修正（理由を入れているあいだに採用が変わったら採用しない）の境目
import { open, reset, gotoCell, snap, diffRows, sleep, logger, installToastLog, takeToasts, state } from './lib14.mjs'
const port = Number(process.env.PORT ?? 5176)
const env = await open(port); const A = env.page; const log = logger(`45-twotab-conflict-${port}.json`)
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
const reasonA = async () => { await gotoCell(A, 1, 'R004', 'ID'); await A.keyboard.press('Shift+A'); await A.keyboard.press('2'); await A.keyboard.press('2'); await A.keyboard.press('Tab'); await A.keyboard.type('3日で入る') }
await caseRun('C1 V11-06 そのまま: A 理由入力中 → B が R004 を a（推奨採用）→ A Enter', { setupA: reasonA, actB: async (B) => { await gotoCell(B, 1, 'R004', 'ID'); await B.keyboard.press('a') }, actA: ['Enter'], expect: '採用しない（知らせる）' })
await caseRun('C2 A 理由入力中 → B が同じミスミを理由つきで採用 → A Enter', { setupA: reasonA, actB: async (B) => { await gotoCell(B, 1, 'R004', 'ID'); await B.keyboard.press('Shift+A'); await B.keyboard.press('2'); await B.keyboard.press('1'); await B.keyboard.press('Enter') }, actA: ['Enter'], expect: '採用は同じなので知らせだけ（理由は？）' })
await caseRun('C3 A 理由入力中 → B（設計）が R004 の型式を変える（再見積要・見積が旧に）→ A Enter', { setupA: reasonA, bRole: 'design', actB: async (B) => { await gotoCell(B, 1, 'R004', '型式'); await B.keyboard.type('CHANGED-MODEL'); await B.keyboard.press('Enter') }, actA: ['Enter'], expect: '旧見積で採用しない（知らせる）' })
await caseRun('C4 A 理由入力中 → B（設計）が R004 を隠す → A Enter', { setupA: reasonA, actB: async (B) => { await gotoCell(B, 1, 'R004', 'ID'); await B.keyboard.press('Alt+h') }, actA: ['Enter'], expect: '?（隠した行は採用しない？）' })
await caseRun('C5 A 理由入力中 → B（設計）が R004 を取消（Shift+Delete）→ A Enter', { setupA: reasonA, actB: async (B) => { await gotoCell(B, 1, 'R004', 'ID'); await B.keyboard.press('Shift+Delete'); await sleep(100); await B.keyboard.press('Enter') }, actA: ['Enter'], expect: '取消の行は採用しない' })
await caseRun('C6 A 理由入力中 → B が R004 の採用を a で → B で Ctrl+Z（採用なしに戻す）→ A Enter', { setupA: reasonA, actB: async (B) => { await gotoCell(B, 1, 'R004', 'ID'); await B.keyboard.press('a'); await sleep(150); await B.keyboard.press('Control+z') }, actA: ['Enter'], expect: '採用は元（なし）に戻ったので採用してよい' })
// 編集・隠す
await caseRun('E1 A が R010 部品名を入力中 → B が R010 を隠す → A Enter', { row: 'R010', setupA: async () => { await gotoCell(A, 1, 'R010', '部品名'); await A.keyboard.type('A-NAME') }, actB: async (B) => { await gotoCell(B, 1, 'R010', 'ID'); await B.keyboard.press('Alt+h') }, actA: ['Enter'], expect: '隠れた行に書いた／知らせる' })
await caseRun('E2 A が R010 を隠す → B（古い画面）が R010 部品名を確定', { row: 'R010', setupA: async () => { await gotoCell(A, 1, 'R010', 'ID') }, actB: async (B) => { await gotoCell(B, 1, 'R010', '部品名'); await A.bringToFront(); await A.keyboard.press('Alt+h'); await sleep(300); await B.bringToFront(); await B.keyboard.type('B-NAME'); await B.keyboard.press('Enter') }, actA: [], expect: 'B: 隠れた行に書いたと知らせる？' })
await caseRun('E3 A が R010 部品名を入力中 → B が R010 を取消 → A Enter', { row: 'R010', setupA: async () => { await gotoCell(A, 1, 'R010', '部品名'); await A.keyboard.type('A-NAME') }, actB: async (B) => { await gotoCell(B, 1, 'R010', 'ID'); await B.keyboard.press('Shift+Delete'); await sleep(100); await B.keyboard.press('Enter') }, actA: ['Enter'], expect: '取消の行に書かない' })
// 公開
await caseRun('P1 A が公開の変更セットのダイアログ → B が公開（Ctrl+Enter → 1 → Enter）→ A Enter', { row: 'R010', setupA: async () => { await gotoCell(A, 1, 'R010', '部品名'); await A.keyboard.type('PUB-A'); await A.keyboard.press('Enter'); await A.keyboard.press('Control+Enter') }, actB: async (B) => { await B.keyboard.press('Control+Enter'); await sleep(150); await B.keyboard.press('1'); await B.keyboard.press('Enter') }, actA: ['2', 'Enter'], expect: 'Rev を二重に作らない（公開するものがない）' })
await caseRun('P2 A が公開のダイアログ → B が R011 を変える（公開されていない変更を足す）→ A Enter', { row: 'R011', setupA: async () => { await gotoCell(A, 1, 'R010', '部品名'); await A.keyboard.type('PUB-A'); await A.keyboard.press('Enter'); await A.keyboard.press('Control+Enter') }, actB: async (B) => { await gotoCell(B, 1, 'R011', '部品名'); await B.keyboard.type('PUB-B'); await B.keyboard.press('Enter') }, actA: ['2', 'Enter'], expect: 'ダイアログに出ていない R011 も公開するなら知らせる' })
await caseRun('P3 A が公開 → B（古い画面）が R010 を Ctrl+Z', { row: 'R010', setupA: async () => { await gotoCell(A, 1, 'R010', '部品名') }, actB: async (B) => { await gotoCell(B, 1, 'R010', '部品名'); await B.keyboard.type('B-EDIT'); await B.keyboard.press('Enter'); await A.bringToFront(); await A.keyboard.press('Control+Enter'); await sleep(150); await A.keyboard.press('1'); await A.keyboard.press('Enter'); await sleep(300); await B.bringToFront(); await B.keyboard.press('Control+z') }, actA: [], expect: 'B の Ctrl+Z: 公開済みの変更は戻せない／知らせる' })
// 購買どうし
await caseRun('U1 A（購買）が R004 を a で採用 → B（購買）が R004 を Shift+A 2 で選び直し（理由 1）→ A Ctrl+Z', { aRole: 'purchasing', bRole: 'purchasing', setupA: async () => { await gotoCell(A, 1, 'R004', 'ID'); await A.keyboard.press('a') }, actB: async (B) => { await gotoCell(B, 1, 'R004', 'ID'); await B.keyboard.press('Shift+A'); await B.keyboard.press('2'); await B.keyboard.press('1'); await B.keyboard.press('Enter') }, actA: ['Control+z'], expect: '戻せない（別のタブで変わった）' })
console.log('errors', JSON.stringify(env.errs.slice(0, 5)))
log.save(); await env.browser.close()
