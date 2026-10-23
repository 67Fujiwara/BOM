// ラウンド5: 実打鍵（keyboard.press）で 450 / 500ms 間隔に型式を打つ（V5-03 の確認）
import { launch, fresh, goto, toCol, mode, sleep, dumpErrors, save, proj, closeAll, panel, cursor } from './lib.mjs'
const { browser, page, errors } = await launch()
const out = []
for (const [col, text] of [['型式', 'K3HB-X'], ['型式', 'ADP3338'], ['型式', 'NJM2904'], ['部品名', 'relay']]) for (const gap of [450, 500]) {
  await fresh(page); await page.keyboard.press('1'); await goto(page, 'R040'); await toCol(page, col)
  const before = JSON.stringify((await proj(page)).rows)
  for (const ch of text) { await page.keyboard.press(/^[A-Z]$/.test(ch) ? 'Shift+' + ch : ch); await sleep(gap) }
  await sleep(300)
  const m = await mode(page); const c = await cursor(page); const pn = await panel(page)
  const ev = m === '編集' ? await page.getByTestId('cell-editor').inputValue() : null
  if (m === '編集') await page.keyboard.press('Enter'); await sleep(200)
  const b = JSON.parse(before); const after = (await proj(page)).rows
  const changed = after.filter((r) => JSON.stringify(r) !== JSON.stringify(b.find((x) => x.id === r.id))).map((r) => { const o = b.find((x) => x.id === r.id); if (!o) return r.id + ':new'; const d = []; for (const k of Object.keys(r)) if (!['statusChangedAt'].includes(k) && JSON.stringify(r[k]) !== JSON.stringify(o[k])) d.push(k + '=' + JSON.stringify(r[k]).slice(0, 40)); return r.id + ':' + d.join(',') })
  const rec = { text, gap, mode: m, edit: ev, cursor: c, panel: pn, changed }
  out.push(rec); console.log(JSON.stringify(rec))
  await closeAll(page)
}
dumpErrors(errors, '33b'); save('33b-real-slow.json', out); await browser.close()
