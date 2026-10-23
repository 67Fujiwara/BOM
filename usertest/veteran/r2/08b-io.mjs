// 08 の深掘り: 取込の NaN、拡張子つき Excel の読込、壊れた xlsx
import fs from 'node:fs'
import path from 'node:path'
import { launch, fresh, setRole, goto, toCol, cursor, sleep, save2, proj, row, panel, closeAll, palette, paletteExact, toastNow, ws, DL2, shot2 } from './lib.mjs'
const { browser, page, errors } = await launch()
const out = {}
const log = (k, o) => { out[k] = o; console.log(k, JSON.stringify(o).slice(0, 3000)) }
// NaN: 購買が R030（見積済）に「1,200円」「¥1,200」「１２００」で取込
await fresh(page, 'purchasing')
const n = errors.length
await paletteExact(page, '見積回答を取り込む', '見積回答'); await sleep(50); await page.keyboard.press('Enter'); await sleep(40)
await page.getByTestId('import-text').fill('行ID\t型式\t単価\t納期\tMOQ\nR030\t\t1,200円\t2週間\t10個\nR031\t\t１２００\t14\t\nR032\t\t¥1,200\t即納\t\nR033\t\t-500\t-3\t0\nR034\t\t1e9\t99999\t\n')
await page.keyboard.press('Control+Enter'); await sleep(150)
const t = await toastNow(page)
const mem = await page.evaluate(async () => { const s = (await import('/src/model/store.ts')).useStore.getState(); const p = s.project(); return p.quotes.filter((q) => ['R030', 'R031', 'R032', 'R033', 'R034'].includes(q.rowId) && q.supplierId === 'S1' && !q.stale).map((q) => `${q.rowId}:${q.unitPrice}/${q.leadDays}/${q.moq}`) })
await page.keyboard.press('9')
const cells = {}
for (const id of ['R030', 'R031', 'R032', 'R033', 'R034']) cells[id] = ((await page.locator(`[data-row-id="${id}"]`).textContent({ timeout: 1000 }).catch(() => "(not in view 9)")) ?? "").replace(/\s+/g, " ").slice(0, 160)
const nanTexts = await page.evaluate(() => { const out = []; const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let x; while ((x = w.nextNode())) if (/NaN|Infinity/.test(x.textContent)) out.push((x.parentElement?.closest('[data-row-id]')?.dataset.rowId ?? x.parentElement?.className) + ':' + x.textContent.slice(0, 40)); return out.slice(0, 10) })
await goto(page, 'R030'); await page.keyboard.press('Space'); await sleep(60)
const detail = (await page.getByTestId('detail').textContent()).slice(0, 400)
await page.keyboard.press('Space')
await setRole(page, 'design'); await page.keyboard.press('1'); await goto(page, 'R030'); await page.keyboard.press('a'); await sleep(40)
const adoptT = await toastNow(page)
const r30 = await row(page, 'R030')
const money = await page.getByTestId('money').textContent()
await page.reload(); await page.waitForSelector('[data-testid="grid"]')
const afterReload = (await proj(page)).quotes.filter((q) => ['R030', 'R031'].includes(q.rowId) && q.supplierId === 'S1' && !q.stale).map((q) => `${q.rowId}:${q.unitPrice}/${q.leadDays}/${q.moq}`)
log('importNaN', { toast: t.slice(0, 160), memory: mem, cells, nanTexts, detail, adoptToast: adoptT.slice(0, 100), r30adopted: r30.adoptedSupplierId, scoreSnapshot: r30.scoreSnapshot, money, afterReload, errors: errors.slice(n).map((e) => e.text.slice(0, 100)) })
await shot2(page, '08b-nan')
// 拡張子つきの社内 Excel を新規 BOM に
await fresh(page)
const files = []
page.on('download', async (d) => { const f = path.join(DL2, 'internal-export.xlsx'); await d.saveAs(f); files.push(f) })
await page.keyboard.press('Control+e'); await page.keyboard.press('Enter'); for (let i = 0; i < 50 && !files.length; i++) await sleep(100); await sleep(300)
await palette(page, '新しいBOM'); await page.getByTestId('wizard-id').fill('P-FILE2'); for (let i = 0; i < 7; i++) await page.keyboard.press('Enter')
await page.keyboard.press('2'); await sleep(50)
await page.getByTestId('wizard-file').setInputFiles(files[0]); await sleep(1000)
const prev = await page.getByTestId('wizard-preview').textContent().catch(() => null)
const werr = await page.getByTestId('wizard-error').textContent().catch(() => null)
await page.keyboard.press('Control+Enter'); await sleep(100); await page.keyboard.press('Enter'); await sleep(300)
const p = await proj(page)
log('wizardFile/internalXlsx', { preview: prev?.slice(0, 300), werr, id: p.id, rows: p.rows.length, sample: p.rows.slice(0, 3).map((r) => [r.ref, r.category, r.name, r.model, r.maker, r.qtyNeeded, r.unit, r.note]), toast: (await toastNow(page)).slice(0, 160) })
// 壊れた .xlsx / 空ファイル / 巨大でない画像
for (const [name, content] of [['broken.xlsx', 'this is not a zip'], ['empty.csv', ''], ['pic.png', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0])]]) {
  const fp = path.join(DL2, name); fs.writeFileSync(fp, content)
  await closeAll(page)
  await palette(page, '新しいBOM'); await page.getByTestId('wizard-id').fill('P-' + name.replace(/\W/g, '')); for (let i = 0; i < 7; i++) await page.keyboard.press('Enter')
  await page.keyboard.press('2'); await sleep(50)
  const ne = errors.length
  await page.getByTestId('wizard-file').setInputFiles(fp); await sleep(800)
  const e1 = await page.getByTestId('wizard-error').textContent().catch(() => null)
  const t1 = await toastNow(page)
  await page.keyboard.press('Control+Enter'); await sleep(100)
  const e2 = await page.getByTestId('wizard-error').textContent().catch(() => null)
  log('wizardFile/' + name, { errAfterSelect: e1, toast: t1.slice(0, 100), errAfterNext: e2, panel: await panel(page), errors: errors.slice(ne).map((e) => e.type + ':' + e.text.slice(0, 120)) })
}
save2('08b-io.json', out)
await browser.close()
