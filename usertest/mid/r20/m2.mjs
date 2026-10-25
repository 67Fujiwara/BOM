// m2: 承認 ON・正式依頼中の行。Rev.c＝C・D の必要数（客先要求）→ Rev.d＝C の部品名（C を Rev.d にまとめる）
//   → 購買が C の型式に質問 → 設計が型式の表記だけ直して公開（指摘対応の Rev.e、すぐ公開値）
//   mode=approve: PM が Rev.c（D）を承認 → 購買が再発行（D だけ、差分は D の必要数）→ PM が Rev.d（C）を承認 → 再発行（C の必要数・部品名、型式は直したまま）
//   mode=reject : PM が Rev.c（D）を承認 → Rev.d（C）を却下 → C の型式は Rev.e のまま、必要数・部品名が作業中に戻る。再発行に C が出ない
//   変更点（3 役割）：Rev.e の内容は型式の表記だけ（承認待ち・まとめた値と比べない）
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
import { csHelpers } from './mcs.mjs'
import ExcelJS from '/home/user/BOM/node_modules/exceljs/excel.js'
const mode = process.argv[2] ?? 'approve'
const t = await launch(); const { page } = t; const h = helpers(t); const c = csHelpers(t, h)
async function question(id, col, text) {
  await t.role('purchasing'); await t.press('1'); await t.goto(id); await t.colKey(col); await t.press('Shift+I'); await page.waitForTimeout(60); await t.press('q'); await page.waitForTimeout(60)
  await page.getByTestId('issue-text').fill(text); await page.getByTestId('issue-text').press('Enter'); await page.waitForTimeout(80); return t.publish()
}
async function formal() {
  await t.role('purchasing'); await t.press('8'); const n0 = t.downloads.length; const msg = await t.requestFormal(); const out = []
  for (const dl of t.downloads.slice(n0)) { const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(dl.name); let sup = ''; const ids = []; wb.worksheets[0].eachRow((r) => { const v = r.values.slice(1); const j = v.indexOf('宛先'); if (j >= 0) sup = v[j + 1]; if (typeof v[0] === 'string' && /^R\d+$/.test(v[0])) ids.push([v[0], v[1], v[2], v[4]]) }); const diff = []; wb.getWorksheet('差分')?.eachRow((r, i) => { if (i > 1) diff.push(r.values.slice(1)) }); out.push({ sup, ids, diff }) }
  return { msg, out }
}
async function keep(id) {
  await t.role('purchasing'); await t.press('9'); await t.goto(id); await t.press('Home'); await t.press('Control+.'); await page.waitForTimeout(80); const o = (await t.panel())?.options ?? []
  const i = o.findIndex((x) => x.includes('据え置き')); if (i < 0) { await t.press('Escape'); return 'NO KEEP ' + JSON.stringify(o) }
  for (let k = 0; k < i; k++) await t.press('ArrowDown'); await t.press('Enter'); await page.waitForTimeout(120); return t.toast()
}
// 一括採用 → 正式依頼（承認 ON はこのあと）
await t.open('design'); log('publish drafts first →', await t.publish('1')); log('bulk →', await t.bulk())
await t.role('purchasing'); log('formal 1 →', (await formal()).msg)
await t.role('pm'); log('approval ON →', await h.setting('changeNeedsPmApproval', 'はい', '承認制'))
let p = await t.proj()
const clean = await page.evaluate(async () => { const m = await import(window.__m('/src/model/rules.ts')); const s = (await import(window.__m('/src/model/store.ts'))).useStore.getState(); const p = s.project(); return p.rows.filter((r) => !m.checkRow(r, s.ws.rules, p).length).map((r) => r.id) })
const fr = p.rows.filter((r) => clean.includes(r.id) && !r.working && r.status === 'formalRequested' && r.procurement === '相見積' && !r.flags.contested && !r.flags.leadNG && !r.needDateFixed && r.qtyNeeded >= 5 && /[A-Z]/.test(r.model))
const C = fr[0].id, D = fr[1].id, qC = fr[0].qtyNeeded, qD = fr[1].qtyNeeded, nC = fr[0].name, mC = fr[0].model
const mC2 = mC.toLowerCase()
log('C', h.show(p, C), mC, 'D', h.show(p, D))
await t.role('design'); await t.press('1')
log('C qty →', await t.setCellKey(C, 'qtyNeeded', String(qC + 1))); log('D qty →', await t.setCellKey(D, 'qtyNeeded', String(qD + 1))); log('publish Rev.c →', await t.publish('1'))
p = await t.proj(); const revC = p.submissions.at(-1).rev
log('C name →', await t.setCellKey(C, 'name', 'NAME-C2')); log('publish Rev.d →', await t.publish('3'))
p = await t.proj(); const revD = p.submissions.at(-1).rev
log('question →', await question(C, 'model', '型式の表記（小文字）を図面に合わせて'))
await t.role('design'); await t.press('1'); log('C model (fix) →', await t.setCellKey(C, 'model', mC2)); log('publish fix →', await t.publish('1'))
p = await t.proj(); const revE = p.submissions.at(-1).rev
log('subs', c.subs(p), 'revE', revE, 'causes', JSON.stringify(p.submissions.at(-1).causes))
let rC = c.row(p, C)
log('C before PM', h.show(p, C), 'model', rC.model, 'pa', JSON.stringify(rC.pendingApproval), 'pendingRev', rC.pendingRev)
check('M2-0 指摘対応の型式の表記修正はすぐ公開値（Rev.e）、C は Rev.d の承認待ちのまま、再発行対象にならない', rC.model === mC2 && rC.pendingRev === revD && rC.flags.pmPending && !rC.flags.reissue, `${h.show(p, C)} model=${rC.model}`)
// PM: Rev.c を D で承認
await t.role('pm'); await t.press('7'); log('PM y D →', (await t.yes(D, 'Rev.c 承認')).toast)
p = await t.proj(); rC = c.row(p, C); const rD = c.row(p, D)
log('after Rev.c', h.show(p, D), '|', h.show(p, C))
check('M2-1 Rev.c の承認で D は必要数が変わり取下げ・再発行対象、C は再発行対象にならない（必要数は Rev.d 待ち）', rD.qtyNeeded === qD + 1 && rD.flags.reissue && rC.qtyNeeded === qC && !rC.flags.reissue, `D ${rD.qtyNeeded} reissue=${rD.flags.reissue} C ${rC.qtyNeeded} reissue=${rC.flags.reissue}`)
log('keep D →', await keep(D)); p = await t.proj(); log('D after keep', h.show(p, D))
const f2 = await formal(); log('formal 2 →', f2.msg, JSON.stringify(f2.out.map((o) => [o.sup, o.ids.map((x) => x[0]).join(','), o.diff])))
const all2 = f2.out.flatMap((o) => o.ids.map((x) => x[0])); const diff2 = f2.out.flatMap((o) => o.diff)
check('M2-2 再発行の依頼書は D だけ（C は出ない）、差分シートの D は必要数 ' + qD + ' → ' + (qD + 1), all2.includes(D) && !all2.includes(C) && diff2.some((d) => d[0] === D && d[1] === 'qtyNeeded' && String(d[2]) === String(qD) && String(d[3]) === String(qD + 1)), JSON.stringify({ all2, diff2 }))
if (mode === 'approve') {
  await t.role('pm'); await t.press('7'); log('PM y C →', (await t.yes(C, 'Rev.d 承認')).toast)
  p = await t.proj(); rC = c.row(p, C)
  log('after Rev.d', h.show(p, C), 'model', rC.model, 'name', rC.name)
  check('M2-3 Rev.d の承認で C の必要数・部品名が公開値、型式は Rev.e で直した表記のまま、再発行対象', rC.qtyNeeded === qC + 1 && rC.name === 'NAME-C2' && rC.model === mC2 && rC.flags.reissue, `${rC.qtyNeeded} ${rC.name} ${rC.model} reissue=${rC.flags.reissue}`)
  log('keep C →', await keep(C)); p = await t.proj(); log('C after keep', h.show(p, C))
  const f3 = await formal(); log('formal 3 →', f3.msg, JSON.stringify(f3.out.map((o) => [o.sup, o.ids, o.diff])))
  const rowsC = f3.out.flatMap((o) => o.ids.filter((x) => x[0] === C)); const diffC = f3.out.flatMap((o) => o.diff.filter((d) => d[0] === C))
  check('M2-4 再発行の依頼書に C（部品名 NAME-C2・型式 ' + mC2 + '）、差分シートに C の必要数 ' + qC + ' → ' + (qC + 1) + '（型式の旧は ' + mC + '）', rowsC.some((x) => x[1] === 'NAME-C2' && x[2] === mC2) && diffC.some((d) => d[1] === 'qtyNeeded' && String(d[2]) === String(qC) && String(d[3]) === String(qC + 1)) && !diffC.some((d) => d[1] === 'model' && String(d[2]) === mC2), JSON.stringify({ rowsC, diffC }))
} else {
  await t.role('pm'); await t.press('7'); log('PM Shift+Y C →', (await t.decide(C, 'Shift+Y', '部品名は不可')).toast)
  p = await t.proj(); rC = c.row(p, C)
  log('after reject', h.show(p, C), 'model', rC.model, 'working', JSON.stringify(rC.working))
  check('M2-5 Rev.d の却下で C の型式は直した表記のまま、必要数・部品名が作業中に戻る（型式は戻らない）', rC.model === mC2 && rC.qtyNeeded === qC && rC.name === nC && rC.working?.qtyNeeded === qC + 1 && rC.working?.name === 'NAME-C2' && rC.working?.model === undefined, `${rC.model} ${rC.qtyNeeded} ${rC.name} w=${JSON.stringify(rC.working)}`)
}
for (const role of ['design', 'purchasing', 'pm']) {
  const rows = await c.chg(role, C); log(role, '変更点 C', JSON.stringify(rows))
  const re = rows.find((x) => String(x[0]) === String(revE))
  check(`M2-X-${role} 変更点：指摘対応の Rev.${revE} の C の内容は型式の表記だけ（${mC} → ${mC2}）。承認待ち・まとめた値の必要数・部品名を出さない`, re && re[2] === `型式: ${mC} → ${mC2}`, JSON.stringify(re ?? null))
}
log('ERRORS', JSON.stringify(t.errors))
summary(); await t.close()
