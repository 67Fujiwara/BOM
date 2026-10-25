// v8: 取込（M-35・読めない値の報告）、差戻し 2 回目 → PM、例外選定の承認 / 却下、先行採用の却下、再見積要の行の正式依頼後の概算依頼
import { launch, check, log, summary } from './lib.mjs'
const t = await launch()
const { page } = t
await t.open('design')
await t.press('1')
// M-35 準備: R015 をメーカ指定＝任意・代替可否＝不可に
await t.showCol('makerLock')
log(await t.setCellKey('R015', 'makerLock', '任意'))
log(await t.setCellKey('R015', 'altPolicy', '不可'))
const prob15 = await page.evaluate(async () => { const r = await import(window.__m('/src/model/rules.ts')); const s = (await import(window.__m('/src/model/store.ts'))).useStore.getState(); const p = s.project(); const row = p.rows.find((x) => x.id === 'R015'); const der = await import(window.__m('/src/model/derive.ts')); return r.checkRow({ ...row, ...der.effective(row) }, s.ws.rules, p).map((x) => x.severity + ':' + x.message) })
log('R015 problems', prob15)
check('M3 メーカ指定＝任意 と 代替可否＝不可 の組合せを矛盾として警告（§3.1・§16）', prob15.some((x) => /任意|矛盾/.test(x)), prob15.join(' / '))
await t.press('Control+Enter'); await page.waitForTimeout(100); let pn = await t.panel(); if (pn?.kind === 'prompt') { await t.press('2'); await page.waitForTimeout(100); if ((await t.panel())?.kind === 'prompt') { await page.keyboard.press('Enter'); await page.waitForTimeout(100) } }
log('publish →', await t.toast(), JSON.stringify((await t.row('R015')).makerLock))
// 例外選定: R011 で 3 位、R012 で 3 位
for (const id of ['R011', 'R012']) { await t.goto(id); await t.press('Shift+A'); await page.waitForTimeout(60); await t.press(id === 'R012' ? '2' : '3'); await page.waitForTimeout(60); await t.press('3'); await page.waitForTimeout(80); if ((await t.panel())?.kind === 'prompt') { await page.keyboard.press('Enter'); await page.waitForTimeout(100) } const r = await t.row(id); if (await t.panel()) await t.press('Escape'); log(id, 'Shift+A →', await t.toast(), r.status, r.adoptedSupplierId, JSON.stringify(r.flags)) }
// 購買: 取込（R015 に代替提案列、R001(指定・不可) にも、R062 に読めない単価）
await t.role('purchasing')
await t.cmd('見積回答を取り込む'); await page.waitForTimeout(80); await t.press('Enter'); await page.waitForTimeout(80)
const imp = ['行ID\t型式\t単価\t納期\tMOQ\t在庫区分\t有効期限\t代替型式\t代替メーカ\t代替単価\t代替納期', 'R015\tRSEL-2006W\t3000\t5\t\t取寄\t2026-12-31\tNF-2006\tコーセル\t2500\t5', 'R001\tFX5U-32MR/ES\t140\t5\t\t\t2026-12-31\tFX5U-32MR/DS\t三菱電機\t130\t5', 'R062\tRCG-M20\t12O0\t5'].join('\n')
await page.getByTestId('import-text').fill(imp); await page.getByTestId('import-text').press('Control+Enter'); await page.waitForTimeout(150)
const impToast = await t.toast(); log('import →', impToast)
let p = await t.proj(); log('drafts', p.issues.filter((i) => i.status === 'draft').map((i) => `${i.id}:${i.rowId}:${i.kind}:${i.text}`))
check('M-35 メーカ指定＝任意の行は代替不可でも代替提案の下書きを作る', p.issues.some((i) => i.rowId === 'R015' && i.kind === '代替提案' && i.status === 'draft'))
check('S メーカ指定＝指定・代替不可の行は提案を作らない', !p.issues.some((i) => i.rowId === 'R001' && i.kind === '代替提案'))
check('M3 取込で読めない値（12O0）があったことを結果に出す', /エラー|読めない|12O0|単価/.test(impToast), impToast)
const q62 = p.quotes.find((q) => q.rowId === 'R062' && q.supplierId === 'S1' && !q.stale); log('R062 S1 price', q62?.unitPrice)
// 差戻し 2 回目 → PM
await t.press('1'); await t.goto('R017'); await t.press('Shift+I'); await t.press('k'); await page.getByTestId('issue-text').fill('5A か 10A か'); await page.getByTestId('issue-text').press('Enter'); await page.waitForTimeout(60)
await t.press('Control+Enter'); await page.waitForTimeout(80); pn = await t.panel(); if (pn) { await t.press('Enter'); await page.waitForTimeout(60) }
log('issue publish →', await t.toast())
for (let round = 1; round <= 2; round++) {
  await t.role('design'); await t.press('1'); await t.goto('R017'); await t.press(' '); await t.press('ArrowDown')
  // 最後の指摘を選ぶ
  p = await t.proj(); const n = p.issues.filter((i) => i.rowId === 'R017' && (i.status !== 'draft')).length
  for (let k = 1; k < n; k++) await t.press('ArrowDown')
  await t.press('Enter'); await page.waitForTimeout(60); await t.press('2'); await page.waitForTimeout(60); await t.promptFill('図面どおり 5A です'); await t.press('Enter'); await page.waitForTimeout(60); await t.press('Escape'); await t.press('Escape')
  await t.role('purchasing'); await t.press('1'); await t.goto('R017'); await t.press('Shift+X'); await page.waitForTimeout(60); await t.promptFill('型式に 5A を書いてください'); await t.press('Enter'); await page.waitForTimeout(60)
  p = await t.proj(); const i17 = p.issues.filter((i) => i.rowId === 'R017').at(-1); log('round', round, 'issue', i17.status, 'bounce', i17.bounceCount, 'ball', await t.cellText('R017', 'ball'))
}
check('S 差戻し 2 回目で PM のボール', (await t.cellText('R017', 'ball')) === 'PM')
// PM
await t.role('pm'); await t.press('7'); const v7 = await t.viewRows(); log('PM 7 has', ['R011', 'R012', 'R017'].map((x) => x + ':' + v7.includes(x)).join(' '))
await t.goto('R017'); await t.press('Enter'); await page.waitForTimeout(60); pn = await t.panel(); log('panel 差戻し2回目', JSON.stringify(pn?.options)); await t.press('Escape')
await t.goto('R017'); await t.press('y'); await page.waitForTimeout(60); await t.promptFill('定格の明記は必要'); await t.press('Enter'); await page.waitForTimeout(80)
log('R017 after 指摘を支持: ball', await t.cellText('R017', 'ball'), JSON.stringify((await t.proj()).issues.filter((i) => i.rowId === 'R017').map((i) => i.status + ':' + i.pmRuled)))
check('S 2 回目の差戻しで PM が指摘を支持 → 設計のボール', (await t.cellText('R017', 'ball')) === '設計')
// 例外選定: R011 却下 / R012 承認
async function ext() { const pn = await t.panel(); if (pn?.extra && '承認者' in pn.extra) { await t.extraFill('承認者', '部長'); await t.extraFill('決裁書No', 'K-9') } }
await t.goto('R011'); await t.press('Shift+y'); await page.waitForTimeout(60); await t.promptFill('1位で良い'); await t.press('Enter'); await page.waitForTimeout(80)
let r = await t.row('R011'); log('R011 after 却下', r.status, r.adoptedSupplierId, JSON.stringify(r.flags), 'ball', await t.cellText('R011', 'ball'))
check('S 例外選定の却下 → 見積済・選定者（設計）のボール', r.status === 'quoted' && !r.adoptedSupplierId && (await t.cellText('R011', 'ball')) === '設計')
await t.goto('R012'); await t.press('y'); await page.waitForTimeout(60); await ext(); await t.promptFill('実績重視'); await t.press('Enter'); await page.waitForTimeout(80)
r = await t.row('R012'); log('R012 after 承認', r.status, r.adoptedSupplierId, JSON.stringify(r.flags), await t.toast())
check('S 例外選定の承認 → 選定済', r.status === 'selected' && !r.flags.pmPending)
// PM の Ctrl+Z（自分の承認を戻す）→ 設計の Ctrl+Z は PM の決定を戻さない
await t.press('Control+z'); await page.waitForTimeout(80); r = await t.row('R012'); log('PM Ctrl+Z →', await t.toast(), r.status, JSON.stringify(r.flags))
check('S PM の Ctrl+Z で自分の承認を戻せる（承認待ちに戻る）', r.flags.pmPending === true)
await t.press('Control+y'); await page.waitForTimeout(80)
await t.role('design'); await t.press('Control+z'); await page.waitForTimeout(80); r = await t.row('R012'); log('design Ctrl+Z →', await t.toast(), r.status, JSON.stringify(r.flags))
// 4 / 7 の中身（役割別）
await t.role('purchasing'); await t.press('4'); const p4 = await t.viewRows(); log('purchasing 4:', p4.length, p4.slice(0, 15).join(','))
await t.role('pm'); await t.press('4'); const m4 = await t.viewRows(); log('PM 4:', m4.length, m4.slice(0, 15).join(','))
await t.press('7'); const m7 = await t.viewRows(); log('PM 7:', m7.length, m7.join(','))
summary(); await t.close()
