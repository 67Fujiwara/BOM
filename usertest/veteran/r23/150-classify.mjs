import fs from 'node:fs'
let tot = 0, cls = 0, other = []
for (const f of process.argv.slice(2)) {
  const A = fs.readFileSync(f, 'utf8').split('\n').map((l) => JSON.parse(l)), B = fs.readFileSync(f.replace('.jsonl', '-r19b.jsonl'), 'utf8').split('\n').map((l) => JSON.parse(l))
  A.forEach((x, i) => {
    const y = B[i]
    if (JSON.stringify([x.n, x.rows, x.mapping]) === JSON.stringify([y.n, y.rows, y.mapping])) return
    tot++
    // Excel の CSV: 同じ行に「コンマを含む囲み」と「改行を含む囲み」の両方がある
    const lines = x.text.replace(/\r/g, '').split('\n')
    const bad = (x.rows ?? []).some((r) => /(^|\u0001)"[^"\u0001]*($|\u0001)/.test(r) && !/"$/.test(r.split('\u0001')[0]))
    const strayHead = (x.rows ?? []).some((r) => r.split('\u0001').some((c) => /^"[^"]*$/.test(c) || /^[^"]*"$/.test(c) && /（改行つき）|注意/.test(c)))
    if (strayHead) cls++; else other.push({ f, i, text: x.text.slice(0, 400), n: [x.n, y.n] })
  })
}
console.log('diff cases', tot, 'broken-multiline class', cls, 'other', other.length)
for (const o of other.slice(0, 5)) console.log(JSON.stringify(o).slice(0, 700))
