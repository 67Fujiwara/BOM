// PM 承認 ON: 設計の取消・置換・型式変更 → 公開 → PM 7 → 却下 / 承認。購買の見え方
import { launch, fresh, T, makeLog, shot, sel, gotoCol, row, proj, ui, runPalette, setRole } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('t15_pm_approval')
const step = async (name, fn) => { try { await fn() } catch (e) { log('EXC', name, String(e).slice(0, 400)) } }
const st = (id) => row(page, id).then((r) => r ? `${r.id}:${r.status}${r.removal ? ' removal=' + JSON.stringify(r.removal) : ''}${r.pendingRemoval ? ' pendingRemoval=' + JSON.stringify(r.pendingRemoval) : ''}${r.replaces ? ' replaces=' + r.replaces : ''}${r.working ? ' working=' + JSON.stringify(r.working) : ''}${r.pending ? ' pending=' + JSON.stringify(r.pending) : ''} model=${r.model} flags=${JSON.stringify(Object.fromEntries(Object.entries(r.flags).filter(([, v]) => v)))}` : `${id}: (なし)`)
const cell = async (id) => { await sel(page, id); const l = page.locator(`[data-row-id="${id}"]`); return (await l.count()) ? (await l.first().innerText()).replace(/\s+/g, ' ').slice(0, 150) : '(DOM なし)' }
const panels = async (keys, tag) => { for (const k of keys) { const pt = await T.panelText(page); if (!pt) break; log(`  [${tag}] panel: ${pt.slice(0, 200)}`); await page.keyboard.press(k); await page.waitForTimeout(120) } log(`  [${tag}] toast: ${await T.toast(page)}`) }
await fresh(page)
await step('setup', async () => {
  await page.keyboard.press('Control+Enter'); await page.waitForTimeout(100); await panels(['2', 'Enter'], 'pub0')
  await setRole(page, 'pm'); await runPalette(page, '案件設定'); await page.waitForTimeout(100)
  for (let i = 0; i < 20; i++) { const s = await page.locator('.overlay [aria-selected="true"]').innerText().catch(() => ''); if (/承認が必要/.test(s)) break; await page.keyboard.press('ArrowDown') }
  await page.keyboard.press('Enter'); await page.keyboard.press('Control+a'); await page.keyboard.type('はい'); await page.keyboard.press('Enter'); await page.keyboard.press('Control+Enter'); await page.waitForTimeout(100)
  await page.keyboard.insertText('テスト'); await page.keyboard.press('Enter'); await page.waitForTimeout(100)
  log('approval', (await proj(page)).settings.changeNeedsPmApproval)
})
await step('design changes', async () => {
  await setRole(page, 'design'); await page.keyboard.press('1')
  await sel(page, 'R032'); await page.keyboard.press('Shift+Delete'); await page.waitForTimeout(60)
  await sel(page, 'R033'); await gotoCol(page, '型式'); await page.keyboard.press('Enter'); await page.keyboard.press('Control+a'); await page.keyboard.type('M2BJ-B24D-NEW'); await page.keyboard.press('Enter')
  await sel(page, 'R034'); await page.keyboard.press('Alt+r'); await page.getByTestId('prompt-text').fill('REPL-34'); await page.keyboard.press('Enter'); await page.waitForTimeout(80)
  const nid = (await proj(page)).rows.find((r) => r.replaces === 'R034')?.id; log('replacement', nid, await st(nid))
  await page.keyboard.press('Control+Enter'); await page.waitForTimeout(100); await panels(['2', 'Enter', 'Enter', 'Enter'], 'pub-blocked')
  await sel(page, nid); await gotoCol(page, '回路記号'); log('  status before x', (await T.status(page)).replace(/\s+/g, ' ').slice(0, 160)); await page.keyboard.press('Alt+x'); await page.waitForTimeout(80); log('  x ->', await T.toast(page))
  await page.keyboard.press('Control+Enter'); await page.waitForTimeout(100); await panels(['2', 'Enter', 'Enter', 'Enter'], 'pub')
  for (const id of ['R032', 'R033', 'R034', nid]) log('  after publish', await st(id))
  await setRole(page, 'purchasing'); await page.keyboard.press('1'); for (const id of ['R032', 'R033', 'R034', nid]) log('  purchasing sees', await cell(id))
  await page.keyboard.press('9'); log('  purchasing 9 has', nid, await page.locator(`[data-row-id="${nid}"]`).count())
  await setRole(page, 'pm'); log('  PM 7 rows', await page.evaluate(() => [...document.querySelectorAll('[data-row-id]')].map((x) => x.dataset.rowId + ':' + x.innerText.replace(/\s+/g, ' ').slice(0, 60)).join(' / ')))
  await shot(page, 't15_pm7')
  globalThis.nid = nid
})
await step('PM reject', async () => {
  const nid = globalThis.nid
  const target = (await page.evaluate(() => [...document.querySelectorAll('[data-row-id]')].map((x) => x.dataset.rowId))).find((x) => x !== 'R003')
  await sel(page, target); log('  hints on', target, await T.hints(page))
  await page.keyboard.press('Enter'); await page.waitForTimeout(80); log('  Enter ->', (await T.panelText(page))?.slice(0, 200)); await page.keyboard.press('Escape')
  await page.keyboard.press('Shift+Y'); await page.waitForTimeout(100)
  for (let i = 0; i < 3 && (await T.panel(page)); i++) { log('   panel', (await T.panelText(page))?.slice(0, 160)); await page.keyboard.insertText('理由なしテスト'); await page.keyboard.press('Enter'); await page.waitForTimeout(120) }
  log('  after Shift+Y', await T.toast(page))
  for (const id of ['R032', 'R033', 'R034', nid]) log('   ', await st(id))
  await setRole(page, 'purchasing'); await page.keyboard.press('1'); for (const id of ['R032', 'R033', 'R034', nid]) log('  purchasing sees', await cell(id))
  await setRole(page, 'design'); await page.keyboard.press('1'); for (const id of ['R032', 'R033', 'R034', nid]) log('  design sees', await cell(id))
  log('  design status hints', await T.hints(page), '| status', (await T.status(page)).replace(/\s+/g, ' ').slice(0, 200))
  await page.keyboard.press('4'); log('  design 4 rows', await page.evaluate(() => [...document.querySelectorAll('[data-row-id]')].map((x) => x.dataset.rowId).slice(0, 15).join(',')))
  // 却下のあと、設計がもう一度公開
  await page.keyboard.press('Control+Enter'); await page.waitForTimeout(100); await panels(['2', 'Enter', 'Enter'], 'republish')
  for (const id of ['R032', 'R033', 'R034', nid]) log('   ', await st(id))
  await setRole(page, 'pm'); await page.keyboard.press('7'); log('  PM 7 rows', await page.evaluate(() => [...document.querySelectorAll('[data-row-id]')].map((x) => x.dataset.rowId).join(',')))
  const t2 = (await page.evaluate(() => [...document.querySelectorAll('[data-row-id]')].map((x) => x.dataset.rowId))).find((x) => x !== 'R003')
  if (t2) { await sel(page, t2); await page.keyboard.press('y'); await page.waitForTimeout(100); for (let i = 0; i < 3 && (await T.panel(page)); i++) { log('   panel', (await T.panelText(page))?.slice(0, 160)); await page.keyboard.press('Enter'); await page.waitForTimeout(120) } log('  y ->', await T.toast(page)) }
  for (const id of ['R032', 'R033', 'R034', nid]) log('   ', await st(id))
  await page.keyboard.press('Control+z'); await page.waitForTimeout(100); log('  PM Ctrl+Z ->', await T.toast(page)); for (const id of ['R032', 'R033', 'R034', nid]) log('   ', await st(id))
})
save(errors); await browser.close()
