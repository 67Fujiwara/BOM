// q4: 商社マスタから S1 を JSON で削除 → 採用が外れた行の知らせ（状態バー・詳細）の言い回し／採用の列／選定記録／発注済・入荷済の表示／案件設定（納期の保存・相見積先に残った ID）／同じ ID で復元
//   usage: node q4.mjs
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
import { csHelpers } from './mcs.mjs'
import { refs, importWs, errs, stuck, scanViews, lintXlsx } from './plib.mjs'
const tag = 'Q4'
const t = await launch({ time: '2026-10-26T09:00:00+09:00' }); const { page } = t; const h = helpers(t); const c = csHelpers(t, h)
await t.open('design'); log('bulk →', (await t.bulk()).slice(0, 50))
let p = await t.proj()
p = await t.proj(); const S = p.rows.find((r) => r.status === 'selected' && r.adoptedSupplierId === 'S1' && r.procurement === '相見積' && !r.flags.contested && !r.flags.leadNG && !r.needDateFixed).id
await t.role('design'); await t.press('1'); await t.setCellKey(S, 'qtyNeeded', String(((await t.row(S)).qtyNeeded) + 1)) // 作業中にして正式依頼から外す（選定済のまま残す）
await t.role('purchasing'); log('formal →', (await t.requestFormal()).slice(-40)); p = await t.proj()
const fr = p.rows.filter((r) => r.status === 'formalRequested' && r.adoptedSupplierId === 'S1' && r.procurement === '相見積' && !r.needDateFixed && !r.flags.contested && !r.flags.leadNG)
const [A, B, E] = fr.map((r) => r.id)
const adq = (id) => p.quotes.find((x) => x.rowId === id && x.supplierId === 'S1' && !x.stale)
await t.press('8'); for (const id of [A, B]) { await t.setCellKey(id, 'q.formalPrice@A', String(adq(id).unitPrice)); await t.press('Escape'); await t.setCellKey(id, 'q.formalLeadDays@A', '10'); await t.press('Escape') }
log('order A →', (await t.order(A)).slice(0, 50)); await t.setTime('2026-11-02T10:00:00+09:00'); await t.press('3'); await t.goto(A); await t.colKey('received'); await t.press('Enter'); await page.waitForTimeout(100)
log('order B →', (await t.order(B)).slice(0, 50))
p = await t.proj()
log('A', h.show(p, A).slice(0, 120)); log('B', h.show(p, B).slice(0, 120)); log('E(formalRequested)', h.show(p, E).slice(0, 120)); log('S(selected)', h.show(p, S).slice(0, 120))
const msg = await importWs(t, (ws) => { ws.suppliers = ws.suppliers.filter((s) => s.id !== 'S1') }); log('import →', msg.slice(0, 80))
p = await t.proj(); const ws = await t.ws()
log('supplierIds', JSON.stringify(p.supplierIds), 'preferred', JSON.stringify(p.preferredSupplierIds), 'requestRevs', JSON.stringify(p.requestRevs))
log('S', h.show(p, S).slice(0, 200)); log('E', h.show(p, E).slice(0, 260))
// 状態バーの文言
await t.role('design'); await t.press('4'); await t.goto(S); await page.waitForTimeout(100); const sbS = await t.status(); log('status bar S:', sbS)
await t.role('purchasing'); await t.press('9'); await t.goto(E); await page.waitForTimeout(100); const sbE = await t.status(); log('status bar E:', sbE)
check(`${tag}-1 削除で採用が外れた選定済の行に知らせが出る（状態バー）。商社の ID が分かる`, /S1/.test(sbS) && !/undefined/.test(sbS), sbS.slice(0, 200))
check(`${tag}-2 知らせの言い回しが「削除」に合っている（「S1（商社マスタから削除） は取引停止（商社マスタ）のため」と二重にならない）`, !/削除[）)]*\s*は取引停止/.test(sbS), sbS.slice(0, 200))
check(`${tag}-3 正式依頼中だった行 E の取下げの記録が商社の ID で出る（undefined なし）`, !!(await t.row(E)).flags.formalWithdrawn && /S1/.test((await t.row(E)).flags.formalWithdrawn) && !/undefined/.test((await t.row(E)).flags.formalWithdrawn), String((await t.row(E)).flags.formalWithdrawn))
// 採用の列
for (const [id, label] of [[A, '入荷済'], [B, '発注済']]) {
  const out = {}; for (const role of ['purchasing', 'pm', 'design']) { await t.role(role); for (const v of [3, 8, 9]) { await t.press(String(v)); const inV = (await t.viewRows()).includes(id); if (inV) { try { out[`${role[0]}${v}`] = await t.cellText(id, 'adopted') } catch { out[`${role[0]}${v}`] = '(no col)' } } } }
  log(label, id, JSON.stringify(out))
  const texts = Object.values(out).filter((x) => x !== '(no col)')
  check(`${tag}-4 ${label}の行の「採用」の列が空欄でなく、ID を示す`, texts.length > 0 && texts.every((x) => /S1/.test(x)), JSON.stringify(out))
}
// 選定記録
await t.role('purchasing'); const n0 = t.downloads.length
await t.cmd('選定記録を出力'); await page.waitForTimeout(1200)
const ex = await c.sheetsOf(n0); const rowsSel = ex.flatMap((s) => s.rows)
const recA = rowsSel.find((r) => r[0] === A); log('selection record A', JSON.stringify(recA)?.slice(0, 300))
check(`${tag}-5 選定記録 Excel の採用に ID が出る（空欄でない・undefined なし）`, !!recA && /S1/.test(String(recA[3])) && !/undefined/.test(JSON.stringify(recA)), JSON.stringify(recA)?.slice(0, 200))
// 案件設定：納期の保存は相見積先に残った S1 に邪魔されない
p = await t.proj(); const n1 = (await t.proj()).supplierIds.includes('S1')
await t.role('pm'); log('set dueDate →', (await h.setting('dueDate', '2026-12-25', '納期')).slice(0, 80)); p = await t.proj()
check(`${tag}-6 案件設定で納期だけ変えて保存できる（相見積先に消えた S1 が残っていても）`, p.dueDate === '2026-12-25', `${p.dueDate} supplierIds=${JSON.stringify(p.supplierIds)}`)
await t.role('purchasing'); let m4 = ''; try { m4 = await h.setting('supplierIds', p.supplierIds.concat(['S4']).join(','), '追加') } catch (e) { m4 = 'EXC ' + String(e.message).split('\n')[0] } ; log('set supplierIds (add S4) →', String(m4).slice(0, 160)); for (let i = 0; i < 3; i++) if (await t.panel()) await page.keyboard.press('Escape')
const p2 = await t.proj(); log('supplierIds after', JSON.stringify(p2.supplierIds))
check(`${tag}-7 [U22-01] 相見積先に消えた商社の ID が残らない（読み込み時に除かれる）`, !p.supplierIds.includes('S1'), JSON.stringify(p.supplierIds))
// 同じ ID で復元
await t.role('purchasing')
const msg2 = await importWs(t, (w) => { if (!w.suppliers.some((s) => s.id === 'S1')) w.suppliers.unshift({ id: 'S1', name: '因幡電機', tradable: true, handledMakers: [], kind: '商社', avl: true, performance: { ontime: 0.9, defect: 0.01 }, color: '#3366cc' }) }); log('restore →', msg2.slice(0, 60))
p = await t.proj(); log('E after restore', h.show(p, E).slice(0, 200), 'S', h.show(p, S).slice(0, 160))
const sk = await stuck(t); check(`${tag}-8 固まる行がない`, sk.length === 0, sk.slice(0, 4))
const bad = await scanViews(t); check(`${tag}-9 全ビュー×3 役割に undefined なし`, bad.length === 0, bad.slice(0, 4))
errs(t, tag + '-99'); summary(); await t.close()
