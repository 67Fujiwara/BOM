// (n5 の前半)  案件設定確定（PM の 7 の案件の行）。納期あり／納期未定。y・Shift+Y・Enter、確定後の影響
//   mode=due   : 納期 2026-12-25 の新規案件 → 提出（Rev.1）→ PM の 7 に案件設定確定 → 行で y → 確定の知らせ（ok）・決定の記録・7 から消える
//   mode=nodue : 納期「未定」の新規案件 → 同じ → y → 確定はするが「納期が未定のまま」と知らせる → 案件設定で納期を入れる → 影響試算 → 納期NG の判定が効く
//   mode=keys  : 案件の行で Shift+Y（却下なし）・Enter（案件設定が開く）・設計/購買の y が効かない・確定後の y（もう確定）
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
const mode = process.argv[2] ?? 'due'
const t = await launch(); const { page } = t; const h = helpers(t)
await t.open('design')
const paste = ['分類\t部品名\t型式\tメーカ\t数量\t単位\t回路記号', '制御\tリレー\tMY4N-D2 DC24\tオムロン\t4\t個\tKA1', '制御\tソケット\tPYF14A-E\tオムロン\t4\t個\tKA2', '電源\t電源\tS8VK-G12024\tオムロン\t1\t個\tPS1'].join('\n')
await t.press('Control+k'); await page.getByTestId('palette-input').fill('新しいBOM'); await t.press('Enter')
await page.getByTestId('wizard-id').fill('P-2026-305'); await t.press('Enter')
await page.getByTestId('wizard-name').fill('中堅R21盤'); await t.press('Enter')
await page.getByTestId('wizard-due').fill(mode === 'nodue' ? '未定' : '2026-12-25'); await t.press('Enter')
await page.getByTestId('wizard-processDays').fill('10'); await t.press('Enter')
await page.getByTestId('wizard-budget').fill('500000'); await t.press('Enter')
await page.getByTestId('wizard-buyer').fill('佐藤, 鈴木'); await t.press('Enter')
await t.press(' ', 'ArrowDown', ' ', 'ArrowDown', ' '); await t.press('Enter')
await t.press('1'); await page.getByTestId('wizard-paste').fill(paste); await t.press('Control+Enter'); await t.press('Enter'); await page.waitForTimeout(300)
log('created →', await t.toast())
let p = await t.proj()
log('publish →', await t.publish('1')); p = await t.proj()
await t.role('pm'); await t.press('7'); const items = await t.viewItems(); const caseKey = items.find((k) => k.startsWith('case:'))
check('O7-0 PM の 7 に案件設定確定の行', !!caseKey, items.join(','))
const onCase = async () => { await page.evaluate(async (k) => { const s = (await import(window.__m('/src/model/store.ts'))).useStore; s.setState({ cursorRow: k }) }, caseKey); await page.waitForTimeout(50) }
// 数字キー（素の数字）でビューが替わる。案件の行からでも（V20-07）
for (const d of [1, 2, 4, 5, 6, 8, 9, 3, 7]) {
  await t.role('pm'); await t.press('7'); await onCase()
  await page.keyboard.rawPress(String(d)); await page.waitForTimeout(80)
  const v = await t.view()
  check(`O7-digit-${d} 案件の行で ${d} を押すとビュー ${d} になる`, v === d, `view=${v} cursorRow=${await t.curRow()}`)
}
// 7 に戻る（Alt+7 でも）
await page.keyboard.press('Alt+7'); await page.waitForTimeout(60); await onCase()
await page.keyboard.rawPress('4'); await page.waitForTimeout(60); await page.keyboard.press('Alt+7'); await page.waitForTimeout(60)
check('O7-alt Alt+数字でも 7 に戻れる', (await t.view()) === 7, String(await t.view()))
// 案件の行で英字（y 以外）は何もしない（確定しない）
await onCase(); for (const k of ['a', 'x', 'b', 'q']) { await page.keyboard.rawPress(k); await page.waitForTimeout(40) }
p = await t.proj(); check('O7-letters 案件の行で a x b q を押しても確定・変更されない', p.settings.pmConfirmed === false, String(p.settings.pmConfirmed))
// 設計・購買の 7 にも案件の行が載る。そこで素の数字を押したとき（案件の行に居るとき）
for (const role of ['design', 'purchasing']) {
  await t.role(role); await page.keyboard.press('Alt+7'); await page.waitForTimeout(80)
  const items2 = await t.viewItems(); const ck = items2.find((k) => k.startsWith('case:')); const cur0 = await t.curRow()
  log(role, '7 items', items2.slice(0, 4).join(','), 'cursorRow', cur0)
  if (ck) { await page.evaluate(async (k) => { const s = (await import(window.__m('/src/model/store.ts'))).useStore; s.setState({ cursorRow: k }) }, ck); await page.waitForTimeout(40); const t0 = await t.toast(); await page.keyboard.rawPress('5'); await page.waitForTimeout(80); const v = await t.view(); const t1 = await t.toast()
    log(role, 'case row: raw 5 → view', v, 'toast', t1)
    check(`O7-${role}-digit 案件の行（${role}）でも 5 でビューが替わる（§9.1 ビュー切替は全ビュー共通）`, v === 5, `view=${v} toast=${t1}`) }
}
// 確定
await t.role('pm'); await t.press('7'); await onCase(); await page.keyboard.rawPress('y'); await page.waitForTimeout(150)
p = await t.proj(); check('O7-y 案件の行で y（素の y）で確定', p.settings.pmConfirmed === true && p.decisions.filter((d) => d.kind === '案件設定確定').length === 1, await t.toast())
log('ERRORS', JSON.stringify(t.errors)); summary(); await t.close()
