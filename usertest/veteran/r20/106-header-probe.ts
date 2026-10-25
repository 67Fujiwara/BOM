// ラウンド16: 106-shapes の形を、現行（/home/user/BOM/src）と r15 ビルド（SRC=scratchpad の b836657）の parseBomPaste で直接。
const SRC = process.env.SRC ?? '/home/user/BOM/src'
const { parseBomPaste } = await import(SRC + '/io/paste.ts')
import fs from 'node:fs'
import { SHAPES } from './106-shapes.mjs'
const out: unknown[] = []
for (const s of SHAPES) {
  const tsv = s.rows.map((r) => r.map(String).join('\t')).join('\n')
  const r = parseBomPaste(tsv)
  const rec = { id: s.id, note: s.note, expect: s.expect, n: r.rows.length, mapping: r.mapping.join(','), header: r.header?.join('|'), warnings: r.warnings, rows: r.rows.map((x) => [x.name, x.model, x.maker, x.qtyNeeded, x.unit, x.drawing ?? '', x.ref ?? ''].join(' / ')) }
  out.push(rec)
  console.log(`\n## ${s.id} — ${s.note}\n期待: ${s.expect}\n件数 ${rec.n}  対応 ${rec.mapping}\n見出し ${rec.header}\n知らせ ${rec.warnings.join(' ／ ')}\n${rec.rows.map((x) => '  ' + x).join('\n')}`)
}
fs.writeFileSync('/home/user/BOM/usertest/veteran/r20/106-header-probe' + (process.env.TAG ?? '') + '.json', JSON.stringify(out, null, 2))
