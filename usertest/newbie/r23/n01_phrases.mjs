// ラウンド23 n01: 削除の注記（括弧の中・文・全て/全部/すべて/この部品は/から の形）を 250 通り。意味 K=残す／D=削除／A=聞くのが適切
// 備考の列（note）と、新の型式の列（new）の両方で、旧 68e45f7 と新（HEAD）を比べる
import fs from 'node:fs'
import { loadParsers, T, lab } from './parselib.mjs'
const { old, neu } = await loadParsers(process.env.OLD || '68e45f7')
const noteSheet = (n) => T(`品名｜型式（旧）｜型式（新）｜メーカー｜数量｜備考
リレー｜MY2N｜MY4N-D2｜オムロン｜4｜
部品1｜P-10｜｜オムロン｜1｜${n}
端子台｜XW2B-20G4｜｜オムロン｜4｜`)
const newSheet = (n) => T(`品名｜型式（旧）｜型式（新）｜メーカー｜数量｜備考
リレー｜MY2N｜MY4N-D2｜オムロン｜4｜
部品1｜P-10｜${n}｜オムロン｜1｜
端子台｜XW2B-20G4｜｜オムロン｜4｜`)
const kindN = (res) => { const l = res.rows.map(lab); return l.includes('P-10:1?') ? 'ASK' : l.includes('P-10:1') ? 'KEEP' : l.some((x) => x.startsWith('P-10')) ? 'KEEP' : l.some((x) => /^\D*:1$/.test(x) && !/MY4N|XW2B/.test(x)) ? 'TEXT' : 'DEL' }
const kindW = (res) => { const l = res.rows.map((r) => `${r.model}|${r.note}`); const p = res.rows.find((r) => r.name === '部品1' || r.model === 'P-10' || (r.note ?? '').includes('【削除？】') || r.model !== 'MY4N-D2' && r.model !== 'XW2B-20G4'); if (!p) return 'DEL'; if (String(p.note ?? '').startsWith('【削除？】')) return 'ASK'; if (p.model === 'P-10') return 'KEEP'; return 'TEXT:' + p.model }
import { P } from './phrases.mjs'
console.log('phrases', P.length)
const out = []
const bad = { 'note K→DEL': [], 'note D→KEEP': [], 'note A→DEL': [], 'note A→KEEP': [], 'new K→DEL': [], 'new D→KEEP': [], 'new D→TEXT': [], 'new K→TEXT': [], 'new A→DEL': [], 'new A→TEXT': [] }
const cnt = { note: {}, new: {} }
for (const p of P) {
  const nn = kindW(neu.parseBomPaste(noteSheet(p.s))), no = kindW(old.parseBomPaste(noteSheet(p.s)))
  const wn = kindW(neu.parseBomPaste(newSheet(p.s))), wo = kindW(old.parseBomPaste(newSheet(p.s)))
  out.push(`${p.m} [${p.grp}] ${p.s} | note old=${no} new=${nn} | newcol old=${wo} new=${wn}`)
  const kn = nn.startsWith('TEXT') ? 'TEXT' : nn, kw = wn.startsWith('TEXT') ? 'TEXT' : wn
  cnt.note[`${p.m}>${kn}`] = (cnt.note[`${p.m}>${kn}`] ?? 0) + 1
  cnt.new[`${p.m}>${kw}`] = (cnt.new[`${p.m}>${kw}`] ?? 0) + 1
  const tag = (kind, k, tgt) => { const key = `${kind} ${p.m}→${k}`; if (key in bad) bad[key].push(`${p.s}(old=${tgt})`) }
  tag('note', kn, no); tag('new', kw, wo)
}
const byGrp = {}
for (const line of out) { const g = /\[([^\]]+)\]/.exec(line)[1]; const m = line[0]; const nw = /note old=\w+ new=(\w+)/.exec(line)[1]; (byGrp[g] ??= {}); const k = m + '>' + nw.replace(/TEXT.*/, 'TEXT'); byGrp[g][k] = (byGrp[g][k] ?? 0) + 1 }
console.log(JSON.stringify(byGrp))
console.log(JSON.stringify(cnt))
for (const [k, v] of Object.entries(bad)) console.log(k, v.length, v.slice(0, 80).join(' / '))
fs.writeFileSync('results/n01_phrases.out', out.join('\n') + '\n\nCOUNTS ' + JSON.stringify(cnt) + '\nBAD\n' + Object.entries(bad).map(([k, v]) => `${k} (${v.length}): ${v.join(' / ')}`).join('\n') + '\n')
