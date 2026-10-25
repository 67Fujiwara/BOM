// o5b: 承認 ON。承認待ちの変更セット（必要数・部品名・調達区分・取消・追加）があるときの Excel（社内／商社向け共通／保管用）を役割ごとに
//   期待（§5・§1）: 購買・商社向け・保管用には公開値だけ（承認待ちの値・追加行は出ない。取消待ちの行は今のまま有効）。設計の社内 Excel は作業中の値＋「作業中の値・未公開」。PM は承認する側
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
import { csHelpers } from './mcs.mjs'
import { rowOf } from './nlib.mjs'
const t = await launch(); const { page } = t; const h = helpers(t); const c = csHelpers(t, h)
const sel = await c.setup()
const [D, E, F] = [sel[1].id, sel[2].id, sel[3].id]
const qD = sel[1].qtyNeeded, nE = sel[2].name, qF = sel[3].qtyNeeded
await t.press('1')
const N = await h.addRow('R075', '追加行N', 'G3VM-61A1', 'オムロン', '相見積', '', '4')
log('D qty →', await t.setCellKey(D, 'qtyNeeded', String(qD + 3)))
log('E name →', await t.setCellKey(E, 'name', '承認待ち部品名'))
await t.goto(F); await t.press('Home'); await t.press('Shift+Delete'); await page.waitForTimeout(120); const pn = await t.panel(); if (pn?.kind === 'prompt') { try { await t.promptFill('不要') } catch {} ; await t.press('Enter'); await page.waitForTimeout(100) }
log('publish →', (await t.publish('1')).slice(0, 80))
let p = await t.proj(); log('D', h.show(p, D).slice(0, 120), '| N', rowOf(p, N).flags.pmPending, '| F removal', JSON.stringify(rowOf(p, F).pendingRemoval ?? rowOf(p, F).removal ?? null), rowOf(p, F).status)
const hdr = (bom) => bom.rows[0].map(String)
const get = (bom, id, col) => { const i = hdr(bom).indexOf(col); const r = bom.rows.find((x) => x[0] === id); return r ? r[i] : undefined }
for (const [idx, nm] of [[0, '社内'], [1, '商社向け共通'], [2, '保管用']]) {
  for (const role of ['design', 'purchasing', 'pm']) {
    await t.role(role)
    let ex; try { ex = await c.excel(idx) } catch (e) { log('ERR', role, nm, e.message); continue }
    const bom = ex.find((s) => s.sh === 'BOM'); if (!bom) { log(role, nm, 'BOM シートなし', ex.map((s) => s.sh).join(',')); continue }
    const qd = get(bom, D, '必要数'), ne = get(bom, E, '部品名'), hasN = bom.rows.some((x) => x[0] === N), fRow = bom.rows.find((x) => x[0] === F), stD = get(bom, D, '状態')
    log(role, nm, `D 必要数=${qd} E 部品名=${ne} N あり=${hasN} F あり=${!!fRow} D 状態=${stD}`)
    if (role === 'purchasing' || idx === 1 || idx === 2) {
      if (!(role === 'design' && idx === 0)) {
        check(`O5B-${nm}-${role}-1 公開値だけ（D の必要数は承認前の ${qD}）`, qd === qD || (role === 'pm' && idx === 0), `D=${qd}`)
        check(`O5B-${nm}-${role}-2 承認待ちの部品名が出ない（E は ${nE}）`, ne === nE || (role === 'pm' && idx === 0), `E=${ne}`)
        check(`O5B-${nm}-${role}-3 承認待ちの追加行 N が出ない（設計・PM の社内／保管用は承認する側・出した側なので出てよい）`, !hasN || (idx !== 1 && role !== 'purchasing'), `hasN=${hasN}`)
        check(`O5B-${nm}-${role}-4 取消待ちの行 F はまだ有効（取消線なし・出ている）`, !!fRow, `F=${!!fRow}`)
      }
    }
    if (idx === 0 && role === 'design') { check('O5B-社内-design-1 設計の社内 Excel は出した値（D 必要数 ' + (qD + 3) + '）', Number(qd) === qD + 3, `D=${qd} 状態=${stD}`); log('INFO 設計の社内 Excel：承認待ちの値の行の状態の欄は', JSON.stringify(stD), '（承認待ちの注記なし）') }
    if (idx === 0 && role !== 'design') {
      const chg = ex.filter((s) => s.sh === '変更点').flatMap((s) => s.rows).filter((r) => [D, E, N, F].includes(r[3]) && r[0] !== '' && r[0] !== 1).map((r) => [r[0], r[3], String(r[7] ?? '').slice(0, 30), String(r[8] ?? '')])
      log(role, '変更点', JSON.stringify(chg))
      if (role === 'purchasing') check('O5B-社内-purchasing-5 購買の変更点に承認待ちの Rev の行（D・E・N・F）が出ない', chg.length === 0, JSON.stringify(chg))
      else check('O5B-社内-pm-5 PM の変更点には承認待ちの Rev の行が出る（承認する側）', chg.length >= 3, JSON.stringify(chg))
    }
  }
}
log('ERRORS', JSON.stringify(t.errors)); summary(); await t.close()
