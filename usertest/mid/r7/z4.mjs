// z4: 英字・数字そのままの打鍵（v0.3 の規則）を役割ごとに: PM の 7 での y、設計の 4 での n、購買の 3 での o、ID の列での x → F8
import { launch, check, log, summary } from './lib.mjs'
const t = await launch()
const { page } = t
const raw = (k) => page.keyboard.rawPress(k)
const S = () => page.evaluate(async () => { const s = (await import(window.__m('/src/model/store.ts'))).useStore.getState(); return { view: s.view, mode: s.mode, row: s.cursorRow, col: s.cursorCol, edit: s.editValue, toast: s.toast?.text ?? '', panel: s.panel?.kind ?? null } })
await t.open('design')
log('bulk →', await t.bulk())
// PM: 7 を開いて y
await t.role('pm'); await page.waitForTimeout(80); let s0 = await S(); log('PM start', JSON.stringify(s0))
await raw('y'); await page.waitForTimeout(100); let s1 = await S(); log('PM raw y', JSON.stringify(s1))
if (s1.panel) { await raw('Escape') }
check('Z4-1 PM が 7 を開いてそのまま y（§9.1「7 のナビで直接効くのは y と Shift+Y」）で決定が始まる', s1.panel === 'prompt' || /承認|許可|確定|受入/.test(s1.toast), JSON.stringify(s1))
await t.press('ArrowRight'); await t.press('ArrowRight'); s0 = await S(); await raw('y'); await page.waitForTimeout(100); s1 = await S(); log('PM raw y on', s0.col, '→', JSON.stringify(s1)); if (s1.panel) await raw('Escape')
check('Z4-2 PM が 7 の部品名などの列（PM は書けない列）で y を押しても決定できる（§14「PM は 7 で編集できるセルを持たないので衝突しない」）', s1.panel === 'prompt' || /承認|許可|確定|受入/.test(s1.toast), `col=${s0.col} ${s1.toast}`)
await raw('Shift+Y'); await page.waitForTimeout(100); s1 = await S(); log('PM raw Shift+Y →', JSON.stringify(s1)); if (s1.panel) await raw('Escape')
await raw('4'); await page.waitForTimeout(80); s1 = await S(); log('PM raw 4 on', s0.col, '→', JSON.stringify(s1))
// 設計 4 → n
await t.role('design'); await page.waitForTimeout(80); s0 = await S(); log('design start', JSON.stringify(s0))
await raw('n'); await page.waitForTimeout(80); s1 = await S(); log('design raw n', JSON.stringify(s1)); if (s1.mode === 'edit') await raw('Escape')
check('Z4-3 (U6-02) 設計が 4 を開いてそのまま n（§6.3・§15 のキー列）で次の問題へ進む（部品名の入力にならない）', s1.mode === 'nav' && s1.row !== s0.row, JSON.stringify(s1))
// 購買 3 → o（発注のチェックの列）
await t.role('purchasing'); await page.getByTestId('view-3').click(); await page.locator('.gridwrap').focus(); s0 = await S(); log('purch 3 start', JSON.stringify(s0))
await raw('o'); await page.waitForTimeout(80); s1 = await S(); log('purch raw o', JSON.stringify(s1)); if (s1.mode === 'edit') await raw('Escape')
summary(); await t.close()
