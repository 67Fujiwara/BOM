// v10: 調達区分ごとの扱い（§3.4）: 客先指定品・指定商社の見積・選定・発注
import { launch, check, log, summary } from './lib.mjs'
const t = await launch()
const { page } = t
await t.open('design')
let p = await t.proj()
const show = (id) => { const r = p.rows.find((x) => x.id === id); return `${id} ${r.procurement} designated=${r.designated} status=${r.status} adopted=${r.adoptedSupplierId ?? '-'} quotes=${JSON.stringify(p.quotes.filter((q) => q.rowId === id && !q.stale).map((q) => [q.supplierId, q.unitPrice]))}` }
log(show('R034')); log(show('R045'))
log('bulk →', await t.bulk())
p = await t.proj(); log(show('R034')); log(show('R045'))
check('M3 指定商社の行は指定先（S2）以外で採用されない', p.rows.find((x) => x.id === 'R045').adoptedSupplierId === 'S2' || !p.rows.find((x) => x.id === 'R045').adoptedSupplierId, show('R045'))
await t.press('1'); await t.goto('R045'); await t.press('Shift+A'); await page.waitForTimeout(60); log('Shift+A on 指定商社 →', JSON.stringify(await t.panel())?.slice(0, 60), await t.toast()); await t.press('Escape')
// 新しい行: 客先指定品と指定商社を追加して公開 → 購買の概算依頼
await t.goto('R080'); await t.press('Shift+Enter'); await page.waitForTimeout(60); await t.type('客先指定のリレー'); await t.press('Enter'); await page.waitForTimeout(60); await t.press('Escape')
p = await t.proj(); const nid = p.rows.at(-1).id === 'R080' ? p.rows[p.rows.findIndex((r) => r.id === 'R080') + 1]?.id : p.rows.find((r) => r.name === '客先指定のリレー')?.id
log('new row', nid)
await t.showCol('designated')
log(await t.setCellKey(nid, 'model', 'G2R-1 DC24')); log(await t.setCellKey(nid, 'maker', 'オムロン')); log(await t.setCellKey(nid, 'procurement', '客先指定品')); log(await t.setCellKey(nid, 'designated', 'オムロン / 客先承認 KS-1'))
await t.press('Control+Enter'); await page.waitForTimeout(100); let pn = await t.panel(); log('publish dialog', pn?.title); if (pn?.kind === 'prompt') { await t.press('1'); await page.waitForTimeout(100); if ((await t.panel())?.kind === 'prompt') { await page.keyboard.press('Enter'); await page.waitForTimeout(100) } }
log('publish →', await t.toast())
p = await t.proj(); log(show(nid))
await t.role('purchasing'); await t.cmd('概算見積を依頼'); await page.waitForTimeout(60); await t.press('Enter'); await page.waitForTimeout(800); log('request →', await t.toast())
p = await t.proj(); log(show(nid))
check('M3 客先指定品の行も指定先 1 社に概算見積を依頼する（§3.4・§7）', p.quotes.some((q) => q.rowId === nid && !q.stale), show(nid))
// 客先指定品の行を発注できるか（R034）
await page.getByTestId('view-3').click(); await page.locator('.gridwrap').focus(); await t.goto('R034'); await t.colKey('ordered'); await t.press('o'); await page.waitForTimeout(60); log('o R034 →', await t.toast())
await t.cmd('正式見積を依頼（社外）', '正式見積を依頼'); await page.waitForTimeout(100); pn = await t.panel(); await t.press('2'); await page.waitForTimeout(1500)
p = await t.proj(); log(show('R034'), 'header money', await t.money())
check('M3 客先指定品（R034）を正式見積依頼・発注まで進められる', p.rows.find((x) => x.id === 'R034').status !== 'selected' || p.rows.find((x) => x.id === 'R034').ordered, show('R034'))
summary(); await t.close()
