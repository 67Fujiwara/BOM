// ラウンド16: ラウンド15 の修正（変えた行だけの変更表・号機・「"」の囲み・縦横の結合・上の段の繰り返し）を 300 行の .xlsx / .csv で。
// ガイド「ファイルから」で取り込む。現行（BOM_URL 既定 5176）と r15 ビルド（5198）。108b-xlsx-direct.ts が同じファイルを直接読む（2 つ目の経路）
// z1 変えた行だけ変更後（型式・メーカ）を書き、変えた行のメーカは同じ値を書き写した 300 行（30 行変更）
// z2 EDA の BOM「Description・Value・MPN・Footprint・Qty・DNP」300 行
// z2b z2 と同じ形で、Description を「Capacitor 1」のような実際の書き方に（部品名に「部品」の語を含めない）
// z3 2 段「数量」の下に「1号機・2号機」（合計なし）300 行
// z4 「"」を含むセルいろいろ（"・""・12"・3/4" グランド・"N"型・a"b"c・"だけの備考）20 行
// z5 縦横に結合した備考（E2:F11 に「盤内配線用（共通）」）と、部品名と型式を横に結合した部品（A12:B12）
// z6 「型式・型式(変更)」の 300 行（30 行だけ変更の値）
// z7 .csv（Excel の CSV と同じく「"」を含むセルは囲む）に〃の代わりの「"」
// z8 .csv（囲まずに書いた）「"」だけのセル
// z9 上の段「部品名・旧・・新・」をページごと（50 行ごと）に繰り返す 300 行（r15 の x10 と同じ形・名前を確かめる）
import fs from 'node:fs'
import path from 'node:path'
import ExcelJS from '/home/user/BOM/node_modules/exceljs/excel.js'
import { launch, fresh, palette, sleep, toastNow, ws } from '../r8/rerun7/rerun6/lib.mjs'
import { saveJson } from './lib21.mjs'
const P = (f) => path.join('/home/user/BOM/usertest/veteran/r21/dl', f)
const TAG = process.env.TAG ?? ''
const MK = ['オムロン', '三菱電機', 'IDEC']
async function wbFile(name, build) { const wb = new ExcelJS.Workbook(); const s = wb.addWorksheet('BOM'); await build(s); await wb.xlsx.writeFile(P(name + '.xlsx')) }
const H = ['部品名', '型式', 'メーカ', '数量']
await wbFile('z1-sparse-maker-written-300', (s) => { s.addRow(['部品名', '型式', '変更後型式', 'メーカ', '変更後メーカ', '数量']); for (let k = 1; k <= 300; k++) { const ch = k % 10 === 0; s.addRow([`部品${k}`, `OLD-${k}`, ch ? `NEW-${k}` : '', MK[k % 3], ch ? MK[k % 3] : '', (k % 9) + 1]) } })
await wbFile('z2-eda-bom-300', (s) => { s.addRow(['Description', 'Value', 'MPN', 'Footprint', 'Qty', 'DNP']); for (let k = 1; k <= 300; k++) s.addRow([`部品${k}`, `${k}k`, `MPN-${k}`, '0603', (k % 9) + 1, k % 7 === 0 ? 'DNP' : '']) })
const EDA = ['Capacitor', 'Resistor', 'Diode', 'Connector', 'Inductor']
await wbFile('z2b-eda-bom-real-300', (s) => { s.addRow(['Description', 'Value', 'MPN', 'Footprint', 'Qty', 'DNP']); for (let k = 1; k <= 300; k++) s.addRow([`${EDA[k % 5]} ${k}`, `${k}k`, `MPN-${k}`, '0603', (k % 9) + 1, k % 7 === 0 ? 'DNP' : '']) })
await wbFile('z3-units-no-total-300', (s) => { s.addRow(['部品名', '型式', 'メーカ', '数量', '']); s.addRow(['', '', '', '1号機', '2号機']); s.mergeCells('D1:E1'); for (let k = 1; k <= 300; k++) s.addRow([`部品${k}`, `MDL-${k}`, MK[k % 3], (k % 9) + 1, (k % 9) + 1]) })
await wbFile('z4-quotes-various', (s) => { s.addRow(['部品名', '型式', 'メーカ', '数量', '備考']); const q = ['"', '""', '12"', '3/4" グランド', '"N"型', 'a"b"c', '"', '"始まり', '終わり"', '" "']; for (let k = 1; k <= 20; k++) s.addRow([`部品${k}`, k <= 10 ? q[k - 1] : `MDL-${k}`, MK[k % 3], (k % 9) + 1, k > 10 ? q[k - 11] : '']) })
await wbFile('z5-merged-2d-note', (s) => { s.addRow(['部品名', '型式', 'メーカ', '数量', '備考', '']); for (let k = 1; k <= 10; k++) s.addRow([`部品${k}`, `MDL-${k}`, MK[k % 3], 2, k === 1 ? '盤内配線用（共通）' : '', '']); s.mergeCells('E2:F11'); s.addRow(['ケーブル（別途手配）', '', 'フジクラ', 5, '', '']); s.mergeCells('A12:B12'); s.addRow(['部品11', 'MDL-11', 'オムロン', 3, '', '']) })
await wbFile('z6-henkou-paren-300', (s) => { s.addRow(['部品名', '型式', '型式(変更)', 'メーカ', '数量']); for (let k = 1; k <= 300; k++) { const ch = k % 10 === 0; s.addRow([`部品${k}`, `OLD-${k}`, ch ? `NEW-${k}` : '', MK[k % 3], (k % 9) + 1]) } })
await wbFile('z9-kyushin-name-up-repeat-300', (s) => { let r = 0; for (let k = 1; k <= 300; k++) { if ((k - 1) % 50 === 0) { s.addRow(['部品名', '旧', '', '新', '']); r++; s.addRow(['', '型式', '数量', '型式', '数量']); r++; s.mergeCells(`A${r - 1}:A${r}`); s.mergeCells(`B${r - 1}:C${r - 1}`); s.mergeCells(`D${r - 1}:E${r - 1}`) } const ch = k % 10 === 0; s.addRow([`部品${k}`, `OLD-${k}`, (k % 9) + 1, ch ? `NEW-${k}` : `OLD-${k}`, ch ? (k % 9) + 11 : (k % 9) + 1]); r++ } })
// CSV（Excel の書き出しと同じく、「"」を含むセルは "…" で囲み中の " は 2 つに）
const csvCell = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v))
const z7 = [H, ...Array.from({ length: 300 }, (_, i) => { const k = i + 1; return k === 3 ? [`部品${k}`, `MDL-${k}`, '"', 3] : [`部品${k}`, `MDL-${k}`, MK[k % 3], (k % 9) + 1] })]
fs.writeFileSync(P('z7-csv-quoted-ditto.csv'), z7.map((r) => r.map(csvCell).join(',')).join('\r\n'))
fs.writeFileSync(P('z8-csv-raw-ditto.csv'), z7.map((r) => r.join(',')).join('\r\n'))
const FILES = (process.env.FILES ?? 'z1-sparse-maker-written-300.xlsx,z2-eda-bom-300.xlsx,z3-units-no-total-300.xlsx,z4-quotes-various.xlsx,z5-merged-2d-note.xlsx,z6-henkou-paren-300.xlsx,z7-csv-quoted-ditto.csv,z8-csv-raw-ditto.csv,z9-kyushin-name-up-repeat-300.xlsx').split(',')
const { browser, page, errors } = await launch()
const out = []
for (const f of FILES) {
  await fresh(page)
  await palette(page, '新しいBOM'); await sleep(40)
  await page.getByTestId('wizard-id').fill('P-Z' + out.length); await page.keyboard.press('Enter')
  for (let i = 0; i < 6; i++) { await page.keyboard.press('Enter'); await sleep(20) }
  await page.keyboard.press('2'); await sleep(60)
  const n0 = errors.length
  await page.getByTestId('wizard-file').setInputFiles(P(f))
  for (let i = 0; i < 400; i++) { if (/読み込みました|読めませんでした|読めません/.test(await toastNow(page))) break; await sleep(100) }
  const toast = (await toastNow(page)).slice(0, 600)
  if (/読み込みました/.test(toast)) { await page.keyboard.press('Enter'); await sleep(300) }
  const prev = (await page.getByTestId('wizard-preview').textContent({ timeout: 2000 }).catch(() => '')) ?? ''
  if ((process.env.SHOT ?? '').split(',').includes(f)) await page.screenshot({ path: `/home/user/BOM/usertest/veteran/r21/shots/${f}${TAG}-preview.png` })
  let created = null
  if (prev) {
    await page.keyboard.press('Enter'); await page.waitForFunction(() => !document.querySelector('[data-testid="panel-wizard"]'), null, { timeout: 60000 }).catch(() => {})
    const w = await ws(page); const p = w?.projects.find((x) => x.id === w.currentProjectId)
    const rs = p?.rows ?? []
    const line = (r) => [r.name, r.model, r.maker, r.qtyNeeded, r.note ?? ''].join(' / ')
    created = { rows: rs.length, qty0: rs.filter((r) => r.qtyNeeded === 0).length, qtySum: rs.reduce((a, r) => a + (r.qtyNeeded ?? 0), 0), noName: rs.filter((r) => !(r.name ?? '').trim()).length, notBuhinN: rs.filter((r) => !/^部品\d+$/.test(r.name ?? '')).length, notBuhin: rs.filter((r) => !/^部品\d+$/.test(r.name ?? '')).map(line).slice(0, 8), modelOld: rs.filter((r) => /^OLD-/.test(r.model ?? '')).length, modelNew: rs.filter((r) => /^NEW-/.test(r.model ?? '')).length, sample: rs.slice(0, 4).map(line), around: rs.slice(48, 53).map(line), last: rs.slice(-3).map(line), quotes: rs.filter((r) => /"/.test([r.model, r.note, r.maker].join(''))).map(line).slice(0, 12) }
  }
  const rec = { f, toast, preview: prev.slice(0, 900), created, errs: errors.slice(n0).filter((e) => e.type !== 'dialog').map((e) => e.text.slice(0, 120)) }
  out.push(rec); console.log(JSON.stringify(rec).slice(0, 2500))
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape')
}
saveJson(`108-xlsx-r16${TAG}.json`, out)
await browser.close()
