// ラウンド4: 実際の速打ちと同じ条件（ページ内で 45ms ごとにキーを発生させ、処理が詰まればキーは待たされる）で、
// 打ち始めルールの結果を 開発（5173）とビルド（5195）で比べる。結果は localStorage と DOM から読む（ビルドでも読める）
import { chromium } from '/home/user/BOM/node_modules/playwright/index.mjs'
import fs from 'node:fs'
const TARGETS = (process.env.TARGETS ?? 'dev:5173,build:5195').split(',').map((x) => x.split(':'))
const GAP = Number(process.env.GAP ?? 45)
const N300 = !!process.env.N300
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const res = {}
const CASES = [
  // [col label, row, text, kind]  kind: text=文字として入ってほしい / cmd=コマンドとして動いてほしい
  ['回路記号', 'R040', 'K1', 'text'], ['回路記号', 'R040', 'J1', 'text'], ['回路記号', 'R040', 'J12', 'text'], ['回路記号', 'R040', 'N1', 'text'], ['回路記号', 'R040', 'k1', 'text'],
  ['型式', 'R040', 'K3HB-X', 'text'], ['型式', 'R040', 'J7KN-10', 'text'], ['型式', 'R040', 'K8AK-AS1', 'text'],
  ['型式', 'R040', 'ADP3338', 'text'], ['型式', 'R040', 'AD8605', 'text'], ['型式', 'R040', 'INA219', 'text'], ['メーカ', 'R040', 'wago', 'text'], ['部品名', 'R040', 'coil', 'text'], ['部品名', 'R040', 'wire', 'text'],
  ['型式', 'R040', 'DRV8833', 'text'], ['型式', 'R040', 'STM32F103', 'text'], ['型式', 'R040', 'S1', 'text'], ['型式', 'R040', 'NJM2904', 'text'], ['部品名', 'R040', 'knob', 'text'], ['部品名', 'R040', 'hook', 'text'], ['部品名', 'R040', 'relay', 'text'], ['部品名', 'R040', 'fuse', 'text'], ['部品名', 'R040', 'oscillator', 'text'], ['部品名', 'R040', 'xtal', 'text'],
  ['部品名', 'R040', 'hjhjhj', 'cmd'], ['部品名', 'R040', 'ajaj', 'cmd'], ['型式', 'R040', 's4', 'cmd'], ['型式', 'R040', 'Dj', 'cmd'],
]
async function typeInPage(page, seq, gap) {
  return page.evaluate(async ([seq, gap]) => {
    const lags = []
    const cap = (e) => { if (e.__t) lags.push({ k: e.key, lag: Math.round(performance.now() - e.__t) }) }
    window.addEventListener('keydown', cap, true)
    const keyOf = (ch) => /^[A-Z]$/.test(ch) ? { key: ch, code: 'Key' + ch, shiftKey: true } : /^[a-z]$/.test(ch) ? { key: ch, code: 'Key' + ch.toUpperCase() } : /^\d$/.test(ch) ? { key: ch, code: 'Digit' + ch } : ch === '-' ? { key: '-', code: 'Minus' } : { key: ch }
    const t0 = performance.now()
    await new Promise((resolve) => {
      ;[...seq].forEach((ch, i) => setTimeout(() => {
        const e = new KeyboardEvent('keydown', { ...keyOf(ch), bubbles: true, cancelable: true })
        e.__t = t0 + i * gap
        ;document.body.dispatchEvent(e)
        if (i === seq.length - 1) setTimeout(resolve, 50)
      }, i * gap))
    })
    window.removeEventListener('keydown', cap, true)
    return lags
  }, [seq, gap])
}
for (const [tag, port] of TARGETS) {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  const errs = []
  page.on('pageerror', (e) => errs.push(e.message))
  if (process.env.CPU) { const cdp = await page.context().newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: Number(process.env.CPU) }) }
  const url = `http://localhost:${port}/`
  res[tag] = []
  const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null
  for (const [colLabel, rid, text, kind] of CASES.filter((c) => !ONLY || ONLY.includes(c[2]))) {
    await page.goto(url); await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); Storage.prototype.setItem = function () {} })
    if (N300) {
      await page.goto(url); await page.waitForSelector('[data-testid="grid"]'); await page.locator('.gridwrap').focus(); await page.keyboard.press('Control+s')
      await page.evaluate(() => { const k = 'bom-pro.workspace.v2'; const w = JSON.parse(localStorage.getItem(k)); const p = w.projects.find((x) => x.id === w.currentProjectId); const base = p.rows.filter((r) => ['draft', 'submitted', 'quoting', 'quoted'].includes(r.status)); let i = 0; while (p.rows.length < 300) { const r = structuredClone(base[i % base.length]); r.id = 'X' + String(p.rows.length + 1).padStart(3, '0'); p.rows.push(r); i++ } localStorage.setItem(k, JSON.stringify(w)) })
    }
    await page.goto(url); await page.waitForSelector('[data-testid="grid"]'); await page.locator('.gridwrap').focus()
    await page.keyboard.press('1')
    await page.keyboard.press('Control+g'); await page.getByTestId('prompt-text').fill(rid); await page.keyboard.press('Enter')
    await page.keyboard.press('Home')
    for (let i = 0; i < 60 && !((await page.getByTestId('cursor').textContent()) ?? '').includes(colLabel); i++) await page.keyboard.press('ArrowRight')
    await page.keyboard.press('Control+s'); await sleep(100)
    const before = await page.evaluate(() => { const w = JSON.parse(localStorage.getItem('bom-pro.workspace.v2')); const p = w.projects.find((x) => x.id === w.currentProjectId); return { n: p.rows.length, hidden: p.rows.filter((r) => r.hidden).map((r) => r.id), adopted: p.rows.filter((r) => r.adoptedSupplierId).map((r) => r.id + ':' + r.adoptedSupplierId), json: JSON.stringify(p.rows) } })
    const c0 = await page.getByTestId('cursor').textContent()
    const lags = await typeInPage(page, text, GAP)
    await sleep(700)
    const m = await page.getByTestId('mode').textContent()
    const ev = m === '編集' ? await page.getByTestId('cell-editor').inputValue().catch(() => '(editor not in DOM)') : null
    const toast = await page.evaluate(() => (document.querySelector('[data-testid="toast-float"]') ?? document.querySelector('[data-testid="toast"]'))?.textContent ?? '')
    const panelOpen = await page.evaluate(() => document.querySelector('[data-testid^="panel-"]')?.dataset.testid ?? null)
    const view = await page.evaluate(() => document.querySelector('.views .on, [data-testid="views"] .on, .view.on')?.textContent ?? '')
    const c1 = await page.getByTestId('cursor').textContent()
    if (m === '編集') { await page.keyboard.press('Enter'); await sleep(50) } else if (panelOpen) { await page.keyboard.press('Escape'); await page.keyboard.press('Escape') }
    await page.locator('.gridwrap').focus().catch(() => {}); await page.keyboard.press('Control+s'); await sleep(100)
    const after = await page.evaluate(() => { const w = JSON.parse(localStorage.getItem('bom-pro.workspace.v2')); const p = w.projects.find((x) => x.id === w.currentProjectId); return { n: p.rows.length, hidden: p.rows.filter((r) => r.hidden).map((r) => r.id), adopted: p.rows.filter((r) => r.adoptedSupplierId).map((r) => r.id + ':' + r.adoptedSupplierId), rows: p.rows } })
    const beforeRows = JSON.parse(before.json)
    const changedRows = after.rows.filter((r) => JSON.stringify(r) !== JSON.stringify(beforeRows.find((b) => b.id === r.id))).map((r) => { const b = beforeRows.find((x) => x.id === r.id); if (!b) return { id: r.id, new: true, model: r.working?.model ?? r.model } ; const ch = {}; for (const k of new Set([...Object.keys(r), ...Object.keys(b)])) if (JSON.stringify(r[k]) !== JSON.stringify(b[k]) && !['history', 'updatedAt'].includes(k)) ch[k] = [b[k], r[k]]; return { id: r.id, ch } })
    const rec = { colLabel, rid, text, kind, cursorBefore: c0, cursorAfter: c1, mode: m, editVal: ev, panel: panelOpen, toast: toast.slice(0, 90), rows: [before.n, after.n], hidden: [before.hidden, after.hidden], adopted: [before.adopted.length, after.adopted.length], changedRows: changedRows.map((x) => JSON.stringify(x).slice(0, 300)), lags }
    rec.ok = kind === 'text' ? changedRows.length === 1 && changedRows[0].id === rid && JSON.stringify(changedRows[0]).includes(JSON.stringify(text)) && before.n === after.n : ev === null
    res[tag].push(rec)
    console.log(tag, rec.ok ? 'OK' : 'NG', text, '| mode', m, 'edit', JSON.stringify(ev), '| panel', panelOpen, '| rows', rec.rows.join('→'), '| changed', rec.changedRows.join(' ; ').slice(0, 250), '| maxLag', Math.max(...lags.map((l) => l.lag)), '|', toast.slice(0, 50))
  }
  console.log(tag, 'errors', errs.slice(0, 5))
  await browser.close()
}
fs.writeFileSync(`/home/user/BOM/usertest/veteran/r6/rerun4/${process.env.OUT ?? '21-burst-inpage.json'}`, JSON.stringify(res, null, 2))
