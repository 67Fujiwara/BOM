// ラウンd6: 容量ぎりぎり（Chromium の localStorage 5,242,880 文字）での JSON 読み込み・退避・編集。
// S1: ラウンド5 の V5-06 手順（P-BIG1〜4 を読み込み → 30 回編集 → リロード）
// S2: 退避の空きを作るために「JSON 読み込みの前」の退避そのものが消され、読み込み前に戻せなくなるか（現 2.3M → 新 3.2M）
// S3: 「退避データを消す」の流れ、読めなかった保存データ（守る退避）が大きいときの編集
import { launch, fresh, goto, toCol, sleep, dumpErrors, panel, palette, toastNow, ws, LS_KEY } from '../../r6/rerun5/lib.mjs'
import { saveJson } from './lib7.mjs'
const { browser, page, errors } = await launch({ acceptDialogs: true })
const out = { steps: [] }
const BK = 'bom-pro.workspace.backup'
const log = (o) => { out.steps.push(o); console.log(JSON.stringify(o).slice(0, 1200)) }
const usage = () => page.evaluate((bk) => { let n = 0; const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); const l = k.length + (localStorage.getItem(k)?.length ?? 0); o[k] = l; n += l } let b = []; try { b = JSON.parse(localStorage.getItem(bk) ?? '[]').map((x) => `${x.reason}:${x.raw.length}:${(/"currentProjectId":"([^"]+)"/.exec(x.raw) ?? [])[1]}`) } catch {} return { total: n, keys: o, backups: b } }, BK)
async function importJson(text, choose = 'ArrowDown') {
  await palette(page, 'JSON を読み込む'); await sleep(40)
  await page.evaluate((t) => { const el = document.querySelector('[data-testid="import-text"]'); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(el, t); el.dispatchEvent(new Event('input', { bubbles: true })) }, text)
  await page.getByTestId('import-text').focus()
  await page.keyboard.press('Control+Enter'); await sleep(100)
  const texts = []
  for (let i = 0; i < 3; i++) {
    const p = await panel(page); if (!p) break
    texts.push((await page.locator('[data-testid^="panel-"]').first().innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 200))
    await page.keyboard.press(choose); await page.keyboard.press('Enter'); await sleep(200)
  }
  return { texts, toast: (await toastNow(page)).slice(0, 220) }
}
const mainProj = () => page.evaluate((k) => { const w = JSON.parse(localStorage.getItem(k) ?? 'null'); return w ? { cur: w.currentProjectId, rows: w.projects.find((p) => p.id === w.currentProjectId)?.rows.length, len: localStorage.getItem(k).length } : null }, LS_KEY)
const header = () => page.evaluate(() => document.querySelector('[data-testid="header"]')?.textContent.slice(0, 60))
async function clean() {
  await page.goto('http://localhost:' + (process.env.PORT ?? 5176) + '/')
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); Storage.prototype.setItem = function () {} })
  await fresh(page); await page.keyboard.press('Control+s'); await sleep(50)
}
await clean()
const base = await ws(page)
function big(id, noteLen = 6000, extra = 160) {
  const w = structuredClone(base); const p = w.projects[0]; p.id = id; p.name = '大型案件 ' + id; w.currentProjectId = id
  for (let i = 0; i < extra; i++) { const r = structuredClone(p.rows[i % 70]); r.id = 'Z' + String(i).padStart(3, '0'); r.ref = 'Z' + i; p.rows.push(r) }
  p.rows.forEach((r, i) => { r.note = (id + ' ' + i + ' ').padEnd(noteLen, 'x') })
  return JSON.stringify(w)
}
// 目標の長さに合わせる
function sized(id, target) { let lo = 100, hi = 20000; while (hi - lo > 5) { const m = (lo + hi) >> 1; if (big(id, m).length < target) lo = m; else hi = m } return big(id, lo) }

if (!process.env.SKIP_S1) {
  // ---------- S1 ----------
  for (const id of ['P-BIG1', 'P-BIG2', 'P-BIG3', 'P-BIG4']) {
    const text = big(id, id === 'P-BIG4' ? 8800 : 5000)
    const r = await importJson(text)
    log({ s: 'S1', step: 'import ' + id, len: text.length, ...r, usage: await usage(), main: await mainProj(), header: await header() })
  }
  await page.keyboard.press('Alt+1'); await goto(page, 'R010'); await toCol(page, '部品名')
  let firstFail = null
  for (let i = 0; i < 30; i++) {
    await page.keyboard.press('Enter'); await page.keyboard.press('Control+a'); await page.keyboard.type('編集' + i + '-'.repeat(50)); await page.keyboard.press('Enter'); await sleep(30)
    const t = await toastNow(page)
    if (/いっぱい/.test(t) && !firstFail) firstFail = { i, toast: t, usage: await usage() }
  }
  const beforeReload = { header: await header(), main: await mainProj() }
  await page.reload(); await page.waitForSelector('[data-testid="grid"]'); await sleep(200)
  const afterReload = await page.evaluate((k) => { const w = JSON.parse(localStorage.getItem(k)); const p = w.projects.find((x) => x.id === w.currentProjectId); return { cur: w.currentProjectId, edited: p.rows.filter((r) => /^編集/.test(r.working?.name ?? r.name)).length } }, LS_KEY)
  log({ s: 'S1', step: 'edit x30 + reload', firstFail, beforeReload, afterReload, header: await header(), usage: await usage() })
}

// ---------- S2 ----------
await clean()
const A = sized('P-A', Number(process.env.SZ_A ?? 2300000)), B = sized('P-B', Number(process.env.SZ_B ?? 3200000))
let r = await importJson(A)
log({ s: 'S2', step: 'import P-A', len: A.length, ...r, usage: await usage(), main: await mainProj(), header: await header() })
// P-A で 1 か所編集（読み込み前に戻したら、この値が戻ってほしい）
await page.keyboard.press('Alt+1'); await goto(page, 'R010'); await toCol(page, '部品名')
await page.keyboard.press('Enter'); await page.keyboard.press('Control+a'); await page.keyboard.type('P-A の大事な編集'); await page.keyboard.press('Enter'); await sleep(50)
log({ s: 'S2', step: 'edit P-A', toast: await toastNow(page), usage: await usage() })
r = await importJson(B)
log({ s: 'S2', step: 'import P-B', len: B.length, ...r, usage: await usage(), main: await mainProj(), header: await header() })
// 読み込み前に戻す
await page.locator('.gridwrap').focus()
await page.keyboard.press('Control+k'); await page.getByTestId('palette-input').fill('読み込み前に戻す'); await sleep(60)
await page.keyboard.press('Enter'); await sleep(150)
const restorePanel = (await page.locator('[data-testid^="panel-"]').first().innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 400)
const restoreToast = await toastNow(page)
log({ s: 'S2', step: '読み込み前に戻す', panel: await panel(page), restorePanel, restoreToast })
for (let i = 0; i < 3 && (await panel(page)); i++) { await page.keyboard.press('Enter'); await sleep(200); const p2 = await panel(page); if (p2 === 'panel-confirm') { await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter'); await sleep(200) } }
const afterRestore = await page.evaluate((k) => { const w = JSON.parse(localStorage.getItem(k)); const p = w.projects.find((x) => x.id === w.currentProjectId); return { cur: w.currentProjectId, r010: p.rows.find((x) => x.id === 'R010')?.working?.name ?? p.rows.find((x) => x.id === 'R010')?.name } }, LS_KEY)
log({ s: 'S2', step: 'after restore attempt', afterRestore, toast: await toastNow(page), header: await header(), usage: await usage() })
await page.keyboard.press('Escape'); await page.keyboard.press('Escape')

// ---------- S3 ----------
await clean()
// 読めない保存データ（2.4M 文字の壊れた JSON）→ リロードで守る退避に入る
await page.evaluate((k) => { Storage.prototype.setItem.call(localStorage, k, '{"projects":[' + 'x'.repeat(2400000)) }, LS_KEY)
await page.reload(); await page.waitForSelector('[data-testid="grid"]'); await sleep(200)
log({ s: 'S3', step: 'broken 2.4M reload', toast: await toastNow(page), usage: await usage() })
r = await importJson(sized('P-C', 2600000))
log({ s: 'S3', step: 'import P-C 2.6M', ...r, usage: await usage(), main: await mainProj(), header: await header() })
await page.keyboard.press('Alt+1'); await goto(page, 'R010'); await toCol(page, '部品名')
await page.keyboard.press('Enter'); await page.keyboard.press('Control+a'); await page.keyboard.type('S3 編集'); await page.keyboard.press('Enter'); await sleep(50)
log({ s: 'S3', step: 'edit', toast: await toastNow(page), usage: await usage() })
// 退避データを消す
await page.keyboard.press('Control+k'); await page.getByTestId('palette-input').fill('退避データを消す'); await sleep(60)
const items = await page.evaluate(() => [...document.querySelectorAll('[data-testid="palette-list"] .item')].map((el) => el.textContent.slice(0, 60)))
await page.keyboard.press('Enter'); await sleep(150)
const confirmText = (await page.locator('[data-testid^="panel-"]').first().innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 300)
await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter'); await sleep(150)
log({ s: 'S3', step: '退避データを消す', items, confirmText, toast: await toastNow(page), usage: await usage() })
await page.keyboard.press('Enter'); await page.keyboard.press('Control+a'); await page.keyboard.type('S3 編集2'); await page.keyboard.press('Enter'); await sleep(50)
log({ s: 'S3', step: 'edit after clear', toast: await toastNow(page), usage: await usage(), main: await mainProj() })
out.errors = dumpErrors(errors, '54')
saveJson(process.env.OUT ?? '54-storage.json', out)
await browser.close()
