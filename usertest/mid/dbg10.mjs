import { launch, check, log } from './lib.mjs'
const t = await launch()
const { page } = t
await t.open('purchasing')
// 見積中の行を作る: 設計が新規行を追加して公開 → 購買が依頼
await t.role('design'); await t.press('1'); await t.goto('R075'); await t.press('Shift+Enter'); await page.waitForTimeout(50); await t.type('追加リレー'); await t.press('Tab'); await t.press('Enter'); await t.type('MY2N-D2 DC24'); await t.press('Tab'); await t.press('Enter'); await t.type('オムロン'); await t.press('Enter'); await page.waitForTimeout(50)
let p = await t.proj(); const nid = p.rows.find((r) => r.name === '追加リレー')?.id; log('new row:', nid, p.rows.find((r) => r.id === nid)?.model, p.rows.find((r) => r.id === nid)?.maker)
await t.press('Control+Enter'); await page.waitForTimeout(100); let d = await page.locator('[role=dialog]').textContent().catch(() => ''); if (/変更セット/.test(d)) { await t.press('2'); await page.waitForTimeout(80); d = await page.locator('[role=dialog]').textContent().catch(() => '') } if (/Rev/.test(d)) await t.press('1'); await page.waitForTimeout(100); log('publish:', (await t.status()).match(/行 \d+[^E]*|公開できません[^E]*/)?.[0])
await t.role('purchasing'); await t.press('Control+k'); await page.getByTestId('palette-input').fill('概算見積を依頼'); await t.press('Enter'); await page.waitForTimeout(50); await page.getByTestId('prompt-text').fill('2026-10-29'); await t.press('Enter'); await page.waitForTimeout(400); log('request:', await t.toast())
log(nid, 'status cell:', await t.cell(nid, 'status'))
// 2 社だけ回答 → 見積完了条件 deadline（期限前）なので見積中のまま、a は灰色
await t.press('6'); await t.setCellKey(nid, 'q.unitPrice@S1', '800'); await t.setCellKey(nid, 'q.unitPrice@S2', '820'); await t.press('1')
log(nid, 'after 2 answers:', await t.cell(nid, 'status'))
check('DBG 回答 2/3 で見積中 2/3 と表示', /見積中 2\/3/.test(await t.cell(nid, 'status')), await t.cell(nid, 'status'))
await t.role('design'); await t.goto(nid); await t.press('a'); await page.waitForTimeout(50); log('a on quoting →', await t.toast())
check('DBG 見積中の a は「回答 2/3 待ち」', /回答 2\/3 待ち/.test(await t.toast()), await t.toast())
await t.press('Shift+A'); await page.waitForTimeout(50); log('Shift+A on quoting panel:', await page.getByTestId('adopt').textContent().catch(() => 'none')); await t.press('1'); await page.waitForTimeout(50); log('prompt:', (await page.locator('[role=dialog]').textContent().catch(() => '')).slice(0, 50)); await t.press('1'); await page.waitForTimeout(50)
log('先行採用 →', await t.toast(), await t.cell(nid, 'status'), JSON.stringify((await t.row(nid)).flags))
await t.role('pm'); await t.press('7'); await t.goto(nid); await t.press('Enter'); log('panel:', await page.getByTestId('quickfix').textContent()); await t.press('y'); await page.waitForTimeout(50); if (await page.getByTestId('extra-承認者').count()) { await page.getByTestId('extra-承認者').fill('部長'); await page.getByTestId('extra-決裁書No').fill('K-1') } await page.getByTestId('prompt-text').fill('ok'); await t.press('Enter'); await page.waitForTimeout(80)
log('y →', await t.toast(), (await t.row(nid)).status, (await t.row(nid)).adoptedSupplierId, JSON.stringify((await t.row(nid)).flags))
check('DBG 先行採用の許可 → 選んだ商社のまま選定済＋先行', (await t.row(nid)).status === 'selected' && (await t.row(nid)).adoptedSupplierId === 'S1' && (await t.row(nid)).flags.early === true)
// 見積完了条件 min2
await t.role('purchasing'); await t.press('Control+k'); await page.getByTestId('palette-input').fill('案件設定'); await t.press('Enter'); await page.waitForTimeout(80)
for (let i = 0; i < 12; i++) await t.press('ArrowDown')
log('settings row 12:', (await page.getByTestId('settings').locator('.opt').nth(12).textContent()))
await t.press('Enter'); await page.getByTestId('settings-input').fill('min2'); await t.press('Enter'); await t.press('Control+Enter'); await page.waitForTimeout(80); await page.getByTestId('prompt-text').fill('2社で締め'); await t.press('Enter'); await page.waitForTimeout(100)
log('rule:', (await t.proj()).settings.quoteCompleteRule)
// 新しい見積中の行で 2 社回答 → 見積済？
await t.role('design'); await t.goto(nid); await t.press('Shift+Enter'); await t.type('追加2'); await t.press('Tab'); await t.press('Enter'); await t.type('MY2N-D2 DC12'); await t.press('Tab'); await t.press('Enter'); await t.type('オムロン'); await t.press('Enter'); await page.waitForTimeout(50)
const nid2 = (await t.proj()).rows.find((r) => r.name === '追加2')?.id
await t.press('Control+Enter'); await page.waitForTimeout(100); d = await page.locator('[role=dialog]').textContent().catch(() => ''); if (/Rev/.test(d)) await t.press('1'); await page.waitForTimeout(100)
await t.role('purchasing'); await t.press('6'); await t.setCellKey(nid2, 'q.unitPrice@S1', '800'); await t.setCellKey(nid2, 'q.unitPrice@S2', '820'); await t.press('1')
log(nid2, 'min2 after 2 answers:', await t.cell(nid2, 'status'))
check('DBG 見積完了条件 n社以上(2) で 2 社回答 → 見積済', /^見積済/.test(await t.cell(nid2, 'status')), await t.cell(nid2, 'status'))
// 5 ビューの x（差分確認）と < >
await t.press('5'); log('view5 count:', await t.viewCount(5), 'filter:', await page.getByTestId('rev-filter').textContent()); const first = (await page.locator('[data-row-id]').first().getAttribute('data-row-id')); await t.goto(first); await t.press('x'); await page.waitForTimeout(50); log('x on 5 →', await t.toast(), 'count now:', await t.viewCount(5))
await t.press('<'); log('< :', await page.getByTestId('rev-filter').textContent(), await t.viewCount(5)); await t.press('<'); log('< :', await page.getByTestId('rev-filter').textContent(), await t.viewCount(5))
// 再見積要 → Ctrl+. 2 再見積 → 依頼フロー
await t.role('design'); await t.setCell('R020', '型式', 'S-T21 AC100V'); await t.press('Control+Enter'); await page.waitForTimeout(100); d = await page.locator('[role=dialog]').textContent().catch(() => ''); if (/変更セット/.test(d)) { await t.press('2'); await page.waitForTimeout(80) } d = await page.locator('[role=dialog]').textContent().catch(() => ''); if (/Rev/.test(d)) await t.press('1'); await page.waitForTimeout(100)
await t.role('purchasing'); await t.press('9'); await t.goto('R020'); log('R020:', await t.cell('R020', 'status')); await t.press('Control+.'); await t.press('2'); await page.waitForTimeout(50); log('再見積 →', (await page.locator('[role=dialog]').textContent().catch(() => '')).slice(0, 40)); await page.getByTestId('prompt-text').fill('2026-10-30'); await t.press('Enter'); await page.waitForTimeout(400); log('→', await t.toast(), await t.cell('R020', 'status').catch(() => '-'), JSON.stringify((await t.row('R020')).flags))
check('DBG 再見積要 → Ctrl+. 2 再見積 → 見積中', (await t.row('R020')).status === 'quoting')
// h / s / f / c
await t.press('1'); await t.goto('R030'); await t.press('h'); log('h →', (await t.row('R030')).hidden, 'view1 rows:', await t.rowCount()); await t.press('2'); log('view2 rows (hidden excluded):', await t.rowCount()); await t.press('1'); await t.goto('R030'); await t.press('h')
await t.goto('R005'); await t.col('必要数'); await t.press('s'); log('sort chip:', await page.locator('.toolbar').textContent()); const firstRow = await page.locator('[data-row-id]').first().getAttribute('data-row-id'); log('first after sort asc:', firstRow, await t.cell(firstRow, 'qtyNeeded')); await t.press('s')
await t.goto('R005'); await t.col('メーカ'); await t.press('f'); log('filter chip:', (await page.locator('.toolbar').textContent()).slice(0, 60), 'rows:', await t.rowCount()); await t.press('f')
log('ERRORS:', t.errors)
await t.close()
