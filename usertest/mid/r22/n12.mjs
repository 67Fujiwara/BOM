// n12: 中堅の細かい確認（ラウンド19 の新人・ベテラン修正の周辺）
//   mode=offset : 必要日(前倒し)に 7 → 警告（+7 は後ろ）・直しの候補・公開できない → -7 で公開できる
//   mode=ordered: 発注済の行を設計が編集 → 役割ごとの案内文（設計は購買に伝える、購買は Alt+Shift+I → h）
//   mode=keys   : Ctrl+R・Ctrl+- はブラウザに通す（preventDefault しない）／Ctrl+W 等は？
//   mode=consol : 商社を集約：やめる（既定）で何も変わらない → 集約する → Ctrl+Z で戻る
import { launch, check, log, summary } from './lib.mjs'
import { helpers } from './h.mjs'
const mode = process.argv[2] ?? 'offset'
const t = await launch(); const { page } = t; const h = helpers(t)
await t.open('design')
let p = await t.proj()
if (mode === 'offset') {
  const X = p.rows.find((r) => r.status === 'submitted' || r.status === 'quoted' || r.status === 'quoting')?.id ?? 'R001'
  await t.press('1'); await t.showCol('needOffset'); log('X', X)
  log('offset 7 →', await t.setCellKey(X, 'needOffset', '7'))
  const probs = await page.evaluate(async (X) => { const m = await import(window.__m('/src/model/rules.ts')); const s = (await import(window.__m('/src/model/store.ts'))).useStore.getState(); const pp = s.project(); return m.checkRow(pp.rows.find((r) => r.id === X) ? { ...pp.rows.find((r) => r.id === X), ...(pp.rows.find((r) => r.id === X).working ?? {}) } : null, s.ws.rules, pp).map((x) => [x.ruleId, x.severity, x.message, x.fixes.map((f) => f.label)]) }, X)
  log('problems', JSON.stringify(probs.filter((x) => /needOffset/.test(x[0]))))
  check('N12-1 +7 に警告（後ろになる・-7 の直し）', probs.some((x) => x[0] === 'sys.needOffset.plus' && /-7/.test(x[2]) && x[3].some((l) => /-7/.test(l))), JSON.stringify(probs))
  log('publish →', await t.publish('1'))
  p = await t.proj(); const r = p.rows.find((x) => x.id === X); log('X working', JSON.stringify(r.working ?? null), 'needOffset', r.needOffset)
  check('N12-2 警告を残したままは公開できない（+7 のまま公開されない）', r.needOffset !== 7, `needOffset=${r.needOffset} toast=${await t.toast()}`)
  log('offset -7 →', await t.setCellKey(X, 'needOffset', '-7')); log('publish →', await t.publish('1')); p = await t.proj()
  check('N12-3 -7 なら公開できる', p.rows.find((x) => x.id === X).needOffset === -7, String(p.rows.find((x) => x.id === X).needOffset))
  // 0 と空
  log('offset 0 →', await t.setCellKey(X, 'needOffset', '0'))
  const w0 = await page.evaluate(async (X) => { const s = (await import(window.__m('/src/model/store.ts'))).useStore.getState(); const r = s.project().rows.find((r) => r.id === X); return JSON.stringify(r.working ?? null) }, X); log('working after 0', w0)
} else if (mode === 'ordered') {
  log('bulk →', await t.bulk()); await t.role('purchasing'); log('formal →', await t.requestFormal()); p = await t.proj()
  const X = p.rows.find((r) => r.status === 'formalRequested' && r.procurement === '相見積' && !r.flags.leadNG && !r.flags.contested).id
  const q = p.quotes.find((q) => q.rowId === X && q.supplierId === p.rows.find((r) => r.id === X).adoptedSupplierId && !q.stale)
  await t.press('8'); await t.setCellKey(X, 'q.formalPrice@A', String(q.unitPrice)); await t.press('Escape')
  log('order →', await t.order(X)); p = await t.proj(); log('X', h.show(p, X))
  for (const role of ['design', 'purchasing', 'pm']) {
    await t.role(role); await t.press('1'); const m = await t.setCellKey(X, 'qtyNeeded', '77'); log(role, 'edit ordered row →', m)
    if (role === 'design') check('N12-1 設計の案内は「購買に伝えてください…購買が Alt+Shift+I → h」', /購買に伝えて/.test(m) && /発注後変更依頼/.test(m), m)
    await t.press('Escape'); await t.press('Escape')
  }
  p = await t.proj(); check('N12-2 発注済の行の必要数は変わらない', p.rows.find((r) => r.id === X).qtyNeeded !== 77, '')
} else if (mode === 'keys') {
  const res = await page.evaluate(() => {
    const out = {}
    for (const [k, o] of [['r', { ctrlKey: true }], ['-', { ctrlKey: true }], ['+', { ctrlKey: true }], ['0', { ctrlKey: true }], ['f', { ctrlKey: true }], ['l', { ctrlKey: true }], ['t', { ctrlKey: true }], ['w', { ctrlKey: true }], ['p', { ctrlKey: true }], ['s', { ctrlKey: true }], ['F5', {}], ['r', { ctrlKey: true, shiftKey: true }]]) {
      const e = new KeyboardEvent('keydown', { key: k, cancelable: true, bubbles: true, ...o }); document.activeElement.dispatchEvent(e); out[(o.ctrlKey ? 'Ctrl+' : '') + (o.shiftKey ? 'Shift+' : '') + k] = e.defaultPrevented
    }
    return out
  })
  log('defaultPrevented', JSON.stringify(res))
  check('N12-1 Ctrl+R・Ctrl+- は止めない（再読み込み・縮小がブラウザに通る）', res['Ctrl+r'] === false && res['Ctrl+-'] === false, JSON.stringify(res))
  check('N12-2 F5 も止めない', res['F5'] === false, JSON.stringify(res))
  check('N12-3 Ctrl+L・Ctrl+T・Ctrl+W（アドレス欄・タブ）も止めない', !res['Ctrl+l'] && !res['Ctrl+t'] && !res['Ctrl+w'], JSON.stringify(res))
  check('N12-4 Ctrl+0・Ctrl++ （拡大縮小）も止めない', !res['Ctrl+0'] && !res['Ctrl++'], JSON.stringify(res))
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape'); await page.waitForTimeout(100); await page.reload(); await page.getByTestId('grid').waitFor()
  await t.role('purchasing'); await t.press('3'); await t.goto('R001'); await t.colKey('orderQty')
  const r2 = await page.evaluate(() => { const e = new KeyboardEvent('keydown', { key: 'r', cancelable: true, bubbles: true, ctrlKey: true }); document.activeElement.dispatchEvent(e); return e.defaultPrevented }); log('Ctrl+R on numeric cell', r2)
  check('N12-5 数値セルでも Ctrl+R は止めない', r2 === false, String(r2))
} else {
  log('bulk →', await t.bulk()); p = await t.proj()
  const adopted = (pp) => JSON.stringify(pp.rows.filter((r) => r.adoptedSupplierId).map((r) => [r.id, r.adoptedSupplierId]))
  const before = adopted(p)
  await t.cmd('商社を集約'); await page.waitForTimeout(100); const pn = await t.panel(); const idx = pn.options.findIndex((o) => /^因幡電機 ::/.test(o)); log('options', JSON.stringify(pn.options.map((o) => o.slice(0, 50))), 'idx', idx)
  for (let k = 0; k < idx; k++) await t.press('ArrowDown'); await t.press('Enter'); await page.waitForTimeout(120)
  const dlg = await t.dialog(); const pn2 = await t.panel(); log('confirm panel', JSON.stringify(pn2)?.slice(0, 300), '| dialog', dlg.slice(0, 120))
  await t.press('Enter'); await page.waitForTimeout(200); p = await t.proj(); log('Enter (既定) →', await t.toast())
  check('N12-1 確認の既定は「やめる」で、Enter だけでは何も変わらない', adopted(p) === before, '')
  await t.cmd('商社を集約'); for (let k = 0; k < idx; k++) await t.press('ArrowDown'); await t.press('Enter'); await page.waitForTimeout(120); await t.press('2'); await page.waitForTimeout(250)
  p = await t.proj(); log('集約 →', await t.toast()); const after = adopted(p)
  check('N12-2 「集約する」で採用が付け替わる', after !== before, '')
  const nS1 = p.rows.filter((r) => r.adoptedSupplierId === 'S1' && r.procurement === '相見積').length; log('S1 adopted rows', nS1)
  await page.keyboard.press('Control+z'); await page.waitForTimeout(200); p = await t.proj(); log('Ctrl+Z →', await t.toast())
  check('N12-3 Ctrl+Z で集約が全部戻る', adopted(p) === before, '')
}
log('ERRORS', JSON.stringify(t.errors))
summary(); await t.close()
