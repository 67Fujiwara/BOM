// ラウンド20: 必要日(前倒し) の正の値の警告（U19-01 の直し）を新人の打ち方で
// 7 / +7 / ７ / 7日 / -7 → 警告の出方（問題の一覧・Ctrl+. の直し・Alt+x で確認済み・公開できるか・購買の画面）
import { launch, fresh, T, makeLog, ui, sleep, shot, proj, setRole, sel, gotoCol, typeReal, palette, clearToast } from './lib.mjs'
import { probs } from './w15.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog(process.env.LOGNAME2 || 'r54_needoffset_ui')
const U = async (tag) => { const u = await ui(page); log(`  [${tag}] role=${u.role} mode=${u.mode} cur=${u.cursorRow}/${u.cursorCol} panel=${u.panel} | ${((await T.panelText(page)) ?? '').slice(0, 280)} | toast=${(await T.toast(page))?.slice(0, 240)}`) }
await fresh(page); await sleep(150)
await palette(page, '列の表示'); await page.keyboard.press('Enter'); await sleep(200)
await page.getByTestId('columns').locator('.opt', { hasText: '必要日(前倒し)' }).click(); await sleep(100); await page.keyboard.press('Escape'); await sleep(100)
const pr = (id) => page.evaluate(async (id) => { const f = (k) => performance.getEntriesByType('resource').map((e) => e.name).find((n) => n.includes(k)) ?? k; const s = (await import(f('/src/model/store.ts'))).useStore.getState(); const R = await import(f('/src/model/rules.ts')); const p = s.ws.projects.find((x) => x.id === s.ws.currentProjectId); const r = p.rows.find((x) => x.id === id); return `needOffset=${r.needOffset} ack=${JSON.stringify(r.ackRules)} | ` + R.checkRow(r, s.ws.rules, p).filter((x) => /needOffset/.test(x.ruleId + x.field)).map((x) => x.severity + ':' + x.message.slice(0, 90)).join(';') }, id)
for (const v of ['7', '+7', '1', '0', '-7']) {
  await sel(page, 'R039'); await gotoCol(page, '必要日(前倒し)'); await clearToast(page)
  await page.keyboard.press('Enter'); await page.keyboard.press('Control+a'); await page.keyboard.insertText(v); await page.keyboard.press('Enter'); await sleep(250)
  log(`「${v}」: toast=${(await T.toast(page))?.slice(0, 220)} | ${await pr('R039')}`)
}
log('== 7 に戻して、公開・Ctrl+. ・Alt+x')
await sel(page, 'R039'); await gotoCol(page, '必要日(前倒し)'); await page.keyboard.press('Enter'); await page.keyboard.press('Control+a'); await page.keyboard.insertText('7'); await page.keyboard.press('Enter'); await sleep(250)
await page.keyboard.press('Control+Enter'); await sleep(400); await U('Ctrl+Enter'); if (await T.panel(page)) { await page.keyboard.press('Escape'); await sleep(150) }
await sel(page, 'R039'); await gotoCol(page, '必要日(前倒し)'); await page.keyboard.press('Control+.'); await sleep(250); await U('Ctrl+.'); await shot(page, 'r54_fixpanel')
await page.keyboard.press('Escape'); await sleep(100)
await page.keyboard.press('Alt+x'); await sleep(250); await U('Alt+x'); log(await pr('R039'))
await page.keyboard.press('Control+Enter'); await sleep(400); await U('Ctrl+Enter 2'); if (await T.panel(page)) { await page.keyboard.press('Escape') }
log('published: ' + (await proj(page)).rows.filter((r) => r.id === 'R039').map((r) => `${r.id}:${r.status}:${r.publishedRev}`).join(' '))
await setRole(page, 'purchasing'); await sleep(250); await sel(page, 'R039'); await U('purchasing'); log('hints: ' + await T.hints(page))
save(errors); await browser.close()
