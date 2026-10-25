// ラウンド23: 区切りの決め方（見出しの語で先に決める headerHit / 列数×行数 consistency×2）の乱数試験。
// 正解つき: 部品名の列が P0.. の順に全部読めるか（行数と名前）。TSV / CSV（Excel 書き出し=必要なセルだけ囲む / 全部囲む / 囲まない）× 反対側の区切りを含むセル
import fs from 'node:fs'
import { parseBomPaste, rng } from './h22.ts'
const N = Number(process.env.N ?? 20000)
const { pick, chance, int } = rng(Number(process.env.SEED ?? 23))
const HEADS: Record<string, string> = { name: '部品名', model: '型式', maker: 'メーカ', qty: '数量', note: '備考', ref: '回路記号', unit: '単位' }
const items = (k: number, p = 'R') => Array.from({ length: k }, (_, i) => `${p}${i + 1}`)
const bad: any[] = []
const stat: Record<string, { n: number; bad: number }> = {}
for (let t = 0; t < N; t++) {
  const kind = pick(['tsv', 'tsv', 'csv', 'csv', 'csvq', 'tsvq'])
  const D = kind.startsWith('tsv') ? '\t' : ','
  const X = D === '\t' ? ',' : '\t'
  const cols = pick([['name', 'qty'], ['name', 'model', 'qty'], ['name', 'model', 'qty', 'ref'], ['name', 'model', 'maker', 'qty', 'note'], ['name', 'model', 'maker', 'qty', 'unit', 'ref', 'note'], ['name', 'ref', 'qty', 'model']])
  const hasHead = chance(0.9)
  const nrows = 3 + int(40)
  const crossCol = int(cols.length)
  const crossMode = pick(['none', 'const', 'var', 'half'])
  const crossK = 1 + int(8)
  const nTitle = pick([0, 0, 0, 1, 2, 4, 8])
  const titleCross = chance(0.5)
  const edaStyle = chance(0.2) // EDA: 回路記号の列に「R1, R2, R3」を全行、囲みあり
  const rows: string[][] = []
  const truth: string[] = []
  for (let r = 0; r < nrows; r++) {
    truth.push('P' + r)
    rows.push(cols.map((c, j) => {
      if (c === 'name') return 'P' + r
      if (c === 'model') return 'M-' + r
      if (c === 'maker') return 'オムロン'
      if (c === 'qty') return String(1 + (r % 5))
      if (c === 'unit') return '個'
      let cross = ''
      const k = crossMode === 'const' ? crossK : crossMode === 'var' ? 1 + int(crossK + 1) : crossMode === 'half' && r % 2 ? crossK : 0
      if (c === 'ref' && edaStyle) return items(1 + int(5)).join(D === '\t' ? ', ' : ', ')
      if (j === crossCol && k > 0) cross = items(k + 1, 'x').join(X + (X === ',' ? ' ' : ''))
      return c === 'note' ? 'メモ' + cross : c === 'ref' ? 'R' + r + (cross ? X + cross : '') : cross
    }))
  }
  const q = (c: string, forceAll: boolean) => (forceAll || c.includes(D) || c.includes('"') || c.includes('\n')) ? '"' + c.replace(/"/g, '""') + '"' : c
  const quoteAll = kind.endsWith('q')
  const render = (r: string[]) => r.map((c) => (kind === 'tsv' || kind === 'csv') && !(kind === 'csv' && c.includes(D)) ? c : q(c, false) && quoteAll ? q(c, true) : (c.includes(D) ? q(c, false) : c)).join(D)
  const lines: string[] = []
  for (let i = 0; i < nTitle; i++) lines.push(titleCross ? ['部品表', '客先, X商事', '納期, 12月', 'Rev.2, 山田'][i % 4] : pick(['部品表', '制御盤A', '2026-10-25']))
  if (hasHead) lines.push(cols.map((c) => HEADS[c]).join(D))
  for (const r of rows) lines.push(render(r))
  const text = lines.join('\n') + '\n'
  const res = parseBomPaste(text)
  const names = res.rows.map((x: any) => x.name)
  const ok = hasHead && names.length === truth.length && names.every((n: string, i: number) => n === truth[i])
  const key = `${kind}/${crossMode}${edaStyle ? '/eda' : ''}`
  const s = (stat[key] ??= { n: 0, bad: 0 }); s.n++
  if (hasHead && !ok) { s.bad++; if (bad.length < 60) bad.push({ kind, cols: cols.join(','), crossMode, crossK, nTitle, titleCross, edaStyle, delim: res.delimiter, got: names.slice(0, 4), n: names.length, text: text.slice(0, 500) }) }
}
const tot = Object.values(stat).reduce((a, s) => a + s.n, 0), tb = Object.values(stat).reduce((a, s) => a + s.bad, 0)
console.log('N', tot, 'bad', tb)
for (const [k, v] of Object.entries(stat).sort()) console.log(k, v.bad + '/' + v.n)
fs.writeFileSync('/home/user/BOM/usertest/veteran/r23/301-delim-fuzz' + (process.env.TAG ?? '') + '.json', JSON.stringify({ stat, bad }, null, 1))
