// V-a〜V-l の再確認
import { launch, fresh, setRole, goto, toCol, cursor, mode, sleep, dumpErrors, shot2, save2, proj, row, panel, closeAll, palette, toastNow, ws } from './lib.mjs'
const { browser, context, page, errors } = await launch()
const out = {}
const log = (k, o) => { out[k] = o; console.log(k, JSON.stringify(o).slice(0, 700)) }
const perr = (n) => errors.slice(n).filter((e) => e.type === 'pageerror' || e.type === 'error').map((e) => e.text.slice(0, 200))
const crashed = async () => (await page.getByTestId('crash').count()) > 0
const gridOk = async () => (await page.getByTestId('grid').count()) > 0

// ---------- V-a: 不完全・異常な JSON ----------
const jsons = {
  truncated: '{"projects":[{"id":"X","rows":[{"id":"R001"',
  emptyObj: '{}',
  nullRows: '{"projects":[{"id":"X","rows":null}]}',
  rowNoId: '{"projects":[{"id":"X","rows":[{"name":"a"}]}]}',
  weirdTypes: '{"projects":[{"id":"X","name":123,"rows":[{"id":"R001","name":5,"model":null,"qtyNeeded":"abc","flags":null,"status":"???"}],"quotes":[{"rowId":"R001"}],"issues":[null],"submissions":[null],"decisions":[1],"events":"x","settings":{"budget":"abc","processDays":"x","holidays":"2026-01-01","currency":5},"weights":{"price":"abc"}}],"suppliers":[{"id":"S1"}]}',
  issueGarbage: '{"projects":[{"id":"Y","rows":[{"id":"R001","name":"a"}],"issues":[{"id":"I1","rowId":"R001","kind":"zzz","status":"open","by":null}]}]}',
  dupCase: '{"projects":[{"id":"A","rows":[]},{"id":"a","rows":[]}]}',
}
for (const [k, j] of Object.entries(jsons)) {
  await fresh(page)
  const n = errors.length
  await palette(page, 'JSON を読み込む')
  await page.getByTestId('import-text').fill(j)
  await page.keyboard.press('Control+Enter')
  await sleep(150)
  const t = await toastNow(page)
  const crash = await crashed()
  // 1 キー操作で全ビュー・行を開く
  if (!crash) { for (const v of '123456789') { await page.keyboard.press(v); await sleep(20) } await page.keyboard.press('1'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Space'); await sleep(50) }
  const crash2 = await crashed()
  await page.reload(); await sleep(400)
  log('V-a/' + k, { toast: t.slice(0, 120), crashAfterImport: crash, crashAfterKeys: crash2, gridAfterReload: await gridOk(), crashAfterReload: await crashed(), errors: perr(n).slice(0, 3) })
  if (crash2) await shot2(page, 'V-a-' + k)
}
// 直接 localStorage を壊す
for (const [k, raw] of Object.entries({ truncatedLS: '{"projects":[{"id":"X"', garbageLS: 'not json', weirdLS: jsons.weirdTypes, issueGarbageLS: jsons.issueGarbage })) {
  await fresh(page)
  const n = errors.length
  await page.evaluate((r) => localStorage.setItem('bom-pro.workspace.v2', r), raw)
  await page.reload(); await sleep(400)
  let ok = await gridOk()
  if (ok) { for (const v of '123456789') { await page.keyboard.press(v); await sleep(20) } await page.keyboard.press('1'); await page.locator('.gridwrap').focus(); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Space'); await sleep(50) }
  log('V-a/' + k, { grid: ok, crash: await crashed(), errors: perr(n).slice(0, 3) })
  if (await crashed()) await shot2(page, 'V-a-' + k)
}

// ---------- V-b: 予算「百万」・重み abc ----------
await fresh(page, 'pm')
{
  const n = errors.length
  await palette(page, '案件設定'); await sleep(50)
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter'); await page.getByTestId('settings-input').fill('百万'); await page.keyboard.press('Enter')
  const e1 = await page.locator('[data-testid="settings"]').textContent()
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter'); await page.getByTestId('settings-input').fill('abc'); await page.keyboard.press('Enter'); await sleep(50)
  const wErr = await toastNow(page)
  const stillEditing = await page.getByTestId('settings-input').count()
  await page.keyboard.press('Escape')
  await page.keyboard.press('Control+Enter'); await sleep(80)
  if ((await panel(page)) === 'panel-prompt') { await page.getByTestId('prompt-text').fill('予算'); await page.keyboard.press('Enter') }
  await sleep(150)
  const p = await proj(page)
  log('V-b', { budget: p.settings.budget, weights: p.weights, weightAbcToast: wErr.slice(0, 80), stillEditingAfterAbc: stillEditing, money: await page.getByTestId('money').textContent(), crash: await crashed(), errors: perr(n) })
}

// ---------- V-c: 設計の Ctrl+Z が他人の変更を戻さない ----------
await fresh(page)
{
  const n = errors.length
  await goto(page, 'R030'); await toCol(page, '部品名'); await page.keyboard.press('Enter'); await page.keyboard.press('Control+a'); await page.keyboard.type('設計の編集'); await page.keyboard.press('Enter')
  await setRole(page, 'pm'); await palette(page, '案件設定'); await sleep(50)
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter'); await page.getByTestId('settings-input').fill('5000000'); await page.keyboard.press('Enter'); await page.keyboard.press('Control+Enter'); await sleep(50); await page.getByTestId('prompt-text').fill('予算増額'); await page.keyboard.press('Enter'); await sleep(100)
  await page.keyboard.press('7'); await goto(page, 'R013'); await page.keyboard.press('y'); await sleep(50); await page.keyboard.type('受入OK'); await page.keyboard.press('Enter'); await sleep(50)
  const before = await proj(page)
  await setRole(page, 'purchasing'); await page.keyboard.press('9'); await goto(page, 'R030'); await page.keyboard.press('Home'); for (let i = 0; i < 40; i++) { if ((await cursor(page)).endsWith('単価')) break; await page.keyboard.press('ArrowRight') } await page.keyboard.press('Enter'); await page.keyboard.press('Control+a'); await page.keyboard.type('5555'); await page.keyboard.press('Enter'); await sleep(30)
  await setRole(page, 'design'); await page.keyboard.press('1')
  const toasts = []
  for (let i = 0; i < 3; i++) { await page.keyboard.press('Control+z'); await sleep(40); toasts.push((await toastNow(page)).slice(0, 90)) }
  const after = await proj(page)
  const r30 = after.rows.find((r) => r.id === 'R030')
  log('V-c', { toasts, budgetBefore: before.settings.budget, budgetAfter: after.settings.budget, decisionsBefore: before.decisions.length, decisionsAfter: after.decisions.length, r030name: r30.working?.name ?? r30.name, q30: after.quotes.find((q) => q.rowId === 'R030' && q.supplierId === 'S1' && !q.stale)?.unitPrice, errors: perr(n) })
}

// ---------- V-d: 公開の Ctrl+Z ----------
await fresh(page)
{
  const n = errors.length
  await goto(page, 'R076'); await toCol(page, '型式'); await page.keyboard.press('Enter'); await page.keyboard.type('M76'); await page.keyboard.press('Enter'); await goto(page, 'R076'); await toCol(page, 'メーカ'); await page.keyboard.press('Enter'); await page.keyboard.type('オムロン'); await page.keyboard.press('Enter'); await goto(page, 'R076'); await toCol(page, '部品名'); await page.keyboard.press('Enter'); await page.keyboard.type('N76'); await page.keyboard.press('Enter')
  for (const id of ['R077', 'R078', 'R079', 'R080']) { await goto(page, id); await page.keyboard.press('Shift+Delete'); await sleep(30); if (await panel(page)) { const o = await page.getByTestId('prompt-options').textContent().catch(() => ''); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter') } }
  await page.keyboard.press('Control+Enter'); await sleep(60)
  let pubPrompt = await page.getByTestId('prompt-options').textContent().catch(() => null)
  if (pubPrompt) { if (await page.getByTestId('prompt-text').count()) await page.keyboard.press('Enter'); else await page.keyboard.press('1') }
  await sleep(100)
  const p1 = await proj(page)
  const subs1 = p1.submissions.length
  await setRole(page, 'purchasing'); await page.keyboard.press('9'); await goto(page, 'R076'); await page.keyboard.press('Home'); for (let i = 0; i < 40; i++) { if ((await cursor(page)).endsWith('単価')) break; await page.keyboard.press('ArrowRight') } await page.keyboard.press('Enter'); await page.keyboard.type('100'); await page.keyboard.press('Enter'); await sleep(30)
  await setRole(page, 'design'); await page.keyboard.press('1'); await page.keyboard.press('Control+z'); await sleep(80)
  const t = await toastNow(page)
  const p3 = await proj(page)
  log('V-d', { pubPrompt, subsBeforeUndo: subs1, subsAfter: p3.submissions.length, toast: t.slice(0, 120), r076: p3.rows.find((r) => r.id === 'R076').status, r076working: p3.rows.find((r) => r.id === 'R076').working, quotes76: p3.quotes.filter((q) => q.rowId === 'R076').map((q) => q.supplierId + ':' + q.unitPrice), errors: perr(n) })
}

// ---------- V-e: 商社が空の案件で 見積回答を取り込む ----------
await fresh(page)
{
  const n = errors.length
  await palette(page, '新しいBOM')
  await page.getByTestId('wizard-id').fill('P-E2'); await page.keyboard.press('Enter'); await page.getByTestId('wizard-name').fill('空2'); await page.keyboard.press('Enter')
  for (let i = 0; i < 4; i++) await page.keyboard.press('Enter') // due..buyer
  await page.keyboard.press('Enter') // suppliers none
  await page.keyboard.press('3'); await page.keyboard.press('Enter'); await page.keyboard.press('Enter'); await sleep(150)
  const p = await proj(page)
  await setRole(page, 'purchasing'); await palette(page, '見積回答を取り込む'); await sleep(50)
  const opts = await page.getByTestId('prompt-options').textContent().catch(() => null)
  await page.keyboard.press('Enter'); await sleep(50)
  const pn = await panel(page)
  if (pn === 'panel-import') { await page.getByTestId('import-text').fill('R001\t100\t5'); await page.keyboard.press('Control+Enter'); await sleep(80) }
  log('V-e', { projId: p.id, supplierIds: p.supplierIds, rows: p.rows.length, opts, panelAfter: pn, toast: (await toastNow(page)).slice(0, 120), errors: perr(n) })
  // 商社マスタも空にした JSON
  await closeAll(page)
  const w = await ws(page)
  w.suppliers = []
  w.projects.forEach((x) => (x.supplierIds = []))
  await page.evaluate((s) => localStorage.setItem('bom-pro.workspace.v2', s), JSON.stringify(w))
  await page.reload(); await sleep(300); await page.locator('.gridwrap').focus()
  const n2 = errors.length
  await palette(page, '見積回答を取り込む'); await sleep(50)
  log('V-e/noSuppliers', { suppliersAfterLoad: (await ws(page))?.suppliers?.length, panel: await panel(page), toast: (await toastNow(page)).slice(0, 100), errors: perr(n2) })
}

// ---------- V-f: 案件設定の検証 ----------
async function trySetting(role, label, value) {
  await fresh(page, role)
  await palette(page, '案件設定'); await sleep(50)
  const fields = await page.locator('[data-testid="settings"] .opt').allTextContents()
  const i = fields.findIndex((f) => f.includes(label))
  for (let k = 0; k < i; k++) await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter'); await page.getByTestId('settings-input').fill(value); await page.keyboard.press('Enter'); await sleep(40)
  const accepted = (await page.getByTestId('settings-input').count()) === 0
  const t = await toastNow(page)
  return { label, value, accepted, msg: t.slice(0, 90) }
}
const vf = []
vf.push(await trySetting('pm', '社内工程日数', '-5'))
vf.push(await trySetting('pm', '社内工程日数', '1e3'))
vf.push(await trySetting('purchasing', '休日', 'あした, 2026-13-01,,x'))
vf.push(await trySetting('purchasing', '見積完了条件', 'nonsense'))
vf.push(await trySetting('purchasing', '通貨', '<script>'))
vf.push(await trySetting('purchasing', '通貨', 'JPY'))
vf.push(await trySetting('pm', '担当者', '山田,山田,山田'))
vf.push(await trySetting('pm', '担当者', ',,'))
vf.push(await trySetting('pm', '案件名', 'x'.repeat(101)))
vf.push(await trySetting('pm', '案件名', '<img src=x onerror=alert(1)>'))
vf.push(await trySetting('pm', '重み', '0,0,0,0'))
vf.push(await trySetting('pm', '重み', '100,100,100,100'))
vf.push(await trySetting('purchasing', '拮抗閾値', 'NaN'))
vf.push(await trySetting('purchasing', '回答期限の既定', '1.5'))
vf.push(await trySetting('purchasing', '今回の回答期限', '2026/2/30'))
vf.push(await trySetting('purchasing', '相見積先', 'S1,S1,因幡電機'))
log('V-f', vf)

// ---------- V-g: 新規ガイド 納期・ID ----------
await fresh(page)
{
  const n = errors.length
  await palette(page, '新しいBOM')
  await page.getByTestId('wizard-id').fill('p-2026-041'); await page.keyboard.press('Enter'); await sleep(30)
  const dupErr = await page.getByTestId('wizard-error').textContent().catch(() => null)
  await page.getByTestId('wizard-id').fill('ｐ－２０２６－０４１'); await page.keyboard.press('Enter'); await sleep(30)
  const dupErrZen = await page.getByTestId('wizard-error').textContent().catch(() => null)
  await page.getByTestId('wizard-id').fill('P-NEW'); await page.keyboard.press('Enter'); await page.getByTestId('wizard-name').fill('n'); await page.keyboard.press('Enter')
  await page.getByTestId('wizard-due').fill('2026/13/45'); await page.keyboard.press('Enter'); await sleep(30)
  const dueErr = await page.getByTestId('wizard-error').textContent().catch(() => null)
  await page.getByTestId('wizard-due').fill('2026/2/29'); await page.keyboard.press('Enter'); await sleep(30)
  const dueErr2 = await page.getByTestId('wizard-error').textContent().catch(() => null)
  await page.getByTestId('wizard-due').fill('2025/12/1'); await page.keyboard.press('Enter'); await sleep(30)
  const dueErr3 = await page.getByTestId('wizard-error').textContent().catch(() => null)
  log('V-g', { dupErr, dupErrZen, dueErr, dueErr2, dueErr3, errors: perr(n) })
}

// ---------- V-h: 入荷予定 ----------
await fresh(page, 'purchasing')
{
  const res = []
  for (const v of ['2026-13-45', '2026/2/30', '13/1', 'あさって', '20261301', '1999-01-01', '2026-11-30']) {
    await page.keyboard.press('3'); await goto(page, 'R013'); await toCol(page, '入荷予定'); await page.keyboard.press('Enter'); await page.keyboard.press('Control+a'); await page.keyboard.type(v); await page.keyboard.press('Enter'); await sleep(30)
    const m = await mode(page); const err = await page.getByTestId('edit-error').textContent().catch(() => null)
    if (m === '編集') await page.keyboard.press('Escape')
    res.push({ v, stored: (await row(page, 'R013')).promisedDate, stillEditing: m === '編集', err: err?.slice(0, 60) })
  }
  log('V-h', res)
}

// ---------- V-i: 数値 ----------
await fresh(page)
{
  const res = []
  for (const v of ['１２', '１２００', '1200円', 'abc', '十二', '1.5', '-3', '0', '1e3', '１，２００', '99999999999', ' 7 ', '½']) {
    await goto(page, 'R030'); await toCol(page, '必要数'); await page.keyboard.press('Enter'); await page.keyboard.press('Control+a'); await page.keyboard.type(v); await page.keyboard.press('Enter'); await sleep(30)
    const m = await mode(page); const err = await page.getByTestId('edit-error').textContent().catch(() => null)
    if (m === '編集') await page.keyboard.press('Escape')
    const r = await row(page, 'R030')
    res.push({ v, stored: r.working?.qtyNeeded ?? r.qtyNeeded, stillEditing: m === '編集', err: err?.slice(0, 60) })
  }
  // 単価（購買）
  await setRole(page, 'purchasing'); await page.keyboard.press('9')
  for (const v of ['１２００', '1,200円', '¥1200', '1.2万', 'abc', '-1', '0']) {
    await goto(page, 'R030'); await page.keyboard.press('Home'); for (let i = 0; i < 40; i++) { if ((await cursor(page)).endsWith('単価')) break; await page.keyboard.press('ArrowRight') }
    const col = await cursor(page)
    await page.keyboard.press('Enter'); await page.keyboard.press('Control+a'); await page.keyboard.type(v); await page.keyboard.press('Enter'); await sleep(30)
    const m = await mode(page); const err = await page.getByTestId('edit-error').textContent().catch(() => null)
    if (m === '編集') await page.keyboard.press('Escape')
    const p = await proj(page)
    res.push({ col, v, stored: p.quotes.find((q) => q.rowId === 'R030' && q.supplierId === 'S1' && !q.stale)?.unitPrice, stillEditing: m === '編集', err: err?.slice(0, 60) })
  }
  log('V-i', res)
}

// ---------- V-j: Ctrl+Shift+C（e.key 小文字） ----------
await fresh(page)
{
  await page.keyboard.press('2'); await page.keyboard.press('ArrowDown')
  await page.evaluate(() => navigator.clipboard.writeText('EMPTY'))
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', code: 'KeyC', ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true })))
  await sleep(300)
  const clip1 = await page.evaluate(() => navigator.clipboard.readText().catch((e) => 'ERR ' + e))
  await page.evaluate(() => navigator.clipboard.writeText('EMPTY'))
  await page.keyboard.press('Control+Shift+C'); await sleep(300)
  const clip2 = await page.evaluate(() => navigator.clipboard.readText().catch((e) => 'ERR ' + e))
  // CapsLock 相当（key 大文字、shift なし）で c
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'C', code: 'KeyC', bubbles: true, cancelable: true })))
  await sleep(50)
  log('V-j', { lowerKeyLines: clip1.split('\n').length, lowerHead: clip1.slice(0, 60), pwLines: clip2.split('\n').length, capsC_panel: await panel(page), toast: (await toastNow(page)).slice(0, 80) })
  await closeAll(page)
}

// ---------- V-k: 指摘の提案欄 Tab ----------
await fresh(page, 'purchasing')
{
  await goto(page, 'R030'); await page.keyboard.press('Shift+I'); await sleep(30)
  const kinds = await page.getByTestId('issue-kinds').textContent()
  // 廃番 を選ぶ
  const items = await page.locator('[data-testid="issue-kinds"] .opt').allTextContents()
  const di = items.findIndex((x) => x.includes('廃番'))
  for (let i = 0; i < di; i++) await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter'); await sleep(30)
  await page.keyboard.type('廃番です')
  await page.keyboard.press('Tab'); await sleep(30)
  await page.keyboard.type('NEWMODEL'); await page.keyboard.press('Tab'); await page.keyboard.type('オムロン'); await page.keyboard.press('Tab'); await page.keyboard.type('S1'); await page.keyboard.press('Tab'); await page.keyboard.type('1200'); await page.keyboard.press('Tab'); await page.keyboard.type('14')
  const vals = {}
  for (const k of ['model', 'maker', 'supplierId', 'unitPrice', 'leadDays']) vals[k] = await page.getByTestId('proposal-' + k).inputValue().catch(() => null)
  // さらに Tab で外へ抜けるか
  await page.keyboard.press('Tab'); await page.keyboard.press('Tab'); await page.keyboard.press('Tab')
  const active = await page.evaluate(() => document.activeElement?.dataset?.testid ?? document.activeElement?.tagName + '.' + document.activeElement?.className)
  await page.keyboard.press('Enter'); await sleep(60)
  const p = await proj(page)
  const iss = p.issues.filter((i) => i.rowId === 'R030').at(-1)
  log('V-k', { kindsHasHaiban: di >= 0, vals, activeAfter3Tabs: active, panelAfterEnter: await panel(page), issue: iss && { kind: iss.kind, text: iss.text, proposal: iss.proposal } })
  await closeAll(page)
}

// ---------- V-l: ガイド 部品の入れ方で 3 ----------
await fresh(page)
{
  await palette(page, '新しいBOM')
  await page.getByTestId('wizard-id').fill('P-L'); await page.keyboard.press('Enter')
  for (let i = 0; i < 6; i++) await page.keyboard.press('Enter')
  const step = await page.getByTestId('wizard').textContent()
  const pasteBefore = await page.getByTestId('wizard-paste').count()
  const activeBefore = await page.evaluate(() => document.activeElement?.dataset?.testid ?? document.activeElement?.tagName)
  await page.keyboard.press('3'); await sleep(40)
  const pasteVal = await page.getByTestId('wizard-paste').inputValue().catch(() => null)
  await page.keyboard.press('1'); await sleep(40)
  const activeAfter1 = await page.evaluate(() => document.activeElement?.dataset?.testid ?? document.activeElement?.tagName)
  // 貼り付け欄の中で 3 を打つ → 文字として入るべき
  await page.keyboard.type('リレー\t3')
  const pasteVal2 = await page.getByTestId('wizard-paste').inputValue().catch(() => null)
  log('V-l', { stepText: step.slice(0, 60), pasteBefore, activeBefore, pasteValAfter3: pasteVal, activeAfter1, pasteValTyped: pasteVal2 })
  await shot2(page, 'V-l')
  await closeAll(page)
}

save2('01-recheck.json', out)
dumpErrors(errors, 'recheck')
await browser.close()
