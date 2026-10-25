// ラウンド22 中堅: p シリーズの共通（全ビュー×全役割の文字走査、Excel 走査、整合の不変条件）
import ExcelJS from '/home/user/BOM/node_modules/exceljs/excel.js'
import { check, log } from './lib.mjs'

export const BAD = /undefined|NaN|\[object|\bnull\b|Infinity/
export const CAMEL = /\b(qtyNeeded|needOffset|orderQty|packQty|adoptedSupplierId|leadDays|unitPrice|formalPrice|pendingRev|publishedRev|needDateFixed|quoteTargets|makerLock|altPolicy|statusChangedAt)\b/

/** 3 役割×ビュー 1〜9 の全セルの文字と、画面の文字を走査して、おかしな文字列を返す */
export async function scanViews(t, roles = ['design', 'purchasing', 'pm'], views = [1, 2, 3, 4, 5, 6, 7, 8, 9]) {
  const bad = []
  for (const role of roles) {
    await t.role(role)
    for (const v of views) {
      await t.press(String(v)); await t.page.waitForTimeout(40)
      const cells = await t.page.evaluate(async () => {
        const m = await import(window.__m('/src/model/selectors.ts')); const s = (await import(window.__m('/src/model/store.ts'))).useStore.getState()
        const vm = m.buildViewModel(s); const out = []
        for (const r of vm.rows) for (const c of vm.columns) { try { const x = m.cellText(r, c.key ?? c, vm.ctx).text; out.push([r.id, c.key ?? c, String(x)]) } catch (e) { out.push([r.id, String(c.key ?? c), 'EXC ' + e.message]) } }
        return out
      })
      for (const [id, col, tx] of cells) if (BAD.test(tx) || tx.startsWith('EXC')) bad.push(`${role}/${v}/${id}/${col}: ${tx.slice(0, 80)}`)
      const body = await t.page.evaluate(() => document.body.innerText)
      if (BAD.test(body)) { const m = body.match(new RegExp('.{0,30}(' + BAD.source + ').{0,30}')); bad.push(`${role}/${v}/DOM: ${m?.[0]?.replace(/\n/g, ' ')}`) }
    }
  }
  return bad
}

/** ダウンロードした Excel の全セルを走査 */
export async function lintXlsx(files) {
  const bad = []
  for (const dl of files) {
    const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(dl.name)
    wb.eachSheet((sh) => sh.eachRow((r, ri) => r.eachCell((c) => {
      const v = String(c.value && typeof c.value === 'object' ? (c.value.text ?? c.value.result ?? JSON.stringify(c.value)) : c.value ?? '')
      if (BAD.test(v) || CAMEL.test(v)) bad.push(`${dl.suggested}/${sh.name}/${ri}: ${v.slice(0, 60)} <= ${JSON.stringify(sh.getRow(ri).values.slice(1)).slice(0, 160)}`)
    })))
  }
  return bad
}

/** 参照の整合：商社マスタに無い商社を指す参照と、行の状態の矛盾 */
export function refs(p, suppliers, soft = false) {
  const ids = new Set(suppliers.map((s) => s.id)); const out = []
  const miss = (id) => id && !ids.has(id)
  if (soft) { for (const id of p.supplierIds) if (miss(id)) out.push(`supplierIds ${id}`); for (const id of p.preferredSupplierIds ?? []) if (miss(id)) out.push(`preferred ${id}`) }
  for (const r of p.rows) {
    if (miss(r.adoptedSupplierId) && !['ordered', 'received'].includes(r.status)) out.push(`${r.id} adopted ${r.adoptedSupplierId} st=${r.status}`)
    for (const sid of r.quoteTargets ?? []) if (miss(sid)) out.push(`${r.id} quoteTargets ${sid}`)
    if (soft && r.procurement === '指定商社' && miss((r.designated ?? '').trim())) out.push(`${r.id} designated ${r.designated}`)
  }
  if (soft) for (const q of p.quotes) if (miss(q.supplierId) && !q.stale) out.push(`quote ${q.rowId}/${q.supplierId}`)
  return out
}
export async function importWs(t, mut) {
  const ws = await t.ws(); mut(ws)
  await t.cmd('JSON を読み込む'); await t.page.waitForTimeout(150)
  await t.page.getByTestId('import-text').fill(JSON.stringify(ws)); await t.page.getByTestId('import-text').press('Control+Enter'); await t.page.waitForTimeout(300)
  for (let g = 0; g < 3; g++) { const pn = await t.panel(); if (!pn) break; const i = (pn.options ?? []).findIndex((o) => /置き換える/.test(o)); if (i < 0) { await t.press('Escape'); break } for (let k = 0; k < i; k++) await t.press('ArrowDown'); await t.press('Enter'); await t.page.waitForTimeout(300) }
  await t.page.locator('.gridwrap').focus(); return t.toast()
}
export function errs(t, name) { log('ERRORS', JSON.stringify(t.errors)); check(name + ' console error なし', t.errors.length === 0, JSON.stringify(t.errors).slice(0, 400)) }

/** ボールが無いのに終わっていない行・ボールの役割のビューに載らない行 */
export async function stuck(t) {
  return t.page.evaluate(async () => {
    const d = await import(window.__m('/src/model/derive.ts')); const v = await import(window.__m('/src/model/views.ts')); const s = (await import(window.__m('/src/model/store.ts'))).useStore.getState()
    const sel = await import(window.__m('/src/model/selectors.ts'))
    const p = s.project(); const out = []
    const inViews = {}
    for (const role of ['design', 'purchasing', 'pm']) {
      inViews[role] = new Set()
      for (const vd of v.VIEWS) {
        if (![3, 4, 5, 6, 7, 8, 9].includes(vd.id)) continue
        const st2 = { ...s, view: vd.id, ws: { ...s.ws, user: { ...s.ws.user, role } } }
        try { for (const r of sel.buildViewModel(st2).rows) inViews[role].add(r.id) } catch (e) { out.push('EXC ' + role + vd.id + ' ' + e.message) }
      }
    }
    for (const r of p.rows) {
      if (['received', 'cancelled', 'replaced'].includes(r.status)) continue
      if (!d.isActive(r)) continue
      const b = d.ball(p, r)
      const supplied = ['支給品', '社内在庫'].includes(r.procurement)
      if (b == null && !supplied && r.status !== 'draft') out.push(`${r.id} ${r.procurement}/${r.status} ball=null`)
      else if (b && !inViews[b].has(r.id) && !(supplied && b === null)) out.push(`${r.id} ${r.procurement}/${r.status} ball=${b} but not in its view`)
    }
    return out
  })
}
