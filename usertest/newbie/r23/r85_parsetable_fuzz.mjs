// ラウンド21: Excel が書くとおりの CSV／TSV（コンマ・引用符・改行入りセル、タブ入りセル）を乱数で作り、parseTable で読み戻して一致するかを
// 旧（688ceb6）と新（今の src）で比べる。使い方: node r85_parsetable_fuzz.mjs [件数] [seed]
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
const ROOT = '/home/user/BOM'
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'r21-fuzz-'))
fs.mkdirSync(path.join(tmp, 'old'))
execSync(`git -C ${ROOT} archive ${process.env.OLD || "56e5aba"} src | tar -x -C ${tmp}/old`)
fs.symlinkSync(path.join(ROOT, 'node_modules'), path.join(tmp, 'node_modules'))
for (const [v, src] of [['old', `${tmp}/old/src`], ['new', `${ROOT}/src`]]) execSync(`${ROOT}/node_modules/.bin/esbuild ${src}/io/paste.ts --bundle --format=esm --platform=node --alias:@=${src} --external:exceljs --outfile=${tmp}/paste_${v}.mjs --log-level=error`)
const mods = { old: await import(`${tmp}/paste_old.mjs`), new: await import(`${tmp}/paste_new.mjs`) }
const N = Number(process.argv[2] ?? 3000)
let seed = Number(process.argv[3] ?? 21)
const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296 }
const pick = (a) => a[Math.floor(rnd() * a.length)]
const POOL0 = ['リレー', 'MY4N-D2', 'オムロン', '4', '', '', '', 'Omron, Inc.', '盤内上段', '1/2" SUS', '3/4" x 2', 'a, b', 'line1\nline2', 'a, b\nc, d, e', '"quoted"', 'x,y,z,w', '〃', '"', 'ボルト M4×10', '客先支給, 要確認', '1,200', 'UL1007 AWG22 (赤/黒)', 'a\tb', '10k, 1%', 'foo\n\nbar', ' lead', 'trail ', 'n1\nn2\nn3\nn4\nn5\nn6\nn7', '注1, 項目\n注2, 項目\n注3, 項目\n注4, 項目\n注5, 項目\n注6, 項目']
// 現実的な表: ふつうの語・コンマ入り・複数行（2〜4 行、コンマ有無）だけ。タブ入り・孤立した引用符・インチ記号は除く（別に測る）
const REAL = process.env.REAL === '1'
const POOL = REAL ? ['リレー', 'MY4N-D2', 'オムロン', '4', '', '', '盤内上段', 'Omron, Inc.', 'a, b', 'line1\nline2', 'a, b\nc, d', '客先支給, 要確認', '1,200', 'UL1007 AWG22 (赤/黒)', '10k, 1%', 'n1\nn2\nn3', '注1\n注2\n注3\n注4', 'x\ny, z'] : POOL0
const ser = (rows, delim) => rows.map((r) => r.map((c) => (/[",\n]/.test(c) || (delim === '\t' && /[\t]/.test(c)) ? '"' + c.replace(/"/g, '""') + '"' : c)).join(delim)).join('\r\n') + '\r\n'
const stats = { old: { csv: 0, tsv: 0 }, new: { csv: 0, tsv: 0 } }
const fails = { old: [], new: [] }
let both = 0, onlyNew = [], onlyOld = 0
for (let t = 0; t < N; t++) {
  const w = 3 + Math.floor(rnd() * 5), h = 3 + Math.floor(rnd() * 12)
  const rows = Array.from({ length: h }, (_, i) => Array.from({ length: w }, (_, j) => (i === 0 ? pick(['品名', '型式', 'メーカー', '数量', '備考', '単位', '分類']) : pick(POOL))))
  for (const [kind, delim] of [['csv', ','], ['tsv', '\t']]) {
    const text = ser(rows, delim)
    const ok = {}
    for (const v of ['old', 'new']) {
      let got
      try { got = mods[v].parseTable(text, delim) } catch { got = null }
      const norm = (g) => g?.filter((r) => r.some((c) => c !== '')).map((r) => r.map((c) => c.replace(/\r/g, '')).join('\u0001'))
      const exp = norm(rows.map((r) => r.map((c) => c.replace(/\n/g, ' '))))
      const a = got ? norm(got) : null
      // 末尾の空セルは削られることがあるので、行内の末尾の空を落として比べる
      const trim = (l) => l?.map((s) => s.replace(/(\u0001)+$/, ''))
      ok[v] = JSON.stringify(trim(a)) === JSON.stringify(trim(exp))
      if (!ok[v]) { stats[v][kind]++; if (fails[v].length < 6) fails[v].push({ kind, text: text.slice(0, 600) }) }
    }
    if (ok.old && !ok.new && onlyNew.length < 8) onlyNew.push({ kind, text })
    if (!ok.old && ok.new) onlyOld++
  }
}
console.log(JSON.stringify({ N, stats, onlyOldFailsCount: onlyOld, onlyNewFails: onlyNew.length }))
fs.writeFileSync(path.join(ROOT, 'usertest/newbie/r23/results/r85_parsetable_fuzz.json'), JSON.stringify({ N, stats, onlyOld, onlyNew: onlyNew.slice(0, 5).map((x) => ({ kind: x.kind, text: x.text.slice(0, 800) })), failsNew: fails.new.slice(0, 5) }, null, 1))
fs.rmSync(tmp, { recursive: true, force: true })
