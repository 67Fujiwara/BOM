// ラウンド4: r のダイアログ・打ち始め後の IME・PageDown・Undo/Redo の長い連鎖（行の移動を含む）・連続コマンド
import { launch, fresh, setRole, goto, toColKey, mode, sleep, dumpErrors, save, closeAll, toastNow, storeState, cursor, cursorVisible, panel } from './lib.mjs'
const { browser, page, errors } = await launch()
const out = {}
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null
const want = (k) => !ONLY || ONLY.includes(k)
const rowsState = () => storeState(page, (s) => s.project().rows.map((r) => ({ id: r.id, name: r.working?.name ?? r.name, model: r.working?.model ?? r.model, note: r.working?.note ?? r.note, status: r.status, hidden: !!r.hidden, deleted: !!r.removal || !!r.pendingRemoval })))
const sameRows = (a, b) => JSON.stringify(a) === JSON.stringify(b)
async function typeSeq(seq, gap = 45) { for (const ch of seq) { if (/^[A-Z]$/.test(ch)) await page.keyboard.press('Shift+' + ch); else await page.keyboard.press(ch === ' ' ? 'Space' : ch); await sleep(gap) } }

// 1. r のあと、ダイアログが見えてから打つ（150 / 400 / 650ms）
if (want('r')) {
  out.r = []
  for (const wait of [150, 400, 650]) {
    await fresh(page); await page.keyboard.press('1'); await goto(page, 'R040'); await toColKey(page, 'model')
    await page.keyboard.press('r'); await sleep(wait)
    const dlg = await panel(page)
    await typeSeq('MY4N-NEW'); await sleep(50)
    const m = await mode(page); const p2 = await panel(page)
    await page.keyboard.press('Enter'); await sleep(120)
    const st = await storeState(page, (s) => { const p = s.project(); const r = p.rows.find((x) => x.id === 'R040'); return { R040: r.working?.model ?? r.model, rows: p.rows.length, last: p.rows.at(-1).id, lastModel: p.rows.at(-1).working?.model ?? p.rows.at(-1).model } })
    out.r.push({ wait, dialogShownBeforeTyping: dlg, modeWhileTyping: m, panelWhileTyping: p2, ...st, toast: (await toastNow(page)).slice(0, 100) })
    console.log('r', wait, JSON.stringify(out.r.at(-1)))
  }
}
// 2. 打ち始めで編集に入ったあと IME で続ける（f → 1 は文字扱い → 編集 → 日本語）
if (want('ime')) {
  out.ime = []
  for (const seq of ['f1', 'ab', 'Dx']) {
    await fresh(page); await page.keyboard.press('1'); await goto(page, 'R040'); await toColKey(page, 'name')
    await typeSeq(seq, 45); await sleep(80)
    const active = await page.evaluate(() => document.activeElement?.className)
    const cdp = await page.context().newCDPSession(page)
    await cdp.send('Input.imeSetComposition', { selectionStart: 1, selectionEnd: 1, text: 'り' })
    await cdp.send('Input.imeSetComposition', { selectionStart: 3, selectionEnd: 3, text: 'りれー' })
    await cdp.send('Input.insertText', { text: 'リレー' })
    await sleep(80)
    const ev = await storeState(page, (s) => ({ mode: s.mode, editValue: s.editValue }))
    await page.keyboard.press('Enter'); await sleep(80)
    const name = await storeState(page, (s) => { const r = s.project().rows.find((x) => x.id === 'R040'); return r.working?.name ?? r.name })
    out.ime.push({ seq, activeAfterBurst: active, store: ev, saved: name })
    console.log('ime', seq, JSON.stringify(out.ime.at(-1)))
  }
}
// 3. PageDown / PageUp が見えている行数ぶんか（3 つの画面サイズ）
if (want('page')) {
  out.page = {}
  for (const vp of [{ width: 853, height: 480 }, { width: 1440, height: 900 }, { width: 1920, height: 1200 }]) {
    await page.setViewportSize(vp)
    await fresh(page); await page.keyboard.press('1'); await goto(page, 'R010'); await sleep(100)
    const visibleRows = await page.evaluate(() => { const w = document.querySelector('.gridwrap'); const wr = w.getBoundingClientRect(); const th = w.querySelector('thead').getBoundingClientRect().height; return [...w.querySelectorAll('tr.row')].filter((tr) => { const r = tr.getBoundingClientRect(); return r.top >= wr.top + th - 1 && r.bottom <= wr.bottom + 1 }).map((tr) => tr.querySelector('td')?.textContent) })
    const c0 = await cursor(page)
    await page.keyboard.press('PageDown'); await sleep(80)
    const c1 = await cursor(page); const v1 = await cursorVisible(page)
    await page.keyboard.press('PageUp'); await sleep(80)
    const c2 = await cursor(page)
    out.page[`${vp.width}x${vp.height}`] = { fullyVisibleRows: visibleRows.length, firstLast: [visibleRows[0], visibleRows.at(-1)], c0, afterPgDn: c1, visible: v1.inView, afterPgUp: c2 }
    console.log('page', vp.width, JSON.stringify(out.page[`${vp.width}x${vp.height}`]))
  }
  await page.setViewportSize({ width: 1440, height: 900 })
}
// 4. Undo / Redo の長い連鎖（移動・追加・複製・削除・編集・隠す を混ぜる）→ 全部戻すと最初と一致、全部やり直すと最後と一致
if (want('undo')) {
  await fresh(page); await page.keyboard.press('1')
  const s0 = await rowsState()
  const ops = []
  const seq = [
    ['R045', 'Alt+ArrowDown'], ['R046', 'Alt+ArrowDown'], ['R030', 'edit:name'], ['R050', 'Alt+ArrowUp'], ['R050', 'Alt+ArrowUp'], ['R060', 'Shift+Enter'], ['R061', 'Shift+D'], ['R030', 'Alt+ArrowDown'], ['R070', 'h'],
    ['R076', 'Shift+Delete'], ['R020', 'edit:note'], ['R021', 'Alt+ArrowDown'], ['R010', 'Alt+ArrowUp'], ['R001', 'Alt+ArrowUp'], ['R080', 'Alt+ArrowDown'], ['R040', 'Shift+D'], ['R040', 'Alt+ArrowDown'],
  ]
  let i = 0
  for (const [rid, op] of seq) {
    await goto(page, rid); await toColKey(page, 'name')
    if (op.startsWith('edit:')) { await toColKey(page, op.slice(5)); await page.keyboard.press('Enter'); await page.keyboard.press('Control+a'); await page.keyboard.type('U' + i); await page.keyboard.press('Enter') }
    else if (op === 'Shift+Enter') { await page.keyboard.press('Shift+Enter'); await sleep(40); await page.keyboard.type('新規' + i); await page.keyboard.press('Enter') }
    else if (op === 'Shift+Delete') { await page.keyboard.press('Shift+Delete'); await sleep(60); if (await panel(page)) { await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter') } }
    else await page.keyboard.press(op)
    await sleep(500) // 打ち始めの判定を外す
    ops.push(`${rid}:${op} → ${(await toastNow(page)).slice(0, 40)}`)
    i++
  }
  const s1 = await rowsState()
  const undoCount = await storeState(page, (s) => Object.values(s.undo).reduce((a, b) => a + b.length, 0))
  const undoMsgs = []
  for (let k = 0; k < seq.length + 2; k++) { await page.keyboard.press('Control+z'); await sleep(40); undoMsgs.push((await toastNow(page)).slice(0, 50)) }
  const s2 = await rowsState()
  const redoMsgs = []
  for (let k = 0; k < seq.length + 2; k++) { await page.keyboard.press('Control+y'); await sleep(40); redoMsgs.push((await toastNow(page)).slice(0, 50)) }
  const s3 = await rowsState()
  const firstDiff = (a, b) => { for (let j = 0; j < Math.max(a.length, b.length); j++) if (JSON.stringify(a[j]) !== JSON.stringify(b[j])) return { j, a: a[j], b: b[j] }; return null }
  out.undo = { ops, undoCount, undoAllEqualsStart: sameRows(s0, s2), redoAllEqualsEnd: sameRows(s1, s3), diffUndo: firstDiff(s0, s2), diffRedo: firstDiff(s1, s3), undoMsgs, redoMsgs, rowCount: [s0.length, s1.length, s2.length, s3.length] }
  console.log('undo', JSON.stringify(out.undo).slice(0, 3000))
  // 4b. 交互に Undo / Redo を 40 回（同じ状態を行き来できるか）
  const sA = await rowsState()
  for (let k = 0; k < 40; k++) { await page.keyboard.press(k % 2 ? 'Control+y' : 'Control+z'); await sleep(15) }
  out.undoAlt = { same: sameRows(sA, await rowsState()) }
  console.log('undoAlt', JSON.stringify(out.undoAlt))
}
// 5. 連続コマンド（ベテランの癖）: 4 要確認で x n、購買 3 で o j、i j
if (want('chain')) {
  out.chain = []
  for (const [role, view, col, seq, gap] of [['design', '4', 'name', 'xnxnxn', 45], ['design', '4', 'model', 'xnxnxn', 45], ['purchasing', '3', 'receivedLot', 'ojoj', 60], ['purchasing', '3', 'promisedDate', 'ojoj', 60], ['purchasing', '3', 'orderQty', 'ijij', 60], ['design', '1', 'name', 'hjhjhj', 45], ['design', '1', 'name', 'ajajaj', 60]]) {
    await fresh(page, role); await page.keyboard.press(view); await sleep(40)
    await page.keyboard.press('Control+ArrowUp'); await page.keyboard.press('j'); await sleep(30); await page.keyboard.press('k')
    if (role === 'purchasing') { await goto(page, 'R005'); }
    await toColKey(page, col); await sleep(650)
    const c0 = await cursor(page)
    const b = await storeState(page, (s) => ({ ordered: s.project().rows.filter((r) => r.ordered).length, received: s.project().rows.filter((r) => r.received).length, hidden: s.project().rows.filter((r) => r.hidden).length, adopted: s.project().rows.filter((r) => r.adoptedSupplierId).length, acks: JSON.stringify(s.project().rows.map((r) => r.ackRules)).length }))
    await typeSeq(seq, gap); await sleep(650)
    const a = await storeState(page, (s) => ({ mode: s.mode, editValue: s.editValue, ordered: s.project().rows.filter((r) => r.ordered).length, received: s.project().rows.filter((r) => r.received).length, hidden: s.project().rows.filter((r) => r.hidden).length, adopted: s.project().rows.filter((r) => r.adoptedSupplierId).length, acks: JSON.stringify(s.project().rows.map((r) => r.ackRules)).length }))
    out.chain.push({ role, view, col, seq, gap, start: c0, before: b, after: a, end: await cursor(page), toast: (await toastNow(page)).slice(0, 80) })
    console.log('chain', JSON.stringify(out.chain.at(-1)))
    await closeAll(page)
  }
}
save(process.env.OUT ?? '24-misc.json', out)
dumpErrors(errors, '24')
await browser.close()
