// ラウンド16: ガイド「1 貼り付け」（Excel からコピーした表を欄に貼る）で、ラウンド15 の修正の境目を 300 行で。
// Excel から結合したセルをコピーすると値は左上だけ（ほかは空）になるので、上の段「部品名・旧・・新・」の部品名は下の段で空になる
// p1 上の段「部品名・旧・・新・」＋下の段「・型式・数量・型式・数量」を 50 行ごと（300 行）
// p2 「"」だけのセル（〃の代わり）が 3 行目のメーカ（300 行。xlsx は直ったが貼り付けは？）
// p3 変えた行だけ変更後（型式・メーカ）を書き、メーカは同じ値を書き写した（300 行・30 行変更）
// p4 EDA の BOM「Description・Value・MPN・Footprint・Qty・DNP」（300 行）
// p5 「型式・型式(変更)」（300 行・30 行変更）
// p6 2 段「数量」の下に「1号機・2号機」（合計なし、300 行）
import { launch, fresh, palette, sleep, ws } from '../r8/rerun7/rerun6/lib.mjs'
import { saveJson } from './lib18.mjs'
const TAG = process.env.TAG ?? ''
const { browser, page, errors } = await launch({ launch: {} })
await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
const MK = ['オムロン', '三菱電機', 'IDEC']
const p1 = []; for (let k = 1; k <= 300; k++) { if ((k - 1) % 50 === 0) { p1.push(['部品名', '旧', '', '新', '']); p1.push(['', '型式', '数量', '型式', '数量']) } const ch = k % 10 === 0; p1.push([`部品${k}`, `OLD-${k}`, (k % 9) + 1, ch ? `NEW-${k}` : `OLD-${k}`, ch ? (k % 9) + 11 : (k % 9) + 1]) }
const p2 = [['部品名', '型式', 'メーカ', '数量'], ...Array.from({ length: 300 }, (_, i) => { const k = i + 1; return k === 3 ? [`部品${k}`, `MDL-${k}`, '"', 3] : [`部品${k}`, `MDL-${k}`, MK[k % 3], (k % 9) + 1] })]
const p3 = [['部品名', '型式', '変更後型式', 'メーカ', '変更後メーカ', '数量'], ...Array.from({ length: 300 }, (_, i) => { const k = i + 1; const ch = k % 10 === 0; return [`部品${k}`, `OLD-${k}`, ch ? `NEW-${k}` : '', MK[k % 3], ch ? MK[k % 3] : '', (k % 9) + 1] })]
const p4 = [['Description', 'Value', 'MPN', 'Footprint', 'Qty', 'DNP'], ...Array.from({ length: 300 }, (_, i) => { const k = i + 1; return [`部品${k}`, `${k}k`, `MPN-${k}`, '0603', (k % 9) + 1, k % 7 === 0 ? 'DNP' : ''] })]
const p5 = [['部品名', '型式', '型式(変更)', 'メーカ', '数量'], ...Array.from({ length: 300 }, (_, i) => { const k = i + 1; const ch = k % 10 === 0; return [`部品${k}`, `OLD-${k}`, ch ? `NEW-${k}` : '', MK[k % 3], (k % 9) + 1] })]
const p6 = [['部品名', '型式', 'メーカ', '数量', ''], ['', '', '', '1号機', '2号機'], ...Array.from({ length: 300 }, (_, i) => { const k = i + 1; return [`部品${k}`, `MDL-${k}`, MK[k % 3], (k % 9) + 1, (k % 9) + 1] })]
const cases = { 'p1-kyushin-name-up-repeat-300': p1, 'p2-ascii-quote-ditto-300': p2, 'p3-sparse-maker-written-300': p3, 'p4-eda-bom-300': p4, 'p5-henkou-paren-300': p5, 'p6-units-no-total-300': p6 }
const out = []
for (const [id, rows] of Object.entries(cases)) {
  await fresh(page)
  await palette(page, '新しいBOM'); await sleep(40)
  await page.getByTestId('wizard-id').fill('P-V' + out.length); await page.keyboard.press('Enter')
  for (let i = 0; i < 6; i++) { await page.keyboard.press('Enter'); await sleep(20) }
  await page.keyboard.press('1'); await sleep(60)
  await page.evaluate((t) => navigator.clipboard.writeText(t), rows.map((r) => r.join('\t')).join('\n'))
  await page.getByTestId('wizard-paste').focus(); await page.keyboard.press('Control+v'); await sleep(150)
  await page.keyboard.press('Control+Enter'); await sleep(400)
  const prev = (await page.getByTestId('wizard-preview').textContent({ timeout: 3000 }).catch(() => '')) ?? ''
  if ((process.env.SHOT ?? '').split(',').includes(id)) await page.screenshot({ path: `/home/user/BOM/usertest/veteran/r18/shots/${id}${TAG}-preview.png` })
  await page.keyboard.press('Enter'); await page.waitForFunction(() => !document.querySelector('[data-testid="panel-wizard"]'), null, { timeout: 60000 }).catch(() => {})
  const w = await ws(page); const p = w?.projects.find((x) => x.id === w.currentProjectId); const rs = p?.rows ?? []
  const line = (r) => [r.name, r.model, r.maker, r.qtyNeeded].join(' / ')
  const rec = { id, preview: prev.slice(0, 700), rows: rs.length, qty0: rs.filter((r) => r.qtyNeeded === 0).length, qtySum: rs.reduce((a, r) => a + (r.qtyNeeded ?? 0), 0), noName: rs.filter((r) => !(r.name ?? '').trim()).length, notBuhinN: rs.filter((r) => !/^部品\d+$/.test(r.name ?? '')).length, modelOld: rs.filter((r) => /^OLD-/.test(r.model ?? '')).length, modelNew: rs.filter((r) => /^NEW-/.test(r.model ?? '')).length, sample: rs.slice(0, 3).map(line), around: rs.slice(48, 53).map(line), tail: rs.slice(-2).map(line) }
  out.push(rec); console.log(JSON.stringify(rec).slice(0, 1600))
}
console.log('errors', JSON.stringify(errors.slice(0, 5)))
saveJson(`109-wizard-paste-r16${TAG}.json`, out)
await browser.close()
