// y6: 仕様 §15 のキー列（設計 4 → n → n / a、購買 5 → x → x）を英字そのままで打つと
import { launch, check, log, summary } from './lib.mjs'
const t = await launch()
const { page } = t
const raw = (k) => page.keyboard.rawPress(k)
const S = async () => page.evaluate(async () => { const s = (await import(window.__m('/src/model/store.ts'))).useStore.getState(); return { mode: s.mode, row: s.cursorRow, col: s.cursorCol, edit: s.editValue, toast: s.toast?.text } })
await t.open('design')
await t.press('4'); await page.waitForTimeout(100); log('design 4 start', JSON.stringify(await S()))
await raw('n'); await page.waitForTimeout(80); log('n #1', JSON.stringify(await S()))
await raw('n'); await page.waitForTimeout(80); const s2 = await S(); log('n #2', JSON.stringify(s2))
log('status', (await t.status()).slice(0, 200))
await t.shot('y6-n-n-edit')
check('Y6-1 4 で n → n と打つと 2 つ目の問題へ進む（§15 のキー列）', s2.mode === 'nav', JSON.stringify(s2))

const nm0 = (await t.S(`return p.rows.find((r) => r.id === 'R016')`)); log('R016 name/working before F8', nm0.name, JSON.stringify(nm0.working))
await raw('F8'); await page.waitForTimeout(80); log('F8', JSON.stringify(await S()))
const nm1 = (await t.S(`return p.rows.find((r) => r.id === 'R016')`)); log('R016 name/working after F8', nm1.name, JSON.stringify(nm1.working))
check('Y6-2 編集中に F8 を押しても、打ちかけの文字が部品名に確定されない', JSON.stringify(nm1.working ?? {}) === JSON.stringify(nm0.working ?? {}) && nm1.name === nm0.name, JSON.stringify(nm1.working))
// 選定待ちの行で a
await page.keyboard.rawPress('Home'); const before = await S(); log('Home', JSON.stringify(before))
summary(); await t.close()
