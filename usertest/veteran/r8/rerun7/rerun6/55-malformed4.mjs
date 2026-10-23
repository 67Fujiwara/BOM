// ラウンド5: 22-malformed2 の手順で、ラウンド4 で試していない型違い（末尾の提出・正規表現・行の任意項目・指摘の提案など）。元: ラウンド4: 型違いの JSON（ワークスペース・案件・行の中の入れ子）を、本物のサンプルを壊して読み込ませる。
// 全ビュー × 3 役割 + Space / 詳細 / Ctrl+E などで画面が壊れないか。壊れたら「退避したデータに戻す」で戻れるか
import { launch, fresh, setRole, sleep, dumpErrors, save, panel, palette, toastNow, ws, shot, LS_KEY } from './lib.mjs'
const { browser, page, errors } = await launch({ acceptDialogs: true })
const out = { cases: [] }
const crash = async () => page.getByTestId('crash').count()
async function importJson(text) {
  await palette(page, 'JSON を読み込む'); await sleep(40)
  await page.evaluate((t) => { const el = document.querySelector('[data-testid="import-text"]'); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(el, t); el.dispatchEvent(new Event('input', { bubbles: true })) }, text)
  await page.getByTestId('import-text').focus()
  await page.keyboard.press('Control+Enter'); await sleep(60)
  const p = await panel(page)
  let confirmText = ''
  if (p) { confirmText = (await page.locator('[data-testid^="panel-"]').first().innerText().catch(() => '')).slice(0, 200); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter'); await sleep(80) }
  return { toast: (await toastNow(page)).slice(0, 200), confirmText }
}
await fresh(page)
await page.keyboard.press('Control+s')
const SAMPLE = await ws(page)
const P = (w) => w.projects[0]
const big = (n, f) => Array.from({ length: n }, (_, i) => f(i))
const M = {
  'row.statusChangedAt="1970-01-01T00:00:00Z"（全行）': (w) => { P(w).rows.forEach((r) => { r.statusChangedAt = '1970-01-01T00:00:00.000Z' }) },
  'row.statusChangedAt="1900-01-01"（全行）': (w) => { P(w).rows.forEach((r) => { r.statusChangedAt = '1900-01-01' }) },
  'row.statusChangedAt="0100-01-01"（1 行）': (w) => { P(w).rows[0].statusChangedAt = '0100-01-01' },
  'row.quotedAt="1970-01-01"（見積済）': (w) => { P(w).rows.forEach((r) => { if (r.status === 'quoted') r.quotedAt = '1970-01-01' }) },
  'settings.holidays 20,000 件': (w) => { P(w).settings = { ...P(w).settings, holidays: big(20000, (i) => `2${String(i).padStart(3, '0')}-01-01`) } },
  'settings.formalDays=1e8': (w) => { P(w).settings = { ...P(w).settings, formalDays: 1e8, quoteDays: 1e8, processDays: 1e8 } },
  'settings.processDays=-1e8': (w) => { P(w).settings = { ...P(w).settings, processDays: -1e8 } },
  'settings.selector="bogus"': (w) => { P(w).settings = { ...P(w).settings, selector: 'bogus', quoteCompleteRule: 'bogus' } },
  'decisions[0] 全部型違い': (w) => { P(w).decisions = [{ id: {}, kind: {}, rowId: {}, by: { name: 'x', role: 'pm' }, at: 5, text: {}, result: {} }] },
  'events 全部 rowId={}・at=5': (w) => { P(w).events = (P(w).events ?? []).map((e) => ({ ...e, at: 5, rowId: {} })) },
  'issues[0].field=123': (w) => { if (P(w).issues[0]) P(w).issues[0].field = 123 },
  'issues[0].field="nosuch"': (w) => { if (P(w).issues[0]) P(w).issues[0].field = 'nosuch' },
  'issues[0].kind="未知の種別"': (w) => { if (P(w).issues[0]) P(w).issues[0].kind = '未知の種別' },
  'issues[0].dueAt=5・rev="x"': (w) => { if (P(w).issues[0]) { P(w).issues[0].dueAt = 5; P(w).issues[0].rev = 'x' } },
  'issues[0].by.name={}': (w) => { if (P(w).issues[0]) P(w).issues[0].by = { name: {}, role: 'purchasing' } },
  'members.design={}': (w) => { P(w).members = { design: {}, purchasing: 5, pm: null } },
  'preferredSupplierIds=[{}]・supplierIds=[null,5]': (w) => { P(w).preferredSupplierIds = [{}]; P(w).supplierIds = [null, 5] },
  'suppliers id 重複': (w) => { w.suppliers = [...w.suppliers, { ...w.suppliers[0], name: '重複商社' }] },
  'suppliers handledMakers="x"': (w) => { w.suppliers[0].handledMakers = 'オムロン' },
  'rowWeights.R040="x"': (w) => { P(w).rowWeights = { R040: 'x' } },
  'rowWeights.R040={price:"x"}': (w) => { P(w).rowWeights = { R040: { price: 'x', lead: {} } } },
  'row id "__proto__"': (w) => { P(w).rows[0].id = '__proto__' },
  'row id "constructor"・"toString"': (w) => { P(w).rows[0].id = 'constructor'; P(w).rows[1].id = 'toString' },
  'submissions snapshot 型違い': (w) => { const s = P(w).submissions ?? []; if (s.length) { const k = Object.keys(s[0].snapshot ?? {})[0] ?? 'R001'; s[0].snapshot = { ...(s[0].snapshot ?? {}), [k]: { model: {}, qtyNeeded: 'x', name: 5 } } } },
  'submissions changeSet 型違い': (w) => { const s = P(w).submissions ?? []; if (s.length) s[s.length - 1].changeSet = { rowIds: 'x', reason: {}, cause: 5, approved: 'x' } },
  'submissions rev 重複・負': (w) => { const s = P(w).submissions ?? []; if (s.length) P(w).submissions = [...s, { ...s[0], rev: s[0].rev }, { ...s[0], rev: -1 }] },
  'requestRevs={S1:{}}': (w) => { P(w).requestRevs = { S1: {}, FS1: 'x' } },
  'quotes supplierId がマスタに無い': (w) => { P(w).quotes.slice(0, 5).forEach((q) => { q.supplierId = 'S-NOSUCH' }) },
  'row qtyNeeded=1e308・packQty=0・orderQty=-1': (w) => { P(w).rows.forEach((r, i) => { if (i % 3 === 0) r.qtyNeeded = 1e308; if (i % 3 === 1) r.packQty = 0; if (i % 3 === 2) r.orderQty = -1 }) },
  'weights={price:-1e308}': (w) => { P(w).weights = { ...(P(w).weights ?? {}), price: -1e308 } },
  'caseDecisions text={}': (w) => { P(w).caseDecisions = [{ id: 'C1', status: 'open', kind: '案件', text: {}, at: 5, by: 5 }] },
  'user.name に HTML': (w) => { w.user = { name: '<img src=x onerror=window.__xss=1>', role: 'design' } },
  'row.working.name 100 万字': (w) => { P(w).rows[0].working = { name: 'あ'.repeat(1000000) } },
  'row status=replaced・replacedBy=自分': (w) => { P(w).rows[1].status = 'replaced'; P(w).rows[1].replacedBy = P(w).rows[1].id; P(w).rows[1].replaces = P(w).rows[1].id },
  'row ordered=true だが draft': (w) => { P(w).rows[0].ordered = true; P(w).rows[0].received = true; P(w).rows[0].status = 'draft' },
  'row.flags.leadNG="yes"・contested=5': (w) => { P(w).rows.forEach((r) => { r.flags = { leadNG: 'yes', contested: 5, pmPending: 'x' } }) },
  'row.ackRules に 1 万件': (w) => { P(w).rows[0].ackRules = big(10000, (i) => 'rule' + i) },
  'rows 1 行も無い案件': (w) => { P(w).rows = []; P(w).quotes = []; P(w).issues = [] },
}
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '1', 'Control+ArrowUp', 'ArrowDown', 'Space', 'j', 'j', 'Space', 'n', 'Shift+N', 's', 'Shift+S', 's', 'c', 'Escape', 'Enter', 'Escape', 'Control+Shift+C']
const ONLY = process.env.ONLY ? new RegExp(process.env.ONLY) : null
for (const [name, mut] of Object.entries(M)) {
  if (ONLY && !ONLY.test(name)) continue
  await fresh(page)
  const n = errors.length
  const w = structuredClone(SAMPLE); w.projects[0].id = 'P-BAD'; w.currentProjectId = 'P-BAD'
  mut(w)
  let text
  try { text = JSON.stringify(w) } catch (e) { out.cases.push({ name, err: 'stringify ' + e.message }); continue }
  const t0 = Date.now()
  const imp = await importJson(text)
  const tImport = Date.now() - t0
  let where = (await crash()) ? 'after import' : null
  if (!where) {
    outer: for (const role of ['design', 'purchasing', 'pm']) {
      await setRole(page, role).catch(() => {})
      for (const k of KEYS) {
        await page.keyboard.press(k).catch(() => {}); await sleep(6)
        if (await crash()) { where = `${role}:${k}`; break outer }
      }
      // パレットを開いて全件を描く・ヘルプ
      await page.keyboard.press('Control+k'); await sleep(20); await page.keyboard.press('Escape')
      if (await crash()) { where = `${role}:palette`; break }
    }
  }
  const tAll = Date.now() - t0
  let reload = null
  if (where) {
    await page.reload(); await page.waitForSelector('[data-testid="grid"], [data-testid="crash"]'); await sleep(150)
    reload = { crash: await crash(), buttons: (await crash()) ? await page.locator('[data-testid="crash"] button').allTextContents() : [] }
  }
  const pe = errors.slice(n).filter((e) => e.type === 'pageerror' || e.type === 'error').map((e) => e.text.replace(/\s+/g, ' ').slice(0, 160))
  const xss = await page.evaluate(() => window.__xss ?? null)
  const rec = { name, toast: imp.toast, crashAt: where, reload, err: pe[0] ?? null, tImport, tAll, xss }
  out.cases.push(rec)
  console.log(where ? 'CRASH' : pe.length ? 'ERR  ' : 'ok   ', name, `import ${tImport}ms all ${tAll}ms`, '|', where ?? '', '|', imp.toast.slice(0, 90), '|', (pe[0] ?? '').slice(0, 120))
}
save('../55-malformed4.json', out)
dumpErrors(errors, '55')
await browser.close()
