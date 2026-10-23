// a1: 指定商社の指定先（ID / 名前）と辞退 → 指定先を変える（Ctrl+.・ステータスバー）→ 公開 → 新しい指定先で採用。承認 ON でも通るか
import { launch, check, log, summary } from './lib.mjs'
const approvalOn = process.argv[2] === 'on'
const t = await launch()
const { page } = t
await t.open('design')
const show = (p, id) => { const r = p.rows.find((x) => x.id === id); return `${id} ${r.procurement} maker=${r.maker} des=${r.designated} st=${r.status} adopt=${r.adoptedSupplierId ?? '-'} reason=${r.adoptReason ?? ''} work=${JSON.stringify(r.working ?? {})} flags=${JSON.stringify(r.flags)} quotes=${JSON.stringify(p.quotes.filter((q) => q.rowId === id).map((q) => [q.supplierId, q.unitPrice, q.leadDays, q.stale ? 'stale' : '']))}` }
const addRow = async (after, name, model, maker, proc, des) => {
  await t.goto(after); await t.press('Shift+Enter'); await page.waitForTimeout(80); await t.type(name); await t.press('Enter'); await page.waitForTimeout(60); if ((await t.mode()) === 'edit') await t.press('Escape')
  const pp = await t.proj(); const id = pp.rows.find((r) => r.name === name).id
  await t.showCol('designated', 'procurement')
  await t.setCellKey(id, 'model', model); await t.setCellKey(id, 'maker', maker); await t.setCellKey(id, 'procurement', proc); if (des) await t.setCellKey(id, 'designated', des)
  await t.setCellKey(id, 'qtyNeeded', '4'); await t.setCellKey(id, 'ref', 'Z' + id)
  return id
}
if (approvalOn) {
  await t.role('pm'); await t.cmd('案件設定'); await page.waitForTimeout(80)
  const idx = await page.evaluate(async () => { const m = await import(window.__m('/src/ui/settingsFields.ts')); const s = (await import(window.__m('/src/model/store.ts'))).useStore.getState(); return m.settingsFields(s.project()).findIndex((f) => f.key === 'changeNeedsPmApproval') })
  for (let i = 0; i < idx; i++) await t.press('ArrowDown')
  await t.press('Enter'); await page.getByTestId('settings-input').fill('はい'); await t.press('Enter'); await t.press('Control+Enter'); await page.waitForTimeout(80); await t.promptFill('承認制'); await t.press('Enter'); await page.waitForTimeout(80)
  log('approval ON', (await t.proj()).settings.changeNeedsPmApproval)
}
await t.role('design'); await t.press('1')
const G1 = await addRow('R080', '因幡指定ID', 'UK5N', 'フエニックス', '指定商社', 'S1')
const G2 = await addRow(G1, '因幡指定名前', 'UK10N', 'フエニックス', '指定商社', '因幡電機')
const G3 = await addRow(G2, '因幡指定略称', 'UK16N', 'フエニックス', '指定商社', '因幡')
await t.goto(G3); await t.colKey('designated'); const sbG3 = await t.status(); log('G3 status bar', sbG3.slice(0, 200))
await t.press('Control+.'); await page.waitForTimeout(80); const qf3 = await t.panel(); log('G3 Ctrl+.', JSON.stringify(qf3?.options)); if (qf3) await t.press('Escape')
check('A1-0 指定先を略称（因幡）で書くと「商社マスタにありません」のエラーと「因幡電機にする」の候補', JSON.stringify(qf3?.options ?? []).includes('因幡電機'), JSON.stringify(qf3?.options))
// 候補で直す
if (qf3?.options?.length) { await t.press('Control+.'); await page.waitForTimeout(80); const i = (await t.panel()).options.findIndex((o) => o.includes('因幡電機')); for (let k = 0; k < i; k++) await t.press('ArrowDown'); await t.press('Enter'); await page.waitForTimeout(80) }
log('G3 after fix', show(await t.proj(), G3), 'cell', await t.cellText(G3, 'designated'))
log('publish →', await t.publish('1'))
if (approvalOn) { await t.role('pm'); await t.press('7'); log('PM y new rows', (await t.yes(G1, '追加を承認')).toast); log('after approve', show(await t.proj(), G1)) }
await t.role('purchasing')
await t.cmd('概算見積を依頼'); await page.waitForTimeout(100); await t.press('Enter'); await page.waitForTimeout(1300); log('request →', await t.toast())
let p = await t.proj(); for (const id of [G1, G2, G3]) log(show(p, id))
await t.press('6'); for (const id of [G1, G2, G3]) { await t.setCellKey(id, 'q.leadDays@S1', '取扱なし'); await t.press('Escape') }
p = await t.proj()
const res = {}
for (const id of [G1, G2, G3]) res[id] = { ball: await t.cellText(id, 'ball'), st: p.rows.find((r) => r.id === id).status }
await t.press('4'); const pu4 = await t.viewRows()
await t.role('design'); await t.press('4'); const de4 = await t.viewRows()
for (const id of [G1, G2, G3]) { res[id].pu4 = pu4.includes(id); res[id].de4 = de4.includes(id); await t.goto(id); await t.press('Home'); res[id].sb = (await t.status()).slice(0, 220); await t.press('Control+.'); await page.waitForTimeout(80); res[id].qf = JSON.stringify((await t.panel())?.options ?? []); if (await t.panel()) await t.press('Escape') }
log(JSON.stringify(res, null, 1))
check('A1-1 (M7-01) 指定先を名前で書いた行の辞退 → ボール設計・設計の 4', res[G2].ball === '設計' && res[G2].de4, JSON.stringify(res[G2]))
check('A1-2 (M7-01) 指定先を ID で書いた行も同じ', res[G1].ball === '設計' && res[G1].de4)
check('A1-3 (U6-04) ステータスバーに「Ctrl+. 指定先を変える」', /指定先を変える/.test(res[G2].sb) && /指定先を変える/.test(res[G1].sb), res[G2].sb)
check('A1-4 (U6-04) Ctrl+. に「指定先を変える（因幡電機 が取扱なしと回答）」', /指定先を変える/.test(res[G2].qf), res[G2].qf)
// 購買側: ボールが設計の行は購買の 4 に出るか（出なくてもよい）。再依頼は「依頼する行がありません」でよい
// Ctrl+. → 指定先を変える → 選択肢を見る
await t.goto(G2); await t.press('Home'); await t.press('Control+.'); await page.waitForTimeout(80)
let pn = await t.panel(); const oi = pn.options.findIndex((o) => o.includes('指定先を変える')); for (let k = 0; k < oi; k++) await t.press('ArrowDown'); await t.press('Enter'); await page.waitForTimeout(80)
pn = await t.panel(); log('change prompt', pn?.title, JSON.stringify(pn?.options))
const ws = await t.ws()
const listed = (pn?.options ?? []).map((n) => { const s = ws.suppliers.find((x) => x.name === n); return `${n}:${s ? (s.handledMakers.length ? (s.handledMakers.includes('フエニックス') ? '扱う' : '扱わない') : '未登録') : '?'}` })
log('candidates', listed.join(' / '))
check('A1-5 指定先の候補に、フエニックスを扱わない商社（直販など）を混ぜない／扱うかを示す', !listed.some((x) => x.endsWith('扱わない')), listed.join(' / '))
const ti = pn.options.indexOf('立花エレテック'); for (let k = 0; k < ti; k++) await t.press('ArrowDown'); await t.press('Enter'); await page.waitForTimeout(80)
log('after choose →', await t.toast()); p = await t.proj(); log(show(p, G2))
// 名前で書いていた G1 は直接書き換え（ID → 名前）
await t.press('1'); log('G1 set 立花エレテック', await t.setCellKey(G1, 'designated', '立花エレテック'))
log('publish →', await t.publish('6'))
p = await t.proj(); for (const id of [G1, G2]) log('after publish', show(p, id), 'ball', await t.cellText(id, 'ball'))
const pend = p.rows.filter((r) => [G1, G2].includes(r.id) && r.flags.pmPending).map((r) => r.id)
if (approvalOn) {
  check('A1-6on 承認 ON: 指定先の変更は変更セットとして PM 承認待ち', pend.length === 2, pend.join(','))
  await t.role('purchasing'); await t.cmd('概算見積を依頼'); await page.waitForTimeout(100); await t.press('Enter'); await page.waitForTimeout(1000); log('purch request while pending →', await t.toast())
  await t.role('pm'); await t.press('7'); log('PM y', (await t.yes(G2, '承認')).toast)
  p = await t.proj(); log('after PM y', show(p, G1), show(p, G2))
}
await t.role('purchasing'); await t.press('4'); log('purch 4 has G1/G2', (await t.viewRows()).filter((x) => [G1, G2].includes(x)).join(','))
const n0 = t.downloads.length
await t.cmd('概算見積を依頼'); await page.waitForTimeout(100); await t.press('Enter'); await page.waitForTimeout(1300); const rq = await t.toast(); log('request after change →', rq, t.downloads.slice(n0).map((d) => d.suggested).join(','))
p = await t.proj(); for (const id of [G1, G2]) log(show(p, id))
check('A1-7 指定先の変更を公開すると、購買の依頼で新しい指定先（立花）に頼む', [G1, G2].every((id) => p.quotes.some((q) => q.rowId === id && q.supplierId === 'S2' && !q.stale)), rq)
await t.press('6'); for (const id of [G1, G2]) { await t.setCellKey(id, 'q.unitPrice@S2', '700'); await t.press('Escape'); await t.setCellKey(id, 'q.leadDays@S2', '4'); await t.press('Escape') }
p = await t.proj(); for (const id of [G1, G2]) log('answered', show(p, id))
check('A1-8 新しい指定先の回答で「指定先（固定）」採用', [G1, G2].every((id) => p.rows.find((r) => r.id === id).adoptedSupplierId === 'S2' && p.rows.find((r) => r.id === id).adoptReason === '指定先（固定）'))
// 新しい指定先も辞退したら？（2 社目も辞退 → 再び設計へ）
await t.setCellKey(G2, 'q.leadDays@S2', '取扱なし'); await t.press('Escape'); p = await t.proj(); log('G2 S2 declined', show(p, G2), 'ball', await t.cellText(G2, 'ball'))
check('A1-9 採用後に新しい指定先が取扱なしに変わったら、採用を外して設計へ（指定先を変える）', p.rows.find((r) => r.id === G2).adoptedSupplierId !== 'S2' && (await t.cellText(G2, 'ball')) === '設計', show(p, G2))
await t.shot('a1-designated' + (approvalOn ? '-on' : ''))
summary(); await t.close()
