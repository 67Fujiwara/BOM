// ラウンド6: コマンドの連続（ID・状態の列で英字だけ／文字を打てる列で Alt 付き／F8）。0〜1000ms の間隔で、最後までコマンドとして動くか。
// 英字 1 打の反応時間、Alt を押したまま ↓・数字を押したときの動きも見る。
import { open, reset, gotoCell, snap, diffRows, typeSeqM, sleep, saveJson } from './lib7.mjs'
const TARGETS = (process.env.TARGETS ?? 'dev:5176,build:5197').split(',').map((x) => x.split(':'))
const GAPS = (process.env.GAPS ?? '0,30,120,450,1000').split(',').map(Number)
const seqOf = (toks, g) => toks.map((t, i) => [t, i ? g : 0])
const noEdit = (b) => b.mode !== '編集'
const count = (d, re) => d.filter((x) => re.test(x)).length
// [名前, 役割, ビュー, 行, 列, トークン, 判定]
const CASES = [
  ['ID: x n x n x n', 'design', 4, 'R016', 'ID', 'x n x n x n', (a, b, d) => noEdit(b) && count(d, /ackRules/) >= 1],
  ['ID: x j x j x j', 'design', 4, 'R016', 'ID', 'x j x j x j', (a, b, d) => noEdit(b) && count(d, /ackRules/) >= 1],
  ['ID: h j h j h j', 'design', 1, 'R040', 'ID', 'h j h j h j', (a, b, d) => noEdit(b) && count(d, /hidden:.*→true/) === 3],
  ['ID: a j a j', 'design', 1, 'R040', 'ID', 'a j a j', (a, b, d) => noEdit(b) && count(d, /adoptedSupplierId/) >= 1],
  ['ID: D j D j', 'design', 1, 'R040', 'ID', 'D j D j', (a, b, d) => noEdit(b) && count(d, /\+new/) === 2],
  ['ID: s 4', 'design', 1, 'R040', 'ID', 's 4', (a, b) => noEdit(b) && b.view === 'view-4'],
  ['状態: h j h j h j', 'design', 1, 'R040', '状態', 'h j h j h j', (a, b, d) => noEdit(b) && count(d, /hidden:.*→true/) === 3],
  ['Alt: x n x n x n（部品名から）', 'design', 4, 'R016', '部品名', 'A-x A-n A-x A-n A-x A-n', (a, b, d) => noEdit(b) && count(d, /ackRules/) >= 1],
  ['Alt: x F8 x F8 x F8', 'design', 4, 'R016', '部品名', 'A-x F8 A-x F8 A-x F8', (a, b, d) => noEdit(b) && count(d, /ackRules/) >= 1],
  ['Alt: h j h j h j', 'design', 1, 'R040', '部品名', 'A-h A-j A-h A-j A-h A-j', (a, b, d) => noEdit(b) && count(d, /hidden:.*→true/) === 3],
  ['Ctrl+Alt+A j Ctrl+Alt+A', 'design', 1, 'R040', '型式', 'C-A-a A-j C-A-a', (a, b, d) => noEdit(b) && count(d, /adoptedSupplierId/) >= 1],
  ['Alt+a（推奨）', 'design', 1, 'R040', '型式', 'A-a', (a, b, d) => noEdit(b) && count(d, /adoptedSupplierId/) >= 1],
  ['ID: x F8 x F8 x F8', 'design', 4, 'R016', 'ID', 'x F8 x F8 x F8', (a, b, d) => noEdit(b) && b.cursor.endsWith(' ID') && count(d, /ackRules/) >= 2],
  ['ID: x N x N（Shift+N）', 'design', 4, 'R016', 'ID', 'x N x N', (a, b, d) => noEdit(b) && b.cursor.endsWith(' ID')],
  ['ID: x S-F8 x S-F8', 'design', 4, 'R016', 'ID', 'x S-F8 x S-F8', (a, b, d) => noEdit(b) && b.cursor.endsWith(' ID')],
  ['状態: x n x n x n', 'design', 4, 'R016', '状態', 'x n x n x n', (a, b, d) => noEdit(b) && b.cursor.endsWith(' 状態') && count(d, /ackRules/) >= 2],
  ['ID: n n n n n n', 'design', 4, 'R016', 'ID', 'n n n n n n', (a, b, d) => noEdit(b) && b.cursor.endsWith(' ID')],
  ['Alt: 4 j 1（Alt+数字）', 'design', 1, 'R040', '型式', 'A-4 A-j A-1', (a, b) => noEdit(b) && b.view === 'view-1'],
  ['Alt: h ↓ ↓（押したまま）', 'design', 1, 'R040', '部品名', 'A-h A-ArrowDown A-ArrowDown', (a, b, d) => !d.includes('order changed') && noEdit(b)],
  ['Alt: Shift+D ↓', 'design', 1, 'R040', '型式', 'A-S-d A-ArrowDown', (a, b, d) => !d.includes('order changed') && noEdit(b)],
  ['Alt: d（割り当て無し）', 'design', 1, 'R040', '型式', 'A-d', (a, b, d) => noEdit(b) && d.length === 0 && /割り当て/.test(b.toast)],
  ['Alt: Shift+D j Shift+D j', 'design', 1, 'R040', '型式', 'A-S-d A-j A-S-d A-j', (a, b, d) => noEdit(b) && count(d, /\+new/) === 2],
  ['Alt: s 4（4 は Alt なし）', 'design', 1, 'R040', '型式', 'A-s 4', (a, b) => noEdit(b) && b.view === 'view-4'],
  ['Alt: f j', 'design', 1, 'R040', 'メーカ', 'A-f A-j', (a, b) => noEdit(b) && /=/.test(b.chips)],
  ['Alt: Shift+I（指摘パネル）', 'design', 1, 'R040', '部品名', 'A-S-i', (a, b) => b.panel === 'panel-issue'],
  ['Alt: Shift+A（採用パネル）', 'design', 1, 'R040', '部品名', 'A-S-a', (a, b) => b.panel === 'panel-adopt'],
  ['購買3ロット Alt: o k j', 'purchasing', 3, 'R013', 'ロット', 'A-o A-k A-j', (a, b, d) => noEdit(b) && count(d, /\.ordered:/) >= 1],
  ['購買3発注 o k j（文字を打てない列）', 'purchasing', 3, 'R013', '発注', 'o k j', (a, b, d) => noEdit(b) && count(d, /\.ordered:/) >= 1],
  ['購買 ID: x n x n', 'purchasing', 4, 'first', 'ID', 'x n x n', (a, b) => noEdit(b)],
  ['PM 7: j k j（PM は打てる列が無い）', 'pm', 7, 'first', null, 'j k j', (a, b) => noEdit(b)],
  // 文字を打てる列で、Alt を付けずに打ったものは必ず値（コマンドにならない）
  ['部品名: xnxnxn は値', 'design', 4, 'R016', '部品名', 'x n x n x n', (a, b, d) => b.mode === '編集' && b.edit === 'xnxnxn' && d.length === 0],
  ['部品名: hjhjhj は値', 'design', 1, 'R040', '部品名', 'h j h j h j', (a, b, d) => b.mode === '編集' && b.edit === 'hjhjhj' && d.length === 0],
  // Alt を押したまま ↓ / 4（Alt を離し忘れ）
  ['Alt: h ↓（Alt+↓ は行の移動）', 'design', 1, 'R040', '部品名', 'A-h A-ArrowDown', (a, b, d) => !d.includes('order changed')],
  ['Alt: x 4（Alt+4）', 'design', 1, 'R016', '部品名', 'A-x A-4', (a, b) => b.view === 'view-4'],
]
const ONLY = process.env.ONLY ? process.env.ONLY.split('|') : null
const out = {}
for (const [tag, port] of TARGETS) {
  const env = await open(port)
  out[tag] = []
  for (const [name, role, view, rowId, col, toks, judge] of CASES.filter((c) => !ONLY || ONLY.includes(c[0]))) {
    for (const gap of GAPS) {
      await reset(env, { role })
      const pg = env.page
      if (rowId && rowId !== 'first') await gotoCell(pg, view, rowId, col)
      else {
        await pg.keyboard.press(`Alt+${view}`); await sleep(40); await pg.keyboard.press('ArrowDown'); await sleep(20)
        if (col) { await pg.keyboard.press('Home'); for (let i = 0; i < 70 && !(await pg.getByTestId('cursor').textContent()).endsWith(' ' + col); i++) await pg.keyboard.press('ArrowRight') }
      }
      const a = await snap(pg)
      const res = await typeSeqM(pg, seqOf(toks.split(' '), gap))
      await sleep(250)
      const b = await snap(pg)
      const d = diffRows(a, b)
      const ok = !!judge(a, b, d)
      const rec = { name, role, gap, ok, cursor: [a.cursor, b.cursor], view: [a.view, b.view], mode: b.mode, edit: b.edit, panel: b.panel, chips: b.chips, toast: b.toast, diff: d, notPrevented: res.filter((r) => !r.prevented).map((r) => (r.alt ? 'Alt+' : '') + r.key) }
      out[tag].push(rec)
      console.log(tag, ok ? 'OK' : 'NG', `${name}@${gap}`, '| mode', b.mode, 'edit', JSON.stringify(b.edit), '| cur', a.cursor, '→', b.cursor, '| view', b.view, '| panel', b.panel, '| chips', b.chips, '| diff', d.join(' ; ').slice(0, 260), '| toast', b.toast.slice(0, 80), '| notPrev', rec.notPrevented.join(','))
    }
  }
  console.log(tag, 'errors', env.errs.slice(0, 5))
  await env.browser.close()
}
saveJson(process.env.OUT ?? '51-chains.json', out)
for (const [t, arr] of Object.entries(out)) console.log('SUMMARY', t, arr.filter((r) => r.ok).length, '/', arr.length, 'NG:', [...new Set(arr.filter((r) => !r.ok).map((r) => r.name))].join(' | '))
