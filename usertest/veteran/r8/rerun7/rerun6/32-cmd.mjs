// コマンドの向き: プロの連続コマンド（x→n、x→j、h→j、a→j、o→j、s→4、Shift+D→j …）を 60〜600ms 間隔で打ち、
// コマンドとして最後まで動くか（途中から文字にならないか）。あわせて「コマンドの直後に値を打つ」「英字 1 打の直後の Esc / Backspace / Enter」
import fs from 'node:fs'
import { open, reset, gotoCell, snap, diffRows, typeSeq, sleep } from './letterlib.mjs'
const TARGETS = (process.env.TARGETS ?? 'dev:5176,build:5197').split(',').map((x) => x.split(':'))
const GAPS = (process.env.GAPS ?? '60,150,300,450,600').split(',').map(Number)
const rep = (s, gap) => [...s].map((ch, i) => [ch, i ? gap : 0])
// [名前, 役割, ビュー, 行, 列, 並び(gap)=>seq, 期待の判定(a,b,d)=>bool]
const noEdit = (b) => b.mode !== '編集'
const count = (d, re) => d.filter((x) => re.test(x)).length
const CASES = [
  ['xnxnxn', 'design', 4, null, null, (g) => rep('xnxnxn', g), (a, b, d) => noEdit(b) && count(d, /ackRules/) >= 3],
  ['xjxjxj', 'design', 4, null, null, (g) => rep('xjxjxj', g), (a, b, d) => noEdit(b) && count(d, /ackRules/) >= 3],
  ['hjhjhj', 'design', 1, 'R040', '部品名', (g) => rep('hjhjhj', g), (a, b, d) => noEdit(b) && count(d, /hidden:false→true/) === 3],
  ['hkhk', 'design', 1, 'R040', '部品名', (g) => rep('hkhk', g), (a, b, d) => noEdit(b) && count(d, /hidden:false→true/) === 2],
  ['ajaj', 'design', 1, 'R040', '型式', (g) => rep('ajaj', g), (a, b, d) => noEdit(b) && count(d, /adoptedSupplierId/) >= 1],
  ['s4', 'design', 1, 'R040', '型式', (g) => rep('s4', g), (a, b) => noEdit(b) && b.view === 'view-4' && /並び替え/.test(b.chips)],
  ['Dj', 'design', 1, 'R040', '型式', (g) => rep('Dj', g), (a, b, d) => noEdit(b) && d.some((x) => /\+new/.test(x))],
  ['DjDj', 'design', 1, 'R040', '型式', (g) => rep('DjDj', g), (a, b, d) => noEdit(b) && d.filter((x) => /\+new/.test(x)).length === 2],
  ['nxnx', 'design', 4, null, null, (g) => rep('nxnx', g), (a, b, d) => noEdit(b) && count(d, /ackRules/) >= 2],
  ['fj', 'design', 1, 'R040', 'メーカ', (g) => rep('fj', g), (a, b) => noEdit(b) && /=/.test(b.chips)],
  ['ojoj(購買3ロット)', 'purchasing', 3, null, 'ロット', (g) => rep('ojoj', g), (a, b, d) => noEdit(b) && count(d, /\.ordered:/) >= 2],
  ['ijij(購買3ロット)', 'purchasing', 3, null, 'ロット', (g) => rep('ijij', g), (a, b, d) => noEdit(b) && count(d, /\.received:|\.ordered:/) >= 1],
  ['Xn(購買)', 'purchasing', 1, 'R040', 'ロット', (g) => rep('xnxn', g), (a, b) => noEdit(b)],
  // コマンドの直後（1.5 秒以内）に別の行で値を打つ
  ['x→j→coil', 'design', 4, null, null, (g) => [['x', 0], ['j', 500], ...rep('coil', 60).map(([c, t], i) => [c, i ? t : g])], (a, b) => b.mode === '編集' && b.edit === 'coil'],
  ['h→Analog', 'design', 1, 'R040', 'メーカ', (g) => [['h', 0], ...rep('Analog', 60).map(([c, t], i) => [c, i ? t : 500 + g])], (a, b) => b.mode === '編集' && b.edit === 'Analog'],
  ['h→↓→snap', 'design', 1, 'R040', '部品名', (g) => [['h', 0], ['ArrowDown', 500], ...rep('snap', 60).map(([c, t], i) => [c, i ? t : g])], (a, b) => b.mode === '編集' && b.edit === 'snap'],
  // 英字 1 打の直後に Esc / Backspace / Enter / Tab（打ち間違いを消す・1 文字の値）
  ['h→Esc', 'design', 1, 'R040', '備考', (g) => [['h', 0], ['Escape', Math.min(g, 350)]], (a, b, d) => d.length === 0],
  ['h→Backspace', 'design', 1, 'R040', '備考', (g) => [['h', 0], ['Backspace', Math.min(g, 350)]], (a, b, d) => d.length === 0],
  ['A→Enter', 'design', 1, 'R040', '備考', (g) => [['A', 0], ['Enter', Math.min(g, 350)]], (a, b, d) => !d.some((x) => /adopted|status/.test(x))],
  ['x→Tab', 'design', 1, 'R040', '備考', (g) => [['x', 0], ['Tab', Math.min(g, 350)]], (a, b, d) => d.length === 0],
]
const ONLY = process.env.ONLY ? process.env.ONLY.split('|') : null
const out = {}
for (const [tag, port] of TARGETS) {
  const env = await open(port, { cpu: process.env.CPU ? Number(process.env.CPU) : undefined })
  out[tag] = []
  for (const [name, role, view, rowId, col, seqOf, judge] of CASES.filter((c) => !ONLY || ONLY.includes(c[0]))) {
    for (const gap of GAPS) {
      await reset(env, { role, n300: !!process.env.N300 })
      if (rowId) await gotoCell(env.page, view, rowId, col)
      else {
        await env.page.keyboard.press(String(view)); await sleep(40)
        if (col) { await env.page.keyboard.press('Home'); for (let i = 0; i < 60 && !(await env.page.getByTestId('cursor').textContent()).endsWith(col); i++) await env.page.keyboard.press('ArrowRight') }
      }
      const a = await snap(env.page)
      const seq = seqOf(gap)
      const lags = await typeSeq(env.page, seq)
      await sleep(700)
      const b = await snap(env.page)
      const d = diffRows(a, b)
      const ok = !!judge(a, b, d)
      const rec = { name, role, gap, ok, cursor: [a.cursor, b.cursor], view: [a.view, b.view], mode: b.mode, edit: b.edit, panel: b.panel, chips: b.chips, toast: b.toast, diff: d, maxLag: Math.max(...lags) }
      out[tag].push(rec)
      console.log(tag, ok ? 'OK' : 'NG', `${name}@${gap}`, '| mode', b.mode, 'edit', JSON.stringify(b.edit), '| cur', a.cursor, '→', b.cursor, '| view', b.view, '| panel', b.panel, '| chips', b.chips, '| diff', d.join(' ; ').slice(0, 260), '| toast', b.toast.slice(0, 70), '| lag', rec.maxLag)
    }
  }
  console.log(tag, 'errors', env.errs.slice(0, 5))
  await env.browser.close()
}
fs.writeFileSync(`/home/user/BOM/usertest/veteran/r8/rerun7/rerun6/${process.env.OUT ?? '32-cmd.json'}`, JSON.stringify(out, null, 2))
