// V6-02 の補足: ID 列で x F8 x F8 / x Shift+N x（Alt なし）
import { open, reset, gotoCell, snap, diffRows, typeSeqM, sleep, saveJson } from './lib6.mjs'
const env = await open(5173); const out = []
for (const toks of ['x F8 x F8', 'x S-n x', 'x S-F8 x']) for (const g of [0, 450]) {
  await reset(env); await gotoCell(env.page, 4, 'R016', 'ID')
  const a = await snap(env.page); await typeSeqM(env.page, toks.split(' ').map((t, i) => [t, i ? g : 0])); await sleep(200); const b = await snap(env.page)
  const o = { toks, g, cursor: [a.cursor, b.cursor], mode: b.mode, edit: b.edit, diff: diffRows(a, b) }; out.push(o); console.log(JSON.stringify(o))
}
saveJson('51c-idf8.json', out); await env.browser.close()
