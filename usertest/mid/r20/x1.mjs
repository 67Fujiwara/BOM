// x1: 発注後変更依頼（§9.1 末尾・§16）承認の経路: 発注済の納期NG → PM d → 設計が候補を回答 → 購買 h → PM 承認 → 購買が発注を外す → 設計 r → 公開 → 新行の扱い
import { launch, check, log, summary } from './lib.mjs'
const t = await launch()
const { page } = t
const APPROVAL = process.argv[2] === 'on'
const REORDER = process.argv[3] === 'reorder'
await t.open('design')
if (APPROVAL) {
  await t.role('pm'); await t.cmd('案件設定'); await page.waitForTimeout(80)
  const idx = await page.evaluate(async () => { const m = await import(window.__m('/src/ui/settingsFields.ts')); const s = (await import(window.__m('/src/model/store.ts'))).useStore.getState(); return m.settingsFields(s.project()).findIndex((f) => f.key === 'changeNeedsPmApproval') })
  for (let i = 0; i < idx; i++) await t.press('ArrowDown')
  await t.press('Enter'); await page.getByTestId('settings-input').fill('はい'); await t.press('Enter'); await t.press('Control+Enter'); await page.waitForTimeout(80); await t.promptFill('承認制'); await t.press('Enter'); await page.waitForTimeout(80)
  log('approval ON', (await t.proj()).settings.changeNeedsPmApproval)
  await t.role('design')
}
log('bulk →', await t.bulk())
await t.role('purchasing'); log('formal →', await t.requestFormal())
let p = await t.proj()
const id = p.rows.find((r) => r.status === 'formalRequested' && !r.flags.leadNG && !r.flags.contested).id
const r0 = p.rows.find((r) => r.id === id); const q0 = p.quotes.find((q) => q.rowId === id && q.supplierId === r0.adoptedSupplierId && !q.stale)
await t.press('8'); await t.setCellKey(id, 'q.formalPrice@A', String(q0.unitPrice)); await t.press('Escape'); await t.press('Escape')
await page.getByTestId('view-3').click(); await page.locator('.gridwrap').focus(); log('o →', await t.order(id))
await t.showCol('promisedDate'); await t.setCellKey(id, 'promisedDate', '2026-12-20'); await t.press('Escape')
const st = (p, rid) => { const r = p.rows.find((x) => x.id === rid); return r ? `${rid}:${r.status}:ord=${!!r.ordered}:adopt=${r.adoptedSupplierId ?? '-'}:${JSON.stringify(r.flags)} issues=${p.issues.filter((i) => i.rowId === rid).map((i) => `${i.id}:${i.kind}:${i.status}${i.pmRuled ? ':ruled' : ''}`).join(',')}` : rid + ':none' }
p = await t.proj(); log('ordered+late', st(p, id))
await t.role('pm'); await t.press('7'); let res = await t.decide(id, 'd', '代替品を検討'); log('PM d →', res.toast)
// 設計: 回答に候補
await t.role('design'); await t.press('1'); await t.goto(id); await t.press(' '); await t.press('ArrowDown'); await t.press('Enter'); await page.waitForTimeout(80)
await t.press('2'); await page.waitForTimeout(60); await t.promptFill('代替候補: XYZ-123（オムロン）'); await page.getByTestId('prompt-text').press('Enter'); await page.waitForTimeout(80); await t.press('Escape'); await t.press('Escape')
p = await t.proj(); log('after answer', st(p, id), 'ball', await t.cellText(id, 'ball'))
// U4-03: PM が 7 で決めることの無い行（回答済の指摘だけ）で Enter
await t.role('pm'); await t.press('7'); const v7a = await t.viewRows(); log('PM 7 has row (answered only)?', v7a.includes(id))
if (v7a.includes(id)) { await t.goto(id); await t.press('Enter'); await page.waitForTimeout(80); log('U4-03 PM Enter →', JSON.stringify(await t.panel())?.slice(0, 120), '|', await t.toast()); if (await t.panel()) await t.press('Escape') }
// 購買: 発注後変更依頼
await t.role('purchasing'); await t.press('1'); await t.goto(id); await t.press('Shift+I'); await t.press('h'); await page.waitForTimeout(60); await page.getByTestId('issue-text').fill('発注を取消して XYZ-123 に切替えたい'); await page.getByTestId('issue-text').press('Enter'); await page.waitForTimeout(60)
log('issue publish →', await t.publish())
p = await t.proj(); log('after h', st(p, id), 'ball', await t.cellText(id, 'ball'))
// 購買: 承認前に o を外す
await t.press('3'); await t.goto(id); await t.colKey('ordered'); await t.press('o'); await page.waitForTimeout(60); log('un-order before approval →', await t.toast())
p = await t.proj(); check('X1-1 承認前は発注済を外せない', p.rows.find((r) => r.id === id).ordered, st(p, id))
// PM: 7 → 決定パネル → y（上長決裁）
await t.role('pm'); await t.press('7'); const v7 = await t.viewRows(); log('PM 7 has row?', v7.includes(id))
await t.goto(id); await t.press('Enter'); await page.waitForTimeout(80); const pnl = await t.panel(); log('PM panel', JSON.stringify(pnl?.title), JSON.stringify(pnl?.options)); await t.press('Escape')
check('X1-2 発注後変更依頼が PM の 7 に載り、決定パネルが出る', v7.includes(id) && /発注後変更依頼/.test(pnl?.title ?? ''))
res = await t.yes(id, '代替品へ切替を承認'); log('PM y →', res.toast, JSON.stringify(res.prompt?.extra))
p = await t.proj(); log('after approve', st(p, id), 'ball', await t.cellText(id, 'ball')); const dec = p.decisions.filter((d) => d.rowId === id); log('decisions', JSON.stringify(dec.map((d) => [d.kind, d.reason, d.external?.approver])))
await t.press('7'); log('PM 7 still has row?', (await t.viewRows()).includes(id))
// 購買: 発注を外す
await t.role('purchasing'); await t.press('4'); log('purch 4 has row?', (await t.viewRows()).includes(id)); await t.press('9'); log('purch 9 has row?', (await t.viewRows()).includes(id))
await t.press('3'); await t.goto(id); log('purch status bar', (await t.status()).slice(0, 160))
await t.colKey('ordered'); await t.press('o'); await page.waitForTimeout(60); log('un-order after approval →', await t.toast())
p = await t.proj(); log('after un-order', st(p, id), 'ball', await t.cellText(id, 'ball'))
check('X1-3 承認後は購買が発注を外せる', !p.rows.find((r) => r.id === id).ordered)
// 購買: もう一度 o（発注し直せる？）
if (REORDER) {
await t.goto(id); await t.colKey('ordered'); await t.press('o'); await page.waitForTimeout(60); const reo = await t.toast(); log('re-order →', reo); p = await t.proj()
if (p.rows.find((r) => r.id === id).ordered) { log('!! re-ordered; Ctrl+Z'); await t.press('Control+z'); await page.waitForTimeout(80); log('Ctrl+Z →', await t.toast()); p = await t.proj(); log('after ctrl+z', st(p, id)); await t.goto(id); await t.colKey('ordered'); await t.press('o'); await page.waitForTimeout(60); log('o again →', await t.toast()); p = await t.proj(); log('after o again', st(p, id)); await t.shot('x1-reorder-stuck') }
}
// 設計: 4 に出るか → r
await t.role('design'); await t.press('4'); const d4 = await t.viewRows(); log('design 4 has row?', d4.includes(id), 'ball', await t.cellText(id, 'ball'))
await t.shot('x1-design4-after-unorder' + (APPROVAL ? '-on' : ''))
check('X1-4 発注を外した行は設計（r で置き換える）のボール・4 に出る', d4.includes(id), await t.cellText(id, 'ball'))
await t.role('pm'); await t.press('7'); log('PM 7 has row after unorder?', (await t.viewRows()).includes(id)); await t.press('4'); log('PM 4 has row?', (await t.viewRows()).includes(id)); await t.role('design')
await t.press('1'); log('design r →', await t.replace(id, 'XYZ-123'))
p = await t.proj(); const nid = p.rows.find((r) => r.replaces === id)?.id; log('new row', nid)
if (nid) {
  log(await t.setCellKey(nid, 'maker', 'オムロン'))
  log('publish →', await t.publish('5'))
  p = await t.proj(); log('after publish old', st(p, id)); log('after publish new', st(p, nid))
  if (APPROVAL) {
    await t.role('pm'); await t.press('7'); const v = await t.viewRows(); log('PM 7 has old/new', v.includes(id), v.includes(nid))
    res = await t.yes(nid, '変更セット承認'); log('PM y changeset →', res.toast)
    p = await t.proj(); log('after cs approve old', st(p, id)); log('after cs approve new', st(p, nid))
  }
  check('X1-5 公開（承認）で元行は置換済、新行は要再確認で購買へ', p.rows.find((r) => r.id === id).status === 'replaced' && !!p.rows.find((r) => r.id === nid)?.flags.reconfirm, st(p, nid))
  await t.role('purchasing'); await t.press('5'); log('purch 5 has new?', (await t.viewRows()).includes(nid), 'ball new', await t.cellText(nid, 'ball'))
  log('purch 5 old cause', await t.cellText(id, 'cause'), 'new cause', await t.cellText(nid, 'cause'))
  // 金額: 元行の発注額は集計から外れたか
  log('money', await t.money())
}
summary(); await t.close()
