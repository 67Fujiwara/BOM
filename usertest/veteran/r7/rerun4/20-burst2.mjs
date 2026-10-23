// ラウンド4: 打ち始めルール（250ms / 600ms）の両方向。文字→コマンド化、コマンド→文字化を探す
import { launch, fresh, setRole, goto, toColKey, mode, sleep, dumpErrors, save, row, closeAll, toastNow, storeState, cursor } from './lib.mjs'
const { browser, page, errors } = await launch()
const out = { text: [], cmd: [], gaps: [] }
const cell = async (id, key) => storeState(page, new Function('s', `const r = s.project().rows.find((x) => x.id === ${JSON.stringify(id)}); return r ? (r.working?.[${JSON.stringify(key)}] ?? r[${JSON.stringify(key)}]) : null`))
async function press(ch) {
  if (/^[A-Z]$/.test(ch)) await page.keyboard.press('Shift+' + ch)
  else if (ch === ' ') await page.keyboard.press('Space')
  else await page.keyboard.press(ch)
}
async function typeSeq(seq, gaps) {
  let i = 0
  for (const ch of seq) { await press(ch); await sleep(Array.isArray(gaps) ? (gaps[i] ?? 45) : gaps); i++ }
}
async function snap() {
  return storeState(page, (s) => ({ view: s.view, sort: s.sort, cellFilter: s.cellFilter, rows: s.project().rows.length, panel: s.panel?.kind ?? null, mode: s.mode, cursorRow: s.cursorRow, cursorCol: s.cursorCol, hidden: s.project().rows.filter((r) => r.hidden).map((r) => r.id), adopted: s.project().rows.filter((r) => r.adoptedSupplierId).length, ordered: s.project().rows.filter((r) => r.ordered).map((r) => r.id), received: s.project().rows.filter((r) => r.received).map((r) => r.id), acks: s.project().rows.reduce((a, r) => a + Object.keys(r.flags?.acked ?? r.acked ?? {}).length, 0), editValue: s.editValue }))
}
function diff(a, b) { return Object.fromEntries(Object.keys(a).filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]) && !['mode', 'editValue'].includes(k)).map((k) => [k, [a[k], b[k]]])) }

// ---------- A. 文字のつもりがコマンドになる（打った文字がそのセルに入れば OK） ----------
const TEXT = [
  ['ref', 'K1', '回路記号 K1（リレー）: Shift+K のあと数字'], ['ref', 'J1', '回路記号 J1（コネクタ）'], ['ref', 'J12', '回路記号 J12'], ['ref', 'N1', '回路記号 N1'], ['ref', 'k1', '小文字 k1'], ['ref', 'KA1', 'KA1'], ['ref', 'CN1', 'CN1'],
  ['model', 'K3HB-X', 'オムロン K3HB（Shift+K→3）'], ['model', 'J7KN-10', 'オムロン J7KN（Shift+J→7）'], ['model', 'K8AK-AS1', 'オムロン K8AK'], ['model', 'JJ-100', 'JJ 始まり'], ['model', 'NN-5', 'NN 始まり'],
  ['model', 'ADP3338', 'Shift+A（見積済の行）'], ['model', 'AD8605', 'Shift+A のあと D'], ['model', 'INA219', 'Shift+I'], ['maker', 'WAGO', 'Shift+W'], ['maker', 'wago', 'w（重みパネル）'], ['name', 'coil', 'c（列パネル）'], ['name', 'cable', 'c'], ['name', 'capacitor', 'c'],
  ['model', 'DRV8833', 'Shift+D'], ['model', 'NJM2904', 'Shift+N'], ['name', 'knob', 'k→n'], ['name', 'nand', 'n→a'], ['name', 'ssr', 's→s'], ['name', 'jumper', 'j→u'], ['name', 'kj', 'k→j（行き来）'],
  ['model', 'S1', 'Shift+S→1'], ['model', 'X1', 'Shift+X→1'], ['model', 'H1', 'h→1（Shift+H は割り当てなし）'], ['name', 'a1', 'a→1'], ['model', '2SC1815', '数字始まり'],
]
for (const [col, text, why] of TEXT) {
  await fresh(page); await page.keyboard.press('1'); await goto(page, 'R040')
  if (!(await toColKey(page, col))) { out.text.push({ col, text, err: 'col not found' }); continue }
  const b = await snap(); const v0 = await cell('R040', col)
  await typeSeq(text, 45); await sleep(650)
  const m = await mode(page)
  const ev = m === '編集' ? await page.getByTestId('cell-editor').inputValue().catch(() => null) : null
  const toast = (await toastNow(page)).slice(0, 90)
  if (m === '編集') { await page.keyboard.press('Enter'); await sleep(40) }
  const a = await snap(); const v1 = await cell('R040', col)
  const rec = { col, text, why, ok: v1 === text, before: v0, after: v1, editVal: ev, side: diff(b, a), toast }
  out.text.push(rec)
  console.log(rec.ok ? 'OK ' : 'NG ', col, text, '→', JSON.stringify(v1), JSON.stringify(rec.side).slice(0, 220), '|', toast.slice(0, 60))
}
// 下書き（見積なし）の行でも Shift+A 系
for (const text of ['ADP3338', 'IRF540N']) {
  await fresh(page); await page.keyboard.press('1')
  const target = await storeState(page, (s) => s.project().rows.find((r) => r.status === 'draft')?.id ?? null)
  await goto(page, target); await toColKey(page, 'model')
  const b = await snap(); await typeSeq(text, 45); await sleep(650)
  const m = await mode(page); const ev = m === '編集' ? await page.getByTestId('cell-editor').inputValue().catch(() => null) : null
  if (m === '編集') { await page.keyboard.press('Enter'); await sleep(40) }
  const a = await snap(); const v1 = await cell(target, 'model')
  out.text.push({ col: 'model', text, why: '下書き行 ' + target, ok: v1 === text, after: v1, editVal: ev, side: diff(b, a) })
  console.log('draft', target, text, JSON.stringify(v1), JSON.stringify(diff(b, a)).slice(0, 200))
}

// ---------- B. コマンドのつもりが文字になる（連続操作） ----------
const CMD = [
  // [役割, ビュー, 行, 列, 連続キー, 説明, 間隔]
  ['design', '1', 'R040', 'name', 'hjhjhj', '行を隠す→次の行 ×3', 45],
  ['design', '1', 'R040', 'name', 'hjhjhj', '同 120ms', 120],
  ['design', '1', 'R040', 'name', 'hjhjhj', '同 200ms', 200],
  ['design', '1', 'R040', 'name', 'hjhjhj', '同 260ms', 260],
  ['design', '4', null, 'name', 'xnxnxn', '確認済み→次の問題 ×3（4 要確認）', 45],
  ['design', '4', null, 'name', 'xnxnxn', '同 150ms', 150],
  ['design', '1', 'R040', 'name', 'ajaj', '推奨で採用→次の行', 60],
  ['design', '1', 'R040', 'name', 'anan', '推奨で採用→次の問題', 60],
  ['design', '1', 'R040', 'model', 's4', '並び替え→ビュー4', 60],
  ['design', '1', 'R040', 'model', 'S1', '降順→ビュー1', 60],
  ['design', '1', 'R040', 'model', 'f1', '絞り込み→ビュー1', 60],
  ['design', '1', 'R040', 'model', 'Dj', '複製→次の行', 60],
  ['design', '1', 'R040', 'model', 'hk', '隠す→前の行', 60],
  ['purchasing', '3', 'R001', 'receivedLot', 'ojoj', '発注→次の行（ロットの列）', 60],
  ['purchasing', '3', 'R001', 'receivedLot', 'ijij', '入荷→次の行（ロットの列）', 60],
  ['purchasing', '9', null, 'orderQty', 'ojoj', '発注→次の行（発注数の列・9）', 60],
]
for (const [role, view, rid, col, seq, why, gap] of CMD) {
  await fresh(page, role); await page.keyboard.press(view); await sleep(40)
  if (rid) await goto(page, rid); else { await page.keyboard.press('Control+ArrowUp'); await page.keyboard.press('j'); await page.keyboard.press('k') }
  await toColKey(page, col)
  await sleep(700)
  const start = await cursor(page)
  const b = await snap()
  await typeSeq(seq, gap); await sleep(700)
  const m = await mode(page)
  const ev = m === '編集' ? await page.getByTestId('cell-editor').inputValue().catch(() => null) : null
  const toast = (await toastNow(page)).slice(0, 90)
  const a = await snap()
  const rec = { role, view, start, col, seq, why, gap, mode: m, editVal: ev, side: diff(b, a), toast }
  out.cmd.push(rec)
  console.log('CMD', seq, gap, why, '| mode', m, 'edit', JSON.stringify(ev), JSON.stringify(rec.side).slice(0, 260), '|', toast.slice(0, 50))
  if (m === '編集') await page.keyboard.press('Escape')
}

// ---------- C. 境界: 割り当てのある 2 文字目の間隔（240 / 260 / 400ms）と、割り当ての無い 2 文字目（580 / 620ms） ----------
for (const [seq, gaps, why] of [['DR', [240], 'Shift+D→R 240ms'], ['DR', [270], 'Shift+D→R 270ms'], ['ab', [240], 'a→b 240'], ['ab', [270], 'a→b 270'], ['hu', [550], 'h→u(割当なし) 550'], ['hu', [650], 'h→u 650'], ['knob', [300, 45, 45], 'k→n 300ms']]) {
  await fresh(page); await page.keyboard.press('1'); await goto(page, 'R040'); await toColKey(page, 'name')
  const b = await snap(); await typeSeq(seq, gaps); await sleep(700)
  const m = await mode(page); const ev = m === '編集' ? await page.getByTestId('cell-editor').inputValue().catch(() => null) : null
  const a = await snap()
  out.gaps.push({ seq, gaps, why, mode: m, editVal: ev, side: diff(b, a), toast: (await toastNow(page)).slice(0, 80) })
  console.log('GAP', why, m, JSON.stringify(ev), JSON.stringify(diff(b, a)).slice(0, 200))
  await closeAll(page)
}
save(process.env.OUT ?? '20-burst2.json', out)
console.log('text NG', out.text.filter((x) => !x.ok).length, '/', out.text.length)
dumpErrors(errors, '20')
await browser.close()
