import { loadParsers } from './parselib.mjs'
const { old, neu } = await loadParsers('68e45f7')
const mk = (unit, n) => '品名,型式,数量\nリレー,MY4N,4\n' + unit.repeat(n) + '\nタイマ,H3CR,1\n'
for (const [lbl, unit] of [['"a",', '"a",'], ['"a","b",', '"a","b",'], ['""",', '""",'], ['"x,y",', '"x,y",']]) for (const n of [5000, 20000, 50000]) {
  const t = mk(unit, n)
  const tm = (p) => { const s = performance.now(); let r; try { r = p.parseBomPaste(t) } catch (e) { return 'EXC' } return Math.round(performance.now() - s) + 'ms' }
  console.log(`${lbl} ×${n} (${Math.round(t.length / 1000)}KB): old=${tm(old)} new=${tm(neu)}`)
}
