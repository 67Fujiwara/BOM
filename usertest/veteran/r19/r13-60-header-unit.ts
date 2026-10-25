// ラウンド13: 作り直した見出しの判断（parseBomPaste）を、実際の BOM にありそうな「意地の悪い」形で直接呼んで確かめる。
// vite-node で src/io/paste.ts をそのまま使う（ブラウザの確認は 61-header-wizard.mjs）
const SRC = process.env.SRC ?? '/home/user/BOM/src'
const { parseBomPaste } = await import(SRC + '/io/paste.ts')
import fs from 'node:fs'
import { SHAPES } from './r13-60-shapes.mjs'
const out: unknown[] = []
for (const s of SHAPES) {
  const tsv = s.rows.map((r) => r.map(String).join('\t')).join('\n')
  const r = parseBomPaste(tsv)
  const rec = { id: s.id, note: s.note, expect: s.expect, n: r.rows.length, mapping: r.mapping.join(','), header: r.header?.join('|'), warnings: r.warnings, rows: r.rows.map((x) => [x.name, x.model, x.maker, x.qtyNeeded].join(' / ')) }
  out.push(rec)
  console.log(`\n## ${s.id} — ${s.note}\n期待: ${s.expect}\n件数 ${rec.n}  対応 ${rec.mapping}\n見出し ${rec.header}\n知らせ ${rec.warnings.join(' ／ ')}\n${rec.rows.map((x) => '  ' + x).join('\n')}`)
}
fs.writeFileSync('/home/user/BOM/usertest/veteran/r19/60-header-unit' + (process.env.TAG ?? '') + '.json', JSON.stringify(out, null, 2))
