// ラウンド12: 速い連打（ページ内で 15ms / 40ms / 120ms 間隔）で F8 → 値 → Enter → F8 … を続けたときの結果が遅い打鍵と同じか（300 行・2,500 行）
import { open, reset, sleep, logger, typeSeqM, snap, diffRows, state } from './lib22.mjs'
const port = Number(process.env.PORT ?? 5176)
const env = await open(port); const pg = env.page; const log = logger(`50-fast-chain-${port}.json`)
const word = (s) => [...s]
const seqOf = (gap) => {
  const toks = ['A-1', 'F8', ...word('MY4N'), 'Enter', 'F8', ...word('OMRON'), 'Enter', 'F8', 'A-x', 'F8', ...word('7'), 'Enter', 'A-4', 'F8', 'S-F8']
  return toks.map((t, i) => [t, i === 0 ? 0 : gap])
}
for (const n300 of [false, true]) for (const gap of [120, 40, 15]) {
  await reset(env, { n300 }); await pg.keyboard.press('Escape')
  const a = await snap(pg)
  const t0 = Date.now(); await typeSeqM(pg, seqOf(gap)); await sleep(800)
  const b = await snap(pg); const s = await state(pg)
  log({ rows: n300 ? 300 : 80, gap, ms: Date.now() - t0, end: s.cursor + '/' + s.mode, diff: diffRows(a, b).slice(0, 8) })
}
log.save(); await env.browser.close()
