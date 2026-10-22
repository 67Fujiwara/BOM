import fs from 'node:fs'
export function parseKeymap() {
  const src = fs.readFileSync('src/keys/keymap.ts', 'utf8')
  const out = []
  for (const m of src.matchAll(/\{ id: '([^']+)', keys: \[([^\]]+)\], mode: '(\w+)', section: '([^']+)', label: '([^']+)'/g)) {
    out.push({ id: m[1], keys: [...m[2].matchAll(/'([^']*)'/g)].map((x) => x[1]), mode: m[3], section: m[4], label: m[5] })
  }
  return out
}
export function toPress(k) {
  if (k === ' ') return 'Space'
  if (k === 'Ctrl+.') return 'Control+Period'
  return k.replace(/^Ctrl\+/, 'Control+').replace(/\+Ctrl\+/, '+Control+').replace('Ctrl+Shift+', 'Control+Shift+')
}
