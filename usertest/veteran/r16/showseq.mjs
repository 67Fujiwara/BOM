// ログ（1 行 1 JSON）か結果の JSON から、シナリオ名・期待・手順を見やすく
import fs from 'node:fs'
const f = process.argv[2]; const w = Number(process.argv[3] ?? 300)
let a
try { a = JSON.parse(fs.readFileSync(f, 'utf8')) } catch { a = fs.readFileSync(f, 'utf8').split('\n').filter((l) => l.startsWith('{')).map((l) => { try { return JSON.parse(l) } catch { return { raw: l.slice(0, w) } } }) }
for (const x of a) { console.log('\n## ' + (x.name ?? x.id ?? '') + (x.expect ? '\n期待: ' + x.expect : '')); for (const s of x.seq ?? []) console.log('  ' + String(s).slice(0, w)); const rest = { ...x }; delete rest.name; delete rest.expect; delete rest.seq; const r = JSON.stringify(rest); if (r !== '{}') console.log('  ' + r.slice(0, w * 2)) }
