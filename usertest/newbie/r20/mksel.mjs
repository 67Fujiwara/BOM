import fs from 'node:fs'
const all = [...JSON.parse(fs.readFileSync('cases/p20.json', 'utf8')), ...JSON.parse(fs.readFileSync('cases/p20b.json', 'utf8'))]
const want = ['G4 ', 'G5 ', 'G8 ', 'G15 ', 'A-keep 「削除（しない）」', 'A-keep 「削除（保留）」', 'A-keep 「撤去（再取付）」', 'A-keep 「取外し（再利用）」', 'A-del2 「削除です」', 'A-del2 「削除お願いします」', 'A-del2 「削除完了」', 'A-del2 「Rev.B:削除」', 'B-kind 変更区分 値「削除済」', 'B-kind 変更区分 値「×」', 'B-kind 変更区分 値「削除する」', 'B-kind 変更区分 値「不要」', 'B-kind ditto under 削除', 'B-kind hdr「変更の種類」', 'H13 ', 'R13 ', 'R14 ', 'E6 ', 'E14 ', 'F3 ', 'F4 ', 'F6 ', 'F11 ', 'P1 ', 'Q9 ', 'D17 ', 'D10 ', 'D19 ', 'C2 ', 'C4 ', 'C6 ', 'H9 ', 'A-keep ordinary notes']
const sel = all.filter(([t]) => want.some((w) => t.startsWith(w))).map(([t, x]) => [t, x])
fs.writeFileSync('cases/p20sel.json', JSON.stringify(sel, null, 1)); console.log(sel.length, want.length)
