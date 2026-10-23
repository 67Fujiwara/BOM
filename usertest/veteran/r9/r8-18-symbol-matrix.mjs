// ラウンド8: 記号・数字・英字で始まる値を、列の種類（文字・数値・日付・選択・チェック・自動計算・ID）× 役割 × 打つ速さで。
// 期待: 自分が書ける列では値の打ち始め（ビュー・行・パネルは変わらない）。書けない列ではコマンド（値は入らない）
import { open, reset, gotoCell, snap, diffRows, sleep, saveJson, typeSeqM, state } from './lib9.mjs'
const port = Number(process.env.PORT ?? 5176)
const SYMS = ['?', '/', '[', ']', '<', '>', '.', ',', ';', ':', "'", '"', '=', '+', '*', '&', '%', '$', '#', '@', '!', '~', '`', '^', '(', ')', '{', '}', '|', '\\', '_', '-']
const COLS = {
  design: [['部品名', 'text'], ['型式', 'text'], ['必要数', 'num'], ['必要日(固定)', 'date'], ['単位', 'select'], ['規格', 'text']],
  purchasing: [['ロット', 'text', 3, 'R054'], ['入荷予定', 'date', 3, 'R054'], ['追加費用', 'num', 3, 'R054'], ['発注数', 'num', 9, 'R040']],
}
const env = await open(port); const pg = env.page; const out = []; let bad = 0, n = 0
const tokOf = (ch) => (/^[A-Z]$/.test(ch) ? ch : ch)
for (const role of ['design', 'purchasing']) {
  for (const [col, kind, view = 1, row = 'R040'] of COLS[role]) {
    await reset(env, { role })
    for (const gap of [0, 30]) for (const sym of SYMS) {
      const ok = await gotoCell(pg, view, row, col)
      if (!ok) { out.push({ role, col, err: 'col not found' }); break }
      const a = await snap(pg); const s0 = await state(pg)
      const word = sym + 'A1'
      await typeSeqM(pg, [...word].map((c, i) => [tokOf(c), i ? gap : 0])); await sleep(60)
      const s = await state(pg)
      const good = s.mode === '編集' && s.edit === word && s.view === s0.view && s.cursor === s0.cursor && !s.panel
      n++; if (!good) bad++
      if (!good) { const rec = { role, col, kind, gap, word, before: s0.cursor + '/' + s0.view, after: { mode: s.mode, edit: s.edit, cursor: s.cursor, view: s.view, panel: s.panel, filter: s.filter }, toast: s.toast.slice(0, 80) }; out.push(rec); console.log(JSON.stringify(rec)) }
      await pg.keyboard.press('Escape'); await pg.keyboard.press('Escape'); await sleep(20)
      if (s.view !== s0.view || s.panel || s.filter) { await reset(env, { role }) }
      const b = await snap(pg); const d = diffRows(a, b); if (d.length) { out.push({ role, col, sym, gap, diffAfterEsc: d }); console.log('DIFF', role, col, sym, d) }
    }
  }
}
console.log('total', n, 'bad', bad, 'errors', JSON.stringify(env.errs.slice(0, 5)))
out.push({ total: n, bad, errs: env.errs.slice(0, 5) })
saveJson('r8-18-symbol-matrix.json', out); await env.browser.close()
