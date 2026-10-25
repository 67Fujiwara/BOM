import fs from 'node:fs'
const T = (s) => s.trim().split('\n').map((l) => l.trim().split('｜').join('\t')).join('\n')
const cases = []
const note = (w) => T(`品名｜型式｜メーカー｜数量｜備考\nリレー｜MY4N-D2｜オムロン｜4｜\nタイマ｜H3CR-A8｜オムロン｜1｜${w}`)
for (const w of ['未実装品', '未実装部品', '未実装です', '未実装（将来用）', '未実装 将来用', '実装しないこと', '実装しない', '実装不可', '実装なし', '非実装品', 'DNP品', 'DNP（将来用）', 'DNP 将来用', 'DNP可', 'Do Not Populate', 'NC', '実装省略', '実装除外', '搭載しない', '搭載なし', '付けない', '不実装', '空き', '未使用', '実装時は短絡', '実装位置注意', '未実装基板用']) cases.push([`W-note 「${w}」`, note(w), /^(未実装品|未実装部品|未実装です|未実装（将来用）|未実装 将来用|実装しないこと|実装しない|実装不可|実装なし|非実装品|DNP品|DNP（将来用）|DNP 将来用|DNP可|Do Not Populate|不実装|実装省略|実装除外|搭載しない|搭載なし)$/.test(w) ? ['MY4N-D2:4'] : ['MY4N-D2:4', 'H3CR-A8:1']])
fs.writeFileSync('cases/p20e.json', JSON.stringify(cases, null, 1)); console.log(cases.length)
