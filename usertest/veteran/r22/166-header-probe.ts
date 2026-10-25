// ラウンド18: 166-shapes の形（SHAPES はタブ区切りにして、TEXTS は文字のまま）を、現行と r18 ビルド（SRC=scratchpad の 783edde）の parseBomPaste で直接。
const SRC = process.env.SRC ?? '/home/user/BOM/src'
const { parseBomPaste } = await import(SRC + '/io/paste.ts')
import fs from 'node:fs'
import { SHAPES, TEXTS } from './166-shapes.mjs'
const out: unknown[] = []
const all = [...SHAPES.map((s) => ({ ...s, text: s.rows.map((r) => r.map(String).join('\t')).join('\n') })), ...TEXTS]
for (const s of all) {
  const t0 = performance.now()
  const r = parseBomPaste(s.text)
  const rec = { id: s.id, note: s.note, expect: s.expect, ms: Math.round(performance.now() - t0), n: r.rows.length, mapping: r.mapping.join(','), header: r.header?.join('|'), warnings: r.warnings, rows: r.rows.map((x) => [x.name, x.model, x.maker, x.qtyNeeded, x.unit, x.drawing ?? '', x.ref ?? '', x.note ?? ''].join(' / ')) }
  out.push(rec)
  console.log(`\n## ${s.id} — ${s.note}\n期待: ${s.expect}\n件数 ${rec.n}  対応 ${rec.mapping}\n見出し ${rec.header}\n知らせ ${rec.warnings.join(' ／ ')}\n${rec.rows.map((x) => '  ' + x).join('\n')}`)
}
fs.writeFileSync('/home/user/BOM/usertest/veteran/r22/166-header-probe' + (process.env.TAG ?? '') + '.json', JSON.stringify(out, null, 2))
