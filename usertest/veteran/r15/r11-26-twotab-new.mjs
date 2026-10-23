// ラウンド11: 2 タブの新しい形（理由ダイアログ中の採用・F2 の編集モード中・選択を外したあとの続きの行・Undo の連鎖とリロード・JSON 読み込み中の編集）
import { open, reset, gotoCell, snap, diffRows, sleep, logger, installToastLog, takeToasts, state } from './lib15.mjs'
const port = Number(process.env.PORT ?? 5176)
const env = await open(port); const A = env.page; const log = logger(`26-twotab-new-${port}.json`)
async function tabB(role) {
  const B = await env.context.newPage(); await B.goto(env.url); await B.waitForSelector('[data-testid="grid"]')
  if (role) { await B.getByTestId(role === 'purchasing' ? 'role-purchasing' : 'role-pm').click(); for (let i = 0; i < 3; i++) { if (!(await B.evaluate(() => !!document.querySelector('[data-testid^="panel-"]')))) break; await B.keyboard.press('Enter') } }
  await B.locator('.gridwrap').focus(); return B
}
const S = async (pg) => { const s = await state(pg); return `${s.view}/${s.cursor}/${s.mode}${s.edit != null ? '[' + s.edit + ']' : ''}${s.panel ? '/' + s.panel : ''}` }
async function press(pg, k) { if (k.startsWith('T:')) return pg.keyboard.type(k.slice(2)); if (k === 'RELOAD') { await pg.reload(); await pg.waitForSelector('[data-testid="grid"]'); await pg.locator('.gridwrap').focus(); return sleep(200) } return pg.keyboard.press(k) }
async function caseRun(name, setupA, actB, actA, bRole, aRole) {
  await reset(env, { role: aRole }); await setupA(); await installToastLog(A); await takeToasts(A)
  const a = await snap(A); const s0 = await S(A)
  const B = await tabB(bRole); await actB(B); await sleep(400)
  await A.bringToFront(); await sleep(300); const s1 = await S(A); const t1 = await takeToasts(A)
  const steps = []
  for (const k of actA) { await press(A, k); await sleep(150); steps.push(`${k}→${await S(A)}`) }
  const b = await snap(A)
  log({ case: name, A0: s0, afterB: s1, steps, diff: diffRows(a, b).slice(0, 8), toastsOnB: t1.filter((t) => !t.startsWith('保存しました')), toastsA: (await takeToasts(A)).filter((t) => !t.startsWith('保存しました')).slice(-4) })
  for (let i = 0; i < 3; i++) await A.keyboard.press('Escape')
  await B.close()
}
await caseRun('W1 A が R004 の理由ダイアログ（2 ミスミ・在庫即納・補足入力中）→ B が R004 を a（推奨採用）→ A Enter',
  async () => { await gotoCell(A, 1, 'R004', 'ID'); await A.keyboard.press('Shift+A'); await A.keyboard.press('2'); await A.keyboard.press('2'); await A.keyboard.type('3日で入る') },
  async (B) => { await gotoCell(B, 1, 'R004', 'ID'); await B.keyboard.press('a'); await sleep(150) }, ['Enter'])
await caseRun('W2 A が R030 型式を F2 で編集モード（文字の中を移動中）→ B が同じセルを確定 → A ← → X → Enter',
  async () => { await gotoCell(A, 1, 'R030', '型式'); await A.keyboard.type('abc'); await A.keyboard.press('F2') },
  async (B) => { await gotoCell(B, 1, 'R030', '型式'); await B.keyboard.type('B-model'); await B.keyboard.press('Enter') }, ['ArrowLeft', 'T:X', 'Enter', 'Enter'])
await caseRun('W3 A 4 で R054 を直して外れた（続きの行 R005）→ B が R005 型式を直す（4 の問題から外れる）→ A ↓',
  async () => { await gotoCell(A, 4, 'R054', '必要数'); await A.keyboard.type('5'); await A.keyboard.press('ArrowRight') },
  async (B) => { await gotoCell(B, 1, 'R005', 'ID'); await B.keyboard.press('x'); await sleep(100) }, ['ArrowDown', 'T:9', 'Enter'])
await caseRun('W4 A が R010 部品名を 3 回変える → B が R010 部品名を変える → A リロード → Ctrl+Z ×3',
  async () => { await gotoCell(A, 1, 'R010', '部品名'); for (const v of ['A1', 'A2', 'A3']) { await A.keyboard.type(v); await A.keyboard.press('Enter'); await A.keyboard.press('ArrowUp') } await sleep(400) },
  async (B) => { await gotoCell(B, 1, 'R010', '部品名'); await B.keyboard.type('B-name'); await B.keyboard.press('Enter') }, ['RELOAD', 'Control+z', 'Control+z', 'Control+z'])
await caseRun('W5 A が R020 型式を打って入力中 → B が JSON を読み込む（同じ内容で置き換え）→ A ↓',
  async () => { await gotoCell(A, 1, 'R020', '型式'); await A.keyboard.type('TYPED') },
  async (B) => {
    const json = await B.evaluate(() => localStorage.getItem('bom-pro.workspace.v2'))
    await B.keyboard.press('Control+k'); await B.getByTestId('palette-input').fill('JSON を読み込む'); await sleep(80); await B.keyboard.press('Enter'); await sleep(150)
    await B.evaluate((t) => { const el = document.querySelector('[data-testid="import-text"]'); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(el, t); el.dispatchEvent(new Event('input', { bubbles: true })) }, json)
    await B.getByTestId('import-text').focus(); await B.keyboard.press('Control+Enter'); await sleep(200); await B.keyboard.press('2'); await sleep(300)
  }, ['ArrowDown', 'Enter'])
await caseRun('W6 A（購買）9 で R004 単価を F2 で編集モード → B（設計）が R004 を置換（Alt+r）→ A Enter',
  async () => { await gotoCell(A, 9, 'R004', '単価'); await A.keyboard.press('F2'); await A.keyboard.type('5') },
  async (B) => { await gotoCell(B, 1, 'R004', 'ID'); await B.keyboard.press('Alt+r'); await sleep(100); await B.keyboard.type('NEW-R004'); await B.keyboard.press('Enter') }, ['Enter', 'ArrowDown'], undefined, 'purchasing')
await caseRun('W7 A が F8 で 1 の R016 → B が R016・R022 を確認済み（x）→ A F8 ×2',
  async () => { await A.keyboard.press('Alt+1'); for (let i = 0; i < 8 && !(await state(A)).cursor.startsWith('R016'); i++) await A.keyboard.press('F8') },
  async (B) => { for (const id of ['R016', 'R022']) { await gotoCell(B, 1, id, 'ID'); await B.keyboard.press('x'); await sleep(80) } }, ['F8', 'F8'])
console.log('errors', JSON.stringify(env.errs.slice(0, 5)))
log.save(); await env.browser.close()
