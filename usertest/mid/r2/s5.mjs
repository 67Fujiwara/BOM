import { launch, check, log } from './lib.mjs'
const t = await launch()
const { page } = t
await t.open('design')
let p = await t.proj()
const st = (id) => t.row(id)
// 1) 見積済の行の型式変更（指摘対応でない）
await t.setCell('R005', '型式', 'MY4N-D2 DC12')
log('R005 cell:', await t.cell('R005', 'status'), 'ball:', await t.cell('R005', 'ball'), 'bar:', (await t.status()).match(/未公開 \d+ 行/)?.[0])
check('S5 編集で 作業中● が付き設計のボール', /作業中●/.test(await t.cell('R005', 'status')) && (await t.cell('R005', 'ball')) === '設計')
// 購買から見ると値は旧のまま？
await t.role('purchasing'); log('purchasing sees R005 model:', await t.cell('R005', 'model'), 'status:', await t.cell('R005', 'status')); await t.role('design')
// 2) 選定済の行の型式変更
await t.setCell('R001', '型式', 'FX5U-32MT/ES')
// 3) 数量 +50%（見積済）
await t.setCell('R006', '必要数', '18')
// 4) 数量 +10%（閾値内）
await t.setCell('R014', '必要数', '1')  // 変更なし（同値）→ R015 で +10%
await t.setCell('R015', '必要数', '1')
// 5) 表記だけ（正式見積済 R013: 全角→半角相当。空白追加）
await t.setCell('R013', '型式', 's8vk-g12024')
// 6) 正式見積済の数量変更 R013 → もう型式変えたので R003（選定済）の必要日
await t.showCol('needOffset'); await t.setCellKey('R003', 'needOffset', '-5')
// 7) 客先承認要の行の型式変更
await t.setCell('R007', '代替可否', '客先承認要')
await t.setCell('R007', '型式', 'H3CR-A8 AC24')
// 8) Shift+Delete（公開済の行）→ 取消
await t.goto('R010'); await t.press('Shift+Delete'); await page.waitForTimeout(50)
log('R010 after Shift+Delete:', (await st('R010')).status, 'toast:', await t.toast())
check('S5 公開済の行の Shift+Delete は取消状態', (await st('R010')).status === 'cancelled')
await t.role('purchasing'); log('purchasing sees R010 immediately:', await t.cell('R010', 'status').catch(() => 'hidden')); await t.role('design')
// 9) r 置換 R011
await t.goto('R011'); await t.press('r'); await page.waitForTimeout(50)
log('r →', await t.cursor(), 'mode:', await page.getByTestId('mode').textContent())
await t.press('Control+a'); await t.type('CLIPFIX 35-5'); await t.press('Enter')
p = await t.proj(); const rep = p.rows.find((r) => r.replaces === 'R011')
log('replacement:', rep?.id, rep?.status, rep?.model, JSON.stringify(rep?.flags), 'quotes copied:', p.quotes.filter((q) => q.rowId === rep?.id).length, 'R011:', p.rows.find((r) => r.id === 'R011').status)
log('status bar:', (await t.status()).match(/未公開 \d+ 行/)?.[0])
await t.shot('s5-01-before-publish')
// 公開 → 変更理由
await t.press('Control+Enter'); await page.waitForTimeout(100)
let dlg = await page.locator('[role=dialog]').textContent().catch(() => '')
log('publish dialog:', dlg.slice(0, 200))
check('S5 変更セットの理由を公開単位で 1 回聞く', /変更セット/.test(dlg) && /客先要求/.test(dlg))
check('S5 変更番号を入力できる欄がある', (await page.getByTestId('prompt-text').count()) > 0)
await t.press('2'); await page.waitForTimeout(100)
dlg = await page.locator('[role=dialog]').textContent().catch(() => ''); if (dlg) { log('dlg2:', dlg.slice(0, 80)); await t.press('1'); await page.waitForTimeout(100) }
log('publish →', await t.toast(), '| bar:', (await t.status()).slice(0, 160))
p = await t.proj()
log('submissions:', p.submissions.map((s) => `Rev${s.rev} ${s.rowIds.join('/')} cs=${JSON.stringify(s.changeSet)} causes=${JSON.stringify(s.causes)}`))
for (const id of ['R005', 'R001', 'R006', 'R015', 'R013', 'R003', 'R007', 'R010', 'R011', rep?.id]) { const r = p.rows.find((x) => x.id === id); log(id, r.status, 'adopted=', r.adoptedSupplierId, 'flags=', JSON.stringify(r.flags), 'cause=', r.lastChangeCause) }
check('S5 R005 型式変更 → 再見積要', p.rows.find((r) => r.id === 'R005').flags.requote === true)
check('S5 R006 数量 +50% → 再見積要', p.rows.find((r) => r.id === 'R006').flags.requote === true)
check('S5 R015 数量 同値 → 再見積要なし', !p.rows.find((r) => r.id === 'R015').flags.requote)
check('S5 R013 表記だけ → 表記修正（正式見積は有効のまま）', p.rows.find((r) => r.id === 'R013').flags.notation === true && !p.rows.find((r) => r.id === 'R013').flags.requote)
check('S5 R003 必要日変更（選定済）→ 再発行なし', !p.rows.find((r) => r.id === 'R003').flags.reissue)
check('S5 R007 客先承認要の型式変更 → 代替承認待ち', p.rows.find((r) => r.id === 'R007').flags.altPending === true)
check('S5 R001 選定済の型式変更後も採用商社と状態が整合（採用なしの選定済にならない）', !(p.rows.find((r) => r.id === 'R001').status === 'selected' && !p.rows.find((r) => r.id === 'R001').adoptedSupplierId))
check('S5 取消行が公開 Rev の差分に載る', p.submissions.some((s) => s.causes['R010'] === '取消'))
// 購買: 9 / 5 で Ctrl+. 据え置き
await t.role('purchasing')
await t.press('9'); const v9 = await page.locator('[data-row-id]').evaluateAll((els) => els.map((e) => e.getAttribute('data-row-id')))
log('view9:', v9.filter((x) => ['R001', 'R005', 'R006'].includes(x)).join(','))
await t.press('5'); log('view5 cols:', (await page.locator('thead th').allTextContents()).join('|'))
const v5 = await page.locator('[data-row-id]').evaluateAll((els) => els.map((e) => e.getAttribute('data-row-id')))
log('view5:', v5.join(','))
check('S5 購買の 5 に取消 R010 が出る', v5.includes('R010'))
await t.goto('R001'); await t.press('Control+.'); const qf = await page.getByTestId('quickfix').textContent(); log('R001 quickfix:', qf)
await t.press('1'); await page.waitForTimeout(50)
log('据え置き →', await t.toast(), 'R001:', (await st('R001')).status, 'adopted=', (await st('R001')).adoptedSupplierId, JSON.stringify((await st('R001')).flags), 'cell:', await t.cell('R001', 'status').catch(() => '-'), 'amount:', await t.cell('R001', 'amount').catch(() => '-'))
check('S5 据え置き後の R001 は採用商社つきで金額が出る', !!(await st('R001')).adoptedSupplierId)
await t.press('1'); await t.goto('R001'); await t.press('a'); await page.waitForTimeout(50); log('a on R001 →', await t.toast())
// 要再確認 (置換行) の商社ごと 1/2/3
await t.press('4'); const v4 = await page.locator('[data-row-id]').evaluateAll((els) => els.map((e) => e.getAttribute('data-row-id'))); log('purchasing 4:', v4.join(','))
await t.goto(rep.id); await t.press('Control+.'); const qf2 = await page.getByTestId('quickfix').textContent(); log(rep.id, 'quickfix:', qf2)
check('S5 置換行で商社ごとに 1 据え置き / 2 再見積 が選べる', /据え置き/.test(qf2) && /再見積/.test(qf2), qf2)
if (/据え置き/.test(qf2)) { for (let i = 0; i < 3; i++) { await t.press('1'); await page.waitForTimeout(50); await t.goto(rep.id); await t.press('Control+.'); const q = await page.getByTestId('quickfix').textContent(); log('  →', (await st(rep.id)).status, JSON.stringify((await st(rep.id)).flags), q.slice(0, 60)); if (!/据え置き/.test(q)) { await t.press('Escape'); break } } }
log(rep.id, 'final:', (await st(rep.id)).status, JSON.stringify((await st(rep.id)).flags), 'cell:', await t.cell(rep.id, 'status').catch(() => '-'))
check('S5 全商社を据え置きにした置換行は見積済になる', (await st(rep.id)).status === 'quoted', (await st(rep.id)).status)
// R013 表記修正の x
await t.press('1'); await t.goto('R013'); log('R013 hint:', (await t.status()).match(/x[^?]*/)?.[0]); await t.press('x'); await page.waitForTimeout(50); log('x →', JSON.stringify((await st('R013')).flags))
// 発注数要確認: 購買が R009 の発注数を手で変える → 設計が必要数を変えて公開
await t.role('design'); await t.goto('R017'); await t.press('a'); await page.waitForTimeout(50); log('adopt R017 →', await t.toast(), 'orderQty:', (await st('R017')).orderQty)
await t.role('purchasing'); await t.showCol('orderQty'); await t.setCellKey('R017', 'orderQty', '5'); log('R017 orderQty set:', (await st('R017')).orderQty)
await t.role('design'); await t.setCell('R017', '必要数', '3'); await t.press('Control+Enter'); await page.waitForTimeout(100); dlg = await page.locator('[role=dialog]').textContent().catch(() => ''); if (/変更セット/.test(dlg)) { await t.press('2'); await page.waitForTimeout(80) } dlg = await page.locator('[role=dialog]').textContent().catch(() => ''); if (/Rev/.test(dlg)) await t.press('1'); await page.waitForTimeout(100)
log('R017 after qty publish:', JSON.stringify((await st('R017')).flags), 'orderQty', (await st('R017')).orderQty, (await t.status()).slice(0, 120))
check('S5 購買が手で変えた発注数 → 必要数公開で発注数要確認', (await st('R017')).flags.orderQtyCheck === true)
await t.shot('s5-02-after')
log('ERRORS:', t.errors)
await t.close()
