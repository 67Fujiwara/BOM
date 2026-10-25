// n5: 案件設定確定（PM の 7 の案件の行）。納期あり／納期未定。y・Shift+Y・Enter、確定後の影響
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
await page.getByTestId('wizard-name').fill('中堅R20盤'); await t.press('Enter')
await page.getByTestId('wizard-due').fill(mode === 'nodue' ? '未定' : '2026-12-25'); await t.press('Enter')
await page.getByTestId('wizard-processDays').fill('10'); await t.press('Enter')
await page.getByTestId('wizard-budget').fill('500000'); await t.press('Enter')
await page.getByTestId('wizard-buyer').fill('佐藤, 鈴木'); await t.press('Enter')
await t.press(' ', 'ArrowDown', ' ', 'ArrowDown', ' '); await t.press('Enter')
await t.press('1'); await page.getByTestId('wizard-paste').fill(paste); await t.press('Control+Enter'); await t.press('Enter'); await page.waitForTimeout(300)
log('created →', await t.toast())
let p = await t.proj(); log('dueDate', p.dueDate, 'rows', p.rows.length, 'confirmed', p.settings.pmConfirmed)
check('N5-0 納期の入力どおり（' + (mode === 'nodue' ? '未定＝null' : '2026-12-25') + '）', mode === 'nodue' ? p.dueDate == null : p.dueDate === '2026-12-25', String(p.dueDate))
log('publish →', await t.publish('1')); p = await t.proj(); log('subs', p.submissions.length, 'caseDecisions', JSON.stringify(p.caseDecisions))
check('N5-1 提出 Rev.1 で案件設定確定が PM の 7 に載る', p.caseDecisions.some((c) => c.kind === '案件設定確定' && c.status === 'open'), JSON.stringify(p.caseDecisions))
// 設計・購買の y は効かない
for (const role of ['design', 'purchasing']) { await t.role(role); await t.press('7'); await t.press('Control+ArrowUp'); const before = (await t.proj()).settings.pmConfirmed; await page.keyboard.press('y'); await page.waitForTimeout(60); log(role, '7 y →', await t.toast()); check(`N5-2-${role} ${role} の y では確定しない`, (await t.proj()).settings.pmConfirmed === before, '') }
await t.role('pm'); await t.press('7'); const items = await t.viewItems(); log('PM 7 items', items.join(','))
const caseKey = items.find((k) => k.startsWith('case:')); check('N5-3 PM の 7 に案件の行', !!caseKey, items.join(','))
log('status bar', (await t.status()).slice(0, 160))
await page.evaluate(async (k) => { const s = (await import(window.__m('/src/model/store.ts'))).useStore; s.setState({ cursorRow: k }) }, caseKey); await page.waitForTimeout(60)
log('cursorRow', await t.curRow(), 'status bar on case row', (await t.status()).slice(0, 200))
if (mode === 'keys') {
  await page.keyboard.press('Shift+Y'); await page.waitForTimeout(80); log('Shift+Y →', await t.toast(), 'confirmed', (await t.proj()).settings.pmConfirmed)
  check('N5-4 案件の行の Shift+Y で確定しない（却下の意味は無い）', (await t.proj()).settings.pmConfirmed === false, await t.toast())
  await page.keyboard.press('Enter'); await page.waitForTimeout(150); const pn = await t.panel(); log('Enter →', JSON.stringify(pn)?.slice(0, 200))
  check('N5-5 案件の行の Enter で案件設定が開く', pn?.kind === 'settings' || /設定/.test(JSON.stringify(pn)), JSON.stringify(pn)?.slice(0, 120))
  await page.keyboard.press('Escape'); await page.waitForTimeout(60); if (await t.panel()) await page.keyboard.press('Escape')
  await page.keyboard.press('Control+ArrowUp'); await page.waitForTimeout(40)
}
await page.evaluate(async (k) => { const s = (await import(window.__m('/src/model/store.ts'))).useStore; s.setState({ cursorRow: k }) }, caseKey); await page.waitForTimeout(60)
await page.keyboard.press('y'); await page.waitForTimeout(150)
const msg = await t.toast(); const tt = await page.evaluate(async () => (await import(window.__m('/src/model/store.ts'))).useStore.getState().toast?.kind)
p = await t.proj(); log('y →', msg, '| kind', tt, '| confirmed', p.settings.pmConfirmed, '| decisions', JSON.stringify(p.decisions.filter((d) => d.kind === '案件設定確定').map((d) => [d.by.name, d.reason])))
check('N5-6 y で案件設定を確定（決定の記録 1 件・案件の要決定が済）', p.settings.pmConfirmed && p.decisions.filter((d) => d.kind === '案件設定確定').length === 1 && p.caseDecisions.every((c) => c.status === 'done'), '')
if (mode === 'nodue') check('N5-7 納期が未定のまま確定したと知らせる（情報）', /納期が未定/.test(msg), msg)
else check('N5-7 納期ありの確定は ok の知らせ（未定の警告は出ない）', /確定しました/.test(msg) && !/未定/.test(msg), msg)
await t.press('7'); log('PM 7 after', (await t.viewItems()).join(','))
check('N5-8 確定後、7 から案件の行が消える', !(await t.viewItems()).some((k) => k.startsWith('case:')), '')
if (mode === 'keys') {
  await page.keyboard.press('y'); await page.waitForTimeout(100); log('y again →', await t.toast())
}
if (mode === 'nodue') {
  // 納期を入れる → 影響試算
  await t.cmd('案件設定'); await page.waitForTimeout(80)
  const idx = await page.evaluate(async () => { const m = await import(window.__m('/src/ui/settingsFields.ts')); const s = (await import(window.__m('/src/model/store.ts'))).useStore.getState(); return m.settingsFields(s.project()).findIndex((f) => f.key === 'dueDate') })
  for (let k = 0; k < idx; k++) await t.press('ArrowDown')
  await t.press('Enter'); await page.getByTestId('settings-input').fill('2026-11-02'); await t.press('Enter'); await t.press('Control+Enter'); await page.waitForTimeout(150)
  const pn = await t.panel(); log('settings confirm panel', JSON.stringify(pn)?.slice(0, 400))
  let guard = 0; let pn2 = pn; while (pn2 && guard++ < 4) { try { await t.promptFill('納期を入れる') } catch {} ; await t.press('Enter'); await page.waitForTimeout(150); pn2 = await t.panel() }
  p = await t.proj(); log('dueDate now', p.dueDate, 'toast', await t.toast())
  check('N5-9 案件設定で納期を入れられる', p.dueDate === '2026-11-02', String(p.dueDate))
}
log('ERRORS', JSON.stringify(t.errors))
summary(); await t.close()
