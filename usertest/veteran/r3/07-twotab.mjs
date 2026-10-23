// 2 タブ: 同じセル・Undo・JSON 読込／退避からの復元を他タブが行ったとき・設定・公開・案件切替
import { launch, fresh, setRole, goto, toCol, toColKey, cursor, mode, sleep, dumpErrors, save, proj, panel, closeAll, palette, toastNow, ws, URL, publish } from './lib.mjs'
const { browser, context, page: A, errors } = await launch()
const out = []
const log = (o) => { out.push(o); console.log(JSON.stringify(o).slice(0, 900)) }
const val = async (pg, id, k = 'name', pid) => { const w = await ws(pg); const p = w.projects.find((x) => x.id === (pid ?? w.currentProjectId)); const r = p?.rows.find((x) => x.id === id); return r ? (r.working?.[k] ?? r[k]) : undefined }
async function edit(pg, id, col, v, commit = true) { await pg.bringToFront(); await closeAll(pg); await goto(pg, id); await toColKey(pg, col); await pg.keyboard.press('Enter'); await pg.keyboard.press('Control+a'); await pg.keyboard.type(v); if (commit) await pg.keyboard.press('Enter'); await sleep(60) }
async function importJson(pg, text) {
  await pg.bringToFront(); await closeAll(pg)
  await palette(pg, 'JSON を読み込む'); await sleep(40)
  await pg.evaluate((t) => { const el = document.querySelector('[data-testid="import-text"]'); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(el, t); el.dispatchEvent(new Event('input', { bubbles: true })) }, text)
  await pg.getByTestId('import-text').focus(); await pg.keyboard.press('Control+Enter'); await sleep(60)
  if (await panel(pg)) { await pg.keyboard.press('ArrowDown'); await pg.keyboard.press('Enter'); await sleep(100) }
}
await fresh(A); A._tag = 'A'
const B = await context.newPage(); B._tag = 'B'
await B.goto(URL); await B.waitForSelector('[data-testid="grid"]'); await B.locator('.gridwrap').focus()
// 1) 同じセル: A 編集中に B が確定 → A の Enter は止まるか
{
  await edit(A, 'R033', 'name', 'A-typing', false)
  await edit(B, 'R033', 'name', 'B-33')
  await A.bringToFront(); await A.keyboard.press('Enter'); await sleep(60)
  const first = { mode: await mode(A), toast: (await toastNow(A)).slice(0, 100), ls: await val(A, 'R033') }
  await A.keyboard.press('Enter'); await sleep(60)
  log({ case: '1 same cell conflict', first, second: { mode: await mode(A), ls: await val(A, 'R033') } })
}
// 2) A の Ctrl+Z: B が同じ行の別の列を変えた後 / 同じ列を変えた後
{
  await edit(A, 'R035', 'name', 'A-35'); await edit(B, 'R035', 'note', 'B-NOTE')
  await A.bringToFront(); await closeAll(A); await A.keyboard.press('Control+z'); await sleep(60)
  const a = { toast: (await toastNow(A)).slice(0, 90), name: await val(A, 'R035'), note: await val(A, 'R035', 'note') }
  await edit(A, 'R036', 'name', 'A-36'); await edit(B, 'R036', 'name', 'B-36')
  await A.bringToFront(); await closeAll(A); await A.keyboard.press('Control+z'); await sleep(60)
  const b = { toast: (await toastNow(A)).slice(0, 120), name: await val(A, 'R036') }
  log({ case: '2 undo after other tab', diffCol: a, sameCol: b })
}
// 3) B が「別の案件の JSON」を読み込む（全置換）→ A は編集中 → A が Enter
{
  await edit(A, 'R030', 'name', 'A-while-B-imports', false)
  const other = await ws(B)
  const p = structuredClone(other.projects[0]); p.id = 'P-OTHER'; p.name = '他の案件'
  await importJson(B, JSON.stringify({ projects: [p] }))
  await A.bringToFront(); await sleep(100)
  const aState = { header: (await A.getByTestId('header').textContent()).slice(0, 40), mode: await mode(A) }
  await A.keyboard.press('Enter'); await sleep(60)
  const r1 = { mode: await mode(A), toast: (await toastNow(A)).slice(0, 120), otherR030: await val(A, 'R030', 'name', 'P-OTHER') }
  if ((await mode(A)) === '編集') { await A.keyboard.press('Enter'); await sleep(60) }
  log({ case: '3 B imports JSON while A editing', aState, afterEnter: r1, afterSecondEnter: { otherR030: await val(A, 'R030', 'name', 'P-OTHER'), ids: (await ws(A)).projects.map((x) => x.id) } })
  // A の Ctrl+Z（A の履歴は読み込み前の案件のもの）
  await closeAll(A); await A.keyboard.press('Control+z'); await sleep(60)
  log({ case: '3b A Ctrl+Z after B replaced workspace', toast: (await toastNow(A)).slice(0, 120), otherR030: await val(A, 'R030', 'name', 'P-OTHER') })
  // B が「読み込み前に戻す」
  await B.bringToFront(); await closeAll(B); await palette(B, '読み込み前に戻す'); await sleep(40); await B.keyboard.press('ArrowDown'); await B.keyboard.press('Enter'); await sleep(100)
  await A.bringToFront(); await sleep(80)
  log({ case: '3c B restores backup', A_ids: (await ws(A)).projects.map((x) => x.id), A_header: (await A.getByTestId('header').textContent()).slice(0, 40), r030: await val(A, 'R030') })
}
// 4) A の Ctrl+Z が、B の JSON 読込後の同じ ID の行に効いてしまうか（同じ内容の JSON を読み直す）
{
  await fresh(A); await B.reload(); await B.waitForSelector('[data-testid="grid"]')
  await edit(A, 'R040', 'name', 'A-40')
  const snap = JSON.stringify(await ws(B))
  await importJson(B, snap) // 同じ内容で置き換え（バックアップから戻した想定）
  await A.bringToFront(); await closeAll(A); await A.keyboard.press('Control+z'); await sleep(60)
  log({ case: '4 A undo after B re-imports same JSON', toast: (await toastNow(A)).slice(0, 100), r040: await val(A, 'R040') })
}
// 5) 案件設定: B（PM）が下書きを持ったまま、A（PM）が納期を保存 → B が別の項目を保存
{
  await fresh(A); await B.reload(); await B.waitForSelector('[data-testid="grid"]')
  await setRole(A, 'pm'); await setRole(B, 'pm')
  const openSetting = async (pg, label, v) => {
    await pg.bringToFront(); await closeAll(pg); await palette(pg, '案件設定'); await sleep(40)
    const f = await pg.locator('[data-testid="settings"] .opt').allTextContents(); const i = f.findIndex((x) => x.includes(label))
    for (let k = 0; k < i; k++) await pg.keyboard.press('ArrowDown')
    await pg.keyboard.press('Enter'); await pg.getByTestId('settings-input').fill(v); await pg.keyboard.press('Enter'); await sleep(30)
  }
  await openSetting(B, '予算', '3000000') // B は下書きのまま
  await openSetting(A, '案件納期', '2027-06-30'); await A.keyboard.press('Control+Enter'); await sleep(100)
  const aSaved = (await proj(A))
  await B.bringToFront(); await B.keyboard.press('Control+Enter'); await sleep(150)
  // 影響試算などの確認が出たら確定
  for (let i = 0; i < 3 && (await panel(B)); i++) { await B.keyboard.press('ArrowDown'); await B.keyboard.press('Enter'); await sleep(80) }
  const p = await proj(B)
  log({ case: '5 settings: both PM tabs', A_due: aSaved.dueDate, final_due: p.dueDate, final_budget: p.settings?.budget ?? p.budget, toastB: (await toastNow(B)).slice(0, 100) })
}
// 6) 2 タブで同時に公開
{
  await fresh(A); await B.reload(); await B.waitForSelector('[data-testid="grid"]')
  await edit(A, 'R038', 'name', 'pub-A'); await edit(B, 'R039', 'name', 'pub-B')
  const ta = await publish(A); const tb = await publish(B)
  const p = await proj(A)
  log({ case: '6 both publish', revs: p.submissions.map((s) => `Rev.${s.rev}:${s.rowIds.join('/')}`), ta: ta.slice(0, 60), tb: tb.slice(0, 60), r038: (p.rows.find((r) => r.id === 'R038').working ?? null), r039: (p.rows.find((r) => r.id === 'R039').working ?? null) })
}
// 7) A が詳細を開いている行を B が削除（Shift+Delete）
{
  await fresh(A); await B.reload(); await B.waitForSelector('[data-testid="grid"]')
  await A.bringToFront(); await closeAll(A); await goto(A, 'R076'); await A.keyboard.press('Space'); await sleep(50)
  await B.bringToFront(); await closeAll(B); await goto(B, 'R076'); await B.keyboard.press('Shift+Delete'); await sleep(50); if (await panel(B)) { await B.keyboard.press('ArrowDown'); await B.keyboard.press('Enter') } await sleep(80)
  await A.bringToFront(); await sleep(80)
  const n = errors.length
  for (const k of ['j', 'k', 'Space', 'Enter', 'Escape', 'Shift+D', 'Control+z']) { await A.keyboard.press(k); await sleep(20) }
  log({ case: '7 B deletes row A has open', crash: await A.getByTestId('crash').count(), errs: errors.slice(n).filter((e) => e.type !== 'dialog').map((e) => e.text.slice(0, 80)), statusB: (await proj(B)).rows.find((r) => r.id === 'R076')?.status })
}
// 8) 交互 30 回（同じ行・別の列）と、最後に両タブの表示が一致するか
{
  await fresh(A); await B.reload(); await B.waitForSelector('[data-testid="grid"]')
  for (let i = 0; i < 30; i++) await edit(i % 2 ? B : A, 'R020', i % 2 ? 'note' : 'name', (i % 2 ? 'B' : 'A') + i)
  await sleep(150)
  const uiA = { name: await A.locator('[data-row-id="R020"] td[data-col="name"]').textContent().catch(() => null), note: await A.locator('[data-row-id="R020"] td[data-col="note"]').textContent().catch(() => null) }
  const uiB = { name: await B.locator('[data-row-id="R020"] td[data-col="name"]').textContent().catch(() => null), note: await B.locator('[data-row-id="R020"] td[data-col="note"]').textContent().catch(() => null) }
  log({ case: '8 alternate 30 same row', ls: { name: await val(A, 'R020'), note: await val(A, 'R020', 'note') }, uiA, uiB })
}
save('07-twotab.json', out)
dumpErrors(errors, '07')
await browser.close()
