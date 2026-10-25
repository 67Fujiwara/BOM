// ラウンド9: 2 タブの新しい形。A が操作中（ナビ・編集・ダイアログ・F8 の途中・Undo の途中）に B が 隠す / 移動 / 編集 / 削除 / 状態を変える。
import { open, reset, gotoCell, snap, diffRows, sleep, saveJson, installToastLog, takeToasts, state } from './lib21.mjs'
const port = Number(process.env.PORT ?? 5176)
const env = await open(port); const A = env.page; const out = []
const log = (o) => { out.push(o); console.log(JSON.stringify(o).slice(0, 1300)) }
async function tabB(role) {
  const B = await env.context.newPage(); await B.goto(env.url); await B.waitForSelector('[data-testid="grid"]')
  if (role) { await B.getByTestId(role === 'purchasing' ? 'role-purchasing' : 'role-pm').click(); for (let i = 0; i < 3; i++) { if (!(await B.evaluate(() => !!document.querySelector('[data-testid^="panel-"]')))) break; await B.keyboard.press('Enter'); await sleep(30) } }
  await B.locator('.gridwrap').focus(); return B
}
async function back() { await A.bringToFront(); await sleep(300) }
const S = async (pg) => { const s = await state(pg); return `${s.view}/${s.cursor}/${s.mode}${s.edit != null ? '[' + s.edit + ']' : ''}${s.panel ? '/' + s.panel : ''}` }
async function caseRun(name, setupA, actB, actA, bRole) {
  await reset(env); await setupA(); await installToastLog(A); await takeToasts(A)
  const a = await snap(A); const s0 = await S(A)
  const B = await tabB(bRole); await actB(B); await sleep(300)
  await back(); const s1 = await S(A)
  const t1 = await takeToasts(A)
  await actA(); await sleep(200)
  const b = await snap(A); const s2 = await S(A)
  log({ case: name, A0: s0, afterB: s1, afterA: s2, diff: diffRows(a, b), toastsOnB: t1.filter((t) => !t.startsWith('保存しました')), toastsA: (await takeToasts(A)).filter((t) => !t.startsWith('保存しました')) })
  for (let i = 0; i < 3; i++) await A.keyboard.press('Escape')
  await B.close()
}
// W1 同じセルを B が先に確定 → A が Enter（上書きの確認が出るか）→ もう一度 Enter
await caseRun('W1 A が R030 部品名を編集中（abc）→ B が同じセルを「B-edit」→ A Enter → Enter',
  async () => { await gotoCell(A, 1, 'R030', '部品名'); await A.keyboard.type('abc') },
  async (B) => { await gotoCell(B, 1, 'R030', '部品名'); await B.keyboard.type('B-edit'); await B.keyboard.press('Enter') },
  async () => { await A.keyboard.press('Enter'); await sleep(150); await A.keyboard.press('Enter') })
// W2 B が R030 を削除（Shift+Delete）→ A は編集中
await caseRun('W2 A が R030 部品名を編集中 → B が R030 を Shift+Delete → A def Enter',
  async () => { await gotoCell(A, 1, 'R030', '部品名'); await A.keyboard.type('abc') },
  async (B) => { await gotoCell(B, 1, 'R030', 'ID'); await B.keyboard.press('Shift+Delete'); await sleep(100); if (await B.evaluate(() => !!document.querySelector('[data-testid^="panel-"]'))) { await B.keyboard.press('2'); await sleep(50); if (await B.evaluate(() => !!document.querySelector('[data-testid^="panel-"]'))) await B.keyboard.press('Enter') } },
  async () => { await A.keyboard.type('def'); await A.keyboard.press('Enter') })
// W3 A が 2 で R030 にいる（ナビ）→ B が R030 を削除 → A が 7 Enter（値の打ち始め）
await caseRun('W3 A 2 の R030 必要数（ナビ）→ B が R030 を Shift+Delete → A 7 Enter',
  async () => { await gotoCell(A, 2, 'R030', '必要数') },
  async (B) => { await gotoCell(B, 1, 'R030', 'ID'); await B.keyboard.press('Shift+Delete'); await sleep(100); if (await B.evaluate(() => !!document.querySelector('[data-testid^="panel-"]'))) { await B.keyboard.press('2'); await sleep(50); if (await B.evaluate(() => !!document.querySelector('[data-testid^="panel-"]'))) await B.keyboard.press('Enter') } },
  async () => { await A.keyboard.type('7'); await A.keyboard.press('Enter') })
// W4 A は Shift+Delete の確認ダイアログを開いている → B が R030 を隠す → A が 2（削除）
await caseRun('W4 A が R030 で Shift+Delete の確認を開いたまま → B が R030 を隠す → A 2',
  async () => { await gotoCell(A, 2, 'R030', 'ID'); await A.keyboard.press('Shift+Delete'); await sleep(80) },
  async (B) => { await gotoCell(B, 1, 'R030', 'ID'); await B.keyboard.press('h') },
  async () => { await A.keyboard.press('2'); await sleep(60); if (await A.evaluate(() => !!document.querySelector('[data-testid^="panel-"]'))) await A.keyboard.press('Enter') })
// W5 A は F8 の途中（R005）→ B が R005 を直す → A F8
await caseRun('W5 A F8 で R054 → B が R054 必要数を直す → A F8',
  async () => { await A.keyboard.press('Alt+4'); for (let i = 0; i < 10 && !(await state(A)).cursor.startsWith('R054 '); i++) await A.keyboard.press('F8') },
  async (B) => { await gotoCell(B, 1, 'R054', '必要数'); await B.keyboard.type('5'); await B.keyboard.press('Enter') },
  async () => { await A.keyboard.press('F8') })
// W6 A が R040 を隠した直後（Undo の対象）→ B が R040 を削除 → A Ctrl+Z
await caseRun('W6 A が R040 を h → B が R040 を Shift+Delete → A Ctrl+Z',
  async () => { await gotoCell(A, 1, 'R040', 'ID'); await A.keyboard.press('h'); await sleep(100) },
  async (B) => { await gotoCell(B, 1, 'R040', 'ID'); await B.keyboard.press('Shift+Delete'); await sleep(100); if (await B.evaluate(() => !!document.querySelector('[data-testid^="panel-"]'))) { await B.keyboard.press('2'); await sleep(50); if (await B.evaluate(() => !!document.querySelector('[data-testid^="panel-"]'))) await B.keyboard.press('Enter') } },
  async () => { await A.keyboard.press('Control+z'); await sleep(100); await A.keyboard.press('Control+y') })
// W7 A は 2 で R030（ナビ）→ B が R030 を 1 つ上へ（Alt+↑）→ A 7 Enter（カーソルは R030 のまま？）
await caseRun('W7 A 2 の R030 必要数 → B が R030 を Alt+↑ → A 7 Enter',
  async () => { await gotoCell(A, 2, 'R030', '必要数') },
  async (B) => { await gotoCell(B, 1, 'R030', 'ID'); await B.keyboard.press('Alt+ArrowUp') },
  async () => { await A.keyboard.type('7'); await A.keyboard.press('Enter') })
// W8 A は 4（購買）で R0xx（ナビ）→ B（購買）がその行を確認 → A x
// W9 A が絞り込み「リレー」で R030 → B が R030 の部品名を変える（A の絞り込みから外れる）→ A 7 Enter
await caseRun('W9 A 絞り込み「ファイバ」で R040 必要数 → B が R040 部品名を変える → A 7 Enter',
  async () => { await gotoCell(A, 1, 'R040', '必要数'); await A.keyboard.press('Control+f'); await A.keyboard.type('ファイバ'); await A.keyboard.press('Enter'); await sleep(80); await A.keyboard.press('Control+g'); await A.getByTestId('prompt-text').fill('R040'); await A.keyboard.press('Enter'); await A.keyboard.press('Home'); for (let i = 0; i < 30 && !(await state(A)).cursor.endsWith('必要数'); i++) await A.keyboard.press('ArrowRight') },
  async (B) => { await gotoCell(B, 1, 'R040', '部品名'); await B.keyboard.type('XX'); await B.keyboard.press('Enter') },
  async () => { await A.keyboard.type('7'); await A.keyboard.press('Enter') })
// W10 A 編集中（必要数 12）→ B（購買）が R0xx を発注済に → A Enter
await caseRun('W10 A 3 で R001 備考を編集中 → B（購買）が R001 を入荷済（i）→ A Enter',
  async () => { await gotoCell(A, 1, 'R001', '備考'); await A.keyboard.type('memo') },
  async (B) => { await gotoCell(B, 3, 'R001', 'ID'); await B.keyboard.press('i'); await sleep(80); if (await B.evaluate(() => !!document.querySelector('[data-testid^="panel-"]'))) await B.keyboard.press('Escape') },
  async () => { await A.keyboard.press('Enter') }, 'purchasing')
// W11 A が 7（PM）で R0xx に y を押す直前 → B（PM）が同じ行に y → A y
await caseRun('W11 A（PM）7 の先頭行 → B（PM）が同じ行で y → A y',
  async () => { await A.getByTestId('role-pm').click(); for (let i = 0; i < 3; i++) { if (!(await A.evaluate(() => !!document.querySelector('[data-testid^="panel-"]')))) break; await A.keyboard.press('Enter'); await sleep(30) } await A.locator('.gridwrap').focus(); await A.keyboard.press('7'); await A.keyboard.press('ArrowDown') },
  async (B) => { await B.keyboard.press('7'); await B.keyboard.press('ArrowDown'); await B.keyboard.press('y'); await sleep(100); if (await B.evaluate(() => !!document.querySelector('[data-testid^="panel-"]'))) { await B.keyboard.type('ok'); await B.keyboard.press('Enter') } },
  async () => { await A.keyboard.press('y'); await sleep(100) }, 'pm')
log({ errors: env.errs.slice(0, 5) })
saveJson('32-twotab2.json', out); await env.browser.close()
