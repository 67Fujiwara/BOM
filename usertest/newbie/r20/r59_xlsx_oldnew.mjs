// ラウンド20: r15〜r19 の xlsx（files*/ すべて）を、5bb9df8（ラウンド19 の測定ビルド）と今の src の xlsxToTsv + parseBomPaste に流し、行・警告の違うものを出す
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
const ROOT = '/home/user/BOM'
const D = path.join(ROOT, 'usertest/newbie/r20')
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'r20-xl-'))
fs.mkdirSync(path.join(tmp, 'old'))
execSync(`git -C ${ROOT} archive 5bb9df8 src | tar -x -C ${tmp}/old`)
fs.symlinkSync(path.join(ROOT, 'node_modules'), path.join(tmp, 'node_modules'))
for (const [v, src] of [['old', `${tmp}/old/src`], ['new', `${ROOT}/src`]]) execSync(`${ROOT}/node_modules/.bin/esbuild ${src}/io/paste.ts --bundle --format=esm --platform=node --alias:@=${src} --external:exceljs --outfile=${tmp}/paste_${v}.mjs --log-level=error`)
const mods = { old: await import(`${tmp}/paste_old.mjs`), new: await import(`${tmp}/paste_new.mjs`) }
const lab = (r) => `${r.category ?? ''}|${r.ref ?? ''}|${r.name ?? ''}|${r.model ?? ''}|${r.maker ?? ''}|${r.qtyNeeded}|${r.unit}|${(r.note ?? '').slice(0, 20)}`
const out = []
let n = 0, diffs = 0
for (const dir of fs.readdirSync(D).filter((x) => /^files/.test(x) && x !== 'files20')) for (const f of fs.readdirSync(path.join(D, dir)).filter((x) => x.endsWith('.xlsx')).sort()) {
  n++
  const buf = fs.readFileSync(path.join(D, dir, f)); const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
  const res = {}
  try { for (const v of ['old', 'new']) { const tsv = await mods[v].xlsxToTsv(ab); res[v] = mods[v].parseBomPaste(tsv) } } catch (e) { out.push(`[${dir}/${f}] EXC ${String(e).slice(0, 100)}`); continue }
  const a = res.old.rows.map(lab).join(' ; '), b = res.new.rows.map(lab).join(' ; ')
  if (a !== b) { diffs++; out.push(`[${dir}/${f}] ROWS DIFFER\n  old: ${a.slice(0, 600)}\n  new: ${b.slice(0, 600)}\n  warn(new): ${res.new.warnings.join(' / ').slice(0, 300)}`) }
}
out.push(`files ${n}, row-differences ${diffs}`)
fs.writeFileSync(path.join(D, 'results/r59_xlsx_oldnew.out'), out.join('\n') + '\n'); console.log(out.slice(-1)[0])
fs.rmSync(tmp, { recursive: true, force: true })
