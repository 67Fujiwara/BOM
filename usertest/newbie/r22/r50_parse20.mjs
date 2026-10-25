// ラウンド20: 取り込みの解析（parseBomPaste）を、ラウンド19 の測定ビルド 688ceb6（旧）と今の src（新）に同じ入力で流し、
// 期待（cases の 3 つ目）と比べる。src は読むだけ。使い方: node r50_parse20.mjs cases/p20.json [OUTNAME]
// 各ケース: [title, text, expect?]  expect は "ラベル:数量" の配列（ラベル = 型式 || 部品名。備考に【削除？】があれば末尾に ?）
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
const ROOT = '/home/user/BOM'
const OUT = path.join(ROOT, 'usertest/newbie/r22/results')
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'r20-parse-'))
fs.mkdirSync(path.join(tmp, 'old'))
execSync(`git -C ${ROOT} archive ${process.env.OLD || "56e5aba"} src | tar -x -C ${tmp}/old`)
fs.symlinkSync(path.join(ROOT, 'node_modules'), path.join(tmp, 'node_modules'))
for (const [v, src] of [['old', `${tmp}/old/src`], ['new', `${ROOT}/src`]]) execSync(`${ROOT}/node_modules/.bin/esbuild ${src}/io/paste.ts --bundle --format=esm --platform=node --alias:@=${src} --external:exceljs --outfile=${tmp}/paste_${v}.mjs --log-level=error`)
const mods = { old: await import(`${tmp}/paste_old.mjs`), new: await import(`${tmp}/paste_new.mjs`) }
const file = process.argv[2]
const lines = []
const log = (s) => { lines.push(s); console.log(s) }
const lab = (r) => `${r.model || r.name || ''}:${r.qtyNeeded}${String(r.note ?? '').startsWith('【削除？】') ? '?' : ''}`
let mism = 0
for (const [t, txt, exp] of JSON.parse(fs.readFileSync(file, 'utf8'))) {
  const res = {}
  for (const v of ['old', 'new']) res[v] = mods[v].parseBomPaste(txt)
  const act = res.new.rows.map(lab)
  const old = res.old.rows.map(lab)
  const ok = exp ? JSON.stringify(act) === JSON.stringify(exp) : null
  if (ok === false) mism++
  log(`[${t}] ${ok === null ? 'INFO' : ok ? 'OK' : 'MISMATCH'}${JSON.stringify(old) !== JSON.stringify(act) ? ' (old≠new)' : ''}`)
  log(`   new: ${act.join(' ')} | map=${res.new.mapping.map((m) => m ?? '-').join(',')}`)
  if (ok === false) log(`   exp: ${exp.join(' ')}`)
  if (JSON.stringify(old) !== JSON.stringify(act)) log(`   old: ${old.join(' ')}`)
  log(`   warn: ${res.new.warnings.join(' / ').slice(0, 500)}`)
}
log(`MISMATCHES ${mism}`)
fs.writeFileSync(path.join(OUT, (process.argv[3] || 'r50_parse20') + '.out'), lines.join('\n') + '\n')
fs.rmSync(tmp, { recursive: true, force: true })
