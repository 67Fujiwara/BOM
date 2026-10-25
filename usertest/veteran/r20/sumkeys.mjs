import fs from 'node:fs'
for (const f of process.argv.slice(2)) {
  const a = JSON.parse(fs.readFileSync(f)); const byKey = {}
  for (const x of a) { if (!x.name || x.name.startsWith('console')) continue; const parts = x.name.split(' '); const key = parts.slice(2).join(' '); const kd = x.after?.kd ?? []; const prev = kd.some((k) => k.prevented); (byKey[key] ??= []).push(prev ? parts[1] + ':PREVENTED' : parts[1] + ':pass') }
  console.log('==', f)
  for (const [k, v] of Object.entries(byKey)) console.log(k.padEnd(24), v.join(' '))
}
