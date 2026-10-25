// ラウンド21: r85 と同じ乱数表のうち、新の parseTable が読み戻せない Excel 形式の CSV を、行・列を減らして最小の形にする（旧が読めて新が読めないものを優先）
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
const ROOT = '/home/user/BOM'
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'r21-min-'))
fs.mkdirSync(path.join(tmp, 'old'))
execSync(`git -C ${ROOT} archive ${process.env.OLD || "56e5aba"} src | tar -x -C ${tmp}/old`)
fs.symlinkSync(path.join(ROOT, 'node_modules'), path.join(tmp, 'node_modules'))
for (const [v, src] of [['old', `${tmp}/old/src`], ['new', `${ROOT}/src`]]) execSync(`${ROOT}/node_modules/.bin/esbuild ${src}/io/paste.ts --bundle --format=esm --platform=node --alias:@=${src} --external:exceljs --outfile=${tmp}/paste_${v}.mjs --log-level=error`)
const mods = { old: await import(`${tmp}/paste_old.mjs`), new: await import(`${tmp}/paste_new.mjs`) }
let seed = Number(process.argv[2] ?? 7)
const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296 }
const pick = (a) => a[Math.floor(rnd() * a.length)]
const POOL = ['リレー', 'MY4N-D2', 'オムロン', '4', '', '', '盤内上段', 'Omron, Inc.', 'a, b', 'line1\nline2', 'a, b\nc, d', '客先支給, 要確認', '1,200', 'UL1007 AWG22 (赤/黒)', '10k, 1%', 'n1\nn2\nn3', '注1\n注2\n注3\n注4', 'x\ny, z']
const ser = (rows, delim = ',') => rows.map((r) => r.map((c) => (/[",\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c)).join(delim)).join('\r\n') + '\r\n'
const norm = (g) => g?.filter((r) => r.some((c) => c !== '')).map((r) => r.join('\u0001').replace(/(\u0001)+$/, ''))
const good = (v, rows) => { let got; try { got = mods[v].parseTable(ser(rows), ',') } catch { return false }; return JSON.stringify(norm(got)) === JSON.stringify(norm(rows.map((r) => r.map((c) => c.replace(/\n/g, ' '))))) }
const minimize = (rows, bad) => {
  let changed = true
  while (changed) {
    changed = false
    for (let i = rows.length - 1; i >= 1; i--) { const t = rows.filter((_, k) => k !== i); if (bad(t)) { rows = t; changed = true } }
    for (let j = rows[0].length - 1; j >= 0 && rows[0].length > 2; j--) { const t = rows.map((r) => r.filter((_, k) => k !== j)); if (bad(t)) { rows = t; changed = true } }
  }
  return rows
}
const res = { onlyNew: [], bothFail: [] }
for (let t = 0; t < 4000 && (res.onlyNew.length < 3 || res.bothFail.length < 6); t++) {
  const w = 3 + Math.floor(rnd() * 5), h = 3 + Math.floor(rnd() * 12)
  const rows = Array.from({ length: h }, (_, i) => Array.from({ length: w }, (_, j) => (i === 0 ? pick(['品名', '型式', 'メーカー', '数量', '備考', '単位', '分類']) : pick(POOL))))
  const o = good('old', rows), n = good('new', rows)
  if (o && !n && res.onlyNew.length < 3) res.onlyNew.push(minimize(rows, (r) => good('old', r) && !good('new', r)))
  else if (!n && res.bothFail.length < 6) res.bothFail.push(minimize(rows, (r) => !good('new', r)))
}
const show = (rows) => JSON.stringify(ser(rows))
console.log('--- 新だけ失敗（旧は読めた）'); res.onlyNew.forEach((r) => console.log(show(r), '\n  new→', JSON.stringify(mods.new.parseTable(ser(r), ','))))
console.log('--- 新も失敗（最小形）'); res.bothFail.forEach((r) => console.log(show(r), '\n  new→', JSON.stringify(mods.new.parseTable(ser(r), ',')), '\n  old→', JSON.stringify(mods.old.parseTable(ser(r), ','))))
fs.rmSync(tmp, { recursive: true, force: true })
