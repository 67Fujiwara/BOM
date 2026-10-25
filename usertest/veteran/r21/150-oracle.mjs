// 150-ordinary-fuzz の jsonl（truth つき）で、取り込み結果が元の表と合っているか（行数・部品名・型式・備考）。ditto・名前が空の行は除く
import fs from 'node:fs'
const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim()
const isDitto = (s) => /^(〃+|″+|”+|＂+|"+|同上|同左|々)$/.test(norm(s))
for (const f of process.argv.slice(2)) {
  const A = fs.readFileSync(f, 'utf8').split('\n').map((l) => JSON.parse(l))
  let cases = 0, countBad = 0, cellBad = 0; const ex = []
  for (const x of A) {
    cases++
    const rows = (x.rows ?? []).map((r) => { const c = r.split('\u0001'); return { name: c[0], model: c[1], note: c[7] } })
    const T = x.truth
    if (rows.length !== T.length) { countBad++; if (ex.length < 3) ex.push({ kind: 'count', got: rows.length, want: T.length, text: x.text.slice(0, 300) }); continue }
    let bad = false
    T.forEach((t, k) => { if (isDitto(t.name) || isDitto(t.model)) return; if (norm(rows[k].name) !== norm(t.name) || norm(rows[k].model) !== norm(t.model)) bad = true })
    if (bad) { cellBad++; if (ex.length < 3) ex.push({ kind: 'cell', text: x.text.slice(0, 300) }) }
  }
  console.log(f.split('/').pop(), 'cases', cases, 'rowcount-mismatch', countBad, 'cell-mismatch', cellBad)
  for (const e of ex) console.log('   ', JSON.stringify(e).slice(0, 420))
}
