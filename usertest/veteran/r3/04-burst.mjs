// 英字の打ち始め（350ms ルール）の誤判定を両方向で探す
import { launch, fresh, setRole, goto, toCol, toColKey, cursor, mode, sleep, dumpErrors, save, proj, row, panel, closeAll, palette, toastNow, ws, shot, storeState } from './lib.mjs'
const { browser, page, errors } = await launch()
const out = { text: [], cmd: [], misc: {} }
const D = 45 // 打鍵間隔（ms）。ベテランの速打ち
const cell = async (id, key) => { const r = await row(page, id); const v = r?.working?.[key] ?? r?.[key]; return v }
async function typeSeq(seq) {
  // seq: 文字列。大文字は Shift+文字 として押す（実際の打鍵と同じ）
  for (const ch of seq) {
    if (/[A-Z]/.test(ch)) await page.keyboard.press('Shift+' + ch)
    else if (ch === ' ') await page.keyboard.press('Space')
    else await page.keyboard.press(ch)
    await sleep(D)
  }
}
async function snapshot() { return storeState(page, (s) => ({ view: s.view, sort: s.sort, filter: s.filter, cellFilter: s.cellFilter, rows: s.project().rows.length, panel: s.panel?.kind ?? null, mode: s.mode, cursorRow: s.cursorRow, hidden: s.project().rows.filter((r) => r.hidden).length, adopted: s.project().rows.filter((r) => r.adoptedSupplierId).length, ordered: s.project().rows.filter((r) => r.ordered).length, undo: Object.values(s.undo).reduce((a, b) => a + b.length, 0), redo: Object.values(s.redo).reduce((a, b) => a + b.length, 0) })) }
// ---------- 文字のつもりがコマンドになる ----------
const TEXT = [
  // [列キー, 打つ文字, 説明]
  ['name', 'knob', '小文字: k の後の n'], ['maker', 'jst', '小文字: j の後の s'], ['name', 'nand', 'n の後の a'], ['name', 'analog', 'a の後の n'], ['name', 'ssr', '同じ文字の連続'], ['name', 'hook', '問題なしのはず'], ['name', 'relay', 'r 始まり'], ['name', 'fuse', 'f 始まり'], ['name', 'coil', 'c 始まり'], ['name', 'xtal', 'x 始まり'], ['name', 'wire', 'w 始まり'], ['name', 'oscillator', 'o 始まり'], ['name', 'inductor', 'i 始まり'],
  ['model', 'DRV8833', '大文字(Shift): Shift+D 複製'], ['model', 'STM32F103', 'Shift+S 降順'], ['model', 'IRF540N', 'Shift+I 指摘'], ['model', 'NJM2904', 'Shift+N 前の問題'], ['maker', 'JST', 'Shift+J 次の行'], ['maker', 'KEMET', 'Shift+K 前の行'], ['model', 'ADP3338', 'Shift+A 商社を選んで採用'], ['model', 'RC0603', 'Shift+R 返信'], ['model', 'XC6206', 'Shift+X 差戻し'], ['maker', 'YAGEO', 'Shift+Y'], ['model', 'MY4N', '割り当てのない大文字'],
  ['model', '2SC1815', '数字始まり'], ['model', '1N4148', '数字始まり'],
  ['altPolicy', 'ka', '選択肢の略号 ka=可'], ['altPolicy', 'no', '選択肢の略号 no=不可'], ['makerLock', 'nini', '略号 nini=任意'], ['unit', 'ko', '略号 ko=個'], ['procurement', 'sh', '略号 sh=指定商社'], ['altPolicy', 'fuka', '略号 fuka=不可'], ['unit', 'k', '1 文字の略号 k=個'],
]
for (const [col, text, why] of TEXT) {
  await fresh(page)
  await page.keyboard.press('1')
  await goto(page, 'R040')
  if (!(await toColKey(page, col))) { out.text.push({ col, text, err: 'col not found' }); continue }
  const before = await snapshot()
  const v0 = await cell('R040', col)
  await typeSeq(text)
  await sleep(400)
  const m = await mode(page)
  const editVal = m === '編集' ? await page.getByTestId('cell-editor').inputValue().catch(() => null) : null
  if (m === '編集') { await page.keyboard.press('Enter'); await sleep(40) }
  const after = await snapshot()
  const v1 = await cell('R040', col)
  const changed = Object.fromEntries(Object.keys(before).filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]) && !['undo', 'redo', 'mode'].includes(k)).map((k) => [k, [before[k], after[k]]]))
  const toast = (await toastNow(page)).slice(0, 80)
  const okText = v1 === text || (typeof v1 === 'string' && v1.length && col !== 'name' && col !== 'model' && col !== 'maker')
  const rec = { col, text, why, editVal, before: v0, after: v1, sideEffects: changed, toast, ok: v1 === text }
  out.text.push(rec)
  console.log(rec.ok ? 'OK ' : 'NG ', col, text, '→', JSON.stringify(v1), JSON.stringify(changed).slice(0, 200), toast.slice(0, 50))
  await closeAll(page)
}
// ---------- コマンドのつもりが文字になる ----------
// r（置換）→ すぐに新しい型式を打つ（r は置換して新しい行の型式を編集に入る）
{
  await fresh(page)
  await page.keyboard.press('1'); await goto(page, 'R040'); await toColKey(page, 'model')
  const m0 = await cell('R040', 'model')
  await page.keyboard.press('r'); await sleep(120)
  const afterR = { mode: await mode(page), cursor: await cursor(page) }
  await typeSeq('MY4N-NEW'); await sleep(50)
  const ev = (await mode(page)) === '編集' ? await page.getByTestId('cell-editor').inputValue() : null
  await page.keyboard.press('Enter'); await sleep(60)
  const p = await proj(page)
  const r40 = p.rows.find((r) => r.id === 'R040')
  out.cmd.push({ case: 'r then type new model at 45ms (120ms after r)', afterR, editVal: ev, R040: { status: r40.status, model: r40.working?.model ?? r40.model, orig: m0 }, newRow: p.rows.at(-1).id, newModel: p.rows.at(-1).working?.model ?? p.rows.at(-1).model, toast: (await toastNow(page)).slice(0, 100) })
  console.log('r+type', JSON.stringify(out.cmd.at(-1)))
}
// r の後 400ms 待ってから打つ（ルール外）
{
  await fresh(page)
  await page.keyboard.press('1'); await goto(page, 'R040'); await toColKey(page, 'model')
  await page.keyboard.press('r'); await sleep(400)
  await typeSeq('MY4N-NEW'); await page.keyboard.press('Enter'); await sleep(60)
  const p = await proj(page)
  const r40 = p.rows.find((r) => r.id === 'R040')
  out.cmd.push({ case: 'r then type after 400ms', R040: { status: r40.status, model: r40.working?.model ?? r40.model }, newModel: p.rows.at(-1).working?.model ?? p.rows.at(-1).model })
  console.log('r+400+type', JSON.stringify(out.cmd.at(-1)))
}
// 1 キー操作の直後（<200ms）に数字・別の英字（ビュー切替・確認済み）
for (const [first, second, why] of [['s', '4', 'sort → view 4'], ['x', 'a', 'ack → adopt'], ['h', 'x', 'hide → ack'], ['a', '9', 'adopt → view 9'], ['f', '1', 'filter → view 1'], ['s', 'S', 'sort asc → desc (Shift+S)'], ['c', 'x', 'columns → x']]) {
  await fresh(page)
  await page.keyboard.press('1'); await goto(page, 'R040'); await toColKey(page, 'name')
  const before = await snapshot()
  await page.keyboard.press(first); await sleep(60)
  if (second === 'S') await page.keyboard.press('Shift+S'); else await page.keyboard.press(second)
  await sleep(300)
  const m = await mode(page)
  const ev = m === '編集' ? await page.getByTestId('cell-editor').inputValue().catch(() => null) : null
  const after = await snapshot()
  out.cmd.push({ case: `${first} then ${second} at 60ms (${why})`, mode: m, editVal: ev, view: [before.view, after.view], sort: after.sort, panel: after.panel, hidden: [before.hidden, after.hidden], toast: (await toastNow(page)).slice(0, 80) })
  console.log('cmd', first, second, JSON.stringify(out.cmd.at(-1)).slice(0, 300))
}
// 採用 a の直後に文字 → a は取り消されるか（Undo 200 件の上限に達していると？）
{
  for (const fill of [0, 205]) {
    await fresh(page)
    await page.keyboard.press('1')
    const target = await storeState(page, (s) => s.project().rows.find((r) => r.status === 'quoted' && !r.adoptedSupplierId)?.id ?? null)
    if (!target) { out.misc.adoptBurst = 'no quoted row'; break }
    // Undo を積む（別の行の部品名を書き換える）
    if (fill) {
      await goto(page, 'R050'); await toColKey(page, 'note')
      for (let i = 0; i < fill; i++) { await page.keyboard.press('Enter'); await page.keyboard.press('Control+a'); await page.keyboard.type(String(i)); await page.keyboard.press('Enter'); await page.keyboard.press('k') }
    }
    await goto(page, target); await toColKey(page, 'name')
    const u0 = await snapshot()
    await typeSeq('ab')
    await sleep(400)
    if ((await mode(page)) === '編集') { await page.keyboard.press('Enter'); await sleep(40) }
    const r = await row(page, target)
    const u1 = await snapshot()
    out.misc['adoptBurst_undo' + fill] = { target, undoBefore: u0.undo, name: r.working?.name ?? r.name, adopted: r.adoptedSupplierId ?? null, status: r.status, toast: (await toastNow(page)).slice(0, 100) }
    console.log('adoptBurst', fill, JSON.stringify(out.misc['adoptBurst_undo' + fill]))
  }
}
// 文字として扱われた後の Ctrl+Y（取り消したコマンドがやり直しに残る？）
{
  await fresh(page)
  await page.keyboard.press('1')
  await goto(page, 'R040'); await toColKey(page, 'name')
  await typeSeq('hx'); await sleep(300)
  await page.keyboard.press('Escape'); await sleep(30) // 入力はやめる
  const s0 = await snapshot()
  await page.keyboard.press('Control+y'); await sleep(40)
  const s1 = await snapshot()
  out.misc.redoAfterBurst = { hiddenBefore: s0.hidden, hiddenAfterCtrlY: s1.hidden, redoBefore: s0.redo, toast: (await toastNow(page)).slice(0, 100) }
  console.log('redoAfterBurst', JSON.stringify(out.misc.redoAfterBurst))
}
// ナビで IME 入力を始める（日本語で上書き入力できるか）
{
  await fresh(page)
  await page.keyboard.press('1'); await goto(page, 'R040'); await toColKey(page, 'name')
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Input.imeSetComposition', { selectionStart: 1, selectionEnd: 1, text: 'り' })
  await sleep(50)
  await cdp.send('Input.imeSetComposition', { selectionStart: 2, selectionEnd: 2, text: 'りれ' })
  await cdp.send('Input.insertText', { text: 'リレー' })
  await sleep(100)
  const m = await mode(page)
  out.misc.imeInNav = { mode: m, editVal: m === '編集' ? await page.getByTestId('cell-editor').inputValue() : null, name: await cell('R040', 'name'), toast: (await toastNow(page)).slice(0, 80), active: await page.evaluate(() => document.activeElement?.className) }
  console.log('imeInNav', JSON.stringify(out.misc.imeInNav))
}
save('04-burst.json', out)
console.log('text NG', out.text.filter((x) => !x.ok).length, '/', out.text.length)
dumpErrors(errors, '04')
await browser.close()
