// ラウンド23 s06: 状態の違う行（選定済・正式依頼中・正式見積済・発注済・入荷済）の調達区分を 支給品／社内在庫 に替えたとき、3 発注・入荷／8 正式見積／9 購買作業 に出るか・ボール・採用の列
import { launch, fresh, T, makeLog, proj, sleep, sel, gotoCol, ui } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog(process.env.LOGNAME2 || 's06_supplied_views')
const probe = async (id) => page.evaluate(async (id) => {
  const find = (k) => performance.getEntriesByType('resource').map((e) => e.name).find((n) => n.includes(k)) ?? k
  const D = await import(find('/src/model/derive.ts'))
  const s = (await import(find('/src/model/store.ts'))).useStore.getState(); const p = s.ws.projects.find((x) => x.id === s.ws.currentProjectId); const r = p.rows.find((x) => x.id === id)
  return { st: r.status, proc: r.procurement, ad: r.adoptedSupplierId ?? null, ball: D.ball(p, r), quotable: D.isQuotable(r), wd: r.flags.formalWithdrawn ?? null, ordered: !!r.ordered, received: !!r.received, pend: r.pendingRev ?? null }
}, id)
const inViews = async (id) => {
  const out = []
  for (const v of [1, 3, 4, 5, 8, 9]) {
    await page.keyboard.press(`Alt+${v}`); await sleep(220)
    const ids = await page.getByTestId('row').evaluateAll((els) => els.map((e) => e.getAttribute('data-row-id')))
    if (ids.includes(id)) out.push(v)
  }
  return out.join(',')
}
for (const st of ['selected', 'formalRequested', 'formalQuoted', 'ordered', 'received']) for (const proc of ['支給品', '社内在庫']) {
  await fresh(page, 'purchasing')
  const w = await proj(page)
  const target = w.rows.find((r) => r.status === st && r.procurement === '相見積' && !r.working)
  if (!target) { log(`[${st}/${proc}] 該当行なし`); continue }
  const id = target.id
  log(`== ${st} の ${id} を ${proc} に`)
  log('  before: ' + JSON.stringify(await probe(id)) + ' views=' + await inViews(id))
  await page.getByTestId('role-design').click(); await sleep(200); await page.locator('.gridwrap').focus()
  await page.keyboard.press('Alt+1'); await sleep(150)
  await sel(page, id); await gotoCol(page, '調達区分'); await page.keyboard.press('Enter'); await page.keyboard.insertText(proc.slice(0, 2)); await page.keyboard.press('Enter'); await sleep(250)
  log('  edit toast: ' + (await T.toast(page))?.slice(0, 120))
  await page.keyboard.press('Control+Enter'); await sleep(350)
  for (let i = 0; i < 4 && (await T.panel(page)); i++) { log('   panel: ' + ((await T.panelText(page)) ?? '').slice(0, 140)); if (i === 0) await page.keyboard.press('2'); await page.keyboard.press('Enter'); await sleep(300) }
  log('  publish toast: ' + (await T.toast(page))?.slice(0, 160))
  log('  after(design): ' + JSON.stringify(await probe(id)))
  await page.getByTestId('role-purchasing').click(); await sleep(250); await page.locator('.gridwrap').focus()
  log('  after(purchasing): ' + JSON.stringify(await probe(id)) + ' views=' + await inViews(id))
  await page.getByTestId('role-pm').click(); await sleep(250); await page.locator('.gridwrap').focus()
  log('  after(pm): views=' + await inViews(id) + ' header=' + (await T.header(page)).replace(/\s+/g, ' ').replace(/^.*?(概算)/, '$1').slice(0, 120))
}
save(errors); await browser.close()
