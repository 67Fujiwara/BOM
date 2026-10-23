// V2-04 読めない保存データ / V2-13 入れ子 null / V2-15 JSON 読込の確認と戻し / V-a / V2-20 壊れたファイル / V2-22 置換済の行
import fs from 'node:fs'
import path from 'node:path'
import { launch, fresh, setRole, goto, toCol, cursor, mode, sleep, dumpErrors, save, proj, row, panel, closeAll, palette, toastNow, ws, shot, DL, LS_KEY } from './lib.mjs'
const { browser, page, errors } = await launch()
const out = {}
const log = (k, o) => { out[k] = o; console.log(k, JSON.stringify(o).slice(0, 1200)) }
const perr = (n) => errors.slice(n).filter((e) => e.type === 'pageerror' || e.type === 'error').map((e) => e.text.slice(0, 160))
const crash = async () => page.getByTestId('crash').count()
async function importJson(text, yes = true) {
  await palette(page, 'JSON を読み込む'); await sleep(40)
  await page.evaluate((t) => { const el = document.querySelector('[data-testid="import-text"]'); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(el, t); el.dispatchEvent(new Event('input', { bubbles: true })) }, text)
  await page.getByTestId('import-text').focus()
  await page.keyboard.press('Control+Enter'); await sleep(80)
  const p = await panel(page)
  const confirmText = p ? (await page.locator('[data-testid^="panel-"]').first().innerText()).slice(0, 200) : null
  if (p && yes) { await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter'); await sleep(80) }
  else if (p) { await page.keyboard.press('Enter'); await sleep(50) }
  return { confirmText, toast: (await toastNow(page)).slice(0, 200) }
}
async function downloads(fn, n = 1) {
  const files = []
  const h = async (d) => { const f = path.join(DL, Date.now() + '-' + d.suggestedFilename()); await d.saveAs(f); files.push(f) }
  page.on('download', h)
  await fn()
  for (let i = 0; i < 50 && files.length < n; i++) await sleep(100)
  page.off('download', h)
  return files
}
// ---- V2-04: 行に id の無い 1 行 → 再読込 → 通知・退避 → 編集しても他案件が残る
{
  await fresh(page)
  await page.keyboard.press('Control+s')
  const w = await ws(page)
  const mine = structuredClone(w.projects[0]); mine.id = 'P-MINE'; mine.name = '自分の案件'; w.projects.push(mine)
  mine.rows.push({ name: 'id の無い行' })
  await page.evaluate(([k, s]) => localStorage.setItem(k, s), [LS_KEY, JSON.stringify(w)])
  await page.reload(); await page.waitForSelector('[data-testid="grid"]'); await sleep(150)
  const t = await toastNow(page)
  const backup = await page.evaluate(() => { const b = JSON.parse(localStorage.getItem('bom-pro.workspace.backup') ?? 'null'); return b ? { at: b.at, reason: b.reason, len: b.raw.length } : null })
  await page.locator('.gridwrap').focus()
  await goto(page, 'R030'); await toCol(page, '部品名'); await page.keyboard.press('Enter'); await page.keyboard.type('x'); await page.keyboard.press('Enter'); await sleep(80)
  const ids = (await ws(page)).projects.map((p) => p.id)
  const mineRows = (await ws(page)).projects.find((p) => p.id === 'P-MINE')?.rows.length
  log('V2-04/partial', { toast: t.slice(0, 250), backup, idsAfterEdit: ids, mineRows, origMineRows: mine.rows.length })
  // 全体が読めない（壊れた JSON）
  await page.evaluate((k) => localStorage.setItem(k, '{"projects":[{"id":"P-BROKEN","rows":[{"id":"R001"'), LS_KEY)
  await page.reload(); await page.waitForSelector('[data-testid="grid"]'); await sleep(150)
  const t2 = await toastNow(page)
  const b2 = await page.evaluate(() => JSON.parse(localStorage.getItem('bom-pro.workspace.backup') ?? 'null')?.reason)
  await page.locator('.gridwrap').focus()
  const files = await downloads(async () => { await palette(page, '退避したデータを書き出す') })
  const exported = files[0] ? fs.readFileSync(files[0], 'utf8') : null
  log('V2-04/broken', { toast: t2.slice(0, 250), backupReason: b2, exportedFile: files[0] && path.basename(files[0]), exportedEqualsBroken: exported === '{"projects":[{"id":"P-BROKEN","rows":[{"id":"R001"', exportToast: (await toastNow(page)).slice(0, 120) })
}
// ---- V2-13: 入れ子 null・by:null・未知の種別・存在しない商社の見積・文字列の数値
{
  const cases = {
    issuesNull: { projects: [{ id: 'Y1', rows: [{ id: 'R001', name: 'a' }], issues: [null, 5, 'x'], quotes: [null], decisions: [null], submissions: [null], events: [null] }] },
    issueByNull: { projects: [{ id: 'Y2', rows: [{ id: 'R001', name: 'a' }], issues: [{ id: 'I1', rowId: 'R001', kind: '型式あいまい', status: 'open', by: null, text: 'x' }] }] },
    issueKindUnknown: { projects: [{ id: 'Y3', rows: [{ id: 'R001', name: 'a' }], issues: [{ id: 'I1', rowId: 'R001', kind: 'ぜんぜん違う', status: 'open', by: { name: 'a', role: 'purchasing' }, text: 'x', replies: [null, { by: null }] }] }] },
    quoteUnknownSupplier: { projects: [{ id: 'Y4', rows: [{ id: 'R001', name: 'a', model: 'M', maker: 'オムロン', qtyNeeded: 1, status: 'quoted' }], quotes: [{ rowId: 'R001', supplierId: 'ZZZ', unitPrice: 100, leadDays: 5 }] }] },
    rowFieldTypes: { projects: [{ id: 'Y5', rows: [{ id: 'R001', name: 123, model: null, maker: ['x'], qtyNeeded: 'abc', unit: 5, status: 'zzz', category: {}, flags: null, history: 'x', working: 'oops', ackRules: 'x' }] }] },
    weightsString: { projects: [{ id: 'Y6', rows: [{ id: 'R001', name: 'a' }], weights: { price: 'x', lead: null, track: -5, terms: 1e309 }, settings: { holidays: 'x', processDays: 'abc', budget: 'たくさん' } }] },
    membersBad: { projects: [{ id: 'Y7', rows: [{ id: 'R001', name: 'a' }], members: { design: 5, purchasing: null } }], user: { name: 5, role: 'god' } },
    decisionsBad: { projects: [{ id: 'Y8', rows: [{ id: 'R001', name: 'a' }], decisions: [{ id: 'D1', rowId: 'R999', kind: '???', status: 'open' }], caseDecisions: [{ id: 'C1', status: 'open', kind: 42 }] }] },
    suppliersBad: { projects: [{ id: 'Y9', rows: [{ id: 'R001', name: 'a' }] }], suppliers: [null, { id: 'S1' }, { name: 'x' }] },
    deep: { projects: [{ id: 'Y10', rows: Array.from({ length: 3 }, (_, i) => ({ id: 'R00' + i, name: 'n', working: { name: null, qtyNeeded: 'x' } })) }] },
  }
  const res = {}
  for (const [name, obj] of Object.entries(cases)) {
    await fresh(page)
    const n = errors.length
    const r = await importJson(JSON.stringify(obj))
    // 開く・全ビュー・役割
    const after = { views: {} }
    await page.locator('.gridwrap').focus().catch(() => {})
    for (const role of ['design', 'purchasing', 'pm']) {
      if (await crash()) break
      await setRole(page, role).catch(() => {})
      for (const v of '123456789') { await page.keyboard.press(v); await sleep(15); if (await crash()) { after.views[role + v] = 'CRASH'; break } }
      await page.keyboard.press('1'); await page.keyboard.press('Control+ArrowUp'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Space'); await sleep(40)
      if (await crash()) { after.views[role + ':open'] = 'CRASH'; break }
      await page.keyboard.press('Space')
      await page.keyboard.press('Control+e'); await sleep(40); await closeAll(page).catch(() => {})
    }
    const crashText = (await crash()) ? (await page.getByTestId('crash').innerText()).slice(0, 120) : null
    res[name] = { ...r, crash: crashText, views: after.views, errors: perr(n).slice(0, 3) }
    console.log(name, JSON.stringify(res[name]).slice(0, 500))
  }
  log('V2-13/malformed', res)
}
// ---- V2-15: 確認・Ctrl+Z・読み込み前に戻す
{
  await fresh(page)
  await goto(page, 'R030'); await toCol(page, '部品名'); await page.keyboard.press('Enter'); await page.keyboard.press('Control+a'); await page.keyboard.type('読込前の値'); await page.keyboard.press('Enter')
  const r1 = await importJson(JSON.stringify({ projects: [{ id: 'P-NEW', name: '読み込んだ案件', rows: [{ id: 'R001', name: '新' }] }] }), false)
  const afterNo = (await ws(page)).projects.map((p) => p.id)
  const r2 = await importJson(JSON.stringify({ projects: [{ id: 'P-NEW', name: '読み込んだ案件', rows: [{ id: 'R001', name: '新' }] }] }), true)
  const afterYes = (await ws(page)).projects.map((p) => p.id)
  await page.locator('.gridwrap').focus()
  await page.keyboard.press('Control+z'); const tz = await toastNow(page)
  await palette(page, '読み込み前に戻す'); await sleep(50)
  const cp = await panel(page); const cpt = cp ? (await page.locator('[data-testid^="panel-"]').first().innerText()).slice(0, 200) : null
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter'); await sleep(80)
  const restored = await ws(page)
  const r030 = restored.projects.find((p) => p.id === 'P-2026-041')?.rows.find((r) => r.id === 'R030')
  // もう一度「戻す」→ 入れ替え（読み込んだ方に戻る）
  await palette(page, '読み込み前に戻す'); await sleep(50); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter'); await sleep(80)
  const swapped = (await ws(page)).projects.map((p) => p.id)
  log('V2-15', { confirmText: r1.confirmText, afterNo, toastYes: r2.toast, afterYes, ctrlZ: tz.slice(0, 100), restoreConfirm: cpt, restoredIds: restored.projects.map((p) => p.id), r030name: r030?.working?.name ?? r030?.name, swappedBack: swapped })
}
// ---- V-a 途中で切れた JSON・{}・巨大
{
  await fresh(page)
  const res = {}
  for (const [k, t] of Object.entries({ truncated: '{"projects":[{"id":"A","rows":[', empty: '{}', arr: '[]', nul: 'null', str: '"x"', projEmpty: '{"projects":[]}', dupId: '{"projects":[{"id":"A","rows":[]},{"id":"a","rows":[]}]}', bom: '﻿{"projects":[{"id":"BOMMARK","rows":[{"id":"R001"}]}]}', proto: '{"__proto__":{"polluted":1},"projects":[{"id":"PR","rows":[{"id":"R001","__proto__":{"x":1}}]}]}' })) {
    const n = errors.length
    const r = await importJson(t, true)
    res[k] = { ...r, ids: (await ws(page))?.projects.map((p) => p.id), crash: await crash(), errors: perr(n), polluted: await page.evaluate(() => ({}).polluted ?? null) }
    await closeAll(page).catch(() => {})
  }
  log('V-a', res)
}
// ---- V2-20 壊れた xlsx・拡張子なし
{
  await fresh(page)
  fs.writeFileSync(path.join(DL, 'broken.xlsx'), 'this is not a zip')
  const res = {}
  for (const f of ['broken.xlsx']) {
    await palette(page, '新しいBOM'); await page.getByTestId('wizard-id').fill('P-F' + f.length); await page.keyboard.press('Enter')
    for (let i = 0; i < 6; i++) await page.keyboard.press('Enter')
    await page.keyboard.press('2'); await sleep(40)
    await page.getByTestId('wizard-file').setInputFiles(path.join(DL, f)); await sleep(800)
    res[f] = { err: await page.getByTestId('wizard-error').textContent().catch(() => null), toast: (await toastNow(page)).slice(0, 150), preview: (await page.getByTestId('wizard-preview').textContent().catch(() => ''))?.slice(0, 100) }
    await closeAll(page)
  }
  log('V2-20', res)
}
// ---- V2-22 置換済の行
{
  await fresh(page)
  await goto(page, 'R030'); await toCol(page, '型式'); await page.keyboard.press('r'); await sleep(400); await page.keyboard.type('NEW-030'); await page.keyboard.press('Enter'); await sleep(50)
  const p = await proj(page)
  const rep = p.rows.find((r) => r.status === 'replaced')
  const res = { replaced: rep?.id, toast: (await toastNow(page)).slice(0, 100) }
  if (rep) for (const k of ['Shift+D', 'w', 'Alt+ArrowUp', 'Alt+ArrowDown', 'Shift+Enter', 'Enter', 'r', 'Delete']) {
    await closeAll(page); await goto(page, rep.id); await toCol(page, '型式')
    const before = JSON.stringify((await proj(page)).rows.map((r) => r.id))
    await page.keyboard.press(k); await sleep(40)
    const after = JSON.stringify((await proj(page)).rows.map((r) => r.id))
    res[k] = { panel: await panel(page), mode: await mode(page), rowsChanged: before !== after, toast: (await toastNow(page)).slice(0, 80) }
  }
  log('V2-22/replaced', res)
}
save('01c-storage-json.json', out)
dumpErrors(errors, '01c')
await browser.close()
