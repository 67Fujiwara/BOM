// ラウンド23 n07: 変更区分の列／新の数量・新のメーカの列に、削除（…）の言い方（n01 と同じ 600 通り）。残すつもり（K）の行が消える／削除のつもり（D）の行が残るもの
import fs from 'node:fs'
import { loadParsers, T, lab } from './parselib.mjs'
import { P } from './phrases.mjs'
const { old, neu } = await loadParsers(process.env.OLD || '68e45f7')
const kindSheet = (v) => T(`変更区分｜品名｜型式（旧）｜型式（新）｜数量
変更｜リレー｜MY2N｜MY4N-D2｜4
${v}｜部品1｜P-10｜P-10｜1
追加｜端子台｜｜XW2B-20G4｜4`)
const kindSheet2 = (v) => T(`変更区分｜品名｜型式｜数量
変更｜リレー｜MY4N-D2｜4
${v}｜部品1｜P-10｜1
追加｜端子台｜XW2B-20G4｜4`)
const qtySheet = (v) => T(`品名｜型式｜数量（旧）｜数量（新）
リレー｜MY4N-D2｜4｜6
部品1｜P-10｜1｜${v}
端子台｜XW2B-20G4｜4｜4`)
const makerSheet = (v) => T(`品名｜型式｜メーカー（旧）｜メーカー（新）｜数量
リレー｜MY4N-D2｜オムロン｜IDEC｜4
部品1｜P-10｜オムロン｜${v}｜1
端子台｜XW2B-20G4｜オムロン｜オムロン｜4`)
const has = (res) => res.rows.some((r) => r.model === 'P-10' || r.name === '部品1')
const out = []
const bad = {}
const tag = (k, s) => (bad[k] ??= []).push(s)
for (const p of P) {
  const r = {
    kind: has(neu.parseBomPaste(kindSheet(p.s))), kind2: has(neu.parseBomPaste(kindSheet2(p.s))),
    qty: has(neu.parseBomPaste(qtySheet(p.s))), maker: has(neu.parseBomPaste(makerSheet(p.s))),
  }
  const o = { kind: has(old.parseBomPaste(kindSheet(p.s))), qty: has(old.parseBomPaste(qtySheet(p.s))), maker: has(old.parseBomPaste(makerSheet(p.s))) }
  out.push(`${p.m} [${p.grp}] ${p.s} | 区分列: 残=${r.kind}(old ${o.kind}) / 区分(型式のみ): ${r.kind2} / 新数量: ${r.qty}(old ${o.qty}) / 新メーカ: ${r.maker}(old ${o.maker})`)
  for (const c of ['kind', 'kind2', 'qty', 'maker']) {
    if (p.m === 'K' && !r[c]) tag(`${c}: K→行が消えた`, p.s + (o[c] === false ? '' : '(old=残)'))
    if (p.m === 'D' && r[c]) tag(`${c}: D→行が残った`, p.s)
  }
}
fs.writeFileSync('results/n07_kindvals.out', out.join('\n') + '\n\nBAD\n' + Object.entries(bad).map(([k, v]) => `${k} (${v.length}): ${v.join(' / ')}`).join('\n') + '\n')
for (const [k, v] of Object.entries(bad)) console.log(k, v.length, v.slice(0, 40).join(' / '))
