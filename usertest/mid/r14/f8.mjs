// f8: 隠した行に対するパレットの行の操作（カーソルは別の行・別のビュー）
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
const t = await launch(); const { page } = t; const h = helpers(t)
await t.open('design'); log('bulk →', await t.bulk())
await t.role('purchasing'); log('formal →', await t.requestFormal())
let p = await t.proj()
const fr = p.rows.filter((r) => r.status === 'formalRequested' && !r.flags.leadNG && !r.flags.contested)
const H = fr[0].id, C = fr[1].id
for (const id of [H, C]) { const q = p.quotes.find((x) => x.rowId === id && x.supplierId === p.rows.find((r) => r.id === id).adoptedSupplierId && !x.stale); await t.press('8'); await t.setCellKey(id, 'q.formalPrice@A', String(q.unitPrice)); await t.press('Escape') }
async function palRun(q, lab) { await page.locator('.gridwrap').focus(); await page.keyboard.press('Control+k'); await page.getByTestId('palette-input').fill(q); await page.waitForTimeout(150); const items = await page.getByTestId('palette-list').locator('.item').allTextContents(); const i = items.findIndex((x) => x.includes(lab)); for (let k = 0; k < i; k++) await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter'); await page.waitForTimeout(200); return { items: items.slice(0, 3), toast: await t.toast() } }
await t.press('1'); await t.goto(H); log('hide via palette', JSON.stringify(await palRun(H, 'を隠す')))
p = await t.proj(); log('H hidden', p.rows.find((r) => r.id === H).hidden)
await t.press('9'); await t.goto(C); log('view', await t.view(), 'cursor', await t.curRow())
const r1 = await palRun(H, 'を発注'); log('palette H を発注 →', JSON.stringify(r1), 'view', await t.view(), 'cursor', await t.curRow())
p = await t.proj(); const hO = p.rows.find((r) => r.id === H).ordered, cO = p.rows.find((r) => r.id === C).ordered
log('H ordered', hO, 'C ordered', cO)
check('F8-1 隠した行 H にパレットで「発注」→ H が発注済、カーソルの行 C は変わらない', hO && !cO, `H=${hO} C=${cO}`)
await t.press('9'); await t.goto(C); const r2 = await palRun(H, 'を隠す'); log('palette H を隠す（戻す）→', JSON.stringify(r2))
p = await t.proj(); log('H hidden', p.rows.find((r) => r.id === H).hidden, 'C hidden', p.rows.find((r) => r.id === C).hidden)
check('F8-2 隠した行をパレットで戻すと H が戻り、C は隠れない', !p.rows.find((r) => r.id === H).hidden && !p.rows.find((r) => r.id === C).hidden)
await t.shot('f8')
summary(); await t.close()
