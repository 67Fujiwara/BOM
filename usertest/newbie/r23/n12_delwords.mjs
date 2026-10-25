// ラウンド23 n12: 削除の書き方いろいろ（備考／変更区分／新の型式）。旧 68e45f7 と新。黙って残る（KEEP）ものを洗い出す
import fs from 'node:fs'
import { loadParsers, T, lab } from './parselib.mjs'
const { old, neu } = await loadParsers(process.env.OLD || '68e45f7')
const words = ['削除', '削除。', '削除!', '削除！', '削除です', '削除ね', '削除で', '削除OK', '削除ok', '削除してください', '削除してOK', '削除で良い', '削除で良いです', '削除で。', 'さくじょ', 'ｻｸｼﾞｮ', '削　除', '削 除', '【削除】', '[削除]', '(削除)', '（削除）', '※削除', '＊削除', '・削除', '-削除', '→削除', '⇒削除', '削除→', '削除↓', '削除 ×', '×削除', '×', '✕', '✖', 'x', 'X', 'ｘ', 'D', 'd', 'DEL', 'Del', 'del', 'DEL.', 'Delete', 'DELETE', 'deleted', 'Remove', 'REMOVE', 'removed', 'Cut', 'CUT', 'N/A', 'NA', '-', '－', '—', 'なし', '無し', '無', '廃', '廃止', '廃止。', '廃止です', '廃止済', '廃番', '取外し', '取外', '取り外し', '取り外す', '取外す', '外す', '外し', '外します', 'はずす', '省く', '省略', '除去', '除外', '排除', '抹消', '消す', '消去', '消し', '落とす', 'カット', 'なくす', '無くす', 'なくなる', '使用しない', '使わない', '使わず', '不使用', '不要', '不要です', '要らない', 'いらない', 'いらん', '要らず', '無用', '撤去', '撤去済', '撤去します', '撤去のこと', '撤去する', '撤廃', '取止め', '取り止め', '取消', '取り消し', '中止', '中止です', '欠品', '欠番', '落ち', '落選', '没', 'ボツ', 'NG', 'ng', 'ＮＧ', '不採用', '不採用です', '採用せず', '採用しない', '使用中止', '入れない', '付けない', '付かない', '載せない', '載らない', '実装しない', '不実装']
const note = (n) => T(`品名｜型式（旧）｜型式（新）｜メーカー｜数量｜備考\nリレー｜MY2N｜MY4N-D2｜オムロン｜4｜\n部品1｜P-10｜｜オムロン｜1｜${n}\n端子台｜XW2B-20G4｜｜オムロン｜4｜`)
const kind = (n) => T(`変更区分｜品名｜型式（旧）｜型式（新）｜数量\n変更｜リレー｜MY2N｜MY4N-D2｜4\n${n}｜部品1｜P-10｜｜1\n追加｜端子台｜｜XW2B-20G4｜4`)
const newc = (n) => T(`品名｜型式（旧）｜型式（新）｜メーカー｜数量\nリレー｜MY2N｜MY4N-D2｜オムロン｜4\n部品1｜P-10｜${n}｜オムロン｜1\n端子台｜XW2B-20G4｜｜オムロン｜4`)
const cls = (res, k) => { const l = res.rows.map(lab); if (l.includes('P-10:1?')) return 'ASK'; if (k === 'kind') return l.some((x) => x.startsWith('P-10')) || l.some((x) => x.startsWith('部品1')) ? 'KEEP' : 'DEL'; const p = res.rows.find((r) => r.name === '部品1' || r.model === 'P-10'); if (!p) return 'DEL'; if (p.model === 'P-10') return 'KEEP'; return p.model === 'MY4N-D2' || p.model === 'XW2B-20G4' ? '?' : 'TEXT' }
const out = []
const keep = { note: [], kind: [], newc: [] }
for (const w of words) {
  const r = { note: cls(neu.parseBomPaste(note(w)), 'note'), kind: cls(neu.parseBomPaste(kind(w)), 'kind'), newc: cls(neu.parseBomPaste(newc(w)), 'newc') }
  const o = { note: cls(old.parseBomPaste(note(w)), 'note'), kind: cls(old.parseBomPaste(kind(w)), 'kind'), newc: cls(old.parseBomPaste(newc(w)), 'newc') }
  out.push(`「${w}」 note ${o.note}→${r.note} / kind ${o.kind}→${r.kind} / new ${o.newc}→${r.newc}`)
  for (const k of ['note', 'kind', 'newc']) if (r[k] === 'KEEP' || r[k] === 'TEXT') keep[k].push(w)
}
fs.writeFileSync('results/n12_delwords.out', out.join('\n') + '\n\nKEEP/TEXT\n' + JSON.stringify(keep) + '\n')
for (const [k, v] of Object.entries(keep)) console.log(k, v.length, v.join(' '))
