// ラウンド8: 見積回答の取り込み（合計の書き方・以下余白・見出しの「単価（円）」）と、部品名「?」の公開
import { launch, fresh, T, makeLog, shot, ui, proj, sleep, runPalette, clearToast } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('t68_quote_import')
const step = async (name, fn) => { try { log('== ' + name); await fn() } catch (e) { log('EXC', name, String(e).slice(0, 300)) } }
const quotes = async (id) => (await proj(page)).quotes.filter((x) => x.rowId === id && x.supplierId === 'S1' && !x.stale).map((x) => `${x.supplierId}:${x.unitPrice}/${x.leadDays}/${x.moq}`).join(' ')
async function importTsv(tsv) {
  await clearToast(page)
  await runPalette(page, '見積回答を取り込む'); await sleep(100)
  for (let i = 0; i < 2 && (await T.panel(page)) && !(await page.locator('.overlay textarea').count()); i++) { await page.keyboard.press('Enter'); await sleep(120) }
  await page.locator('.overlay textarea').fill(tsv); await page.keyboard.press('Control+Enter'); await sleep(250)
  log('  toast:', await T.toast(page)); if (await T.panel(page)) { log('  panel:', (await T.panelText(page))?.slice(0, 200)); await page.keyboard.press('Escape') }
}
await step('A. 合計の書き方（全角空白・税抜）と以下余白', async () => {
  await fresh(page, 'purchasing'); await sleep(150)
  const p = await proj(page); const m = (id) => p.rows.find((r) => r.id === id).model
  log('  before', await quotes('R033'), '|', await quotes('R034'))
  await importTsv(['行ID\t型式\t単価\t納期\tMOQ', `R033\t${m('R033')}\t99\t10\t1`, `R034\t${m('R034')}\t350\t15\t1`, '\t合　計\t449\t\t', '\t合計（税抜）\t449\t\t', '\t以下余白\t\t\t'].join('\n'))
  log('  after', await quotes('R033'), '|', await quotes('R034'))
})
await step('B. 見出しが「単価（円）」「納期（日）」', async () => {
  await fresh(page, 'purchasing'); await sleep(150)
  const p = await proj(page); const m = (id) => p.rows.find((r) => r.id === id).model
  await importTsv(['行ID\t型式\t単価（円）\t納期（日）\tMOQ', `R033\t${m('R033')}\t97\t9\t1`].join('\n'))
  log('  after', await quotes('R033'))
})
await step('C. 設計: 部品名に ? → Enter → Ctrl+Enter → 理由 2 → Enter（公開されるか）', async () => {
  await fresh(page); await page.keyboard.press('ArrowDown'); await page.keyboard.press('?'); await page.keyboard.press('Enter'); await sleep(80)
  await page.keyboard.press('Control+Enter'); await sleep(150); log('  panel:', (await T.panelText(page))?.slice(0, 160), '| toast', await T.toast(page))
  if (await T.panel(page)) { await page.keyboard.press('2'); await page.keyboard.press('Enter'); await sleep(200) }
  log('  toast:', await T.toast(page)); const p = await proj(page); const r = p.rows.find((x) => x.id === 'R001'); log('  R001 name', r.name, 'working', JSON.stringify(r.working), 'rev', r.publishedRev)
})
save(errors); await browser.close()
