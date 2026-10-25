// ラウンド15: 取り込みの解析（parseBomPaste / xlsxToTsv）を、ラウンド16 の測定ビルド bd8881e と今のビルド（作業ツリーの src）で同じ入力に流して比べる。
// 使い方: node r00_oldnew.mjs cases/c1.json [files15/*.xlsx ...]。src は読むだけ（bd8881e の src は一時ディレクトリへ git archive）
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
const ROOT = '/home/user/BOM'
const OUT = path.join(ROOT, 'usertest/newbie/r20/results')
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'r20-oldnew-'))
fs.mkdirSync(path.join(tmp, 'old'))
execSync(`git -C ${ROOT} archive 5bb9df8 src | tar -x -C ${tmp}/old`)
fs.symlinkSync(path.join(ROOT, 'node_modules'), path.join(tmp, 'node_modules'))
for (const [v, src] of [['old', `${tmp}/old/src`], ['new', `${ROOT}/src`]]) execSync(`${ROOT}/node_modules/.bin/esbuild ${src}/io/paste.ts --bundle --format=esm --platform=node --alias:@=${src} --external:exceljs --outfile=${tmp}/paste_${v}.mjs --log-level=error`)
const args = process.argv.slice(2)
const lines = []
const log = (s) => { lines.push(s); console.log(s) }
const fmt = (r) => `map=${JSON.stringify(r.mapping)}\n    rows=${r.rows.map((x) => `{${x.category ?? ''}|${x.ref ?? ''}|${x.name ?? ''}|${x.model ?? ''}|${x.maker ?? ''}|${x.qtyNeeded}}`).join(' ')}\n    warn=${r.warnings.join(' / ').slice(0, 400)}`
const mods = { old: await import(`${tmp}/paste_old.mjs`), new: await import(`${tmp}/paste_new.mjs`) }
for (const a of args) {
  if (a.endsWith('.json')) {
    for (const [t, txt] of JSON.parse(fs.readFileSync(a, 'utf8'))) {
      log(`[${t}]`)
      for (const v of ['old', 'new']) log(`  ${v}: ${fmt(mods[v].parseBomPaste(txt))}`)
    }
  } else {
    const buf = fs.readFileSync(a)
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
    log(`[${path.basename(a)}]`)
    for (const v of ['old', 'new']) { const tsv = await mods[v].xlsxToTsv(ab); log(`  ${v}: tsv=${JSON.stringify(tsv).slice(0, 300)}\n    ${fmt(mods[v].parseBomPaste(tsv))}`) }
  }
}
const name = process.env.OUTNAME || 'r00_oldnew'
fs.writeFileSync(path.join(OUT, name + '.out'), lines.join('\n') + '\n')
fs.rmSync(tmp, { recursive: true, force: true })
