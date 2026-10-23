import { launch, log } from './lib.mjs'
const t = await launch(); const { page } = t
await t.open('design')
const mk = (name, wait) => page.evaluate(async ([name, wait]) => { if (wait) await new Promise(r => setTimeout(r, 300)); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['x'], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })); a.download = name; a.click() }, [name, wait])
for (const [n, w] of [['ascii.xlsx', true], ['日本語.xlsx', false], ['P-1_日本語.xlsx', true], ['P-2026-041_第3ライン 搬送制御盤_社内.xlsx', false]]) {
  const [d] = await Promise.all([page.waitForEvent('download'), mk(n, w)])
  log(n, w, '→', d.suggestedFilename())
}
await t.close()
