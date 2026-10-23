// ラウンド5: 容量ぎりぎり。大きい案件（約 1.2MB）の JSON を続けて読み込んで退避がたまったとき、
// いつもの編集・JSON 読み込みが保存されるか（リロードで消えないか）。退避を消す手段はあるか
import { launch, fresh, goto, toCol, sleep, dumpErrors, save, panel, palette, toastNow, ws, LS_KEY } from './lib.mjs'
const { browser, page, errors } = await launch({ acceptDialogs: true })
const out = { steps: [] }
const BK = 'bom-pro.workspace.backup'
const log = (o) => { out.steps.push(o); console.log(JSON.stringify(o).slice(0, 900)) }
const usage = () => page.evaluate((bk) => { const o = {}; let n = 0; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); const l = k.length + (localStorage.getItem(k)?.length ?? 0); o[k] = l; n += l } let b = []; try { b = JSON.parse(localStorage.getItem(bk) ?? '[]').map((x) => `${x.reason}:${x.raw.length}`) } catch {} return { total: n, keys: o, backups: b } }, BK)
async function importJson(text) {
  await palette(page, 'JSON を読み込む'); await sleep(40)
  await page.evaluate((t) => { const el = document.querySelector('[data-testid="import-text"]'); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(el, t); el.dispatchEvent(new Event('input', { bubbles: true })) }, text)
  await page.getByTestId('import-text').focus()
  await page.keyboard.press('Control+Enter'); await sleep(100)
  const texts = []
  for (let i = 0; i < 3; i++) {
    const p = await panel(page); if (!p) break
    texts.push((await page.locator('[data-testid^="panel-"]').first().innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 160))
    await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter'); await sleep(150)
  }
  return { texts, toast: (await toastNow(page)).slice(0, 200) }
}
const mainProj = () => page.evaluate((k) => { const w = JSON.parse(localStorage.getItem(k) ?? 'null'); return w ? { cur: w.currentProjectId, rows: w.projects.find((p) => p.id === w.currentProjectId)?.rows.length } : null }, LS_KEY)
await fresh(page); await page.keyboard.press('Control+s')
const base = await ws(page)
// 1 件あたり約 1.2M 文字（行の備考を長くした 80 行＋追加 160 行）
function big(id, noteLen = 6000, extra = 160) {
  const w = structuredClone(base); const p = w.projects[0]; p.id = id; p.name = '大型案件 ' + id; w.currentProjectId = id
  for (let i = 0; i < extra; i++) { const r = structuredClone(p.rows[i % 70]); r.id = 'Z' + String(i).padStart(3, '0'); r.ref = 'Z' + i; p.rows.push(r) }
  p.rows.forEach((r, i) => { r.note = (id + ' ' + i + ' ').padEnd(noteLen, 'x') })
  return JSON.stringify(w)
}
const sizes = []
for (const id of ['P-BIG1', 'P-BIG2', 'P-BIG3', 'P-BIG4']) {
  const text = big(id, id === 'P-BIG4' ? Number(process.env.BIG4 ?? 8800) : 5000)
  sizes.push(text.length)
  const r = await importJson(text)
  log({ step: 'import ' + id, len: text.length, ...r, usage: await usage(), main: await mainProj(), inMemory: await page.evaluate(() => document.querySelector('[data-testid="header"]')?.textContent.slice(0, 60)) })
}
// いつもの編集を続ける（部品名を 30 行書き換える）
await page.keyboard.press('1'); await goto(page, 'R010'); await toCol(page, '部品名')
let firstFail = null
for (let i = 0; i < 30; i++) {
  await page.keyboard.press('Enter'); await page.keyboard.press('Control+a'); await page.keyboard.type('編集' + i + '-'.repeat(50)); await page.keyboard.press('Enter'); await sleep(30)
  const t = await toastNow(page)
  if (/いっぱい/.test(t) && !firstFail) { firstFail = { i, toast: t, usage: await usage() }; }
}
log({ step: 'edit x30', firstFail })
const nameInStore = await page.evaluate((k) => { const w = JSON.parse(localStorage.getItem(k)); const p = w.projects.find((x) => x.id === w.currentProjectId); return p.rows.filter((r) => /^編集/.test(r.working?.name ?? r.name)).length }, LS_KEY)
await page.reload(); await page.waitForSelector('[data-testid="grid"]'); await sleep(200)
const afterReload = await page.evaluate((k) => { const w = JSON.parse(localStorage.getItem(k)); const p = w.projects.find((x) => x.id === w.currentProjectId); return { cur: w.currentProjectId, edited: p.rows.filter((r) => /^編集/.test(r.working?.name ?? r.name)).length } }, LS_KEY)
log({ step: 'reload', editedInStoreBeforeReload: nameInStore, afterReload, header: await page.evaluate(() => document.querySelector('[data-testid="header"]')?.textContent.slice(0, 60)) })
// パレットに退避を消す操作はあるか
await page.locator('.gridwrap').focus()
await page.keyboard.press('Control+k'); await page.getByTestId('palette-input').fill('退避'); await sleep(50)
const items = await page.evaluate(() => [...document.querySelectorAll('[data-testid="palette-list"] .item')].map((el) => el.textContent.slice(0, 50)))
await page.keyboard.press('Escape')
log({ step: 'palette 退避', items })
dumpErrors(errors, '34')
save('34-storage.json', out)
await browser.close()
