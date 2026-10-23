// ラウンド5（ベテラン）: 英字の扱い（0.4 秒待ち・続きの判定・1.5 秒の連続・j/k/n の巻き戻し）を両方向で調べる共通部品。
// ページ内でキーを発生させる（e.timeStamp＝発生時刻）。開発（5173）でもビルド（5195）でも DOM と localStorage だけで結果を読む。
import { chromium } from '/home/user/BOM/node_modules/playwright/index.mjs'
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
export const LS = 'bom-pro.workspace.v2'

export async function open(port, opts = {}) {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
  const context = await browser.newContext({ locale: 'ja-JP', viewport: { width: 1440, height: 900 }, timezoneId: opts.tz })
  const page = await context.newPage()
  const errs = []
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message))
  page.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 200)) })
  page.on('dialog', (d) => { errs.push('dialog: ' + d.message()); d.dismiss().catch(() => {}) })
  if (opts.cpu) { const cdp = await context.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: opts.cpu }) }
  return { browser, context, page, errs, url: `http://localhost:${port}/` }
}

export async function reset(env, { role = 'design', n300 = false } = {}) {
  const { page, url } = env
  await page.goto(url)
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); Storage.prototype.setItem = function () {} })
  await page.goto(url); await page.waitForSelector('[data-testid="grid"]')
  await page.locator('.gridwrap').focus(); await page.keyboard.press('Control+s'); await sleep(50)
  if (n300) {
    await page.evaluate((k) => { const w = JSON.parse(localStorage.getItem(k)); const p = w.projects.find((x) => x.id === w.currentProjectId); const base = p.rows.filter((r) => ['draft', 'submitted', 'quoting', 'quoted'].includes(r.status)); let i = 0; while (p.rows.length < 300) { const r = structuredClone(base[i % base.length]); r.id = 'X' + String(p.rows.length + 1).padStart(3, '0'); r.ref = 'XR' + p.rows.length; p.rows.push(r); i++ } localStorage.setItem(k, JSON.stringify(w)) }, LS)
    await page.goto(url); await page.waitForSelector('[data-testid="grid"]')
  }
  if (role !== 'design') {
    const label = role === 'purchasing' ? 'role-purchasing' : 'role-pm'
    await page.getByTestId(label).click()
    for (let i = 0; i < 3; i++) { if (!(await panelOf(page))) break; await page.keyboard.press('Enter'); await sleep(30) }
  }
  await page.locator('.gridwrap').focus()
}
export async function panelOf(page) { return page.evaluate(() => document.querySelector('[data-testid^="panel-"]')?.dataset.testid ?? null) }
export async function cursorText(page) { return (await page.getByTestId('cursor').textContent()) ?? '' }
export async function gotoCell(page, view, rowId, colLabel) {
  await page.keyboard.press(String(view)); await sleep(30)
  await page.keyboard.press('Control+g'); await page.getByTestId('prompt-text').fill(rowId); await page.keyboard.press('Enter'); await sleep(30)
  await page.keyboard.press('Home')
  for (let i = 0; i < 70; i++) {
    const c = await cursorText(page)
    if (c.startsWith(rowId) && c.slice(rowId.length).trim() === colLabel) return true
    await page.keyboard.press('ArrowRight')
  }
  return false
}
/** 画面と保存データの今の様子 */
export async function snap(page) {
  return page.evaluate((k) => {
    const w = JSON.parse(localStorage.getItem(k) ?? 'null')
    const p = w?.projects.find((x) => x.id === w.currentProjectId)
    const mode = document.querySelector('[data-testid="mode"]')?.textContent ?? ''
    const ed = document.querySelector('[data-testid="cell-editor"]')
    const view = document.querySelector('[data-testid^="view-"][aria-current="true"]')?.dataset.testid ?? ''
    const chips = [...document.querySelectorAll('.toolbar .chip')].map((c) => c.textContent).join(' | ')
    return {
      mode, edit: mode === '編集' ? (ed?.value ?? '(no editor)') : null, cursor: document.querySelector('[data-testid="cursor"]')?.textContent ?? '', view, chips,
      panel: document.querySelector('[data-testid^="panel-"]')?.dataset.testid ?? null,
      toast: (document.querySelector('[data-testid="toast-float"]') ?? document.querySelector('[data-testid="toast"]'))?.textContent?.slice(0, 120) ?? '',
      rows: p ? JSON.stringify(p.rows.map((r) => { const { statusChangedAt, ...x } = r; return x })) : '', issues: p ? p.issues.length : 0, quotes: p ? JSON.stringify(p.quotes) : '',
    }
  }, LS)
}
export function diffRows(a, b) {
  const A = JSON.parse(a.rows || '[]'), B = JSON.parse(b.rows || '[]')
  const out = []
  for (const r of B) {
    const o = A.find((x) => x.id === r.id)
    if (!o) { out.push(`${r.id}:+new`); continue }
    for (const k of new Set([...Object.keys(r), ...Object.keys(o)])) if (JSON.stringify(r[k]) !== JSON.stringify(o[k])) out.push(`${r.id}.${k}:${JSON.stringify(o[k])?.slice(0, 40)}→${JSON.stringify(r[k])?.slice(0, 60)}`)
  }
  for (const o of A) if (!B.find((x) => x.id === o.id)) out.push(`${o.id}:-removed`)
  if (A.map((r) => r.id).join() !== B.map((r) => r.id).join()) out.push('order changed')
  if (a.issues !== b.issues) out.push(`issues ${a.issues}→${b.issues}`)
  if (a.quotes !== b.quotes) out.push('quotes changed')
  return out
}
/**
 * ページ内でキーを順に発生させる。seq: [[key, gapBeforeMs], ...]。key は 1 文字か Enter / Escape / Tab / Backspace / ArrowDown など
 * 予定時刻（t0＋累積）に setTimeout で発生させる。処理が詰まればキーも待たされる（実機と同じ）
 */
export async function typeSeq(page, seq) {
  return page.evaluate(async (seq) => {
    const keyOf = (ch) => /^[A-Z]$/.test(ch) ? { key: ch, code: 'Key' + ch, shiftKey: true } : /^[a-z]$/.test(ch) ? { key: ch, code: 'Key' + ch.toUpperCase() } : /^\d$/.test(ch) ? { key: ch, code: 'Digit' + ch } : ch === '-' ? { key: '-', code: 'Minus' } : ch === ' ' ? { key: ' ', code: 'Space' } : { key: ch, code: ch }
    const t0 = performance.now()
    let acc = 0
    const lags = []
    await new Promise((resolve) => {
      seq.forEach(([ch, gap], i) => {
        acc += gap
        const due = acc
        setTimeout(() => {
          const e = new KeyboardEvent('keydown', { ...keyOf(ch), bubbles: true, cancelable: true })
          lags.push(Math.round(performance.now() - t0 - due))
          ;document.body.dispatchEvent(e)
          if (i === seq.length - 1) setTimeout(resolve, 30)
        }, due)
      })
    })
    return lags
  }, seq)
}
export const word = (text, gap, first = 0) => [...text].map((ch, i) => [ch, i === 0 ? first : gap])
