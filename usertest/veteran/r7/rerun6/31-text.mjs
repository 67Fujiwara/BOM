// 値の向き: 実在の型式・部品名・メーカ名・回路記号を 60〜500ms 間隔で打ち、値として入るか（別の行・別の状態が変わらないか）
import fs from 'node:fs'
import { open, reset, gotoCell, snap, diffRows, typeSeq, word, sleep } from './letterlib.mjs'
const TARGETS = (process.env.TARGETS ?? 'dev:5176,build:5197').split(',').map((x) => x.split(':'))
const GAPS = (process.env.GAPS ?? '60,150,300,380,450').split(',').map(Number)
const CASES = [
  // [列, 語, 種別メモ]
  ['メーカ', 'Analog', 'メーカ名（A＋n）'], ['メーカ', 'Infineon', 'メーカ名（I＋n）'], ['メーカ', 'Knowles', 'メーカ名（K＋n）'], ['メーカ', 'Skyworks', 'メーカ名（S＋k）'], ['メーカ', 'Intersil', 'メーカ名'],
  ['部品名', 'Inductor', '部品名'], ['部品名', 'Antenna', '部品名'], ['部品名', 'Anode', '部品名'], ['備考', 'Sn-Ag-Cu', 'はんだ組成'],
  ['部品名', 'snubber', '小文字（s＋n）'], ['部品名', 'skip', '小文字（s＋k）'], ['型式', 'sn74hc595', '小文字型式（s＋n）'], ['回路記号', 'cn1', '小文字回路記号（c＋n）'],
  ['備考', 'i2c', '小文字＋数字'], ['回路記号', 'r1', '小文字回路記号＋数字'], ['回路記号', 'c10', '小文字回路記号＋数字'], ['備考', 'x7r', '誘電体（小文字）'], ['回路記号', 'k1', '小文字 k＋数字'],
  ['回路記号', 'K1', 'V4-01'], ['回路記号', 'J1', 'V4-01'], ['回路記号', 'J12', 'V4-01'], ['回路記号', 'N1', 'V4-01'], ['型式', 'K3HB-X', 'V4-01'], ['型式', 'J7KN-10', 'V4-01'], ['型式', 'K8AK-AS1', 'V4-01'],
  ['型式', 'ADP3338', 'V4-02'], ['型式', 'AD8605', 'V4-02'], ['型式', 'INA219', 'V4-02'], ['型式', 'IRF540N', 'V4-02'], ['メーカ', 'wago', 'V4-02'], ['部品名', 'wire', 'V4-02'], ['部品名', 'coil', 'V4-02'], ['部品名', 'cable', 'V4-02'],
  ['部品名', 'knob', 'V3-01'], ['型式', 'DRV8833', 'V3-01'], ['型式', 'STM32F103', 'V3-01'], ['型式', 'NJM2904', 'V3-01'], ['部品名', 'hook', 'V3-01'], ['部品名', 'relay', '英単語'], ['部品名', 'fuse', '英単語'], ['部品名', 'xtal', '英単語'], ['メーカ', 'YAGEO', 'V3-01'], ['メーカ', 'KEMET', 'V3-01'],
  ['部品名', 'on', '母音＋n'], ['部品名', 'ok', '母音＋k'], ['型式', 'S1', 'Shift+S＋数字'], ['型式', '2SC1815', '数字で始まる型式'], ['型式', '1N4148', '数字で始まる型式'], ['メーカ', '3M', '数字で始まるメーカ'], ['備考', '100uF', '数字で始まる備考'],
]
const ONLY = process.env.ONLY ? process.env.ONLY.split('|') : null
const out = {}
for (const [tag, port] of TARGETS) {
  const env = await open(port, { cpu: process.env.CPU ? Number(process.env.CPU) : undefined })
  out[tag] = []
  for (const [col, text, memo] of CASES.filter((c) => !ONLY || ONLY.includes(c[1]))) {
    for (const gap of GAPS) {
      await reset(env, { n300: !!process.env.N300 })
      const okNav = await gotoCell(env.page, 1, 'R040', col)
      const a = await snap(env.page)
      const lags = await typeSeq(env.page, word(text, gap))
      await sleep(650)
      const b = await snap(env.page)
      const d = diffRows(a, b)
      const ok = b.mode === '編集' && b.edit === text && d.length === 0 && b.cursor === a.cursor && b.view === a.view && b.chips === a.chips && !b.panel
      const rec = { col, text, memo, gap, ok, okNav, cursor: [a.cursor, b.cursor], view: [a.view, b.view], mode: b.mode, edit: b.edit, panel: b.panel, chips: b.chips, toast: b.toast, diff: d, maxLag: Math.max(...lags) }
      // 実際に Enter で確定したら何が変わるか（ベテランは打ったら Enter）
      if (!ok) {
        await env.page.keyboard.press('Enter'); await sleep(150)
        const c = await snap(env.page)
        rec.afterEnter = { diff: diffRows(a, c), cursor: c.cursor, panel: c.panel, toast: c.toast }
      }
      out[tag].push(rec)
      console.log(tag, ok ? 'OK' : 'NG', `${text}@${gap}`, '|', col, '| mode', b.mode, 'edit', JSON.stringify(b.edit), '| cur', b.cursor, '| view', b.view, '| panel', b.panel, '| chips', b.chips, '| diff', d.join(' ; ').slice(0, 200), rec.afterEnter ? '| afterEnter ' + rec.afterEnter.diff.join(' ; ').slice(0, 200) : '', '| lag', rec.maxLag)
    }
  }
  console.log(tag, 'errors', env.errs.slice(0, 5))
  await env.browser.close()
}
fs.writeFileSync(`/home/user/BOM/usertest/veteran/r7/rerun6/${process.env.OUT ?? '31-text.json'}`, JSON.stringify(out, null, 2))
