// ラウンド19: ラウンド18 の修正（M18-04: PM の決定パネルを開いたあとに別のタブで Rev・種別が変わったら決めない）の境目。
// タブ A＝設計、タブ B＝PM。案件設定「変更は PM の承認が要る」を入れ、A が R010 の部品名を変えて公開（変更セット）→ B が 7 で R010 の決定パネルを開く →
// A が（D1）もう一度変えて公開（Rev が進む）／（D2）公開を Ctrl+Z で戻すだけ／（D3）公開を Ctrl+Z で戻して別の名前で公開し直す（同じ Rev 番号になるか）／
// （D4）別の行 R011 を変えて公開 → B が y（承認）。D3 は「同じ Rev 番号で中身が違う」ので、見ていない変更を承認しないか
import { open, reset, gotoCell, sleep, logger, state, installToastLog, takeToasts } from './lib22.mjs'
const port = Number(process.env.PORT ?? 5176)
const env = await open(port); const A = env.page; const log = logger(`143-twotab-decision-${port}${process.env.RUN ?? ''}.json`)
const LSK = 'bom-pro.workspace.v2'
const info = (pg) => pg.evaluate((k) => { const w = JSON.parse(localStorage.getItem(k)); const p = w.projects.find((x) => x.id === w.currentProjectId); const r = (id) => p.rows.find((x) => x.id === id); const f = (id) => { const x = r(id); return `${id}=${x.name}${x.working?.name ? '/作業中:' + x.working.name : ''} rev${x.pendingRev ?? '-'}${x.flags.pmPending ? ' pm:' + x.flags.pmReason : ''}` }; return { rows: [f('R010'), f('R011')].join(' | '), subs: p.submissions.slice(-3).filter((s) => s.rev > 1).map((s) => `Rev${s.rev}${s.changeSet ? '[' + (s.changeSet.approved ? '承認' : s.changeSet.rejected ? '却下' : '待ち') + (s.changeSet.merged ? ' merged' + JSON.stringify(s.changeSet.merged) : '') + ']' : ''}:${s.rowIds.length}行:R010=${s.snapshot.R010?.name ?? '-'}:R011=${s.snapshot.R011?.name ?? '-'}${s.revoked ? '(取消)' : ''}`).join(' / '), decisions: p.decisions.slice(-2).map((d) => `${d.kind}:${d.rowId ?? ''}`).join(' / ') } }, LSK)
const toastOf = async (pg) => (await state(pg)).toast
async function tabPM() {
  const B = await env.context.newPage(); await B.goto(env.url); await B.waitForSelector('[data-testid="grid"]')
  await B.getByTestId('role-pm').click(); for (let i = 0; i < 3; i++) { if (!(await B.evaluate(() => !!document.querySelector('[data-testid^="panel-"]')))) break; await B.keyboard.press('Enter') }
  await B.locator('.gridwrap').focus(); await installToastLog(B); return B
}
const edit = async (id, v) => { await A.bringToFront(); await gotoCell(A, 1, id, '部品名'); await A.keyboard.type(v); await A.keyboard.press('Enter'); await sleep(150) }
const publish = async () => {
  await A.bringToFront(); await A.locator('.gridwrap').focus(); await A.keyboard.press('Control+Enter'); await sleep(250)
  const t = await A.evaluate(() => document.querySelector('[data-testid^="panel-"]')?.textContent?.slice(0, 200) ?? '')
  for (let i = 0; i < 3; i++) { if (!(await A.evaluate(() => !!document.querySelector('[data-testid^="panel-"]')))) break; await A.keyboard.press('1'); await sleep(80); await A.keyboard.press('Enter'); await sleep(250) }
  return t
}
const openPanel = async (B, id) => { await B.bringToFront(); await B.locator('.gridwrap').focus(); await B.keyboard.press('7'); await sleep(150); await B.keyboard.press('Control+g'); await B.getByTestId('prompt-text').fill(id); await B.keyboard.press('Enter'); await sleep(150); await B.keyboard.press('Enter'); await sleep(250); return B.evaluate(() => document.querySelector('[data-testid^="panel-"]')?.textContent?.slice(0, 260) ?? '(パネルなし)') }
async function S(name, expect, actA) {
  await reset(env)
  await A.evaluate((k) => { const w = JSON.parse(localStorage.getItem(k)); const p = w.projects.find((x) => x.id === w.currentProjectId); p.settings.changeNeedsPmApproval = true; p.settings.pmConfirmed = true; localStorage.setItem(k, JSON.stringify(w)) }, LSK)
  await A.reload(); await A.waitForSelector('[data-testid="grid"]'); await A.locator('.gridwrap').focus(); await installToastLog(A)
  const seq = []
  await edit('R010', 'CS-X1'); const pt = await publish(); seq.push(`A 公開（${pt.slice(0, 80)}）→ ${JSON.stringify(await info(A))}`)
  const B = await tabPM(); const title = await openPanel(B, 'R010'); seq.push(`B 決定パネル: ${title}`)
  await actA(seq)
  await sleep(600)
  await B.bringToFront(); await sleep(200)
  const before = await info(B)
  await B.keyboard.press('y'); await sleep(250)
  // 理由を聞かれたら Enter
  for (let i = 0; i < 2; i++) { if (await B.evaluate(() => !!document.querySelector('[data-testid="panel-prompt"]'))) { await B.keyboard.press('Enter'); await sleep(250) } }
  const after = await info(B)
  seq.push(`B y → ${(await takeToasts(B)).filter((t) => !t.startsWith('保存')).slice(-2).join(' ／ ')}`)
  log({ name, expect, seq, before, after })
  await B.close()
}
await S('D1 A がもう一度 R010 を変えて公開（Rev が進む）→ B y', '決めない（開き直してください）', async (seq) => {
  await edit('R010', 'CS-X2'); await publish(); seq.push(`A 再公開 → ${JSON.stringify(await info(A))}`)
})
await S('D2 A が公開を Ctrl+Z で戻すだけ → B y', '決めない（要決定でなくなった）', async (seq) => {
  await A.bringToFront(); await A.locator('.gridwrap').focus(); await A.keyboard.press('Control+z'); await sleep(300); seq.push(`A Ctrl+Z «${await toastOf(A)}» → ${JSON.stringify(await info(A))}`)
})
await S('D3 A が公開を Ctrl+Z で戻し、R010 を CS-X9 にして公開し直す（同じ Rev 番号）→ B y', '決めない（パネルを開いたときの Rev 3 は CS-X1、いまは CS-X9）', async (seq) => {
  await A.bringToFront(); await A.locator('.gridwrap').focus(); await A.keyboard.press('Control+z'); await sleep(300); seq.push(`A Ctrl+Z «${await toastOf(A)}» → ${JSON.stringify(await info(A))}`)
  await edit('R010', 'CS-X9'); await publish(); seq.push(`A 公開し直し → ${JSON.stringify(await info(A))}`)
})
await S('D4 A が別の行 R011 を変えて公開 → B y', 'R010 の Rev を承認（決めてよい）', async (seq) => {
  await edit('R011', 'CS-Y1'); await publish(); seq.push(`A R011 公開 → ${JSON.stringify(await info(A))}`)
})

// D5: まとめた変更セットの比べる前の値（M18-03）。Rev2（CS-X1）を Rev3（CS-X2）にまとめて B が Rev3 を承認 → A（設計）と購買で社内用の Excel を書き出し、変更点のシートを読む
// (ExcelJS は上で読み込む)
import ExcelJS from '/home/user/BOM/node_modules/exceljs/excel.js'
async function exportChanges(pg, file) {
  await pg.bringToFront(); await pg.locator('.gridwrap').focus()
  const dlP = pg.waitForEvent('download', { timeout: 60000 })
  await pg.keyboard.press('Control+e'); await sleep(200); await pg.keyboard.press('1'); await sleep(100)
  if (await pg.evaluate(() => !!document.querySelector('[data-testid="panel-export"]'))) await pg.keyboard.press('Enter')
  const d = await dlP; const f = '/home/user/BOM/usertest/veteran/r22/dl/' + file; await d.saveAs(f)
  const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(f); const sh = wb.getWorksheet('変更点')
  const rows = []; sh?.eachRow((r, i) => { if (i > 1) { const v = r.values.slice(1).map((x) => (x && typeof x === 'object' ? x.text ?? JSON.stringify(x) : x ?? '')); if (v[3] === 'R010') rows.push(`Rev${v[0]} ${v[4]} | ${v[7]} | 承認:${v[8]}`) } })
  return rows
}
{
  await reset(env)
  await A.evaluate((k) => { const w = JSON.parse(localStorage.getItem(k)); const p = w.projects.find((x) => x.id === w.currentProjectId); p.settings.changeNeedsPmApproval = true; p.settings.pmConfirmed = true; localStorage.setItem(k, JSON.stringify(w)) }, LSK)
  await A.reload(); await A.waitForSelector('[data-testid="grid"]'); await A.locator('.gridwrap').focus(); await installToastLog(A)
  const seq = []
  await edit('R010', 'CS-X1'); await publish(); await edit('R010', 'CS-X2'); await publish(); seq.push(`A 公開 ×2 → ${JSON.stringify(await info(A))}`)
  const B = await tabPM(); seq.push(`B 決定パネル: ${(await openPanel(B, 'R010')).slice(0, 120)}`)
  await B.keyboard.press('y'); await sleep(300); for (let i = 0; i < 2; i++) { if (await B.evaluate(() => !!document.querySelector('[data-testid="panel-prompt"]'))) { await B.keyboard.press('Enter'); await sleep(250) } }
  seq.push(`B y → ${JSON.stringify(await info(B))}`)
  const design = await exportChanges(A, `143-d5-design${process.env.RUN ?? ''}.xlsx`)
  const pm = await exportChanges(B, `143-d5-pm${process.env.RUN ?? ''}.xlsx`)
  log({ name: 'D5 Rev2（CS-X1）を Rev3（CS-X2）にまとめて Rev3 を承認 → 社内用 Excel の変更点', expect: 'Rev2 の R010 は「Rev 3 にまとめた」、Rev3 の R010 は「部品名: 端子台エンドカバー → CS-X2」（CS-X1 と比べない）', seq, design, pm })
  await B.close()
}
log({ name: 'console/pageerror', errs: env.errs.slice(0, 20) })
log.save(); await env.browser.close()
