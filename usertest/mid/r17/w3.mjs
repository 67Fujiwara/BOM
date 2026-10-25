// w3: 取消・置換（未公開の設計作業）＋ PM 承認 ON → 購買の見え方・除外 → 承認 → Undo（役割をまたぐ）、重複回路記号
import { launch, check, log, summary } from './lib.mjs'
const t = await launch()
const { page } = t
await t.open('design')
log('bulk →', await t.bulk())
await t.role('pm'); await t.cmd('案件設定'); await page.waitForTimeout(80)
const idx = await page.evaluate(async () => { const m = await import(window.__m('/src/ui/settingsFields.ts')); const s = (await import(window.__m('/src/model/store.ts'))).useStore.getState(); return m.settingsFields(s.project()).findIndex((f) => f.key === 'changeNeedsPmApproval') })
for (let i = 0; i < idx; i++) await t.press('ArrowDown')
await t.press('Enter'); await page.getByTestId('settings-input').fill('はい'); await t.press('Enter'); await t.press('Control+Enter'); await page.waitForTimeout(80); await t.promptFill('承認制'); await t.press('Enter'); await page.waitForTimeout(80)
log('approval ON', (await t.proj()).settings.changeNeedsPmApproval)
await t.role('design'); await t.press('1')
const money0 = await t.money()
// 置換（r）: 新しい行の回路記号の重複
log('r R060 →', await t.replace('R060', 'AB150-N'))
let p = await t.proj(); const rep = p.rows.find((r) => r.replaces === 'R060'); log('new', rep.id, 'ref', rep.ref, 'R060 ref', p.rows.find((r) => r.id === 'R060').ref)
const probs = await page.evaluate(async (id) => { const r = await import(window.__m('/src/model/rules.ts')); const s = (await import(window.__m('/src/model/store.ts'))).useStore.getState(); const p = s.project(); return r.checkRow(p.rows.find((x) => x.id === id), s.ws.rules, p).map((x) => x.severity + ':' + x.message) }, rep.id)
log('problems on new row', probs)
check('W3-1 置換で作った行に、置換元との回路記号の重複警告が出ない', !probs.some((x) => /重複/.test(x)), probs.join(' / '))
// 取消: 正式依頼前の選定済の行 R050、さらに見積中にする予定のない R047
await t.goto('R050'); await t.press('Shift+Delete'); await page.waitForTimeout(60); log('cancel R050 →', await t.toast())
const pubTry = await t.publish('1'); log('publish try →', pubTry)
if (/重複/.test(pubTry)) { await t.goto(rep.id); await t.colKey('ref'); await t.press('x'); log('x →', await t.toast()); log('publish →', await t.publish('1')) }
p = await t.proj(); log('pending', p.rows.filter((r) => r.flags.pmPending).map((r) => `${r.id}:${r.status}:${JSON.stringify(r.pendingRemoval ?? null)}`).join(' '))
// 購買: 見え方・正式見積依頼から外れるか・ヘッダー金額
await t.role('purchasing'); await t.press('1')
log('purch R050', await t.cellText('R050', 'status'), '| R060', await t.cellText('R060', 'status'), '|', rep.id, await t.cellText(rep.id, 'status'), '| money', money0, '→', await t.money())
const v9 = await (async () => { await t.press('9'); return t.viewRows() })(); log('purch 9 has new row?', v9.includes(rep.id))
log('rough →', await t.requestRough())
p = await t.proj(); log('new row after rough', p.rows.find((r) => r.id === rep.id).status)
log('formal →', await t.requestFormal())
p = await t.proj(); log('R050 after formal', p.rows.find((r) => r.id === 'R050').status, JSON.stringify(p.rows.find((r) => r.id === 'R050').flags))
check('W3-2 取消の承認待ちの R050 は正式見積依頼から外れる', p.rows.find((r) => r.id === 'R050').status === 'selected')
// 設計: 承認待ちの取消をもう一度 Shift+Delete
await t.role('design'); await t.press('1'); await t.goto('R050'); await t.press('Shift+Delete'); await page.waitForTimeout(60); log('Shift+Delete on pending →', await t.toast())
// PM: 7 → 承認
await t.role('pm'); await t.press('7'); const v7 = await t.viewRows(); log('PM 7 has R050,R060,new', v7.includes('R050'), v7.includes('R060'), v7.includes(rep.id))
await t.goto('R050'); await t.press('Enter'); await page.waitForTimeout(80); log('PM panel R050', JSON.stringify(await t.panel())?.slice(0, 250)); await t.press('Escape')
const ya = await t.yes('R050', '取消を承認'); log('y R050 →', ya.toast)
p = await t.proj(); log('after approve', ['R050', 'R060', rep.id].map((id) => { const r = p.rows.find((x) => x.id === id); return `${id}:${r.status}:pm=${r.flags.pmPending}` }).join(' '))
check('W3-3 PM 承認で同じ変更セットの取消・置換・新行がまとめて反映', p.rows.find((r) => r.id === 'R050').status === 'cancelled' && p.rows.find((r) => r.id === 'R060').status === 'replaced' && p.rows.find((r) => r.id === rep.id).status === 'submitted' && !p.rows.find((r) => r.id === rep.id).flags.pmPending)
await t.role('purchasing'); log('purch money after approve', await t.money())
await t.press('5'); log('purch 5 cause R050', await t.cellText('R050', 'cause'), 'R060', await t.cellText('R060', 'cause'), rep.id, await t.cellText(rep.id, 'cause'))
// 設計の Ctrl+Z（自分の公開を戻す？ PM の承認は戻さない）
await t.role('design'); await t.press('Control+z'); await page.waitForTimeout(100); log('design Ctrl+Z →', await t.toast(), '| status', (await t.status()).slice(0, 100))
p = await t.proj(); log('after design undo', ['R050', 'R060', rep.id].map((id) => { const r = p.rows.find((x) => x.id === id); return `${id}:${r.status}:pm=${r.flags.pmPending}:rm=${JSON.stringify(r.removal ?? r.pendingRemoval ?? null)}` }).join(' '), 'subs', p.submissions.map((s) => s.rev + (s.revoked ? 'x' : '')).join(','))
// PM の Ctrl+Z（自分の承認を戻す）
await t.role('pm'); await t.press('Control+z'); await page.waitForTimeout(100); log('PM Ctrl+Z →', await t.toast())
p = await t.proj(); log('after PM undo', ['R050', 'R060', rep.id].map((id) => { const r = p.rows.find((x) => x.id === id); return `${id}:${r.status}:pm=${r.flags.pmPending}:rm=${JSON.stringify(r.removal ?? r.pendingRemoval ?? null)}` }).join(' '))
await t.press('Control+y'); await page.waitForTimeout(100); log('PM Ctrl+Y →', await t.toast())
summary(); await t.close()
