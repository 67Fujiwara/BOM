// ラウンド19: まだ新人が触っていない所 その 2。
// A 必要日(前倒し) に「7」「-7」「7日前」と打つ（列の名前どおり前倒しのつもり）→ 必要日はどちらに動くか
// B 設計（選定者）が「商社を集約」→ 1 番目 → Enter → Ctrl+Z
// C 購買が自分の指摘（I-001）の Ctrl+. →「この指摘からルールを作る」→ どんなルールで、どの行に出るか
// D 設計が選定済の R002 の型式を変えて公開 → 購買が「正式見積を依頼」（対象の数え方・再見積要の除外の知らせ）→ 依頼 → もう一度
import { launch, fresh, T, makeLog, ui, sleep, shot, proj, setRole, sel, gotoCol, runPalette, clearToast, typeReal, palette } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog(process.env.LOGNAME2 || 'r47_misc19')
const step = async (name, fn) => { try { log('== ' + name); await fn() } catch (e) { log('EXC', name, String(e).slice(0, 300)) } }
const U = async (tag) => { const u = await ui(page); log(`  [${tag}] role=${u.role} view=${u.view} cur=${u.cursorRow}/${u.cursorCol} mode=${u.mode} panel=${u.panel} | ${((await T.panelText(page)) ?? '').slice(0, 260)} | toast=${(await T.toast(page))?.slice(0, 240)}`) }
const needOf = async (id) => page.evaluate(async (id) => {
  const f = (k) => performance.getEntriesByType('resource').map((e) => e.name).find((n) => n.includes(k)) ?? k
  const s = (await import(f('/src/model/store.ts'))).useStore.getState(); const D = await import(f('/src/model/derive.ts'))
  const p = s.ws.projects.find((x) => x.id === s.ws.currentProjectId); const r = p.rows.find((x) => x.id === id)
  return `${id} needOffset=${r.needOffset} working=${JSON.stringify(r.working ?? null)} 必要日=${D.rowNeedDate(p, r)} 必要日(作業中)=${D.rowNeedDate(p, r, true)} 案件納期=${p.dueDate}`
}, id)
await step('A 設計: R039 の必要日(前倒し) に 7 / -7 / 7日前', async () => {
  await fresh(page); await sleep(150)
  await palette(page, '列の表示'); await page.keyboard.press('Enter'); await sleep(200)
  await page.getByTestId('columns').locator('.opt', { hasText: '必要日(前倒し)' }).click(); await sleep(100); await page.keyboard.press('Escape'); await sleep(100)
  log('  before: ' + (await needOf('R039')))
  for (const v of ['7', '-7', '7日前', '１週間前']) {
    await sel(page, 'R039'); log(`  col ${await gotoCol(page, '必要日(前倒し)')}`); await clearToast(page)
    await typeReal(page, v.replace(/[^\x20-\x7e]/g, ''), 20); if (/[^\x20-\x7e]/.test(v)) { await page.keyboard.press('Control+a'); await page.keyboard.insertText(v) }
    await page.keyboard.press('Enter'); await sleep(250)
    log(`  「${v}」 Enter: toast=${(await T.toast(page))?.slice(0, 200)} | ${await needOf('R039')} | cell=${(await page.locator('[data-row-id="R039"] td').allInnerTexts()).join('|').slice(0, 200)}`)
    if ((await ui(page)).mode === 'edit') { await page.keyboard.press('Escape'); await sleep(100) }
  }
  await shot(page, 'r47_A_needoffset')
})
await step('B 設計（選定者）: 商社を集約 → 1 番目 → Enter → Ctrl+Z', async () => {
  await fresh(page); await sleep(150)
  const before = (await proj(page)).rows.filter((r) => r.adoptedSupplierId).length
  await runPalette(page, '商社を集約'); await sleep(250); await U('集約')
  await page.keyboard.press('Enter'); await sleep(300); await U('Enter')
  for (let i = 0; i < 2 && (await T.panel(page)); i++) { await page.keyboard.press('Enter'); await sleep(300); await U('Enter ' + i) }
  const p = await proj(page); log(`  adopted rows ${before} → ${p.rows.filter((r) => r.adoptedSupplierId).length} | statuses: ${JSON.stringify(p.rows.reduce((a, r) => ((a[r.status] = (a[r.status] ?? 0) + 1), a), {}))} | by supplier: ${JSON.stringify(p.rows.reduce((a, r) => (r.adoptedSupplierId && (a[r.adoptedSupplierId] = (a[r.adoptedSupplierId] ?? 0) + 1), a), {}))}`)
  await page.keyboard.press('Control+z'); await sleep(250); await U('Ctrl+Z')
  log(`  after undo adopted=${(await proj(page)).rows.filter((r) => r.adoptedSupplierId).length}`)
})
await step('C 購買: I-001（R016 型式あいまい・自分の指摘）→ Ctrl+. →「この指摘からルールを作る」', async () => {
  await fresh(page, 'purchasing'); await sleep(150)
  const r0 = (await proj(page)).rules?.length ?? (await page.evaluate(async () => { const u = performance.getEntriesByType('resource').map((e) => e.name).find((n) => n.includes('/src/model/store.ts')); const m = await import(u); return m.useStore.getState().ws.rules.length }))
  await page.keyboard.press('Alt+1'); await sleep(100); await sel(page, 'R016'); await gotoCol(page, '型式')
  await page.keyboard.press('Control+.'); await sleep(250); await U('Ctrl+.')
  const items = (await T.panelText(page)) ?? ''
  if (/この指摘からルールを作る/.test(items)) { await page.keyboard.press('5'); await sleep(250); await U('5') }
  if (await T.panel(page)) { await page.keyboard.press('Escape'); await sleep(150) }
  const rules = await page.evaluate(async () => { const u = performance.getEntriesByType('resource').map((e) => e.name).find((n) => n.includes('/src/model/store.ts')); const m = await import(u); return m.useStore.getState().ws.rules.map((r) => JSON.stringify(r).slice(0, 260)) })
  log(`  rules ${r0} → ${rules.length}: ${rules.slice(r0).join(' / ')}`)
  const probs = await page.evaluate(async () => {
    const f = (k) => performance.getEntriesByType('resource').map((e) => e.name).find((n) => n.includes(k)) ?? k
    const s = (await import(f('/src/model/store.ts'))).useStore.getState(); const R = await import(f('/src/model/rules.ts'))
    const p = s.ws.projects.find((x) => x.id === s.ws.currentProjectId); const last = s.ws.rules[s.ws.rules.length - 1]
    return p.rows.map((r) => [r.id, R.checkRow(r, s.ws.rules, p).filter((x) => x.ruleId === last.id || x.message.includes(last.name)).map((x) => x.message.slice(0, 40))]).filter((x) => x[1].length).map((x) => x[0] + ':' + x[1].join(';')).slice(0, 12)
  })
  log(`  rows hit by the new rule: ${probs.length ? probs.join(' | ') : '（なし）'}`)
  await setRole(page, 'design'); await sleep(200); await U('design')
  log('  design hints at R016: ' + (await T.hints(page)))
})
await step('D 設計が選定済の R002 の型式を変えて公開 → 購買が正式見積を依頼（2 回）', async () => {
  await fresh(page); await sleep(150)
  await sel(page, 'R002'); await gotoCol(page, '型式'); await typeReal(page, 'FX5-16EX/ES2', 15); await page.keyboard.press('Enter'); await sleep(200)
  await page.keyboard.press('Control+Enter'); await sleep(300)
  if (await T.panel(page)) { await page.keyboard.press('2'); await page.keyboard.press('Enter'); await sleep(300) }
  await U('design publish')
  const p = await proj(page); log('  R001-R003,R013: ' + p.rows.filter((r) => ['R001', 'R002', 'R003', 'R013'].includes(r.id)).map((r) => `${r.id}:${r.status}:${JSON.stringify(r.flags)}`).join(' '))
  await setRole(page, 'purchasing'); await sleep(250)
  await runPalette(page, '正式見積を依頼'); await sleep(250); await U('正式見積を依頼 1')
  if (await T.panel(page)) { await page.keyboard.press('2'); await sleep(150); if (await T.panel(page)) await page.keyboard.press('Enter'); await sleep(400) }
  await U('依頼後')
  await clearToast(page)
  await runPalette(page, '正式見積を依頼'); await sleep(250); await U('正式見積を依頼 2')
  if (await T.panel(page)) { await page.keyboard.press('Escape'); await sleep(150) }
})
save(errors); await browser.close()
