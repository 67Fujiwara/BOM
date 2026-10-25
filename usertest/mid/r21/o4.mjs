// o4: 商社マスタの JSON 読み込みで、採用中の商社（発注済・入荷済・正式依頼中・選定済の行がある）をマスタから消す（M20-05 の修正の確認と周辺）
//   mode=remove : S を商社マスタから消す。発注済・入荷済は採用のまま（取引停止と同じ）、発注前は採用を外れ取下げの記録
//   mode=stop   : 同じ行で取引停止（対照）
//   周辺: 画面（採用の列・8・3）、概算見積を依頼のパネル、保管用 Excel の見出し（undefined を含まない）、console error、案件の相見積先
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
const mode = process.argv[2] ?? 'remove'
const t = await launch({ time: '2026-10-26T09:00:00+09:00' }); const { page } = t; const h = helpers(t)
const adq = (p, id) => { const r = p.rows.find((x) => x.id === id); return p.quotes.find((x) => x.rowId === id && x.supplierId === r.adoptedSupplierId && !x.stale) }
async function formalAnswer(id, lead) { const p = await t.proj(); await t.press('8'); await t.setCellKey(id, 'q.formalPrice@A', String(adq(p, id).unitPrice)); await t.press('Escape'); await t.setCellKey(id, 'q.formalLeadDays@A', String(lead)); await t.press('Escape') }
async function receive(id) { await t.press('3'); await t.goto(id); await t.colKey('received'); await t.press('Enter'); await page.waitForTimeout(100); return t.toast() }
async function importWs(mut) {
  const ws = await t.ws(); mut(ws)
  await t.cmd('JSON を読み込む'); await page.waitForTimeout(150)
  await page.getByTestId('import-text').fill(JSON.stringify(ws)); await page.getByTestId('import-text').press('Control+Enter'); await page.waitForTimeout(250)
  for (let g = 0; g < 3; g++) { const pn = await t.panel(); if (!pn) break; const i = (pn.options ?? []).findIndex((o) => /置き換える/.test(o)); if (i < 0) { await t.press('Escape'); break } for (let k = 0; k < i; k++) await t.press('ArrowDown'); await t.press('Enter'); await page.waitForTimeout(250) }
  await page.locator('.gridwrap').focus(); return t.toast()
}
await t.open('design'); log('bulk →', await t.bulk())
await t.role('purchasing'); log('formal →', await t.requestFormal())
let p = await t.proj()
const base = p.rows.filter((r) => r.status === 'formalRequested' && r.procurement === '相見積' && !r.flags.leadNG && !r.flags.contested && !r.needDateFixed)
const S = base[0].adoptedSupplierId; const same = base.filter((r) => r.adoptedSupplierId === S)
const [A, B, C] = [same[0].id, same[1].id, same[2].id]; const E = same[3].id
log('S', S, 'A(入荷済)', A, 'B(発注済)', B, 'C(正式依頼中)', C, 'E(正式見積済)', E)
for (const id of [A, B, E]) await formalAnswer(id, 10)
await t.press('Escape'); for (const id of [A, B]) log('order', id, await t.order(id))
await t.setTime('2026-11-02T10:00:00+09:00'); log('receive A', await receive(A))
p = await t.proj(); log('A', h.show(p, A)); log('B', h.show(p, B)); log('E', h.show(p, E)); log('C', h.show(p, C))
const sname = (await t.ws()).suppliers.find((s) => s.id === S).name
const adoptedBefore = p.rows.filter((r) => r.adoptedSupplierId === S).length
const msg = await importWs((ws) => { if (mode === 'remove') ws.suppliers = ws.suppliers.filter((s) => s.id !== S); else ws.suppliers = ws.suppliers.map((s) => (s.id === S ? { ...s, tradable: false } : s)) })
log(mode, S, sname, '→', msg); p = await t.proj()
const rA = p.rows.find((r) => r.id === A), rB = p.rows.find((r) => r.id === B), rC = p.rows.find((r) => r.id === C), rE = p.rows.find((r) => r.id === E)
log('A', h.show(p, A)); log('B', h.show(p, B)); log('E', h.show(p, E)); log('C', h.show(p, C))
check(`O4-${mode}-1 発注済（B）・入荷済（A）の採用と状態は変わらない`, rB.status === 'ordered' && rB.adoptedSupplierId === S && rA.status === 'received' && rA.adoptedSupplierId === S, h.show(p, B))
check(`O4-${mode}-2 発注前（C 正式依頼中・E 正式見積済）の採用は外れ、正式依頼の取下げが記録される`, !rC.adoptedSupplierId && !!rC.flags.formalWithdrawn && !rE.adoptedSupplierId && !!rE.flags.formalWithdrawn, `${h.show(p, C).slice(0, 140)} | ${h.show(p, E).slice(0, 140)}`)
const left = p.rows.filter((r) => r.adoptedSupplierId === S && !['ordered', 'received'].includes(r.status)).length
log('left rows', JSON.stringify(p.rows.filter((r) => r.adoptedSupplierId === S && !['ordered', 'received'].includes(r.status)).map((r) => h.show(p, r.id).slice(0, 220))))
check(`O4-${mode}-3 発注前の採用が S に 1 行も残らない（${adoptedBefore} 行中）`, left === 0, `left=${left}`)
check(`O4-${mode}-4 取下げの知らせは商社の名前（${sname}）か依頼 No を含む`, /因幡|P-2026-041-S1/.test(rC.flags.formalWithdrawn ?? ''), rC.flags.formalWithdrawn)
// 画面
await t.role('purchasing'); await t.press('8')
const cellB = await t.cellText(B, 'adopted'), cellC = await t.cellText(C, 'adopted')
log('採用の列 B(発注済)', JSON.stringify(cellB), 'C(取下げ)', JSON.stringify(cellC))
check(`O4-${mode}-5 発注済の行の「採用」の列が空欄にならない（誰に発注したか見える）`, !!String(cellB).trim(), JSON.stringify(cellB))
// 概算見積を依頼のパネル
await t.cmd('概算見積を依頼'); await page.waitForTimeout(150); const pr = await t.panel(); log('rough request panel', JSON.stringify(pr?.options)); await t.press('Escape'); if (await t.panel()) await t.press('Escape')
if (mode === 'remove') check('O4-remove-6 概算見積の依頼先に消えた商社が出ない', !(pr?.options ?? []).some((o) => o.startsWith(S + ' ') || o.includes(sname)), JSON.stringify(pr?.options))
// 保管用 Excel
const ex = await (async () => { const { csHelpers } = await import('./mcs.mjs'); return csHelpers(t, h).excel(2) })()
const bom = ex.find((s) => s.sh === 'BOM'); const head = bom.rows[0].map(String)
log('保管用 見出し', JSON.stringify(head.filter((x) => /単価|納期|MOQ/.test(x))))
check(`O4-${mode}-7 保管用 Excel の見出しに undefined が出ない`, !head.some((x) => /undefined/.test(x)), JSON.stringify(head.filter((x) => /undefined/.test(x))))
const rowB = bom.rows.find((r) => r[0] === B); const iAdopt = head.indexOf('採用')
check(`O4-${mode}-8 保管用 Excel の B の採用が空欄にならない`, !!String(rowB?.[iAdopt] ?? '').trim(), JSON.stringify(rowB?.[iAdopt]))
// 入荷（発注済 B は商社が消えても入荷できる）
log('receive B', await receive(B)); p = await t.proj()
check(`O4-${mode}-9 商社が消えて/停止しても、発注済の行は入荷できる`, p.rows.find((r) => r.id === B).status === 'received', h.show(p, B))
// 正式依頼：C は選び直して依頼する → S には出ない
await t.role('design'); await t.press('1'); log('re-bulk →', await t.bulk())
await t.role('purchasing'); const n0 = t.downloads.length; const fm = await t.requestFormal(); await page.waitForTimeout(1500); const files = await h.files(n0); log('formal again', fm.slice(0, 120), JSON.stringify(files.map((f) => [f.sup, f.ids.length])))
check(`O4-${mode}-10 選び直しの正式依頼書が消えた/停止の商社宛にならない`, !files.some((f) => f.sup === sname), JSON.stringify(files.map((f) => f.sup)))
p = await t.proj(); const rC2 = p.rows.find((r) => r.id === C); log('C after re-adopt', h.show(p, C).slice(0, 200))
check(`O4-${mode}-11 C は別の商社を採用し直せる`, !!rC2.adoptedSupplierId && rC2.adoptedSupplierId !== S, h.show(p, C).slice(0, 160))
log('ERRORS', JSON.stringify(t.errors)); check(`O4-${mode}-12 console error なし`, t.errors.length === 0, JSON.stringify(t.errors).slice(0, 300)); summary(); await t.close()
