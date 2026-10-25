// 手順の記録（json）を読みやすく。node showseq17.mjs file.json [幅]
import fs from 'node:fs'
const w = Number(process.argv[3] ?? 400)
for (const o of JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))) { console.log('\n##', o.name); for (const s of o.seq ?? []) console.log('  ', s.slice(0, w)); if (o.errs) console.log('  errs', JSON.stringify(o.errs)) }
