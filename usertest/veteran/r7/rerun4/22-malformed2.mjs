// ラウンド4: 型違いの JSON（ワークスペース・案件・行の中の入れ子）を、本物のサンプルを壊して読み込ませる。
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
const M = {
  'suppliers[0]=null': (w) => { w.suppliers[0] = null },
  'suppliers=[{}]+rest': (w) => { w.suppliers.unshift({}) },
  'suppliers[0].id=5': (w) => { w.suppliers[0].id = 5 },
  'suppliers[0].name={}': (w) => { w.suppliers[0].name = {} },
  'suppliers=[5,"x"]': (w) => { w.suppliers = [5, 'x'] },
  'rules=[null]': (w) => { w.rules = [null] },
  'rules[0]={}': (w) => { w.rules = [{}, ...(w.rules ?? [])] },
  'rules[0].pattern=5': (w) => { if (w.rules?.[0]) Object.keys(w.rules[0]).forEach((k) => { if (typeof w.rules[0][k] === 'string' && k !== 'id') w.rules[0][k] = 5 }) },
  'working.model=5': (w) => { const r = P(w).rows.find((x) => x.status === 'quoted'); r.working = { model: 5 } },
  'working.name={}': (w) => { const r = P(w).rows.find((x) => x.status === 'quoted'); r.working = { name: {} } },
  'working.qtyNeeded="abc"': (w) => { const r = P(w).rows.find((x) => x.status === 'quoted'); r.working = { qtyNeeded: 'abc' } },
  'working.needDateFixed=5': (w) => { const r = P(w).rows.find((x) => x.status === 'quoted'); r.working = { needDateFixed: 5 } },
  'working.category={}': (w) => { const r = P(w).rows.find((x) => x.status === 'quoted'); r.working = { category: {} } },
  'working.tags=[1]': (w) => { const r = P(w).rows.find((x) => x.status === 'quoted'); r.working = { tags: [1] } },
  'pendingApproval.model={}': (w) => { const r = P(w).rows.find((x) => x.status === 'quoted'); r.pendingApproval = { model: {} } },
  'flags.leadNG="x"': (w) => { P(w).rows[3].flags = { leadNG: 'x', requote: {} } },
  'members.design={}': (w) => { P(w).members = { design: {}, purchasing: 5, pm: null } },
  'rowWeights.R001="x"': (w) => { P(w).rowWeights = { R001: 'x', R002: { price: 'abc' } } },
  'preferredSupplierIds=[null]': (w) => { P(w).preferredSupplierIds = [null, 5] },
  'supplierIds=[null,{}]': (w) => { P(w).supplierIds = [null, {}] },
  'quotes[0].validUntil=5': (w) => { P(w).quotes[0].validUntil = 5 },
  'quotes[0].stock={}': (w) => { P(w).quotes[0].stock = {} },
  'quotes[0].supplierId=unknown': (w) => { P(w).quotes[0].supplierId = 'S999' },
  'issues[0].dueAt=5': (w) => { if (P(w).issues[0]) P(w).issues[0].dueAt = 5 },
  'issues[0].kind=zzz': (w) => { if (P(w).issues[0]) P(w).issues[0].kind = 'zzz' },
  'issues[0].text={}': (w) => { if (P(w).issues[0]) P(w).issues[0].text = {} },
  'decisions[0]={kind:zzz}': (w) => { P(w).decisions = [{ id: 'D1', kind: 'zzz', rowId: 'R001', by: { name: 'x', role: 'pm' } }, ...(P(w).decisions ?? [])] },
  'events[0].at=5': (w) => { P(w).events = [{ id: 1, at: 5, by: { name: 'x', role: 'design' }, text: 'x' }] },
  'submissions[0].at=5': (w) => { P(w).submissions = [{ id: 1, at: 5, by: { name: 'x', role: 'design' }, rowIds: ['R001'] }, ...(P(w).submissions ?? [])] },
  'requestRevs={x:"y"}': (w) => { P(w).requestRevs = { S1: 'y', S2: { rev: 'a' } } },
  'caseDecisions=[{}]': (w) => { P(w).caseDecisions = [{}] },
  'settings.holidays="x"': (w) => { P(w).settings = { ...P(w).settings, holidays: 'x' } },
  'settings.approver=5': (w) => { P(w).settings = { ...P(w).settings, selector: 5, pmApproval: 'yes' } },
  'row.history=[null]': (w) => { P(w).rows[0].history = [null, 5] },
  'row.adoptedSupplierId=S999': (w) => { const r = P(w).rows.find((x) => x.status === 'quoted'); r.adoptedSupplierId = 'S999'; r.status = 'selected' },
  'row.tags=[1,2]': (w) => { P(w).rows[0].tags = [1, 2] },
  'user.name={}': (w) => { w.user = { name: {}, role: 'design' } },
  'row.id=数値風 "001"': (w) => { P(w).rows[0].id = '001' },
  'row.id 大文字小文字重複': (w) => { P(w).rows[1].id = P(w).rows[0].id.toLowerCase() },
  'huge string 2MB in note': (w) => { P(w).rows[0].note = 'x'.repeat(2_000_000) },
  'deep nesting 5000': (w) => { let o = {}; const root = o; for (let i = 0; i < 5000; i++) { o.a = {}; o = o.a } P(w).rows[0].extra = root },
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
  const imp = await importJson(text)
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
  let reload = null
  if (where) {
    await page.reload(); await page.waitForSelector('[data-testid="grid"], [data-testid="crash"]'); await sleep(150)
    reload = { crash: await crash(), buttons: (await crash()) ? await page.locator('[data-testid="crash"] button').allTextContents() : [] }
  }
  const pe = errors.slice(n).filter((e) => e.type === 'pageerror' || e.type === 'error').map((e) => e.text.replace(/\s+/g, ' ').slice(0, 160))
  const rec = { name, toast: imp.toast, crashAt: where, reload, err: pe[0] ?? null }
  out.cases.push(rec)
  console.log(where ? 'CRASH' : pe.length ? 'ERR  ' : 'ok   ', name, '|', where ?? '', '|', imp.toast.slice(0, 90), '|', (pe[0] ?? '').slice(0, 120))
}
save('22-malformed2.json', out)
dumpErrors(errors, '22')
await browser.close()
