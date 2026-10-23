import { launch, check, log } from './lib.mjs'
import ExcelJS from 'exceljs'
import fs from 'node:fs'
const t = await launch()
const { page } = t
await t.open('design')
let p = await t.proj()
const flags = async (id) => { const r = await t.row(id); return `${r.status} ${JSON.stringify(Object.fromEntries(Object.entries(r.flags).filter(([, v]) => v)))} adopted=${r.adoptedSupplierId ?? '-'} oq=${r.orderQty}` }
for (const id of ['R010', 'R012', 'R014']) { await t.goto(id); await t.press('a'); await page.waitForTimeout(30) }
await t.role('purchasing'); await t.cmd('正式見積を依頼（社外）', '正式見積を依頼'); await t.press('2'); await page.waitForTimeout(1200); log('formal →', await t.toast())
await t.role('design'); await t.goto('R016'); await t.press('a'); await page.waitForTimeout(30); log('R016', await flags('R016'))
await t.role('purchasing'); await t.press('3'); await t.showCol('orderQty').catch((e) => log('showCol err', e.message)); await t.press('3')
await t.setCellKey('R016', 'orderQty', '50'); log('R016 orderQty manual →', await flags('R016'), await t.toast())
// 設計の変更
await t.role('design'); await t.press('1')
p = await t.proj()
const qtyRow = p.rows.find((r) => r.status === 'quoted' && r.qtyNeeded >= 10 && !r.adoptedSupplierId)
const r21 = p.rows.find((r) => r.id === 'R021')
log('qtyRow', qtyRow.id, qtyRow.qtyNeeded, 'R021 model', r21.model)
await t.setCell('R020', '型式', 'XYZ-NEW-1')
await t.setCell('R021', '型式', r21.model.toLowerCase().replace(/-/g, ' '))
await t.setCell('R024', '必要数', String((p.rows.find((r) => r.id === 'R024').qtyNeeded) * 2))
await t.setCell(qtyRow.id, '必要数', String(Math.round(qtyRow.qtyNeeded * 1.1)))
await t.setCell('R016', '必要数', String(p.rows.find((r) => r.id === 'R016').qtyNeeded + 1))
await t.showCol('needOffset'); await t.press('1')
log('before offset: cursor', await t.cursor(), 'headers has 前倒し:', (await page.locator('thead th').allTextContents()).includes('必要日(前倒し)'))
await t.goto('R010'); await t.colKey('needOffset'); log('cursor at', await t.cursor(), 'status', (await t.row('R010')).status); await t.press('Enter'); log('mode', await page.getByTestId('mode').textContent()); await page.keyboard.press('Control+a'); await page.keyboard.type('-5'); await t.press('Enter')
log('R010 needOffset set →', await t.toast(), JSON.stringify((await t.row('R010')).working))
await t.setCell('R012', '必要数', String(p.rows.find((r) => r.id === 'R012').qtyNeeded + 1))
log('design status:', (await t.status()).slice(0, 80))
// 購買から見える値
await t.role('purchasing'); await t.press('1')
const r20m = await t.cell('R020', 'model'); const r10nd = await t.cell('R010', 'needDate'); const r24amt = await t.cell('R024', 'status')
log('purchasing sees R020 model:', r20m, '| R010 needDate:', r10nd, '| R024 status:', r24amt)
check('S5 購買には R020 の作業中の型式が見えない', !/XYZ-NEW/.test(r20m), r20m)
await t.role('design'); await t.press('1'); const r10ndD = await t.cell('R010', 'needDate'); await t.role('purchasing'); await t.press('1')
check('S5 購買の必要日（R010）は公開済の値（設計の作業中 -5 日を反映しない）', r10nd !== r10ndD, `purchasing=${r10nd} design=${r10ndD}`)
// Space の内訳（必要数）
await t.goto('R024'); await t.press(' '); const det = (await page.getByTestId('detail').textContent()).slice(0, 80); log('purchasing detail R024:', det); await t.press('Escape')
const r24pub = (await t.row('R024')).qtyNeeded
check('S5 購買の Space 内訳の必要数は公開済の値', det.includes(`必要数 ${r24pub}`), `pub=${r24pub} detail=${det}`)
// 購買の Excel 出力（社内）に作業中の値が出ないか
await t.press('Control+e'); await page.waitForTimeout(80); log('export panel:', (await page.getByTestId('quickfix').textContent().catch(() => '')).slice(0, 200))
const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 6000 }).catch(() => null), t.press('1')])
if (dl) { const f = 'usertest/mid/r2/shots/s5-purchasing-export.xlsx'; await dl.saveAs(f); const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(f); const sh = wb.getWorksheet('BOM'); let found = ''; sh.eachRow((row) => { if (row.getCell(1).value === 'R020') found = String(row.getCell(6).value) }); log('purchasing Excel R020 model:', found); check('S5 購買の Excel 出力に設計の作業中の型式が出ない', !/XYZ-NEW/.test(found), found) }
// 取消・置換
await t.role('design')
await t.goto('R030'); await t.press('Shift+Delete'); await page.waitForTimeout(50); log('Shift+Delete →', await t.toast(), await flags('R030'))
await t.goto('R031'); await t.press('r'); await page.waitForTimeout(80); log('r →', await t.toast(), 'cursor', await t.cursor(), 'dialog', (await t.dialog()).slice(0, 80))
p = await t.proj(); const nr = p.rows.find((r) => r.replaces === 'R031'); log('replace new row:', nr?.id, nr?.status, JSON.stringify(nr?.flags), 'old R031:', p.rows.find((r) => r.id === 'R031').status)
log('mode after r:', await page.getByTestId('mode').textContent())
if (nr) { if ((await page.getByTestId('mode').textContent()) === '編集') { await page.keyboard.press('Control+a'); await page.keyboard.type('NEW-MODEL-31'); await t.press('Enter') } else await t.setCell(nr.id, '型式', 'NEW-MODEL-31') }
log('R081 after model:', JSON.stringify(await t.row(nr.id).then(r => ({ model: r.model, w: r.working, st: r.status }))))
// 公開
const before = (await t.proj()).submissions.length
for (let k = 0; k < 6; k++) { await t.press('Control+Enter'); await page.waitForTimeout(80); const tt = await t.toast(); if (/未確認の警告/.test(tt)) { const id = tt.match(/（(R\d+)/)[1]; log('warn gate:', tt.slice(0, 80)); if ((await page.getByTestId('mode').textContent()) === '編集') await t.press('Escape'); await t.goto(id); await t.colKey('model'); await t.press('x'); await page.waitForTimeout(40); log('  x →', await t.toast(), 'ack', JSON.stringify((await t.row(id)).ackRules)) } else break }
let dlg = await t.dialog(); log('publish dlg:', dlg.slice(0, 120))
if (/変更セット/.test(dlg)) { await t.press('ArrowDown'); await page.getByTestId('prompt-text').fill('ECN-2026-001'); await t.press('Enter'); await page.waitForTimeout(100) }
dlg = await t.dialog(); if (/Rev/.test(dlg)) { log('rev dlg', dlg.slice(0, 60)); await t.press('Enter'); await page.waitForTimeout(80) }
log('publish →', await t.toast())
p = await t.proj()
log('subs:', p.submissions.slice(before).map((s) => `Rev${s.rev} rows=${s.rowIds.join('/')} cs=${JSON.stringify(s.changeSet)} sum=${JSON.stringify(s.summary)}`))
for (const id of ['R020', 'R021', 'R024', qtyRow.id, 'R016', 'R010', 'R012', 'R030', nr?.id]) log(' ', id, await flags(id))
check('S5 R020 型式変更（見積済）→ 再見積要', (await t.row('R020')).flags.requote === true)
check('S5 R021 表記だけ → 表記修正', (await t.row('R021')).flags.notation === true)
check('S5 R024 必要数 ×2（±20% 超）→ 再見積要', (await t.row('R024')).flags.requote === true)
check('S5 R016 必要数変更・発注数を手で変えていた → 発注数要確認', (await t.row('R016')).flags.orderQtyCheck === true)
check('S5 R010 正式依頼中で必要日変更 → 再発行', (await t.row('R010')).flags.reissue === true)
check('S5 R012 正式依頼中で数量変更 → 再発行＋再見積要', (await t.row('R012')).flags.reissue === true && (await t.row('R012')).flags.requote === true)
log('R016 orderQty after:', (await t.row('R016')).orderQty)
// 購買の 5 と 8
await t.role('purchasing'); await t.press('5')
const v5 = await page.locator('[data-row-id]').evaluateAll((els) => els.map((e) => e.getAttribute('data-row-id')))
log('purchasing 5:', v5.join(','), 'cols:', (await page.locator('thead th').allTextContents()).join('|'))
await t.press('8'); log('view8 toolbar:', await page.locator('.toolbar').textContent(), 'count', await t.viewCount(8))
check('S5 8 に「再発行 n 行」が出る', /再発行/.test(await page.locator('.toolbar').textContent()))
await t.press('9'); const v9 = await page.locator('[data-row-id]').evaluateAll((els) => els.map((e) => e.getAttribute('data-row-id'))); log('9 has R020/R024/R012:', ['R020', 'R024', 'R012'].map((x) => v9.includes(x)))
await t.press('4'); const pv4 = await page.locator('[data-row-id]').evaluateAll((els) => els.map((e) => e.getAttribute('data-row-id'))); log('purchasing 4:', pv4.join(','))
check('S5 購買の 4 に発注数要確認（R016）', pv4.includes('R016'))
// x で表記修正・発注数を確認
await t.press('1'); await t.goto('R021'); log('R021 x hint:', (await t.status()).match(/x[^?]{0,20}/)?.[0]); await t.press('x'); await page.waitForTimeout(40); log('x R021 →', await t.toast(), await flags('R021'))
await t.goto('R016'); log('R016 x hint:', (await t.status()).match(/x[^?]{0,20}/)?.[0]); await t.press('x'); await page.waitForTimeout(40); log('x R016 →', await t.toast(), await flags('R016'))
// 再見積要: Ctrl+. 据え置き
await t.goto('R024'); await t.press('Control+.'); log('R024 quickfix:', await page.getByTestId('quickfix').textContent().catch(() => t.toast())); await t.press('1'); await page.waitForTimeout(40); log('据え置き →', await flags('R024'))
// 公開後の Ctrl+Z（設計）
await t.role('design'); const nsub = (await t.proj()).submissions.length
await t.press('Control+z'); await page.waitForTimeout(80); log('design Ctrl+Z after publish →', await t.toast())
p = await t.proj(); log('subs after undo:', p.submissions.length, '(before', nsub, ') R020 working:', JSON.stringify(p.rows.find((r) => r.id === 'R020').working), 'status:', (await t.status()).slice(0, 60))
check('S5 公開後の Ctrl+Z で Rev は消えず、未公開として積まれる', p.submissions.length === nsub && !!p.rows.find((r) => r.id === 'R020').working)
await t.shot('s5-after-undo')
log('ERRORS:', t.errors, 'paletteMiss:', t.paletteMiss)
await t.close()
