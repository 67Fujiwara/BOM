// ラウンド10: 2 タブの新しい形（打って始めた入力を矢印で確定する・F8 の途中・直して外れた直後・理由のダイアログ・Undo）。
import { open, reset, gotoCell, snap, diffRows, sleep, logger, installToastLog, takeToasts, state } from './lib15.mjs'
const port = Number(process.env.PORT ?? 5176)
const env = await open(port); const A = env.page; const log = logger(`04-twotab-${port}.json`)
async function tabB(role) {
  const B = await env.context.newPage(); await B.goto(env.url); await B.waitForSelector('[data-testid="grid"]')
  if (role) { await B.getByTestId(role === 'purchasing' ? 'role-purchasing' : 'role-pm').click(); for (let i = 0; i < 3; i++) { if (!(await B.evaluate(() => !!document.querySelector('[data-testid^="panel-"]')))) break; await B.keyboard.press('Enter') } }
  await B.locator('.gridwrap').focus(); return B
}
const S = async (pg) => { const s = await state(pg); return `${s.view}/${s.cursor}/${s.mode}${s.edit != null ? '[' + s.edit + ']' : ''}${s.panel ? '/' + s.panel : ''}` }
async function caseRun(name, setupA, actB, actA, bRole) {
  await reset(env); await setupA(); await installToastLog(A); await takeToasts(A)
  const a = await snap(A); const s0 = await S(A)
  const B = await tabB(bRole); await actB(B); await sleep(400)
  await A.bringToFront(); await sleep(300); const s1 = await S(A); const t1 = await takeToasts(A)
  const steps = []
  for (const k of actA) {
    if (k.startsWith('T:')) await A.keyboard.type(k.slice(2)); else await A.keyboard.press(k)
    await sleep(120); steps.push(`${k}→${await S(A)}`)
  }
  const b = await snap(A)
  log({ case: name, A0: s0, afterB: s1, steps, diff: diffRows(a, b), toastsOnB: t1.filter((t) => !t.startsWith('保存しました')), toastsA: (await takeToasts(A)).filter((t) => !t.startsWith('保存しました')) })
  for (let i = 0; i < 3; i++) await A.keyboard.press('Escape')
  await B.close()
}
const delB = async (B, id) => { await gotoCell(B, 1, id, 'ID'); await B.keyboard.press('Shift+Delete'); await sleep(100); if (await B.evaluate(() => !!document.querySelector('[data-testid^="panel-"]'))) { await B.keyboard.press('2'); await sleep(50); if (await B.evaluate(() => !!document.querySelector('[data-testid^="panel-"]'))) await B.keyboard.press('Enter') } }
await caseRun('T1 A が R030 部品名に打って入力中（abc）→ B が同じセルを確定 → A ↓ → ↓',
  async () => { await gotoCell(A, 1, 'R030', '部品名'); await A.keyboard.type('abc') },
  async (B) => { await gotoCell(B, 1, 'R030', '部品名'); await B.keyboard.type('B-edit'); await B.keyboard.press('Enter') }, ['ArrowDown', 'ArrowDown'])
await caseRun('T2 A が R030 部品名に打って入力中 → B が同じセルを確定 → A →（右）→ Esc',
  async () => { await gotoCell(A, 1, 'R030', '部品名'); await A.keyboard.type('abc') },
  async (B) => { await gotoCell(B, 1, 'R030', '部品名'); await B.keyboard.type('B-edit'); await B.keyboard.press('Enter') }, ['ArrowRight', 'Escape'])
await caseRun('T3 A が 2 の R031 部品名に打って入力中 → B が R031 を隠す → A →',
  async () => { await gotoCell(A, 2, 'R031', '部品名'); await A.keyboard.type('abc') },
  async (B) => { await gotoCell(B, 1, 'R031', 'ID'); await B.keyboard.press('h') }, ['ArrowRight', 'T:7', 'Enter'])
await caseRun('T4 A が R030 に打って入力中 → B が R030 の上に行を足す（Shift+Enter）→ A ↓ → 打つ',
  async () => { await gotoCell(A, 1, 'R030', '部品名'); await A.keyboard.type('abc') },
  async (B) => { await gotoCell(B, 1, 'R029', '部品名'); await B.keyboard.press('Shift+Enter'); await sleep(100); await B.keyboard.press('Escape') }, ['ArrowDown', 'T:def', 'Enter'])
await caseRun('T5 A が F8 で R005 → B が R009 を直す（4 の一覧が減る）→ A F8 → F8',
  async () => { await A.keyboard.press('Alt+4'); for (let i = 0; i < 8 && !(await state(A)).cursor.startsWith('R005'); i++) await A.keyboard.press('F8') },
  async (B) => { await gotoCell(B, 1, 'R009', 'メーカ'); await B.keyboard.type('オムロン'); await B.keyboard.press('Enter') }, ['F8', 'F8'])
await caseRun('T6 A 4 で R054 必要数（ナビ）→ B が R054 必要数を直す（A の 4 から外れる）→ A F8',
  async () => { await gotoCell(A, 4, 'R054', '必要数') },
  async (B) => { await gotoCell(B, 1, 'R054', '必要数'); await B.keyboard.type('5'); await B.keyboard.press('Enter') }, ['F8'])
await caseRun('T7 A が R010 部品名を変える → B が R010 型式を変える → A Ctrl+Z → Ctrl+Y',
  async () => { await gotoCell(A, 1, 'R010', '部品名'); await A.keyboard.type('A-name'); await A.keyboard.press('Enter') },
  async (B) => { await gotoCell(B, 1, 'R010', '型式'); await B.keyboard.type('B-model'); await B.keyboard.press('Enter') }, ['Control+z', 'Control+y'])
await caseRun('T8 A が R010 部品名を変える → B が同じセルを変える → A Ctrl+Z',
  async () => { await gotoCell(A, 1, 'R010', '部品名'); await A.keyboard.type('A-name'); await A.keyboard.press('Enter') },
  async (B) => { await gotoCell(B, 1, 'R010', '部品名'); await B.keyboard.type('B-name'); await B.keyboard.press('Enter') }, ['Control+z', 'Control+z'])
await caseRun('T9 A が R030 の取消ダイアログで 2 を選んで理由を入力中 → B が R030 を削除 → A Enter',
  async () => { await gotoCell(A, 1, 'R030', 'ID'); await A.keyboard.press('Shift+Delete'); await sleep(100); await A.keyboard.press('2'); await A.keyboard.type('reason') },
  async (B) => { await delB(B, 'R030') }, ['Enter', 'T:7'])
await caseRun('T10 A が Enter で始めた編集（R030 型式）→ B が R030 型式を変える → A ← → Enter',
  async () => { await gotoCell(A, 1, 'R030', '型式'); await A.keyboard.press('Enter'); await A.keyboard.type('X') },
  async (B) => { await gotoCell(B, 1, 'R030', '型式'); await B.keyboard.type('B-model'); await B.keyboard.press('Enter') }, ['ArrowLeft', 'Enter', 'Enter'])
await caseRun('T11 A 絞り込み「リレー」で R005 部品名に打って入力中 → B が R005 部品名を「ヒューズ」に → A ↓',
  async () => { await A.keyboard.press('Control+f'); await A.keyboard.type('リレー'); await A.keyboard.press('Enter'); await gotoCell(A, 1, 'R005', '型式'); await A.keyboard.type('MY2N') },
  async (B) => { await gotoCell(B, 1, 'R005', '部品名'); await B.keyboard.press('Enter'); await B.keyboard.press('Control+a'); await B.keyboard.type('fuse'); await B.keyboard.press('Enter') }, ['ArrowDown', 'T:9', 'Enter'])
await caseRun('T12 A（購買）3 で R001 入荷予定に打って入力中 → B（購買）が R001 を入荷済（i）→ A ←',
  async () => { await A.getByTestId('role-purchasing').click(); for (let i = 0; i < 3; i++) { if (!(await A.evaluate(() => !!document.querySelector('[data-testid^="panel-"]')))) break; await A.keyboard.press('Enter') } await gotoCell(A, 3, 'R001', '入荷予定'); await A.keyboard.type('2026/12/1') },
  async (B) => { await gotoCell(B, 3, 'R001', 'ID'); await B.keyboard.press('i'); await sleep(80); if (await B.evaluate(() => !!document.querySelector('[data-testid^="panel-"]'))) await B.keyboard.press('Enter') }, ['ArrowLeft'], 'purchasing')
console.log('errors', JSON.stringify(env.errs.slice(0, 5)))
log.save(); await env.browser.close()
