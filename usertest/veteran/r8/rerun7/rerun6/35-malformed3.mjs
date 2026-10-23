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
const M = {
  'submissions 末尾 {}': (w) => { P(w).submissions = [...(P(w).submissions ?? []), {}] },
  'submissions 末尾 summary 無し': (w) => { const s = P(w).submissions ?? []; if (s.length) delete s[s.length - 1].summary; else P(w).submissions = [{ rev: 1, at: '2026-10-01T00:00:00Z', by: { name: 'x', role: 'design' }, rowIds: [] }] },
  'submissions 末尾 at=5': (w) => { P(w).submissions = [...(P(w).submissions ?? []), { rev: 9, at: 5, by: { name: 'x', role: 'design' }, rowIds: [], summary: { added: 0, modelChanged: 0, qtyChanged: 0 } }] },
  'rules regex pattern="("': (w) => { w.rules = [...(w.rules ?? []), { id: 'bad', name: 'bad', field: 'model', type: 'regex', pattern: '(', severity: 'warn', message: 'x', owner: 'x', scope: 'all', enabled: true }] },
  'rules regex when="["': (w) => { w.rules = [...(w.rules ?? []), { id: 'bad2', name: 'bad', field: 'model', type: 'regex', pattern: 'x', when: '[', severity: 'warn', message: 'x', owner: 'x', scope: 'all', enabled: true }] },
  'rules message={}': (w) => { w.rules = [...(w.rules ?? []), { id: 'bad3', name: {}, field: 'model', type: 'required', severity: 'warn', message: '', owner: {}, scope: 'all', enabled: true }] },
  'row.receivedLot={}': (w) => { P(w).rows.forEach((r) => { r.receivedLot = { a: 1 } }) },
  'row.adoptReason={}': (w) => { P(w).rows.forEach((r) => { if (r.adoptedSupplierId) r.adoptReason = { a: 1 } }) },
  'row.adoptedSupplierId={}': (w) => { const r = P(w).rows.find((x) => x.status === 'selected' || x.adoptedSupplierId); if (r) r.adoptedSupplierId = { a: 1 } },
  'row.lastChangeCause={}': (w) => { P(w).rows.forEach((r) => { r.lastChangeCause = { a: 1 } }) },
  'row.replacedBy=5': (w) => { P(w).rows[2].replacedBy = 5; P(w).rows[2].status = 'replaced' },
  'row.replaces={}': (w) => { P(w).rows[3].replaces = {} },
  'row.publishedRev="x"': (w) => { P(w).rows.forEach((r) => { r.publishedRev = 'x' }) },
  'row.ltbRequest=5': (w) => { P(w).rows[4].ltbRequest = 5; P(w).rows[4].flags = { ltbPending: true, pmReason: '先行発注判断' } },
  'row.removal={kind:5}': (w) => { P(w).rows[5].removal = { kind: 5, reason: {} } },
  'row.flags.pmReason={}': (w) => { P(w).rows[6].flags = { pmPending: true, pmReason: { a: 1 } } },
  'row.flags.importMismatch={}': (w) => { P(w).rows[7].flags = { importMismatch: { a: 1 } } },
  'row.flags.countermeasure={}': (w) => { P(w).rows[8].flags = { leadNG: true, countermeasure: { a: 1 } } },
  'row.fromIssue={}': (w) => { P(w).rows[9].fromIssue = { a: 1 } },
  'row.quotedAt=5': (w) => { P(w).rows.forEach((r) => { if (r.status === 'quoted') r.quotedAt = 5 }) },
  'row.statusChangedAt=5': (w) => { P(w).rows.forEach((r) => { r.statusChangedAt = 5 }) },
  'row.dueAt=5': (w) => { P(w).rows.forEach((r) => { r.dueAt = 5 }) },
  'row.scoreSnapshot="x"': (w) => { P(w).rows.forEach((r) => { if (r.adoptedSupplierId) r.scoreSnapshot = 'x' }) },
  'issues[0].proposal={model:{}}': (w) => { if (P(w).issues[0]) P(w).issues[0].proposal = { model: {}, maker: 5, unitPrice: 'x' } },
  'issues[0].proposal=5': (w) => { if (P(w).issues[0]) P(w).issues[0].proposal = 5 },
  'issues[0].at=5': (w) => { if (P(w).issues[0]) P(w).issues[0].at = 5 },
  'issues[0].replies[0].at=5': (w) => { if (P(w).issues[0]) P(w).issues[0].replies = [{ by: { name: 'x', role: 'design' }, at: 5, text: 'x' }] },
  'issues[0].answer={}': (w) => { if (P(w).issues[0]) { P(w).issues[0].answer = {}; P(w).issues[0].status = 'answered' } },
  'issues[0].field={}': (w) => { if (P(w).issues[0]) P(w).issues[0].field = {} },
  'decisions[0].text={}': (w) => { P(w).decisions = [...(P(w).decisions ?? []), { id: 'D9', kind: '例外選定', rowId: 'R001', by: { name: 'x', role: 'pm' }, at: 5, text: {}, result: {} }] },
  'caseDecisions open 型違い': (w) => { P(w).caseDecisions = [{ id: 'C1', status: 'open', kind: {}, text: {}, at: 5 }] },
  'events 末尾 at=5': (w) => { P(w).events = [...(P(w).events ?? []), { id: 99999, at: 5, by: { name: 'x', role: 'design' }, text: 'x', rowId: 'R001' }] },
  'suppliers handledMakers 正常＋onTimeRate="x"': (w) => { w.suppliers[0].onTimeRate = 'x'; w.suppliers[0].defectRate = 'x' },
  'suppliers color={}': (w) => { w.suppliers[0].color = {} },
  'suppliers order="x"': (w) => { w.suppliers.forEach((s) => { s.order = 'x' }) },
  'project.name={}': (w) => { P(w).name = {} },
  'project.id 数字だけ "123"': (w) => { P(w).id = '123'; w.currentProjectId = '123' },
  'settings.budget="1e400"': (w) => { P(w).settings = { ...P(w).settings, budget: 1e308 * 10 } },
  'settings.currency={}': (w) => { P(w).settings = { ...P(w).settings, currency: {} } },
  'members.design="x".repeat(5000)': (w) => { P(w).members = { design: 'x'.repeat(5000), purchasing: '', pm: '' } },
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
save('35-malformed3.json', out)
dumpErrors(errors, '35')
await browser.close()
