// 異常な順序
import { launch, fresh, setRole, goto, toCol, cursor, mode, sleep, dumpErrors, shot2, save2, proj, row, panel, closeAll, palette, paletteExact, toastNow, ws } from './lib.mjs'
const { browser, page, errors } = await launch()
const out = []
const log = (o) => { out.push(o); console.log(JSON.stringify(o).slice(0, 600)) }
const perr = (n) => errors.slice(n).filter((e) => e.type === 'pageerror' || e.type === 'error').map((e) => e.text.slice(0, 160))
const opts = async () => page.getByTestId('prompt-options').textContent().catch(() => null)
async function step(name, fn) {
  const n = errors.length
  let r
  try { r = await fn() } catch (e) { r = { exception: e.message.slice(0, 200) } }
  log({ case: name, ...r, errors: perr(n) })
  await closeAll(page)
}
// ---- 置換済を置換・取消行の編集
await fresh(page)
await step('r on R040', async () => { await goto(page, 'R040'); await page.keyboard.press('r'); await sleep(30); const m = await mode(page); await page.keyboard.press('Escape'); return { toast: (await toastNow(page)).slice(0, 100), mode: m, r040: (await row(page, 'R040')).status, rows: (await proj(page)).rows.length } })
await step('r on replaced R040 again', async () => { await goto(page, 'R040'); await page.keyboard.press('r'); await sleep(30); return { toast: (await toastNow(page)).slice(0, 100), rows: (await proj(page)).rows.length } })
await step('edit replaced R040 (Enter / type / Delete / Ctrl+V / Shift+D / w / Shift+I / a / o)', async () => {
  const res = {}
  for (const k of ['Enter', 'z', 'Delete', 'Shift+D', 'w', 'Shift+I', 'a', 'Alt+a', 'o', 'i', 'x', 'Control+Period', 'Shift+Enter', 'Alt+ArrowUp']) { await goto(page, 'R040'); await toCol(page, '部品名'); await page.keyboard.press(k); await sleep(30); res[k] = { mode: await mode(page), panel: await panel(page), toast: (await toastNow(page)).slice(0, 70) }; await closeAll(page) }
  const p = await proj(page)
  return { res, r040: p.rows.find((r) => r.id === 'R040'), rows: p.rows.length, order: p.rows.slice(38, 43).map((r) => r.id) }
})
await step('Ctrl+Z after r (both rows back?)', async () => { await page.keyboard.press('Control+z'); await sleep(40); const p = await proj(page); return { toast: (await toastNow(page)).slice(0, 100), r040: p.rows.find((r) => r.id === 'R040').status, rows: p.rows.length } })
// ---- 取消
await fresh(page)
await step('Shift+Delete published R030 → cancelled → edit / delete again / undo', async () => {
  await goto(page, 'R030'); await page.keyboard.press('Shift+Delete'); await sleep(30)
  const o = await opts(); if (o) { await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter') }
  const s1 = (await row(page, 'R030')).status
  await goto(page, 'R030'); await page.keyboard.press('Shift+Delete'); await sleep(30); const t2 = (await toastNow(page)).slice(0, 80); const o2 = await opts(); await closeAll(page)
  await goto(page, 'R030'); await toCol(page, '型式'); await page.keyboard.press('Enter'); const m = await mode(page); await closeAll(page)
  await goto(page, 'R030'); await page.keyboard.press('Shift+D'); await sleep(30); const dupToast = (await toastNow(page)).slice(0, 80); const rowsAfterDup = (await proj(page)).rows.length
  await page.keyboard.press('Control+z'); await page.keyboard.press('Control+z'); await sleep(40)
  return { confirmOpts: o, statusAfterDelete: s1, secondDelete: { toast: t2, opts: o2 }, editMode: m, dupToast, rowsAfterDup, afterUndo: (await row(page, 'R030')).status, undoToast: (await toastNow(page)).slice(0, 80) }
})
// ---- 発注済を削除（localStorage で発注済の行を作る）
await fresh(page)
{
  await page.keyboard.press('Control+s')
  const w = await ws(page)
  const p = w.projects[0]
  const r = p.rows.find((x) => x.id === 'R001'); r.status = 'ordered'; r.ordered = true
  const r2 = p.rows.find((x) => x.id === 'R002'); r2.status = 'received'; r2.ordered = true; r2.received = true
  await page.evaluate((s) => localStorage.setItem('bom-pro.workspace.v2', s), JSON.stringify(w))
  await page.reload(); await page.waitForSelector('[data-testid="grid"]'); await page.locator('.gridwrap').focus()
}
await step('design: Shift+Delete ordered R001 / received R002, edit model, r', async () => {
  const res = {}
  for (const id of ['R001', 'R002']) {
    await page.keyboard.press('1'); await goto(page, id); await page.keyboard.press('Shift+Delete'); await sleep(30); const o = await opts(); res[id + ' del'] = { toast: (await toastNow(page)).slice(0, 90), opts: o }; if (o) { await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter'); await sleep(30); res[id + ' del'].after = (await row(page, id)).status; res[id + ' del'].toast2 = (await toastNow(page)).slice(0, 90) } await closeAll(page)
    await goto(page, id); await toCol(page, '型式'); await page.keyboard.press('Enter'); res[id + ' edit'] = { mode: await mode(page), toast: (await toastNow(page)).slice(0, 80) }; if ((await mode(page)) === '編集') { await page.keyboard.type('X'); await page.keyboard.press('Enter'); res[id + ' edit'].after = (await toastNow(page)).slice(0, 80) } await closeAll(page)
    await goto(page, id); await page.keyboard.press('r'); await sleep(30); res[id + ' r'] = { toast: (await toastNow(page)).slice(0, 80), rows: (await proj(page)).rows.length }; await closeAll(page)
  }
  return res
})
await step('purchasing: o off on received / i off then o off / Delete on 発注 col', async () => {
  await setRole(page, 'purchasing'); await page.keyboard.press('3')
  const res = {}
  await goto(page, 'R002'); await page.keyboard.press('o'); res.oOnReceived = (await toastNow(page)).slice(0, 80)
  await page.keyboard.press('i'); res.iOff = { toast: (await toastNow(page)).slice(0, 60), status: (await row(page, 'R002')).status }
  await page.keyboard.press('o'); res.oOff = { toast: (await toastNow(page)).slice(0, 60), status: (await row(page, 'R002')).status }
  await page.keyboard.press('i'); res.iWithoutOrdered = { toast: (await toastNow(page)).slice(0, 80), status: (await row(page, 'R002')).status }
  await goto(page, 'R004'); await page.keyboard.press('o'); res.oOnQuoted = (await toastNow(page)).slice(0, 80)
  return res
})
// ---- 見積なしで Shift+A / a / Alt+A
await fresh(page)
await step('no quote rows: a / Shift+A / Alt+A on draft R076, selected R001', async () => {
  const res = {}
  for (const id of ['R076', 'R001', 'R013']) for (const k of ['a', 'Shift+A', 'Alt+a']) { await goto(page, id); await page.keyboard.press(k); await sleep(30); res[id + ' ' + k] = { panel: await panel(page), toast: (await toastNow(page)).slice(0, 80) }; await closeAll(page) }
  return res
})
// ---- 空案件で全キー
await fresh(page)
await step('empty project: create, delete the only row, all keys all roles', async () => {
  await palette(page, '新しいBOM'); await page.getByTestId('wizard-id').fill('P-EMPTY'); await page.keyboard.press('Enter'); for (let i = 0; i < 6; i++) await page.keyboard.press('Enter'); await page.keyboard.press('3'); await page.keyboard.press('Enter'); await page.keyboard.press('Enter'); await sleep(100)
  await page.keyboard.press('1'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Shift+Delete'); await sleep(30); if (await opts()) { await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter') }
  const rows = (await proj(page)).rows.length
  const { parseKeymap, toPress } = await import('../keymap-parse.mjs')
  const keys = parseKeymap().flatMap((b) => b.keys)
  const bad = []
  for (const role of ['design', 'purchasing', 'pm']) {
    await setRole(page, role)
    for (const v of '123456789') { await page.keyboard.press(v); for (const k of keys) { const n = errors.length; await page.keyboard.press(toPress(k)); const e = perr(n); if (e.length) bad.push({ role, v, k, e: e[0] }); await closeAll(page) } }
  }
  // palette commands on empty project
  const cmds = ['Excelで出力', '表示中の行と列を書式つきでコピー', '未採用を推奨で一括採用', '商社を集約', '正式見積を依頼', '選定記録を出力', '概算見積を依頼', '履歴', 'JSON を書き出す', '案件設定を確定']
  const ct = {}
  for (const role of ['purchasing', 'design']) { await setRole(page, role); for (const c of cmds) { const n = errors.length; await paletteExact(page, c, c); await sleep(60); ct[role + ':' + c] = { panel: await panel(page), toast: (await toastNow(page)).slice(0, 60), e: perr(n) }; if ((await panel(page)) === 'panel-export') { await page.keyboard.press('Enter'); await sleep(300); ct[role + ':' + c].after = (await toastNow(page)).slice(0, 60) } await closeAll(page) } }
  return { rows, statuses: (await proj(page)).rows.map((r) => r.status), bad: bad.slice(0, 10), badCount: bad.length, cmds: ct }
})
// ---- PM 承認待ちを設計が編集（R013 正式見積差分超過 → PM 待ち）
await fresh(page)
await step('design edits PM-pending R013, publishes; PM then decides', async () => {
  await goto(page, 'R013'); await toCol(page, '型式'); await page.keyboard.press('Enter'); const m = await mode(page); await page.keyboard.press('Control+a'); await page.keyboard.type('NEW-013'); await page.keyboard.press('Enter'); await sleep(30)
  const t1 = (await toastNow(page)).slice(0, 100)
  const r1 = await row(page, 'R013')
  await toCol(page, '必要数'); await goto(page, 'R013'); await toCol(page, '必要数'); await page.keyboard.press('Enter'); await page.keyboard.press('Control+a'); await page.keyboard.type('99'); await page.keyboard.press('Enter')
  await page.keyboard.press('Control+Enter'); await sleep(50); const po = await opts(); if (po) { await page.keyboard.press('Enter') } await sleep(80)
  const t2 = (await toastNow(page)).slice(0, 120)
  const r2 = await row(page, 'R013')
  await setRole(page, 'pm'); await page.keyboard.press('7'); const inView7 = await page.locator('[data-row-id="R013"]').count(); await goto(page, 'R013'); await page.keyboard.press('y'); await sleep(30); const pmPanel = await panel(page); const pmToast = (await toastNow(page)).slice(0, 80)
  if (pmPanel) { await page.keyboard.type('承認'); await page.keyboard.press('Enter'); await sleep(40) }
  const r3 = await row(page, 'R013')
  const p = await proj(page)
  return { editMode: m, t1, r1: { status: r1.status, working: r1.working, flags: r1.flags }, publishOpts: po, t2, r2: { status: r2.status, model: r2.model, working: r2.working, flags: r2.flags }, inView7, pmPanel, pmToast, r3: { status: r3.status, flags: r3.flags, model: r3.model }, decisions: p.decisions.slice(-2).map((d) => d.kind + ':' + d.rowId), quotes13: p.quotes.filter((q) => q.rowId === 'R013').map((q) => q.supplierId + (q.stale ? '(stale)' : '') + ':' + q.unitPrice + '/' + q.formalPrice) }
})
// ---- Alt+A 先行採用 → PM 待ち → 設計が型式変更 → PM 承認
await fresh(page)
await step('Alt+A early adopt on quoting row, design changes model, PM approves', async () => {
  // R076 を公開 → 購買が 1 社だけ単価 → quoting
  await goto(page, 'R076'); await toCol(page, '型式'); await page.keyboard.press('Enter'); await page.keyboard.type('M76'); await page.keyboard.press('Enter'); await goto(page, 'R076'); await toCol(page, 'メーカ'); await page.keyboard.press('Enter'); await page.keyboard.type('オムロン'); await page.keyboard.press('Enter'); await goto(page, 'R076'); await toCol(page, '部品名'); await page.keyboard.press('Enter'); await page.keyboard.type('N76'); await page.keyboard.press('Enter')
  for (const id of ['R077', 'R078', 'R079', 'R080']) { await goto(page, id); await page.keyboard.press('Shift+Delete'); await sleep(20); if (await opts()) { await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter') } }
  await page.keyboard.press('Control+Enter'); await sleep(50); if (await opts()) await page.keyboard.press('Enter'); await sleep(80)
  await setRole(page, 'purchasing'); await page.keyboard.press('9'); await goto(page, 'R076'); await page.keyboard.press('Home'); for (let i = 0; i < 40; i++) { if ((await cursor(page)).endsWith('単価')) break; await page.keyboard.press('ArrowRight') } await page.keyboard.press('Enter'); await page.keyboard.type('100'); await page.keyboard.press('Tab'); await page.keyboard.type('5'); await page.keyboard.press('Enter'); await sleep(30)
  const s0 = (await row(page, 'R076')).status
  await setRole(page, 'design'); await page.keyboard.press('1'); await goto(page, 'R076'); await page.keyboard.press('Alt+a'); await sleep(30); const ap = await panel(page); const ao = await opts(); if (ap) { await page.keyboard.press('Enter'); await sleep(30) }
  const r1 = await row(page, 'R076')
  await goto(page, 'R076'); await toCol(page, '型式'); await page.keyboard.press('Enter'); await page.keyboard.press('Control+a'); await page.keyboard.type('M76-CHANGED'); await page.keyboard.press('Enter'); await page.keyboard.press('Control+Enter'); await sleep(50); if (await opts()) await page.keyboard.press('Enter'); await sleep(80)
  const r2 = await row(page, 'R076')
  await setRole(page, 'pm'); await page.keyboard.press('7'); const in7 = await page.locator('[data-row-id="R076"]').count(); await goto(page, 'R076'); await page.keyboard.press('y'); await sleep(30); const pp = await panel(page); if (pp) { await page.keyboard.type('OK'); await page.keyboard.press('Enter'); await sleep(40) }
  const r3 = await row(page, 'R076')
  const p = await proj(page)
  return { statusBefore: s0, altAPanel: ap, altAOpts: ao, r1: { status: r1.status, adopted: r1.adoptedSupplierId, flags: r1.flags }, r2: { status: r2.status, model: r2.model, adopted: r2.adoptedSupplierId, flags: r2.flags }, in7, pmPanel: pp, pmToast: (await toastNow(page)).slice(0, 80), r3: { status: r3.status, adopted: r3.adoptedSupplierId, flags: r3.flags }, quotes: p.quotes.filter((q) => q.rowId === 'R076').map((q) => q.supplierId + (q.stale ? '(stale ' + q.staleModel + ')' : '') + ':' + q.unitPrice) }
})
// ---- 行の移動の端・並び替え中の移動
await fresh(page)
await step('Alt+Up on first, Alt+Down on last, Alt+Up under sort/filter', async () => {
  const res = {}
  await page.keyboard.press('Control+ArrowUp'); await page.keyboard.press('j'); const first = await cursor(page); await page.keyboard.press('Alt+ArrowUp'); res.firstUp = (await toastNow(page)).slice(0, 60)
  await page.keyboard.press('Control+ArrowDown'); await page.keyboard.press('Alt+ArrowDown'); res.lastDown = (await toastNow(page)).slice(0, 60)
  await goto(page, 'R030'); await toCol(page, '型式'); await page.keyboard.press('s'); await page.keyboard.press('Alt+ArrowUp'); res.underSort = { toast: (await toastNow(page)).slice(0, 80), order: (await proj(page)).rows.slice(27, 32).map((r) => r.id) }
  await page.keyboard.press('s'); await page.keyboard.press('/'); await page.keyboard.type('リレー'); await page.keyboard.press('Enter'); const c0 = await cursor(page); await page.keyboard.press('j'); await page.keyboard.press('Alt+ArrowUp'); res.underFilter = { cursor: c0, toast: (await toastNow(page)).slice(0, 80) }
  // 分類をまたぐ移動
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape'); await goto(page, 'R005'); for (let i = 0; i < 6; i++) await page.keyboard.press('Alt+ArrowUp'); res.crossCategory = { cursor: await cursor(page), toast: (await toastNow(page)).slice(0, 80), cat: (await row(page, 'R005')).category, order: (await proj(page)).rows.slice(0, 6).map((r) => r.id + ':' + r.category) }
  return res
})
// ---- 2 度押し・連続公開
await fresh(page)
await step('Ctrl+Enter twice fast / publish with nothing / x without target / Shift+X design / < > / Ctrl+. no problem / y design', async () => {
  const res = {}
  await page.keyboard.press('Control+Enter'); await page.keyboard.press('Control+Enter'); res.pub2 = { panel: await panel(page), toast: (await toastNow(page)).slice(0, 100) }; await closeAll(page)
  await goto(page, 'R005'); for (const k of ['x', 'Shift+X', '<', '>', 'Control+Period', 'y', 'Shift+Y', 'Shift+R', 'Shift+ArrowRight', 'Control+Shift+F']) { await page.keyboard.press(k); await sleep(20); res[k] = { panel: await panel(page), toast: (await toastNow(page)).slice(0, 80) }; await closeAll(page); await page.keyboard.press('1'); await goto(page, 'R005') }
  return res
})
// ---- 購買が指摘を連続起票 → 発行 → 設計が直さずに Ctrl+Z
await fresh(page, 'purchasing')
await step('purchasing raises 2 issues, publishes, Ctrl+Z', async () => {
  for (const id of ['R030', 'R031']) { await goto(page, id); await page.keyboard.press('Shift+I'); await page.keyboard.press('k'); await page.keyboard.type('確認' + id); await page.keyboard.press('Enter') }
  await page.keyboard.press('Control+Enter'); await sleep(60); const o = await opts(); if (await panel(page)) await page.keyboard.press('Enter'); await sleep(60)
  const p1 = await proj(page)
  await page.keyboard.press('Control+z'); await sleep(40)
  const p2 = await proj(page)
  return { opts: o, issues1: p1.issues.filter((i) => ['R030', 'R031'].includes(i.rowId)).map((i) => i.id + ':' + i.status), undoToast: (await toastNow(page)).slice(0, 100), issues2: p2.issues.filter((i) => ['R030', 'R031'].includes(i.rowId)).map((i) => i.id + ':' + i.status) }
})
// ---- 担当者を同名にした案件の Undo
await fresh(page, 'pm')
await step('members same name → design undo includes PM decision?', async () => {
  await palette(page, '案件設定'); await sleep(40)
  const f = await page.locator('[data-testid="settings"] .opt').allTextContents(); const i = f.findIndex((x) => x.includes('担当者'))
  for (let k = 0; k < i; k++) await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter'); await page.getByTestId('settings-input').fill('山田,佐藤,山田'); await page.keyboard.press('Enter'); await page.keyboard.press('Control+Enter'); await sleep(60); if (await panel(page)) { if (await page.getByTestId('prompt-text').count()) await page.getByTestId('prompt-text').fill('x'); await page.keyboard.press('Enter') }
  await closeAll(page)
  await setRole(page, 'pm'); const pmName = (await ws(page)).user.name
  await page.keyboard.press('7'); await goto(page, 'R013'); await page.keyboard.press('y'); await sleep(30); if (await panel(page)) { await page.keyboard.type('PM 承認'); await page.keyboard.press('Enter') } await sleep(30)
  const d1 = (await proj(page)).decisions.length
  await setRole(page, 'design'); const dName = (await ws(page)).user.name
  await page.keyboard.press('1'); await page.keyboard.press('Control+z'); await sleep(40)
  const d2 = (await proj(page)).decisions.length
  return { pmName, designName: dName, decisionsAfterPM: d1, decisionsAfterDesignUndo: d2, toast: (await toastNow(page)).slice(0, 100) }
})
// ---- 新規ガイドの案件（購買・PM 担当が空）で役割切替 → 名前
await fresh(page)
await step('wizard project with empty members: role names', async () => {
  await palette(page, '新しいBOM'); await page.getByTestId('wizard-id').fill('P-NM'); await page.keyboard.press('Enter'); for (let i = 0; i < 6; i++) await page.keyboard.press('Enter'); await page.keyboard.press('3'); await page.keyboard.press('Enter'); await page.keyboard.press('Enter'); await sleep(100)
  const names = {}
  for (const r of ['purchasing', 'pm', 'design']) { await setRole(page, r); names[r] = (await ws(page)).user.name }
  // 設計が編集 → PM に切替えて Ctrl+Z
  await page.keyboard.press('1'); await goto(page, 'R001'); await toCol(page, '部品名'); await page.keyboard.press('Enter'); await page.keyboard.type('設計が入力'); await page.keyboard.press('Enter')
  await setRole(page, 'pm'); await page.keyboard.press('1'); await page.keyboard.press('Control+z'); await sleep(40)
  return { names, pmUndoToast: (await toastNow(page)).slice(0, 80), r001: (await row(page, 'R001')).name }
})
save2('06-abnormal.json', out)
dumpErrors(errors, 'abnormal')
await browser.close()
