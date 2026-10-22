import { launch, fresh, setRole, goto, toCol, cursor, mode, toast, dumpErrors, shot, save, state, sleep, DL } from './lib.mjs'
import fs from 'node:fs'
import path from 'node:path'
import ExcelJS from 'exceljs'
const { browser, page, errors } = await launch()
const out = []
const log = (o) => { out.push(o); console.log(JSON.stringify(o).slice(0, 500)) }
const proj = async () => { const ws = await state(page); return ws.projects.find((x) => x.id === ws.currentProjectId) }
async function readWb(fp) {
  const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(fp)
  return wb.worksheets.map((s) => ({ name: s.name, rows: s.rowCount, cols: s.columnCount, head: s.getRow(1).values?.slice(1, 8), r2: s.getRow(2).values?.slice(1, 8) }))
}
await fresh(page)
// make a cell with HTML/formula-like content for export checks
await goto(page, 'R076'); await toCol(page, '型式'); await page.keyboard.press('Enter'); await page.keyboard.press('Control+a'); await page.keyboard.type('=1+1'); await page.keyboard.press('Enter')
await goto(page, 'R077'); await toCol(page, '部品名'); await page.keyboard.press('Enter'); await page.keyboard.press('Control+a'); await page.keyboard.type('<b>太字</b>&"q"'); await page.keyboard.press('Enter')
// Ctrl+E x3
for (const k of ['1', '2', '3']) {
  const n = errors.length
  const dlp = page.waitForEvent('download', { timeout: 15000 }).catch(() => null)
  await page.keyboard.press('Control+e'); await page.keyboard.press(k)
  const dl = await dlp
  if (!dl) { log({ case: 'Ctrl+E ' + k, download: null, toast: await toast(page), errs: errors.slice(n).map((e) => e.text.slice(0, 200)) }); continue }
  const fp = path.join(DL, 'e' + k + '-' + dl.suggestedFilename()); await dl.saveAs(fp)
  const sheets = await readWb(fp).catch((e) => 'READ ERR ' + e.message)
  log({ case: 'Ctrl+E ' + k, file: dl.suggestedFilename(), size: fs.statSync(fp).size, sheets, errs: errors.slice(n).map((e) => e.text.slice(0, 200)) })
}
// check formula cell in archive export
{
  const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(fs.readdirSync(DL).filter((f) => f.startsWith('e3-')).map((f) => path.join(DL, f))[0])
  const sh = wb.getWorksheet('BOM'); let found = null
  sh.eachRow((r) => { const v = r.getCell(6).value; if (v && String(typeof v === 'object' ? JSON.stringify(v) : v).includes('1+1')) found = typeof v === 'object' ? JSON.stringify(v) : v })
  log({ case: 'formula-like cell in export', found })
}
// Ctrl+Shift+C clipboard
await page.keyboard.press('2')
await page.keyboard.press('Control+Shift+c'); await sleep(300)
const clip = await page.evaluate(async () => { try { const items = await navigator.clipboard.read(); const o = {}; for (const it of items) for (const t of it.types) o[t] = await (await it.getType(t)).text(); return o } catch (e) { return { err: String(e), text: await navigator.clipboard.readText().catch((e2) => 'ERR ' + e2) } } })
const tsv = clip['text/plain'] ?? clip.text ?? ''
log({ case: 'Ctrl+Shift+C view2', toast: await toast(page), types: Object.keys(clip), tsvLines: tsv.split('\n').length, tsvCols: tsv.split('\n')[0]?.split('\t').length, htmlHasBold: (clip['text/html'] ?? '').includes('<b>太字'), htmlSnippet: (clip['text/html'] ?? '').match(/.{0,40}太字.{0,40}/)?.[0], quoteEsc: (clip['text/html'] ?? '').includes('&"q"') })
// Ctrl+Shift+C in edit mode?
await goto(page, 'R020'); await page.keyboard.press('Enter'); await page.keyboard.press('Control+Shift+c'); await sleep(100); log({ case: 'Ctrl+Shift+C in edit', mode: await mode(page), toast: await toast(page) }); await page.keyboard.press('Escape')
// ---- purchasing: 概算見積依頼 Excel (choose supplier 1 to avoid deadline bug)
await setRole(page, 'purchasing')
// need submitted rows: R076.. are draft; publish as design first
await setRole(page, 'design')
await goto(page, 'R076'); await toCol(page, '型式'); await page.keyboard.press('Enter'); await page.keyboard.press('Control+a'); await page.keyboard.type('MODEL-76'); await page.keyboard.press('Enter')
await goto(page, 'R076'); await toCol(page, 'メーカ'); await page.keyboard.press('Enter'); await page.keyboard.press('Control+a'); await page.keyboard.type('オムロン'); await page.keyboard.press('Enter')
await goto(page, 'R076'); await toCol(page, '部品名'); await page.keyboard.press('Enter'); await page.keyboard.press('Control+a'); await page.keyboard.type('新規部品76'); await page.keyboard.press('Enter')
// R077..R080 drafts: delete them to allow publish w/o errors
for (const id of ['R077', 'R078', 'R079', 'R080']) { await goto(page, id); await page.keyboard.press('Shift+Delete') }
await page.keyboard.press('Control+Enter'); await sleep(100); log({ case: 'publish R076', panel: await page.evaluate(() => document.querySelector('[data-testid^="panel-"]')?.dataset.testid), toast: await toast(page) })
if (await page.getByTestId('prompt-options').count()) { await page.keyboard.press('1'); await sleep(100) }
log({ case: 'publish R076 result', toast: await toast(page), status: (await proj()).rows.find((r) => r.id === 'R076').status })
await setRole(page, 'purchasing')
const dls = []
page.on('download', async (d) => { const fp = path.join(DL, 'req-' + d.suggestedFilename()); await d.saveAs(fp); dls.push(fp) })
await page.keyboard.press('Control+k'); await page.getByTestId('palette-input').fill('概算見積を依頼'); await page.keyboard.press('Enter'); await sleep(50)
await page.getByTestId('prompt-text').fill('2026-11-05'); await page.keyboard.press('Enter'); await sleep(1500)
log({ case: 'rough request all', toast: await toast(page), downloads: dls.map((f) => path.basename(f)), r076: (await proj()).rows.find((r) => r.id === 'R076').status, deadline: (await proj()).settings.quoteDeadline })
for (const f of dls) log({ case: 'req file', f: path.basename(f), sheets: await readWb(f).catch((e) => 'ERR ' + e.message) })
// ---- import answers: header form with alt proposal, mismatched model, unknown id
const pr = await proj()
const r76 = pr.rows.find((r) => r.id === 'R076')
const tsvIn = ['行ID\t部品名\t型式\tメーカ\tメーカ指定\t代替可否\t必要数\t単位\t必要日\t備考\t単価\t納期\tMOQ\t在庫区分\t見積数量\t代替型式\t代替メーカ\t代替単価\t代替納期\t有効期限',
  'R076\t新規部品76\tMODEL-76\tオムロン\t\t\t1\t個\t\t\t1,500\t7\t10\t取寄\t10\t\t\t\t\t2026-12-31',
  'R020\t電磁接触器\tWRONG-MODEL\t三菱電機\t\t\t2\t個\t\t\t9,999\t即納\t\t在庫\t\tS-T21 AC200V 代替\t三菱電機\t8,800\t3\t',
  'R999\tnone\tX\t\t\t\t1\t個\t\t\t100\t1\t\t\t\t\t\t\t\t',
  'R022\t\tLT-C32AC385\t\t\t\t1\t個\t\t\t辞退\t取扱なし\t\t\t\t\t\t\t\t',
  'R034\t\t\t\t\t\t\t\t\t\t500\tabc\t-1\tゾンビ\t\t\t\t\t\t2026/13/45'].join('\n')
await page.keyboard.press('Control+k'); await page.getByTestId('palette-input').fill('見積回答を取り込む'); await page.keyboard.press('Enter'); await sleep(50)
await page.keyboard.press('1'); await sleep(50)
await page.getByTestId('import-text').fill(tsvIn); await page.keyboard.press('Control+Enter'); await sleep(200)
const p2 = await proj()
const q = (id) => p2.quotes.find((x) => x.rowId === id && x.supplierId === 'S1' && !x.stale)
log({ case: 'import with header', toast: await toast(page), q76: q('R076'), q20: q('R020'), q22: q('R022'), q34: q('R034'), issues: p2.issues.filter((i) => i.status === 'draft').map((i) => ({ id: i.id, kind: i.kind, rowId: i.rowId, proposal: i.proposal })), r076status: p2.rows.find((r) => r.id === 'R076').status, r034flags: p2.rows.find((r) => r.id === 'R034').status })
// headerless
await page.keyboard.press('Control+k'); await page.getByTestId('palette-input').fill('見積回答を取り込む'); await page.keyboard.press('Enter'); await sleep(50); await page.keyboard.press('2'); await sleep(50)
await page.getByTestId('import-text').fill('R076\tMODEL-76\t1400\t5\t\t在庫\nR020\tS-T21 AC200V\t1234\t4\t20\n'); await page.keyboard.press('Control+Enter'); await sleep(200)
const p3 = await proj()
log({ case: 'import headerless S2', toast: await toast(page), q76: p3.quotes.find((x) => x.rowId === 'R076' && x.supplierId === 'S2' && !x.stale), q20: p3.quotes.find((x) => x.rowId === 'R020' && x.supplierId === 'S2' && !x.stale) })
// import with formula/HTML in alt proposal + 50k rows garbage
await page.keyboard.press('Control+k'); await page.getByTestId('palette-input').fill('見積回答を取り込む'); await page.keyboard.press('Enter'); await sleep(50); await page.keyboard.press('1'); await sleep(50)
await page.getByTestId('import-text').fill('garbage line without tabs\n\n\t\t\t\n行ID\t型式\t単価\nR020\t\t100'); await page.keyboard.press('Control+Enter'); await sleep(200)
log({ case: 'import garbage', toast: await toast(page), errs: errors.filter((e) => e.type === 'pageerror').map((e) => e.text) })
// ---- Ctrl+Z after import (undo import?)
await page.keyboard.press('Control+z'); log({ case: 'undo import', toast: await toast(page), q20: (await proj()).quotes.find((x) => x.rowId === 'R020' && x.supplierId === 'S1' && !x.stale)?.unitPrice })
// ---- formal request
dls.length = 0
await page.keyboard.press('Control+k'); await page.getByTestId('palette-input').fill('正式見積を依頼'); await page.keyboard.press('Enter'); await sleep(1500)
log({ case: 'formal request', toast: await toast(page), downloads: dls.map((f) => path.basename(f)), statuses: (await proj()).rows.filter((r) => ['R001', 'R002', 'R003'].includes(r.id)).map((r) => r.status) })
for (const f of dls) log({ case: 'formal file', f: path.basename(f), sheets: await readWb(f).catch((e) => 'ERR ' + e.message) })
// 選定記録
dls.length = 0
await page.keyboard.press('Control+k'); await page.getByTestId('palette-input').fill('選定記録を出力'); await page.keyboard.press('Enter'); await sleep(1500)
log({ case: 'selection record', downloads: dls.map((f) => path.basename(f)), sheets: dls[0] ? await readWb(dls[0]).catch((e) => 'ERR ' + e.message) : null })
// Ctrl+E with project name containing / and :
await setRole(page, 'pm')
await page.keyboard.press('Control+k'); await page.getByTestId('palette-input').fill('案件設定'); await page.keyboard.press('Enter'); await sleep(50)
await page.keyboard.press('Enter'); await page.getByTestId('settings-input').fill('A/B:C*D?'); await page.keyboard.press('Enter'); await page.keyboard.press('Control+Enter'); await sleep(50)
await page.getByTestId('prompt-text').fill('名前変更'); await page.keyboard.press('Enter'); await sleep(100)
dls.length = 0
await page.keyboard.press('Control+e'); await page.keyboard.press('1'); await sleep(1500)
log({ case: 'export with special chars in name', name: (await proj()).name, downloads: dls.map((f) => path.basename(f)) })
save('07-excel.json', out)
dumpErrors(errors, 'excel')
await browser.close()
