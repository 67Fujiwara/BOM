// 96-header-wizard の結果を 1 行ずつ（作成した行・プレビューの注意）
import fs from 'node:fs'
const a = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))
for (const x of a) console.log(x.id, '|', x.created ? x.created.rows + '行 ' + x.created.sample.join(' ‖ ') : '(作成なし)', '|', (x.preview.match(/⚠[^⚠]{0,160}/g) ?? []).join(' '), x.errs.length ? 'ERR ' + x.errs.join(';') : '')
