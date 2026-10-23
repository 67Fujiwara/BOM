// z1: ラウンド6 の修正の確認（指定系・メーカで絞る依頼先）: M6-01・M6-02・M6-04・U6-04・U6-05・M5-01・M6-05
import { launch, check, log, summary } from './lib.mjs'
import ExcelJS from '/home/user/BOM/node_modules/exceljs/excel.js'
const t = await launch()
const { page } = t
await t.open('design')
const show = (p, id) => { const r = p.rows.find((x) => x.id === id); return `${id} ${r.procurement} maker=${r.maker} des=${r.designated} st=${r.status} adopt=${r.adoptedSupplierId ?? '-'} reason=${r.adoptReason ?? ''} snap=${r.scoreSnapshot ?? '-'} quotes=${JSON.stringify(p.quotes.filter((q) => q.rowId === id && !q.stale).map((q) => [q.supplierId, q.unitPrice, q.leadDays]))}` }
const addRow = async (after, name, model, maker, proc, des) => {
  await t.goto(after); await t.press('Shift+Enter'); await page.waitForTimeout(80); await t.type(name); await t.press('Enter'); await page.waitForTimeout(60); if ((await t.mode()) === 'edit') await t.press('Escape')
  const pp = await t.proj(); const id = pp.rows.find((r) => r.name === name).id
  await t.showCol('designated', 'procurement')
  await t.setCellKey(id, 'model', model); await t.setCellKey(id, 'maker', maker); await t.setCellKey(id, 'procurement', proc); if (des) await t.setCellKey(id, 'designated', des)
  await t.setCellKey(id, 'qtyNeeded', '4'); await t.setCellKey(id, 'ref', 'Z' + id)
  return id
}
await t.press('1')
const A = await addRow('R080', '表示灯パトライト', 'LR6-302WJBW-RYG', 'パトライト', '相見積')
const B = await addRow(A, 'SPD音羽', 'LT-C32AC385A', '音羽電機', '相見積')
const C = await addRow(B, 'リレー英字表記', 'G2R-1-SN DC24', 'OMRON', '相見積')
const D = await addRow(C, '客先指定パナ', 'WTP5001', 'パナソニック', '客先指定品', '客先承認 KS-9')
const E = await addRow(D, '客先指定オムロン', 'G2R-1 DC24', 'オムロン', '客先指定品', '客先承認 KS-1')
const F = await addRow(E, '直販指定リレー', 'G3NA-210B', 'オムロン', '指定商社', 'オムロン直販')
const G = await addRow(F, '因幡指定端子', 'UK5N', 'フエニックス', '指定商社', '因幡電機')
log('rows', A, B, C, D, E, F, G)
log('publish →', await t.publish('1'))
await t.role('purchasing')
const files = async (from) => { const out = []; for (const dl of t.downloads.slice(from)) { const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(dl.name); const sh = wb.worksheets[0]; let sup = ''; const ids = []; sh.eachRow((r) => { const v = r.values.slice(1); const j = v.indexOf('宛先'); if (j >= 0 && !sup) sup = v[j + 1]; if (typeof v[0] === 'string' && /^R\d+$/.test(v[0])) ids.push(v[0]) }); out.push({ sup, file: dl.suggested, ids }) } return out }
async function requestTo(prefix) {
  const n0 = t.downloads.length
  await t.cmd('概算見積を依頼'); await page.waitForTimeout(100); const pr = await t.panel()
  const i = prefix ? (pr?.options ?? []).findIndex((o) => o.startsWith(prefix + ' ')) : 0
  for (let k = 0; k < i; k++) await t.press('ArrowDown')
  await t.press('Enter'); await page.waitForTimeout(1300)
  const msg = await t.toast(); const f = await files(n0)
  return { opts: pr?.options, title: pr?.title, msg, f }
}
const r1 = await requestTo(null); log('request all →', r1.title, '|', r1.msg); for (const f of r1.f) log('  file', f.sup, f.file, f.ids.join(','))
let p = await t.proj(); for (const id of [A, B, C, D, E, F, G]) log(show(p, id))
const tg = (id) => p.quotes.filter((q) => q.rowId === id && !q.stale).map((q) => q.supplierId).sort().join(',')
check('Z1-1 (M6-04) パトライトの行は因幡・ミスミだけに依頼（立花に出さない）', tg(A) === 'S1,S3', tg(A))
check('Z1-2 (M6-04) 音羽電機の行は立花・ミスミだけに依頼（因幡に出さない）', tg(B) === 'S2,S3', tg(B))
check('Z1-3 メーカを英字で書いた行（OMRON）も、オムロンを扱う因幡・立花に依頼される', tg(C).includes('S1') && tg(C).includes('S2'), `targets=${tg(C)}`)
check('Z1-3b 依頼の確認・結果に、メーカで絞った（除いた）商社が分かる表示がある', /絞|扱わ|除/.test((r1.title ?? '') + r1.msg), r1.msg)
// M6-01: 客先指定品 E（因幡に依頼）→ 立花の欄に先に値 → 因幡の回答
await t.press('6')
log('E: S2 first', await t.setCellKey(E, 'q.unitPrice@S2', '500')); await t.press('Escape'); await t.setCellKey(E, 'q.leadDays@S2', '3'); await t.press('Escape')
p = await t.proj(); log('E after S2', show(p, E))
const e1 = p.rows.find((r) => r.id === E)
await t.setCellKey(E, 'q.unitPrice@S1', '800'); await t.press('Escape'); await t.setCellKey(E, 'q.leadDays@S1', '5'); await t.press('Escape')
p = await t.proj(); log('E after S1', show(p, E))
check('Z1-4 (M6-01) 依頼先（因幡）が答える前に立花に値を入れても立花で採用されない。因幡の回答で因幡を採用', e1.adoptedSupplierId !== 'S2' && p.rows.find((r) => r.id === E).adoptedSupplierId === 'S1', show(p, E))
// M6-02 / U6-05: D パナソニック（立花に依頼）→ 立花が取扱なし
log('D before decline', show(p, D))
log('D decline', await t.setCellKey(D, 'q.leadDays@S2', '取扱なし')); await t.press('Escape')
p = await t.proj(); log('D after decline', show(p, D), 'ball', await t.cellText(D, 'ball'))
await t.press('4'); const pu4 = (await t.viewRows()).includes(D); await t.goto(D); const sbD = (await t.status()); log('purch 4 has D', pu4, 'status bar', sbD.slice(0, 250))
await t.press('Control+.'); await page.waitForTimeout(80); const qfD = await t.panel(); log('purch Ctrl+. on D', JSON.stringify(qfD?.options)); if (qfD) await t.press('Escape')
await t.goto(D); await t.press(' '); await page.waitForTimeout(80); log('detail D', (await page.getByTestId('detail').textContent()).slice(0, 300)); await t.press(' ')
const lampsP = await t.lamps(); const prog = await page.getByTestId('quote-progress').textContent().catch(() => '')
await t.role('design'); await t.press('4'); const de4 = (await t.viewRows()).includes(D); await t.role('purchasing')
log('design 4 has D', de4, 'lamps', lampsP, 'progress', prog)
check('Z1-5 (M6-02) 客先指定品の依頼先が辞退 → 見積中のまま・ボール購買・購買の 4 に出る・設計の 4 に出ない', p.rows.find((r) => r.id === D).status === 'quoting' && (await t.cellText(D, 'ball')) === '購買' && pu4 && !de4, `st=${p.rows.find((r) => r.id === D).status} ball=${await t.cellText(D, 'ball')} pu4=${pu4} de4=${de4}`)
check('Z1-5b 購買の 4 で、辞退した行に「次の商社へ依頼」の案内が出る（ステータスバー・Ctrl+.・詳細のどれか）', /次の商社|依頼し直|頼み直|辞退/.test(sbD + JSON.stringify(qfD?.options ?? [])), sbD.slice(0, 160))
const r2 = await requestTo(null); log('re-request →', r2.msg, JSON.stringify(r2.f))
p = await t.proj(); log('D after re-request', show(p, D))
const nextD = p.quotes.filter((q) => q.rowId === D && !q.stale && q.leadDays !== -1).map((q) => q.supplierId)
const ws = await t.ws(); const carriesD = ws.suppliers.filter((s) => nextD.includes(s.id)).map((s) => `${s.name}:${s.handledMakers.length === 0 ? '未登録' : s.handledMakers.includes('パナソニック')}`)
log('D next to', nextD, carriesD)
check('Z1-6 (U6-05) 辞退後の次の依頼先が、パナソニックを扱わない因幡に黙って決まらない（扱う商社が無いことを知らせるか、購買が選ぶ）', !nextD.includes('S1') || /扱|メーカ/.test(r2.msg), `next=${nextD} msg=${r2.msg}`)
// M5-01: 案件外の指定先（オムロン直販）
await t.press('6')
let f5 = 'n/a'; try { f5 = await t.setCellKey(F, 'q.unitPrice@S5', '2100'); await t.press('Escape'); f5 += ' / ' + await t.setCellKey(F, 'q.leadDays@S5', '6'); await t.press('Escape') } catch (e) { f5 = 'ERR ' + e.message.slice(0, 100) }
p = await t.proj(); log('F (直販) enter →', f5, show(p, F))
check('Z1-7 (M5-01) 6 にオムロン直販の列があり、回答を入れると直販指定の行が S5 で採用', p.rows.find((r) => r.id === F).adoptedSupplierId === 'S5', show(p, F))
await t.cmd('見積回答を取り込む'); await page.waitForTimeout(100); const imp = await t.panel(); log('import options', JSON.stringify(imp?.options)); if (imp) await t.press('Escape')
check('Z1-8 (M5-01) 見積回答の取り込みで直販を選べる', (imp?.options ?? []).some((o) => o.startsWith('S5')), JSON.stringify(imp?.options))
await t.press('9'); const v9cols = await page.evaluate(async () => { const m = await import(window.__m('/src/model/selectors.ts')); const s = (await import(window.__m('/src/model/store.ts'))).useStore.getState(); return m.viewColumns(s, s.project()).filter((c) => c.includes('@')).join(',') })
log('9 columns', v9cols)
// 相見積の行（フエニックス）が直販に依頼されない
p = await t.proj(); log('project supplierIds', JSON.stringify(p.supplierIds))
// U6-04: 指定商社 G（因幡）が辞退 → 設計の 4 に「指定先を変える」
await t.press('6'); log('G decline', await t.setCellKey(G, 'q.leadDays@S1', '取扱なし')); await t.press('Escape')
p = await t.proj(); log('G after decline', show(p, G), 'ball', await t.cellText(G, 'ball'))
await t.press('4'); const gpu4 = (await t.viewRows()).includes(G)
await t.role('design'); await t.press('4'); const gde4 = (await t.viewRows()).includes(G); await t.goto(G); await t.press('Home'); const sbG = await t.status(); log('design 4 has G', gde4, 'purch4', gpu4, 'status', sbG.slice(0, 250))
await t.press('Control+.'); await page.waitForTimeout(80); const qfG = await t.panel(); log('design Ctrl+. on G', JSON.stringify(qfG?.options)); if (qfG) await t.press('Escape')
await t.shot('z1-designated-declined')
check('Z1-9 (U6-04) 指定商社の辞退で設計の 4 に出て、「指定先を変える」の案内がある', gde4 && /指定先/.test(sbG + JSON.stringify(qfG?.options ?? [])), `de4=${gde4} sb=${sbG.slice(0, 120)}`)
// 設計が指定先を立花に変えて公開 → 購買が依頼 → 立花の回答で採用
await t.press('1'); log('change designated', await t.setCellKey(G, 'designated', '立花エレテック'))
log('publish G →', await t.publish('6'))
p = await t.proj(); log('G after publish', show(p, G), 'ball', await t.cellText(G, 'ball'), JSON.stringify(p.rows.find((r) => r.id === G).flags))
await t.role('purchasing'); await t.press('4'); log('purch 4 has G', (await t.viewRows()).includes(G))
const r3 = await requestTo(null); log('request after designated change →', r3.msg, JSON.stringify(r3.f))
p = await t.proj(); log('G', show(p, G))
check('Z1-10 指定先を変えて公開すると、新しい指定先（立花）に依頼書が出る', r3.f.some((f) => /立花/.test(f.sup + f.file) && f.ids.includes(G)), JSON.stringify(r3.f))
await t.press('6'); await t.setCellKey(G, 'q.unitPrice@S2', '700'); await t.press('Escape'); await t.setCellKey(G, 'q.leadDays@S2', '4'); await t.press('Escape')
p = await t.proj(); log('G after S2 answer', show(p, G))
check('Z1-11 新しい指定先の回答で指定先（固定）として採用', p.rows.find((r) => r.id === G).adoptedSupplierId === 'S2' && p.rows.find((r) => r.id === G).adoptReason === '指定先（固定）', show(p, G))
// M6-05: 指定系の行に設計が Alt+a / Ctrl+Alt+A / Alt+Shift+A
await t.role('design'); await t.press('1')
for (const [id, key] of [['R045', 'Alt+a'], ['R045', 'Control+Alt+a'], ['R034', 'Alt+a'], [E, 'Alt+a'], ['R045', 'Alt+Shift+A']]) {
  const before = show(await t.proj(), id)
  await t.goto(id); await page.keyboard.rawPress(key); await page.waitForTimeout(100); const pn = await t.panel(); const msg = await t.toast(); if (pn) { log('  panel', JSON.stringify(pn).slice(0, 200)); await t.press('Escape') }
  const after = show(await t.proj(), id)
  log(id, key, '→', msg); log('  before', before); log('  after ', after)
  check(`Z1-12 (M6-05) ${id} ${key} で指定先（固定）が消えない・スコアが付かない`, before.match(/reason=[^ ]*/)[0] === after.match(/reason=[^ ]*/)[0] && before.match(/snap=[^ ]*/)[0] === after.match(/snap=[^ ]*/)[0], msg)
}
log('bulk →', await t.bulk())
p = await t.proj(); log('after bulk', show(p, 'R045'), show(p, 'R034'))
check('Z1-13 一括採用でも指定系の行は指定先（固定）のまま', p.rows.find((r) => r.id === 'R045').adoptReason === '指定先（固定）' && p.rows.find((r) => r.id === 'R034').adoptReason === '指定先（固定）')
summary(); await t.close()
