// ラウンド7 中堅: 共通部品（r5 から。英字コマンドは Alt 付きに変換、?fresh= で開く）
import { chromium } from '/home/user/BOM/node_modules/playwright/index.mjs'
import fs from 'node:fs'

export const DIR = '/home/user/BOM/usertest/mid/r12'
export const SHOTS = DIR + '/shots'
fs.mkdirSync(SHOTS, { recursive: true })

const KEY = 'bom-pro.workspace.v2'

export async function launch(opts = {}) {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
  const context = await browser.newContext({ viewport: { width: opts.width ?? 1600, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'], acceptDownloads: true })
  await context.addInitScript(() => { if (location.search.includes('fresh=')) { try { localStorage.clear(); sessionStorage.clear() } catch {} ; history.replaceState(null, '', location.pathname) } })
  if (opts.time) await context.clock.setFixedTime(new Date(opts.time))
  const page = await context.newPage()
  // ラウンド5 の修正: 文字を打てるセルでは英字は値の打ち始め。ナビモードで英字コマンドを押すときは Alt 付きにする（a は Ctrl+Alt+A）
  const origPress = page.keyboard.press.bind(page.keyboard)
  page.keyboard.rawPress = origPress
  page.keyboard.press = async (k, o) => {
    if (/^(Shift\+)?[a-zA-Z]$/.test(k) || /^[1-9]$/.test(k)) {
      const nav = await page.evaluate(async () => { try { const s = (await import(window.__m('/src/model/store.ts'))).useStore.getState(); const ae = document.activeElement; const inInput = ae instanceof HTMLInputElement || ae instanceof HTMLTextAreaElement; return !s.panel && s.mode === 'nav' && !inInput } catch { return false } })
      if (nav) { k = 'Alt+' + k }
    }
    await origPress(k, o)
  }
  const errors = []
  page.on('console', (m) => { if (m.type() === 'error') errors.push('[console] ' + m.text()) })
  page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message))
  await context.addInitScript(() => { window.__m = (p) => { const e = performance.getEntriesByType('resource').map((x) => x.name).filter((n) => new URL(n).pathname === p); return e[0] ?? p } })
  const downloads = []
  let dlSeq = 0
  page.on('download', async (d) => { const name = `${SHOTS}/dl-${Date.now()}-${process.pid}-${dlSeq++}.xlsx`; await d.saveAs(name).catch(() => {}); downloads.push({ name, suggested: d.suggestedFilename() }) })
  const t = {
    browser, context, page, errors, downloads, paletteMiss: [],
    async open(role = 'design', seed) {
      if (seed) {
        await page.goto('http://localhost:5175/?fresh=' + Date.now()); await page.getByTestId('grid').waitFor()
        await page.evaluate(([k, v]) => localStorage.setItem(k, v), [KEY, JSON.stringify(seed)])
        await page.goto('http://localhost:5175/')
      } else await page.goto('http://localhost:5175/?fresh=' + Date.now())
      await page.getByTestId('grid').waitFor()
      // 状態を一度保存させる（サンプルを localStorage に）
      await t.role(role === 'pm' ? 'design' : 'pm')
      await t.role(role)
      await page.locator('.gridwrap').focus()
      if (!(await page.evaluate((k) => localStorage.getItem(k), KEY))) {
        await t.S(`st.commitWs('', () => {})`)
      }
    },
    async setTime(iso) { await page.clock.setFixedTime(new Date(iso)) },
    async reload() { await page.reload(); await page.getByTestId('grid').waitFor(); await page.locator('.gridwrap').focus() },
    async role(role) {
      await page.getByTestId('role-' + role).click()
      await page.waitForTimeout(40)
      await page.locator('.gridwrap').focus()
    },
    async press(...keys) { for (const k of keys) { await page.keyboard.press(k); await page.waitForTimeout(35) } },
    async type(s) { await page.keyboard.type(s) },
    async goto(id) { await page.keyboard.press('Control+g'); await page.getByTestId('prompt-text').fill(id); await page.keyboard.press('Enter'); await page.waitForTimeout(60) },
    async curCol() { return page.evaluate(async () => (await import(__m('/src/model/store.ts'))).useStore.getState().cursorCol) },
    async curRow() { return page.evaluate(async () => (await import(__m('/src/model/store.ts'))).useStore.getState().cursorRow) },
    async colKey(key) {
      for (let i = 0; i < 90; i++) { if ((await t.curCol()) === key) return; await page.keyboard.press('ArrowRight') }
      for (let i = 0; i < 90; i++) { if ((await t.curCol()) === key) return; await page.keyboard.press('ArrowLeft') }
      throw new Error('colKey not found ' + key + ' view=' + (await t.view()))
    },
    async showCol(...keys) { await page.evaluate(async (keys) => { const s = (await import(window.__m('/src/model/store.ts'))).useStore; s.setState({ hiddenCols: s.getState().hiddenCols.filter((k) => !keys.includes(k)) }) }, keys) },
    async view() { return page.evaluate(async () => (await import(__m('/src/model/store.ts'))).useStore.getState().view) },
    async mode() { return page.evaluate(async () => (await import(__m('/src/model/store.ts'))).useStore.getState().mode) },
    async panel() { return page.evaluate(async () => { const p = (await import(__m('/src/model/store.ts'))).useStore.getState().panel; return p ? { kind: p.kind, title: p.title, options: (p.options ?? []).map?.((o) => typeof o === 'string' ? o : (o.key ? o.key + ' ' : '') + o.label + (o.detail ? ' :: ' + o.detail : '')), lines: p.lines, extra: p.extra, error: p.error, index: p.index } : null }) },
    async setCellKey(id, colKey, value) {
      await t.goto(id); await t.colKey(colKey); await page.keyboard.press('Enter'); await page.waitForTimeout(30)
      await page.keyboard.press('Control+a'); await page.keyboard.type(value); await page.keyboard.press('Enter'); await page.waitForTimeout(60)
      if ((await t.mode()) === 'edit') { const msg = await t.toast(); await page.keyboard.press('Escape'); return 'EDIT-ERR ' + msg }
      return await t.toast()
    },
    async cmd(label, query = label) {
      await page.keyboard.press('Control+k'); await page.getByTestId('palette-input').fill(query); await page.waitForTimeout(100)
      const items = await page.getByTestId('palette-list').locator('.item').allTextContents()
      const idx = items.findIndex((x) => x.includes(label))
      if (idx < 0) throw new Error('palette item not found: ' + label + ' in ' + items.slice(0, 5).join(' | '))
      if (idx > 0) { t.paletteMiss.push(`${query} → 先頭は「${items[0].slice(0, 30)}」、目的は ${idx + 1} 番目`); for (let i = 0; i < idx; i++) await page.keyboard.press('ArrowDown') }
      await page.keyboard.press('Enter'); await page.waitForTimeout(120)
    },
    async bulk() { await t.cmd('未採用を推奨で一括採用'); await page.waitForTimeout(80); const pn = await t.panel(); if (pn?.kind === 'prompt' && pn.options?.[0] === 'やめる') { await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter'); await page.waitForTimeout(250) } return t.toast() },
    async replace(id, model) { await t.goto(id); await page.keyboard.press('r'); await page.waitForTimeout(120); await t.promptFill(model); await page.keyboard.press('Enter'); await page.waitForTimeout(120); return t.toast() },
    async decide(id, key, text = '', extra) {
      await t.goto(id); await page.keyboard.press('Enter'); await page.waitForTimeout(80); const panel = await t.panel()
      await page.keyboard.press(key); await page.waitForTimeout(80); const pr = await t.panel()
      if (pr?.kind === 'prompt') {
        if (text) await t.promptFill(text)
        if (pr.extra && '承認者' in pr.extra) { await t.extraFill('承認者', '部長 田中'); if ('決裁書No' in pr.extra) await t.extraFill('決裁書No', 'K-77') }
        if (extra) for (const [k, v] of Object.entries(extra)) await t.extraFill(k, v)
        await page.getByTestId('prompt-text').press('Enter'); await page.waitForTimeout(100)
      }
      const after = await t.panel(); if (after) { await page.keyboard.press('Escape'); await page.keyboard.press('Escape') }
      return { panel, prompt: pr, after, toast: await t.toast() }
    },
    async yes(id, text = 'ok') {
      await t.goto(id); await page.keyboard.press('y'); await page.waitForTimeout(80); const pr = await t.panel()
      if (pr?.kind === 'prompt') { await t.promptFill(text); if (pr.extra && '承認者' in pr.extra) { await t.extraFill('承認者', '部長 田中'); if ('決裁書No' in pr.extra) await t.extraFill('決裁書No', 'K-77') } await page.getByTestId('prompt-text').press('Enter'); await page.waitForTimeout(100) }
      const after = await t.panel(); if (after) { await page.keyboard.press('Escape') }
      return { prompt: pr, after, toast: await t.toast() }
    },
    async publish(reasonKey = '2') {
      await page.keyboard.press('Control+Enter'); await page.waitForTimeout(120); let pn = await t.panel(); const title = pn?.title
      if (pn?.kind === 'prompt' && pn.options?.includes('客先要求')) { await page.keyboard.press(reasonKey); await page.waitForTimeout(60); pn = await t.panel(); if (pn) { await page.keyboard.press('Enter'); await page.waitForTimeout(100) } }
      else if (pn?.kind === 'prompt') { await page.keyboard.press('Enter'); await page.waitForTimeout(100) }
      pn = await t.panel(); if (pn?.kind === 'prompt') { await page.keyboard.press('Enter'); await page.waitForTimeout(100) }
      return (title ? '[' + title.slice(0, 60) + '] ' : '') + await t.toast()
    },
    async requestRough(deadline) { await t.cmd('概算見積を依頼'); await page.waitForTimeout(80); if (deadline) await t.promptFill(deadline); await page.keyboard.press('Enter'); await page.waitForTimeout(900); return t.toast() },
    async requestFormal() { await t.cmd('正式見積を依頼（社外）', '正式見積を依頼'); await page.waitForTimeout(120); const pn = await t.panel(); await page.keyboard.press('2'); await page.waitForTimeout(1500); return (pn?.title ?? '') + ' → ' + await t.toast() },
    async order(id, key = 'o') { await t.goto(id); await page.keyboard.press(key); await page.waitForTimeout(80); return t.toast() },
    async promptFill(text) { await page.getByTestId('prompt-text').fill(text) },
    async extraFill(k, v) { await page.getByTestId('extra-' + k).fill(v) },
    dialog: async () => { const l = page.locator('[role=dialog]'); return (await l.count()) ? (await l.first().textContent()) : '' },
    status: () => page.getByTestId('status').textContent(),
    toast: async () => page.evaluate(async () => (await import(__m('/src/model/store.ts'))).useStore.getState().toast?.text ?? ''),
    lamps: () => page.getByTestId('lamps').textContent(),
    money: () => page.getByTestId('money').textContent(),
    header: () => page.getByTestId('header').textContent(),
    cell: (id, col) => page.locator(`[data-row-id="${id}"] td[data-col="${col}"]`).textContent(),
    viewRows: () => page.evaluate(async () => { const m = await import(__m('/src/model/selectors.ts')); const s = (await import(__m('/src/model/store.ts'))).useStore.getState(); return m.buildViewModel(s).rows.map((r) => r.id) }),
    viewItems: () => page.evaluate(async () => { const m = await import(__m('/src/model/selectors.ts')); const s = (await import(__m('/src/model/store.ts'))).useStore.getState(); return m.buildViewModel(s).items.map((i) => i.key) }),
    viewCount: async (n) => page.evaluate(async (n) => { const m = await import(__m('/src/model/selectors.ts')); const s = (await import(__m('/src/model/store.ts'))).useStore.getState(); return m.buildViewModel(s).counts[n] }, n),
    cellText: (id, col) => page.evaluate(async ([id, col]) => { const m = await import(__m('/src/model/selectors.ts')); const s = (await import(__m('/src/model/store.ts'))).useStore.getState(); const vm = m.buildViewModel(s); const r = s.project().rows.find((x) => x.id === id); return m.cellText(r, col, vm.ctx).text }, [id, col]),
    // ストアの読み取り（検証用。操作はキーボードで行う）
    S: (src) => page.evaluate(async (src) => { const m = await import(__m('/src/model/store.ts')); const st = m.useStore.getState(); const p = st.project(); return new Function('st', 'p', src)(st, p) }, src),
    async ws() { return page.evaluate((k) => JSON.parse(localStorage.getItem(k)), KEY) },
    async proj() { const ws = await t.ws(); return ws.projects.find((p) => p.id === ws.currentProjectId) },
    async row(id) { const p = await t.proj(); return p.rows.find((r) => r.id === id) },
    async quotes(id) { const p = await t.proj(); return p.quotes.filter((q) => q.rowId === id) },
    async shot(name) { await page.screenshot({ path: `${SHOTS}/${name}.png` }) },
    async close() { if (errors.length) console.log('ERRORS', errors); await browser.close() },
  }
  return t
}

export const log = (...a) => console.log(...a)
const results = []
export function check(name, cond, detail = '') { results.push([name, !!cond]); console.log((cond ? 'PASS ' : 'FAIL ') + name + (detail ? ' :: ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) : '')); return cond }
export function summary() { const f = results.filter((r) => !r[1]); console.log(`== ${results.length - f.length}/${results.length} PASS`); }
