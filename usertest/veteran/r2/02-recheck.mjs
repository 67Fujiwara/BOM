// V-e（正しいコマンドで）, V-m〜V-t の再確認
import { launch, fresh, setRole, goto, toCol, cursor, mode, sleep, dumpErrors, shot2, save2, proj, row, panel, closeAll, palette, paletteExact, toastNow, ws } from './lib.mjs'
const out = {}
const log = (k, o) => { out[k] = o; console.log(k, JSON.stringify(o).slice(0, 700)) }
let { browser, context, page, errors } = await launch()
const perr = (n) => errors.slice(n).filter((e) => e.type === 'pageerror' || e.type === 'error').map((e) => e.text.slice(0, 200))

// ---------- V-e ----------
await fresh(page)
{
  const n = errors.length
  await palette(page, '新しいBOM')
  await page.getByTestId('wizard-id').fill('P-E3'); await page.keyboard.press('Enter'); await page.getByTestId('wizard-name').fill('空3'); await page.keyboard.press('Enter')
  for (let i = 0; i < 5; i++) await page.keyboard.press('Enter')
  await page.keyboard.press('3'); await page.keyboard.press('Enter'); await page.keyboard.press('Enter'); await sleep(150)
  await setRole(page, 'purchasing')
  const ok = await paletteExact(page, '見積回答を取り込む', '見積回答')
  await sleep(50)
  const opts = await page.getByTestId('prompt-options').textContent().catch(() => null)
  await page.keyboard.press('Enter'); await sleep(50)
  const pn = await panel(page)
  if (pn === 'panel-import') { await page.getByTestId('import-text').fill('R001\t100\t5\nR999\tx\ty\n\t\t\n'); await page.keyboard.press('Control+Enter'); await sleep(80) }
  log('V-e', { ok, opts, panelAfter: pn, toast: (await toastNow(page)).slice(0, 140), errors: perr(n) })
  await closeAll(page)
  // 商社マスタが空
  const w = await ws(page)
  w.suppliers = []; w.projects.forEach((x) => (x.supplierIds = []))
  await page.evaluate((s) => localStorage.setItem('bom-pro.workspace.v2', s), JSON.stringify(w))
  await page.reload(); await page.waitForSelector('[data-testid="grid"]'); await page.locator('.gridwrap').focus()
  const n2 = errors.length
  await paletteExact(page, '見積回答を取り込む', '見積回答'); await sleep(50)
  const o2 = await page.getByTestId('prompt-options').textContent().catch(() => null)
  await page.keyboard.press('Enter'); await sleep(40)
  log('V-e/noSuppliers', { opts: o2, panel: await panel(page), toast: (await toastNow(page)).slice(0, 100), errors: perr(n2) })
  await closeAll(page)
}

// ---------- V-m: 同 ID 案件 ----------
{
  await fresh(page)
  const n = errors.length
  const w = await (async () => { await page.keyboard.press('Control+s'); return ws(page) })()
  const dup = structuredClone(w.projects[0]); dup.name = 'コピー'
  w.projects.push(dup)
  await page.evaluate((s) => localStorage.setItem('bom-pro.workspace.v2', s), JSON.stringify(w))
  await page.reload(); await sleep(400)
  const t = await toastNow(page)
  const projectsShown = (await ws(page))?.projects?.length
  await page.locator('.gridwrap').focus(); await page.keyboard.press('Control+p'); await sleep(50)
  const inbox = await page.getByTestId('inbox').textContent().catch(() => null)
  await page.keyboard.press('Escape')
  log('V-m/localStorage dup', { toast: t.slice(0, 100), projectsInLS: projectsShown, inbox: inbox?.slice(0, 200), header: (await page.getByTestId('header').textContent())?.slice(0, 40), errors: perr(n).filter((x) => /key/i.test(x)) })
  // 2 タブで同時に同じ ID のガイドを完了
  await fresh(page)
  const p2 = await context.newPage(); p2._tag = 'tabB'
  await p2.goto('http://localhost:5173/'); await p2.waitForSelector('[data-testid="grid"]'); await p2.locator('.gridwrap').focus()
  for (const pg of [page, p2]) {
    await pg.bringToFront(); await pg.locator('.gridwrap').focus()
    await palette(pg, '新しいBOM')
    await pg.getByTestId('wizard-id').fill('P-SAME'); await pg.keyboard.press('Enter'); await pg.getByTestId('wizard-name').fill(pg === page ? 'A' : 'B'); await pg.keyboard.press('Enter')
    for (let i = 0; i < 5; i++) await pg.keyboard.press('Enter')
    await pg.keyboard.press('3'); await pg.keyboard.press('Enter')
  }
  // 両方でまだ最後の Enter を押していない → A 完了 → B 完了
  await page.bringToFront(); await page.keyboard.press('Enter'); await sleep(200)
  await p2.bringToFront(); await p2.keyboard.press('Enter'); await sleep(200)
  const ids = (await ws(page)).projects.map((p) => p.id + ':' + p.name)
  log('V-m/2tabs same id', { ids, toastB: (await toastNow(p2)).slice(0, 100), errors: perr(n).filter((x) => /key/i.test(x)).slice(0, 2) })
  await p2.close()
}

// ---------- V-n: パネルの ↓ で選択が画面外 ----------
async function selVisible(pg, listSel) {
  return pg.evaluate((sel) => {
    const list = document.querySelector(sel)
    if (!list) return 'no list'
    const s = list.querySelector('[aria-selected="true"], .sel, .cur')
    if (!s) return 'no sel'
    const a = list.getBoundingClientRect(), b = s.getBoundingClientRect()
    return b.top >= a.top - 1 && b.bottom <= a.bottom + 1 && b.bottom <= window.innerHeight
  }, listSel)
}
{
  await fresh(page)
  const res = {}
  await page.setViewportSize({ width: 1280, height: 600 })
  await page.keyboard.press('Control+k'); for (let i = 0; i < 38; i++) await page.keyboard.press('ArrowDown'); res.palette = await selVisible(page, '[data-testid="palette-list"]'); await page.keyboard.press('Escape')
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('c'); for (let i = 0; i < 36; i++) await page.keyboard.press('ArrowDown'); res.columns = await selVisible(page, '[data-testid="columns"]'); await shot2(page, 'V-n-columns'); await page.keyboard.press('Escape')
  await setRole(page, 'pm'); await palette(page, '案件設定'); for (let i = 0; i < 22; i++) await page.keyboard.press('ArrowDown'); res.settings = await selVisible(page, '[data-testid="settings"]'); await page.keyboard.press('Escape')
  await page.keyboard.press('?'); res.helpScrollable = await page.evaluate(() => { const h = document.querySelector('[data-testid="help"]'); const d = h?.closest('.dialog') ?? h; return d ? { sh: d.scrollHeight, ch: d.clientHeight } : null }); await page.keyboard.press('ArrowDown'); await page.keyboard.press('PageDown'); res.helpScrollAfterKeys = await page.evaluate(() => { let m = 0; document.querySelectorAll('[data-testid="panel-help"] *').forEach((e) => (m = Math.max(m, e.scrollTop))); return m }); await page.keyboard.press('Escape')
  await page.keyboard.press('Control+p'); res.inbox = await selVisible(page, '[data-testid="inbox"]'); await page.keyboard.press('Escape')
  log('V-n', res)
  await page.setViewportSize({ width: 1440, height: 900 })
}

// ---------- V-o: 1280 幅・150% のヘッダー ----------
async function headerCheck(pg, tag) {
  return pg.evaluate((tag) => {
    const vw = document.documentElement.clientWidth
    const vis = (sel) => { const e = document.querySelector(sel); if (!e) return 'none'; const r = e.getBoundingClientRect(); return r.width > 0 && r.left >= 0 && r.right <= vw + 0.5 ? 'ok' : `clip(${Math.round(r.left)}-${Math.round(r.right)}/${vw})` }
    const h = document.querySelector('[data-testid="header"]').getBoundingClientRect()
    return { tag, vw, headerH: Math.round(h.height), design: vis('[data-testid="role-design"]'), purchasing: vis('[data-testid="role-purchasing"]'), pm: vis('[data-testid="role-pm"]'), palette: vis('[data-testid="open-palette"]'), help: vis('[data-testid="open-help"]'), lamps: vis('[data-testid="lamps"]'), money: vis('[data-testid="money"]'), docScrollX: document.documentElement.scrollWidth > vw }
  }, tag)
}
{
  const res = []
  for (const [w, h, tag] of [[1280, 720, '1280x720'], [853, 480, '1280@150%'], [1024, 768, '1024'], [683, 384, '1024@150%'], [640, 360, '1280@200%']]) {
    await page.setViewportSize({ width: w, height: h })
    await fresh(page)
    for (const role of ['design', 'pm']) { if (role === 'pm') await setRole(page, 'pm'); res.push({ ...(await headerCheck(page, tag + '/' + role)) }) }
    await shot2(page, 'V-o-' + tag.replace(/[@%]/g, '_'))
  }
  log('V-o', res)
  await page.setViewportSize({ width: 1440, height: 900 })
}

// ---------- V-p: 詳細の見積表 ----------
{
  const res = []
  for (const [w, h] of [[1280, 720], [853, 480]]) {
    await page.setViewportSize({ width: w, height: h })
    await fresh(page)
    await goto(page, 'R020'); await page.keyboard.press('Space'); await sleep(80)
    res.push(await page.evaluate((w) => { const t = document.querySelector('table.quotes'); const d = document.querySelector('[data-testid="detail"]'); if (!t) return { w, none: true }; const r = t.getBoundingClientRect(); const dr = d.getBoundingClientRect(); return { w, tableRight: Math.round(r.right), detailRight: Math.round(dr.right), vw: document.documentElement.clientWidth, detailScrollW: d.scrollWidth, detailClientW: d.clientWidth } }, w))
    await shot2(page, 'V-p-' + w)
  }
  log('V-p', res)
  await page.setViewportSize({ width: 1440, height: 900 })
}

// ---------- V-q: 列をすべて隠す ----------
{
  await fresh(page)
  const n = errors.length
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('c')
  const cols = await page.locator('[data-testid="columns"] .opt').allTextContents()
  for (let i = 0; i < cols.length; i++) { if (cols[i].startsWith('●') || !cols[i].startsWith('○')) await page.keyboard.press('Space'); await page.keyboard.press('ArrowDown') }
  await page.keyboard.press('Escape')
  const shown = await page.evaluate(() => [...document.querySelectorAll('[data-testid="grid"] thead th')].map((t) => t.textContent).join('|'))
  const cur1 = await cursor(page)
  for (const k of ['ArrowRight', 'End', 'Home', 'Enter']) await page.keyboard.press(k)
  const m = await mode(page)
  await page.keyboard.press('Escape')
  for (const v of '23456789') await page.keyboard.press(v)
  log('V-q', { shownCols: shown.slice(0, 200), cursor: cur1, cursorAfter: await cursor(page), modeAfterEnter: m, cursorCell: await page.locator('td.cursor').count(), errors: perr(n) })
  await shot2(page, 'V-q')
}

// ---------- V-r: 商社 15 社の色 ----------
{
  await fresh(page, 'purchasing')
  const n = errors.length
  for (let i = 0; i < 12; i++) { await paletteExact(page, '商社を追加', '商社を追加'); await page.getByTestId('prompt-text').fill('商社' + i); await page.keyboard.press('Enter'); await sleep(20) }
  const w = await ws(page)
  const colors = w.suppliers.map((s) => s.color)
  const dup = colors.filter((c, i) => colors.indexOf(c) !== i)
  log('V-r', { n: colors.length, unique: new Set(colors).size, dup, errors: perr(n) })
}

// ---------- V-s: Undo/Redo 交互 50 ----------
{
  await fresh(page)
  await goto(page, 'R001')
  for (let i = 0; i < 50; i++) { await page.keyboard.press('Enter'); await page.keyboard.press('Control+a'); await page.keyboard.type('z' + i); await page.keyboard.press('Enter') }
  const names = async () => JSON.stringify((await proj(page)).rows.map((r) => r.working?.name ?? r.name))
  const before = await names()
  const t0 = Date.now()
  for (let i = 0; i < 50; i++) { await page.keyboard.press('Control+z'); await page.keyboard.press('Control+Shift+z') }
  const ms = Date.now() - t0
  const after = await names()
  // Ctrl+Y でも
  for (let i = 0; i < 20; i++) { await page.keyboard.press('Control+z'); await page.keyboard.press('Control+y') }
  const afterY = await names()
  // 全部戻す
  let undos = 0
  for (let i = 0; i < 80; i++) { await page.keyboard.press('Control+z'); undos++; if ((await toastNow(page)).includes('ありません') || (await toastNow(page)).includes('戻せません')) break }
  const p = await proj(page)
  log('V-s', { ms, same: before === after, sameY: before === afterY, undosUntilEmpty: undos, lastToast: (await toastNow(page)).slice(0, 80), restored: p.rows.slice(0, 50).filter((r) => !/^z\d+$/.test(r.working?.name ?? r.name)).length })
}

// ---------- V-t: 900 回ビュー切替 ----------
{
  await fresh(page)
  await page.keyboard.press('ArrowDown')
  let t0 = Date.now()
  for (let i = 0; i < 100; i++) for (const k of '123456789') await page.keyboard.press(k)
  const ms = Date.now() - t0
  const lat = await page.evaluate(async () => {
    const res = []
    const cur = () => document.querySelector('[aria-current="true"][data-testid^="view-"]')?.dataset.testid
    for (let i = 0; i < 45; i++) {
      const k = String((i % 9) + 1)
      const t = performance.now()
      window.dispatchEvent(new KeyboardEvent('keydown', { key: k, code: 'Digit' + k, bubbles: true, cancelable: true }))
      await new Promise((r) => requestAnimationFrame(() => r()))
      res.push(performance.now() - t)
    }
    res.sort((a, b) => a - b)
    return { median: +res[22].toFixed(1), p90: +res[40].toFixed(1), max: +res.at(-1).toFixed(1) }
  })
  const jl = await page.evaluate(async () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '1', code: 'Digit1', bubbles: true }))
    await new Promise((r) => setTimeout(r, 50))
    const res = []
    for (let i = 0; i < 40; i++) {
      const t = performance.now()
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'j', code: 'KeyJ', bubbles: true, cancelable: true }))
      await new Promise((r) => requestAnimationFrame(() => r()))
      res.push(performance.now() - t)
    }
    res.sort((a, b) => a - b)
    return { median: +res[20].toFixed(1), p90: +res[36].toFixed(1), max: +res.at(-1).toFixed(1) }
  })
  log('V-t', { ms900: ms, perPressMs: +(ms / 900).toFixed(1), viewLatency: lat, jLatency80: jl })
}

save2('02-recheck.json', out)
dumpErrors(errors, 'recheck2')
await browser.close()
