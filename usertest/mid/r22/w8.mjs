// w8: 発注済の行の代替品検討（§9.1 末尾）: 納期NG(発注済) d → 設計が回答に候補 → 購買が発注後変更依頼 → PM 承認 → 購買が取消 → 設計が r
import { launch, check, log, summary } from './lib.mjs'
const t = await launch()
const { page } = t
await t.open('design')
log('bulk →', await t.bulk())
await t.role('purchasing'); log('formal →', await t.requestFormal())
let p = await t.proj()
const id = p.rows.find((r) => r.status === 'formalRequested' && !r.flags.leadNG && !r.flags.contested).id
const r0 = p.rows.find((r) => r.id === id); const q0 = p.quotes.find((q) => q.rowId === id && q.supplierId === r0.adoptedSupplierId && !q.stale)
await t.press('8'); log(await t.setCellKey(id, 'q.formalPrice@A', String(q0.unitPrice))); await t.press('Escape'); await t.press('Escape')
await page.getByTestId('view-3').click(); await page.locator('.gridwrap').focus(); log('o →', await t.order(id))
await t.showCol('promisedDate'); log(await t.setCellKey(id, 'promisedDate', '2026-12-20')); await t.press('Escape')
p = await t.proj(); log(id, p.rows.find((r) => r.id === id).status, JSON.stringify(p.rows.find((r) => r.id === id).flags))
await t.role('pm'); await t.press('7'); let res = await t.decide(id, 'd', '代替品を検討'); log('PM d (ordered) →', res.toast, JSON.stringify(res.panel?.options))
p = await t.proj(); log('issues', p.issues.filter((i) => i.rowId === id).map((i) => `${i.id}:${i.kind}:${i.status}`))
// 設計: 回答に候補
await t.role('design'); await t.press('1'); await t.goto(id); await t.press(' '); await t.press('ArrowDown'); await t.press('Enter'); await page.waitForTimeout(80); log('design panel', JSON.stringify((await t.panel())?.options))
await t.press('2'); await page.waitForTimeout(60); await t.promptFill('代替候補: XYZ-123（オムロン）'); await page.getByTestId('prompt-text').press('Enter'); await page.waitForTimeout(80); await t.press('Escape'); await t.press('Escape')
// 購買: 発注後変更依頼
await t.role('purchasing'); await t.press('1'); await t.goto(id); await t.press('Shift+I'); await t.press('h'); await page.waitForTimeout(60); await page.getByTestId('issue-text').fill('発注を取消して XYZ-123 に切替えたい'); await page.getByTestId('issue-text').press('Enter'); await page.waitForTimeout(60)
log('issue publish →', await t.publish())
p = await t.proj(); log('issues', p.issues.filter((i) => i.rowId === id).map((i) => `${i.id}:${i.kind}:${i.status}`), 'ball', await t.cellText(id, 'ball'))
// PM: 7 に発注後変更依頼が載るか・承認できるか
await t.role('pm'); await t.press('7'); const v7 = await t.viewRows(); log('PM 7 has row?', v7.includes(id))
await t.goto(id); await t.press('Enter'); await page.waitForTimeout(80); log('PM Enter →', JSON.stringify(await t.panel())?.slice(0, 250), await t.toast()); if (await t.panel()) await t.press('Escape')
await t.goto(id); await t.press('y'); await page.waitForTimeout(80); log('PM y →', JSON.stringify(await t.panel())?.slice(0, 150), await t.toast()); if (await t.panel()) await t.press('Escape')
// 購買: 取消（発注取消）
await t.role('purchasing'); await t.press('1'); await t.goto(id); await t.press('Shift+Delete'); await page.waitForTimeout(60); log('purchasing Shift+Delete →', await t.toast())
await t.cmd('取消', '取消'); await page.waitForTimeout(80); log('palette 取消 →', JSON.stringify(await t.panel())?.slice(0, 100), await t.toast()); if (await t.panel()) await t.press('Escape')
await t.press('3'); await t.goto(id); await t.colKey('ordered'); await t.press('o'); await page.waitForTimeout(60); log('purchasing o (un-order) →', await t.toast(), (await t.row(id)).status)
await t.role('design'); await t.press('1'); log('design r →', await t.replace(id, 'XYZ-123'))
p = await t.proj(); log(id, p.rows.find((r) => r.id === id).status, 'replaced by', p.rows.find((r) => r.replaces === id)?.id)
summary(); await t.close()
