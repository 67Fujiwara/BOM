// ラウンド13: ガイドで作った BOM の最初の Ctrl+Enter（理由のダイアログが出ない）→ 新人は 2 回目以降と同じく 1 → Tab → 番号 → Enter と打つ
import { launch, fresh, T, makeLog, shot, ui, typeReal, proj, sleep, palette } from './lib.mjs'
const { browser, page, errors } = await launch()
const { log, save } = makeLog('v12_first_publish')
await fresh(page); await palette(page, '新しいBOM'); await page.keyboard.press('Enter'); await page.getByTestId('wizard').waitFor()
for (let i = 0; i < 7; i++) { await page.keyboard.press('Enter'); await sleep(40) }
await page.keyboard.press('1'); await sleep(80)
await page.getByTestId('wizard-paste').fill('品名\t型式\tメーカー\t数量\nリレー\tMY4N-D2\tオムロン\t4\nタイマ\tH3CR-A8\tオムロン\t2\n端子台\tTB-12\tIDEC\t3')
await page.keyboard.press('Control+Enter'); await sleep(200); await page.keyboard.press('Enter'); await sleep(300)
log('created: ' + (await T.toast(page)) + ' cursor=' + (await T.cursor(page)))
for (const k of ['Control+Enter', '1', 'Tab', 't:ECN-2026-03', 'Enter']) {
  if (k.startsWith('t:')) await typeReal(page, k.slice(2)); else await page.keyboard.press(k)
  await sleep(120); const u = await ui(page); log(`  [${k}] mode=${u.mode} view=${u.view} cur=${u.cursorRow}/${u.cursorCol} edit=${JSON.stringify(u.editValue)} panel=${u.panel} toast=${await T.toast(page)}`)
}
const p = await proj(page)
log('rows: ' + p.rows.map((r) => `${r.id}:${r.status}:${r.name}/${r.model} working=${JSON.stringify(r.working ?? null)}`).join(' | '))
log('subs: ' + JSON.stringify(p.submissions.map((s) => ({ rev: s.rev, changeSet: s.changeSet }))))
await shot(page, 'v12_first_publish')
save(errors); await browser.close()
