// ラウンド22: 支給品・社内在庫に替えた行（ボールが無い・正式見積のビューに出ない・金額/見積済の分母に入らない）を新人の操作で
import { launch, fresh, T, makeLog, ui, proj, store, sleep, shot, sel, gotoCol, typeReal } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog(process.env.LOGNAME2 || 'r90_supplied')
const ballOf = (id) => page.evaluate(async (id) => {
  const find = (k) => performance.getEntriesByType('resource').map((e) => e.name).find((n) => n.includes(k)) ?? k
  const D = await import(find('/src/model/derive.ts')); const V = await import(find('/src/model/views.ts'))
  const s = (await import(find('/src/model/store.ts'))).useStore.getState(); const p = s.ws.projects.find((x) => x.id === s.ws.currentProjectId); const r = p.rows.find((x) => x.id === id)
  const inView = {}
  for (const v of V.VIEWS) { try { inView[v.id ?? v.key] = V.rowsOf ? undefined : undefined } catch {} }
  return { ball: D.ball(p, r), status: r.status, proc: r.procurement, adopted: r.adoptedSupplierId, flags: Object.keys(r.flags).filter((k) => r.flags[k]).join(','), quotable: D.isQuotable(r), working: r.working ? JSON.stringify(r.working) : null, pend: r.pendingRev ?? null }
}, id)
const viewIds = async () => page.getByTestId('row').evaluateAll((els) => els.map((e) => e.getAttribute('data-row-id')))
for (const proc of ['支給品', '社内在庫']) {
  await fresh(page, 'design')
  log(`=== 設計: R001 の調達区分を ${proc} にする`)
  log('  before: ' + JSON.stringify(await ballOf('R001')))
  await sel(page, 'R001'); log('  goto 調達: ' + await gotoCol(page, '調達区分'))
  await page.keyboard.press('Enter'); await sleep(150)
  log('  edit mode: ' + (await T.mode(page)) + ' cursor ' + (await T.cursor(page)) + ' panel=' + (await T.panelText(page)))
  await page.keyboard.insertText(proc.slice(0, 2)); await sleep(100)
  log('  after typing: ' + (await T.mode(page)) + ' | ' + ((await T.panelText(page)) ?? '').slice(0, 200))
  await page.keyboard.press('Enter'); await sleep(250)
  log('  toast: ' + (await T.toast(page)))
  log('  after: ' + JSON.stringify(await ballOf('R001')))
  log('  status: ' + (await T.status(page)))
  // 公開
  await page.keyboard.press('Control+Enter'); await sleep(400)
  log('  Ctrl+Enter -> ' + (await T.toast(page)) + ' | panel ' + ((await T.panelText(page)) ?? '-').slice(0, 300))
  for (let i = 0; i < 4 && (await T.panel(page)); i++) { if (i === 0) await page.keyboard.press('2'); await page.keyboard.press('Enter'); await sleep(300); log('   panel→ ' + ((await T.panelText(page)) ?? '-').slice(0, 200) + ' toast=' + (await T.toast(page))) }
  log('  after publish: ' + JSON.stringify(await ballOf('R001')))
  await shot(page, `r90_${proc}_design`)
  // 購買に切り替えて見る
  await page.getByTestId('role-purchasing').click(); await sleep(300)
  log('  purchasing view ' + (await T.view(page)) + ' header=' + (await T.header(page).catch(() => '')))
  for (const v of [9, 8, 5, 1]) {
    await page.keyboard.press(`Alt+${v}`); await sleep(250)
    const ids = await viewIds()
    log(`  Alt+${v}: ${ids.length} rows, R001 ${ids.includes('R001') ? 'あり' : 'なし'} | ${(await T.header(page).catch(() => '')).slice(0, 120)}`)
  }
  log('  after (購買): ' + JSON.stringify(await ballOf('R001')))
  // 正式見積を依頼
  await page.keyboard.press('Alt+8'); await sleep(200)
  const ids8 = await viewIds(); log('  view8 rows: ' + ids8.slice(0, 12).join(',') + ' (' + ids8.length + ')')
  await page.keyboard.press('Control+k'); await page.getByTestId('palette-input').fill('正式見積を依頼'); await sleep(100)
  const items = await page.getByTestId('palette-list').locator('.item').allTextContents(); log('  palette: ' + items.slice(0, 3).map((t) => t.replace(/\s+/g, ' ').trim()).join(' / '))
  await page.keyboard.press('Escape'); await sleep(100)
  const w = await store(page); const p = w.projects.find((x) => x.id === w.currentProjectId)
  const h = await page.evaluate(() => document.querySelector('[data-testid="header"]')?.textContent?.replace(/\s+/g, ' ').slice(0, 300))
  log('  header: ' + h)
}
save(errors); await browser.close()
