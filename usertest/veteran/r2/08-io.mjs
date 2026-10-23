// JSON 往復、Excel 3 種＋選定記録、概算依頼書 → 回答を記入 → 取込、正式依頼書、ガイドのファイル読込
import fs from 'node:fs'
import path from 'node:path'
import ExcelJS from 'exceljs'
import { launch, fresh, setRole, goto, toCol, cursor, mode, sleep, dumpErrors, shot2, save2, proj, row, panel, closeAll, palette, paletteExact, toastNow, ws, DL2 } from './lib.mjs'
const { browser, context, page, errors } = await launch()
const out = {}
const log = (k, o) => { out[k] = o; console.log(k, JSON.stringify(o).slice(0, 800)) }
const perr = (n) => errors.slice(n).filter((e) => e.type === 'pageerror' || e.type === 'error').map((e) => e.text.slice(0, 160))
async function grab(fn, n = 1, timeout = 10000) {
  const files = []
  const h = async (d) => { const f = path.join(DL2, d.suggestedFilename()); await d.saveAs(f); files.push(f) }
  page.on('download', h)
  await fn()
  const t0 = Date.now(); while (files.length < n && Date.now() - t0 < timeout) await sleep(100)
  await sleep(300)
  page.off('download', h)
  return files
}
async function readXlsx(f) {
  const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(f)
  return wb.worksheets.map((s) => ({ name: s.name, rows: s.rowCount, cols: s.columnCount, head: (s.getRow(1).values ?? []).slice(1).join('|').slice(0, 300), sheet: s }))
}
fs.rmSync(DL2, { recursive: true, force: true }); fs.mkdirSync(DL2, { recursive: true })

// ---- 危ない文字を入れた案件
await fresh(page)
const evil = { name: '=HYPERLINK("http://x","クリック")', model: '+SUM(1,2)', maker: '@cmd', note: '改行\nあり🔧<script>alert(1)</script>' }
await goto(page, 'R030'); await toCol(page, '部品名'); await page.keyboard.press('Enter'); await page.keyboard.press('Control+a'); await page.keyboard.type(evil.name); await page.keyboard.press('Enter')
await goto(page, 'R030'); await toCol(page, '型式'); await page.keyboard.press('Enter'); await page.keyboard.press('Control+a'); await page.keyboard.type(evil.model); await page.keyboard.press('Enter')
await goto(page, 'R030'); await toCol(page, 'メーカ'); await page.keyboard.press('Enter'); await page.keyboard.press('Control+a'); await page.keyboard.type(evil.maker); await page.keyboard.press('Enter')
// ---- Excel 3 種
const ex = {}
for (const [i, label] of [[0, 'internal'], [1, 'supplier'], [2, 'archive']]) {
  const n = errors.length
  const files = await grab(async () => { await page.keyboard.press('Control+e'); for (let k = 0; k < i; k++) await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter') })
  if (!files.length) { ex[label] = { none: true, toast: await toastNow(page), errors: perr(n) }; continue }
  const sheets = await readXlsx(files[0])
  const bom = sheets[0].sheet
  // R030 の行を探して数式・文字列型を確認
  let r30 = null
  bom.eachRow((r) => { if (String(r.getCell(1).value).includes('R030') || r.values.some((v) => String(v).includes('HYPERLINK'))) r30 = r })
  const cellTypes = r30 ? r30.values.slice(1).map((v) => (v && typeof v === 'object' ? (v.formula ? 'FORMULA:' + v.formula : JSON.stringify(v).slice(0, 40)) : typeof v)).join(',') : null
  const formulas = []; for (const s of sheets) s.sheet.eachRow((r) => r.eachCell((c) => { if (c.type === ExcelJS.ValueType.Formula) formulas.push(s.name + '!' + c.address + ':' + c.formula) }))
  const hasPrice = sheets.some((s) => /単価|金額|スコア|正式/.test(s.head))
  ex[label] = { file: path.basename(files[0]), sheets: sheets.map((s) => `${s.name}(${s.rows}x${s.cols})`), bomHead: sheets[0].head, hasPriceCols: hasPrice, r30types: cellTypes, r30name: r30?.values.find((v) => String(v).includes('HYPERLINK')), formulas: formulas.slice(0, 5), errors: perr(n) }
}
log('excel3', ex)
// 選定記録
{
  const files = await grab(async () => { await paletteExact(page, '選定記録を出力（社内）', '選定記録') })
  log('selectionRecord', files.length ? { file: path.basename(files[0]), sheets: (await readXlsx(files[0])).map((s) => `${s.name}(${s.rows}x${s.cols}) ${s.head.slice(0, 80)}`) } : { none: true, toast: await toastNow(page) })
}
// 書式つきコピー（改行・タブを含むセル）
{
  await page.keyboard.press('1')
  await page.keyboard.press('Control+Shift+C'); await sleep(400)
  const clip = await page.evaluate(() => navigator.clipboard.readText())
  const html = await page.evaluate(async () => { try { const it = await navigator.clipboard.read(); for (const i of it) if (i.types.includes('text/html')) return (await (await i.getType('text/html')).text()).length; return 'no html' } catch (e) { return 'ERR ' + e.message } })
  const lines = clip.split('\n')
  const bad = lines.filter((l) => l.split('\t').length !== lines[0].split('\t').length).length
  log('copyFormatted', { lines: lines.length, colsHead: lines[0].split('\t').length, linesWithWrongColCount: bad, htmlLen: html, hasScriptRaw: clip.includes('<script>') })
}
// ---- JSON 往復
{
  const files = await grab(async () => { await paletteExact(page, 'JSON を書き出す', 'JSON を書き出す') })
  const text = fs.readFileSync(files[0], 'utf8')
  const before = await ws(page)
  await fresh(page)
  const n = errors.length
  await paletteExact(page, 'JSON を読み込む', 'JSON を読み込む')
  await page.evaluate((t) => { const el = document.querySelector('[data-testid="import-text"]'); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(el, t); el.dispatchEvent(new Event('input', { bubbles: true })) }, text)
  await page.getByTestId('import-text').focus()
  await page.keyboard.press('Control+Enter'); await sleep(300)
  const after = await ws(page)
  const strip = (w) => JSON.stringify({ projects: w.projects.map((p) => ({ ...p, events: undefined, version: undefined, updatedAt: undefined })), suppliers: w.suppliers, rules: w.rules })
  const r30 = after.projects[0].rows.find((r) => r.id === 'R030')
  log('jsonRoundTrip', { file: path.basename(files[0]), bytes: text.length, toast: (await toastNow(page)).slice(0, 80), same: strip(before) === strip(after), r30: { name: r30.working?.name ?? r30.name, note: (r30.working?.note ?? r30.note) }, errors: perr(n) })
  // 2 回目の読込で Ctrl+Z
  await page.keyboard.press('Control+z'); log('undoAfterImport', { toast: (await toastNow(page)).slice(0, 100) })
}
// ---- 概算依頼書 → 回答 → 取込（依頼書のシートを丸ごとコピーした形）
await fresh(page)
// 設計: R076 を公開
await goto(page, 'R076'); await toCol(page, '型式'); await page.keyboard.press('Enter'); await page.keyboard.type('MY4N-D2 DC24'); await page.keyboard.press('Enter'); await goto(page, 'R076'); await toCol(page, 'メーカ'); await page.keyboard.press('Enter'); await page.keyboard.type('オムロン'); await page.keyboard.press('Enter'); await goto(page, 'R076'); await toCol(page, '部品名'); await page.keyboard.press('Enter'); await page.keyboard.type('リレー'); await page.keyboard.press('Enter')
for (const id of ['R077', 'R078', 'R079', 'R080']) { await goto(page, id); await page.keyboard.press('Shift+Delete') }
await page.keyboard.press('Control+Enter'); await sleep(50); if (await panel(page)) await page.keyboard.press('Enter'); await sleep(100)
await setRole(page, 'purchasing')
{
  const n = errors.length
  const files = await grab(async () => { await paletteExact(page, '概算見積を依頼', '概算見積'); await sleep(50); await page.keyboard.press('Enter') }, 3)
  const t = await toastNow(page)
  const sheets = files.length ? await readXlsx(files[0]) : []
  log('roughRequest', { files: files.map((f) => path.basename(f)), toast: t.slice(0, 100), head: sheets[0]?.head, rows: sheets[0]?.rows, status76: (await row(page, 'R076')).status, errors: perr(n) })
}
// 状態を作り直して 2 通り
async function setupQuoting() {
  await fresh(page)
  await goto(page, 'R076'); await toCol(page, '型式'); await page.keyboard.press('Enter'); await page.keyboard.type('MY4N-D2 DC24'); await page.keyboard.press('Enter'); await goto(page, 'R076'); await toCol(page, 'メーカ'); await page.keyboard.press('Enter'); await page.keyboard.type('オムロン'); await page.keyboard.press('Enter'); await goto(page, 'R076'); await toCol(page, '部品名'); await page.keyboard.press('Enter'); await page.keyboard.type('リレー'); await page.keyboard.press('Enter')
  for (const id of ['R077', 'R078', 'R079', 'R080']) { await goto(page, id); await page.keyboard.press('Shift+Delete') }
  await page.keyboard.press('Control+Enter'); await sleep(50); if (await panel(page)) await page.keyboard.press('Enter'); await sleep(100)
  await setRole(page, 'purchasing')
  const files = await grab(async () => { await paletteExact(page, '概算見積を依頼', '概算見積'); await sleep(50); await page.keyboard.press('Enter') }, 3)
  return files
}
for (const variant of ['tableOnly', 'wholeSheet', 'garbage']) {
  const files = await setupQuoting()
  const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(files[0]); const sh = wb.worksheets[0]
  const sup = path.basename(files[0]).replace(/\.xlsx$/, '').split('_').at(-1)
  const grid = []
  sh.eachRow({ includeEmpty: true }, (r) => grid.push((r.values ?? []).slice(1).map((v) => (v == null ? '' : typeof v === 'object' ? (v.text ?? v.result ?? '') : String(v)))))
  const hi = grid.findIndex((r) => r[0] === '行ID')
  const vals = { tableOnly: ['1,200円', '14', '10'], wholeSheet: ['1200', '14', '10'], garbage: ['abc', '来週', '-5'] }[variant]
  for (let i = hi + 1; i < grid.length; i++) if (grid[i][0]) { grid[i][10] = vals[0]; grid[i][11] = vals[1]; grid[i][12] = vals[2] }
  const text = (variant === 'wholeSheet' ? grid : grid.slice(hi)).map((r) => r.join('\t')).join('\n')
  const n = errors.length
  await paletteExact(page, '見積回答を取り込む', '見積回答'); await sleep(50)
  const o = await page.evaluate(() => [...document.querySelectorAll('[data-testid="prompt-options"] .opt')].map((e) => e.textContent))
  const si = o.findIndex((x) => x.includes(sup)); for (let k = 0; k < si; k++) await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter'); await sleep(50)
  await page.getByTestId('import-text').fill(text); await page.keyboard.press('Control+Enter'); await sleep(150)
  const t = await toastNow(page)
  const p = await proj(page)
  const sid = (await ws(page)).suppliers.find((s) => s.name === sup)?.id
  const q = p.quotes.filter((x) => x.supplierId === sid && !x.stale && x.source === '取込').slice(0, 3).map((x) => `${x.rowId}:${x.unitPrice}/${x.leadDays}/${x.moq}/${x.validUntil}`)
  const money = await page.getByTestId('money').textContent()
  await page.keyboard.press('9'); await goto(page, 'R005'); await page.keyboard.press('Space'); await sleep(50)
  const detail = (await page.getByTestId('detail').textContent().catch(() => '')).slice(0, 200)
  log('import/' + variant, { supplier: sup, lines: text.split('\n').length, toast: t.slice(0, 160), sampleQuotes: q, money, nanInUi: /NaN/.test(await page.locator('body').textContent()), detail, errors: perr(n) })
  await closeAll(page)
}
// 取消行・発注済行への取込
{
  await fresh(page, 'purchasing')
  await page.keyboard.press('Control+s')
  const w = await ws(page); const r1 = w.projects[0].rows.find((x) => x.id === 'R001'); r1.status = 'ordered'; r1.ordered = true; const r5 = w.projects[0].rows.find((x) => x.id === 'R005'); r5.status = 'cancelled'
  await page.evaluate((s) => localStorage.setItem('bom-pro.workspace.v2', s), JSON.stringify(w)); await page.reload(); await page.waitForSelector('[data-testid="grid"]'); await page.locator('.gridwrap').focus()
  await paletteExact(page, '見積回答を取り込む', '見積回答'); await sleep(50); await page.keyboard.press('Enter'); await sleep(40)
  await page.getByTestId('import-text').fill('行ID\t型式\t単価\t納期\nR001\t\t1\t1\nR005\t\t2\t2'); await page.keyboard.press('Control+Enter'); await sleep(100)
  const p = await proj(page)
  log('import/inactiveRows', { toast: (await toastNow(page)).slice(0, 120), r001q: p.quotes.filter((q) => q.rowId === 'R001' && q.supplierId === 'S1' && !q.stale).map((q) => q.unitPrice), r005q: p.quotes.filter((q) => q.rowId === 'R005' && q.supplierId === 'S1' && !q.stale).map((q) => q.unitPrice), r001adoptedPriceCell: await page.locator('[data-row-id="R001"] td[data-col="unitPrice"]').textContent().catch(() => null) })
}
// 正式見積依頼書
{
  await fresh(page, 'purchasing')
  const n = errors.length
  const files = await grab(async () => { await paletteExact(page, '正式見積を依頼（社外）', '正式見積'); await sleep(60); const o = await page.getByTestId('prompt-options').textContent().catch(() => null); out.formalConfirm = o; await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter') }, 1)
  const sheets = files.length ? await readXlsx(files[0]) : []
  log('formalRequest', { confirm: out.formalConfirm, files: files.map((f) => path.basename(f)), head: sheets[0]?.head, rows: sheets[0]?.rows, toast: (await toastNow(page)).slice(0, 100), status1: (await row(page, 'R001')).status, errors: perr(n) })
}
// ガイドのファイル読込: 社内 Excel を新規 BOM に
{
  await fresh(page)
  const files = await grab(async () => { await page.keyboard.press('Control+e'); await page.keyboard.press('Enter') })
  const n = errors.length
  await palette(page, '新しいBOM'); await page.getByTestId('wizard-id').fill('P-FILE'); for (let i = 0; i < 7; i++) await page.keyboard.press('Enter')
  await page.keyboard.press('2'); await sleep(50)
  await page.getByTestId('wizard-file').setInputFiles(files[0]); await sleep(800)
  const prev = await page.getByTestId('wizard-preview').textContent().catch(() => null)
  await page.locator('.gridwrap').focus().catch(() => {})
  await page.keyboard.press('Control+Enter'); await sleep(100); await page.keyboard.press('Enter'); await sleep(300)
  const p = await proj(page)
  log('wizardFile/internalExcel', { preview: prev?.slice(0, 250), id: p.id, rows: p.rows.length, sample: p.rows.slice(0, 2).map((r) => [r.name, r.model, r.maker, r.qtyNeeded, r.category]), toast: (await toastNow(page)).slice(0, 120), errors: perr(n) })
  // CSV（Shift_JIS 風の文字化け・BOM付き UTF-8・引用符内改行）
  const csv = '﻿品名,形式,メーカー,員数,備考\n"リレー, 4極",MY4N,オムロン,12,"1行目\n2行目"\nヒューズ,"5A ""速断""",,3,\n'
  const csvPath = path.join(DL2, 'bom.csv'); fs.writeFileSync(csvPath, csv)
  await palette(page, '新しいBOM'); await page.getByTestId('wizard-id').fill('P-CSV'); for (let i = 0; i < 7; i++) await page.keyboard.press('Enter')
  await page.keyboard.press('2'); await sleep(50)
  await page.getByTestId('wizard-file').setInputFiles(csvPath); await sleep(500)
  const prev2 = await page.getByTestId('wizard-preview').textContent().catch(() => null)
  await page.keyboard.press('Control+Enter'); await sleep(100); await page.keyboard.press('Enter'); await sleep(300)
  const p2 = await proj(page)
  log('wizardFile/csv', { preview: prev2?.slice(0, 250), id: p2.id, rows: p2.rows.map((r) => [r.name, r.model, r.maker, r.qtyNeeded, r.note]), errors: perr(n) })
  // 壊れたファイル
  const badPath = path.join(DL2, 'broken.xlsx'); fs.writeFileSync(badPath, 'this is not a zip')
  await palette(page, '新しいBOM'); await page.getByTestId('wizard-id').fill('P-BAD'); for (let i = 0; i < 7; i++) await page.keyboard.press('Enter')
  await page.keyboard.press('2'); await sleep(50)
  const n3 = errors.length
  await page.getByTestId('wizard-file').setInputFiles(badPath); await sleep(800)
  log('wizardFile/broken', { err: await page.getByTestId('wizard-error').textContent().catch(() => null), toast: (await toastNow(page)).slice(0, 100), preview: (await page.getByTestId('wizard-preview').textContent().catch(() => null))?.slice(0, 80), errors: perr(n3) })
  await closeAll(page)
}
// ファイル名に使えない文字
{
  await fresh(page, 'pm')
  await palette(page, '案件設定'); await sleep(40); await page.keyboard.press('Enter'); await page.getByTestId('settings-input').fill('盤/A:B*C?"<>|'); await page.keyboard.press('Enter'); await page.keyboard.press('Control+Enter'); await sleep(60); if (await page.getByTestId('prompt-text').count()) { await page.getByTestId('prompt-text').fill('x'); await page.keyboard.press('Enter') }
  await closeAll(page)
  const files = await grab(async () => { await page.keyboard.press('Control+e'); await page.keyboard.press('Enter') })
  log('filename', { files: files.map((f) => path.basename(f)), name: (await proj(page)).name })
}
save2('08-io.json', out)
dumpErrors(errors, 'io')
await browser.close()
