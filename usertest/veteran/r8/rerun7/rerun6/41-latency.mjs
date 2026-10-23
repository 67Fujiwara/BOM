// ラウンド5: 英字コマンド 1 打の反応時間（キーを押してから保存データに反映されるまで）。現行ビルド 5195 / ラウンド4 時点ビルド 5196
import fs from 'node:fs'
import { open, reset, gotoCell, sleep } from './letterlib.mjs'
const out = {}
for (const [tag, port] of [['build-current', 5195], ['build-r4', 5196], ['build-current', 5195], ['build-r4', 5196]]) {
  const env = await open(port)
  const res = {}
  for (const [name, key, col, check] of [['h 隠す（部品名）', 'h', '部品名', 'hidden'], ['Shift+D 複製（型式）', 'D', '型式', 'rows'], ['h 隠す（ID 列＝文字を打てない列）', 'h', 'ID', 'hidden'], ['j 次の行（部品名）', 'j', '部品名', 'cursor']]) {
    const samples = []
    for (let i = 0; i < 5; i++) {
      await reset(env)
      await gotoCell(env.page, 1, 'R040', col)
      const ms = await env.page.evaluate(async ([key, check]) => {
        const k = 'bom-pro.workspace.v2'
        const state = () => { const w = JSON.parse(localStorage.getItem(k)); const p = w.projects.find((x) => x.id === w.currentProjectId); return check === 'hidden' ? p.rows.find((r) => r.id === 'R040').hidden : check === 'rows' ? p.rows.length : document.querySelector('[data-testid="cursor"]')?.textContent }
        const s0 = state()
        const t0 = performance.now()
        document.body.dispatchEvent(new KeyboardEvent('keydown', { key, code: 'Key' + key.toUpperCase(), shiftKey: key !== key.toLowerCase(), bubbles: true, cancelable: true }))
        for (;;) { if (state() !== s0) return Math.round(performance.now() - t0); if (performance.now() - t0 > 3000) return -1; await new Promise((r) => setTimeout(r, 5)) }
      }, [key, check])
      samples.push(ms)
    }
    samples.sort((a, b) => a - b)
    res[name] = { median: samples[2], samples }
  }
  ;(out[tag] ??= []).push(res)
  console.log(tag, JSON.stringify(res))
  await env.browser.close()
}
fs.writeFileSync('/home/user/BOM/usertest/veteran/r8/rerun7/rerun6/41-latency.json', JSON.stringify(out, null, 2))
