// 表への Ctrl+V: 途中が空のセル・合計の行・見出しつきのコピー（Excel でそのままコピー）
import { launch, fresh, T, makeLog, shot, sel, gotoCol, proj, sleep, diff, ui } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('y11_paste_blank')
const clip = (t) => page.evaluate((t) => navigator.clipboard.writeText(t), t)
const strip = (r) => { const { updatedAt, statusChangedAt, dueAt, flags, ...x } = r; return x }
const changes = async (p0) => { const p1 = await proj(page); const out = []; for (const r of p1.rows) { const r0 = p0.rows.find((x) => x.id === r.id); if (!r0) { out.push(`NEW ${r.id}{${r.name}|${r.model}|${r.maker}|${r.qtyNeeded}}`); continue } const d = diff(strip(r0), strip(r)); if (d) out.push(`${r.id}: ${d.slice(0, 240)}`) } return out.join(' ; ') || '(なし)' }
const cases = [
  ['途中が空（メーカ空）', 'R040', '部品名', '近接センサ\tE2E-X5ME1\t\t4\n光電センサ\tE3Z-D61\tオムロン\t2\n'],
  ['先頭が空（部品名空）', 'R040', '部品名', '\tE2E-X5ME1\tオムロン\n\tE3Z-D61\tオムロン\n'],
  ['見出しつきでコピー', 'R040', '部品名', '品名\t型式\tメーカー\t数量\n近接センサ\tE2E-X5ME1\tオムロン\t4\n'],
  ['合計の行つき', 'R040', '必要数', '4\n2\n合計 6\n'],
  ['数量に単位', 'R040', '必要数', '4個\n2 pcs\n１０\n'],
  ['最後の行を越える', 'R079', '部品名', 'A\nB\nC\nD\n'],
]
for (const [title, id, col, text] of cases) {
  log('== ' + title)
  await fresh(page); await sel(page, id); await gotoCol(page, col); const p0 = await proj(page)
  await clip(text); await page.keyboard.press('Control+v'); await sleep(300)
  const u = await ui(page)
  log(`  toast: ${await T.toast(page)} | panel=${u.panel} ${(await T.panelText(page))?.slice(0, 200) ?? ''}`)
  if (u.panel) { await page.keyboard.press('Enter'); await sleep(200); log(`  Enter → toast: ${await T.toast(page)}`) }
  log('  changes: ' + (await changes(p0)))
}
save(errors); await browser.close()
