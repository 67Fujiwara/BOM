// ラウンド9 中堅: シナリオ用の共通手順（キーボード操作。判定はストアの読み取りだけ）
import ExcelJS from '/home/user/BOM/node_modules/exceljs/excel.js'

export function helpers(t) {
  const { page } = t
  const h = {
    show(p, id) {
      const r = p.rows.find((x) => x.id === id)
      if (!r) return id + ' (none)'
      const fl = Object.fromEntries(Object.entries(r.flags).filter(([, v]) => v !== undefined && v !== false))
      return `${id} ${r.procurement} st=${r.status} adopt=${r.adoptedSupplierId ?? '-'} reason=${r.adoptReason ?? ''} oq=${r.orderQty ?? '-'} flags=${JSON.stringify(fl)} quotes=${JSON.stringify(p.quotes.filter((q) => q.rowId === id && !q.stale).map((q) => [q.supplierId, q.unitPrice, q.leadDays, q.formalPrice ?? null]))}`
    },
    async addRow(after, name, model, maker, proc, des, qty = '4') {
      await t.goto(after); await t.press('Shift+Enter'); await page.waitForTimeout(80); await t.type(name); await t.press('Enter'); await page.waitForTimeout(60); if ((await t.mode()) === 'edit') await t.press('Escape')
      const pp = await t.proj(); const id = pp.rows.find((r) => r.name === name).id
      await t.showCol('designated', 'procurement')
      await t.setCellKey(id, 'model', model); await t.setCellKey(id, 'maker', maker); await t.setCellKey(id, 'procurement', proc); if (des) await t.setCellKey(id, 'designated', des)
      await t.setCellKey(id, 'qtyNeeded', qty); await t.setCellKey(id, 'ref', 'Z' + id)
      return id
    },
    async files(from) {
      const out = []
      for (const dl of t.downloads.slice(from)) {
        try {
          const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(dl.name); const sh = wb.worksheets[0]; let sup = ''; const ids = []
          sh.eachRow((r) => { const v = r.values.slice(1); const j = v.indexOf('宛先'); if (j >= 0 && !sup) sup = v[j + 1]; if (typeof v[0] === 'string' && /^R\d+$/.test(v[0])) ids.push(v[0]) })
          out.push({ sup, ids })
        } catch (e) { out.push({ sup: 'ERR', ids: [] }) }
      }
      return out
    },
    /** 概算見積を依頼。prefix=null は「相見積先すべて」、'S2' はその商社 */
    async requestTo(prefix, deadline) {
      const n0 = t.downloads.length
      await t.cmd('概算見積を依頼'); await page.waitForTimeout(100)
      const pr = await t.panel(); const i = prefix ? pr.options.findIndex((o) => o.startsWith(prefix + ' ')) : 0
      for (let k = 0; k < i; k++) await t.press('ArrowDown')
      if (deadline) await t.promptFill(deadline)
      await t.press('Enter'); await page.waitForTimeout(1300)
      return { msg: await t.toast(), f: await h.files(n0), options: pr.options }
    },
    async setting(key, value, reason = '設定変更') {
      await t.cmd('案件設定'); await page.waitForTimeout(80)
      const idx = await page.evaluate(async (key) => { const m = await import(window.__m('/src/ui/settingsFields.ts')); const s = (await import(window.__m('/src/model/store.ts'))).useStore.getState(); return m.settingsFields(s.project()).findIndex((f) => f.key === key) }, key)
      for (let k = 0; k < idx; k++) await t.press('ArrowDown')
      await t.press('Enter'); await page.getByTestId('settings-input').fill(value); await t.press('Enter'); await t.press('Control+Enter'); await page.waitForTimeout(100)
      let pn = await t.panel(); let guard = 0
      while (pn && guard++ < 3) { try { await t.promptFill(reason) } catch {} ; await t.press('Enter'); await page.waitForTimeout(100); pn = await t.panel() }
      return t.toast()
    },
    async q(id, sid, price, lead) {
      const out = []
      if (price != null) { out.push(await t.setCellKey(id, `q.unitPrice@${sid}`, String(price))); await t.press('Escape') }
      if (lead != null) { out.push(await t.setCellKey(id, `q.leadDays@${sid}`, String(lead))); await t.press('Escape') }
      return out.join(' / ')
    },
    async importAnswers(sid, tsv) {
      await t.cmd('見積回答を取り込む'); await page.waitForTimeout(100)
      const pr = await t.panel(); const i = pr.options.findIndex((o) => o.startsWith(sid + ' '))
      for (let k = 0; k < i; k++) await t.press('ArrowDown')
      await t.press('Enter'); await page.waitForTimeout(100)
      await page.getByTestId('import-text').fill(tsv); await page.getByTestId('import-text').press('Control+Enter'); await page.waitForTimeout(200)
      if (await t.panel()) { await page.keyboard.press('Escape') }
      return t.toast()
    },
    async adoptPick(id, n, reasonDigit = '1', text = '') {
      await t.goto(id); await t.press('Shift+A'); await page.waitForTimeout(80)
      const ap = await t.panel(); await t.press(String(n)); await page.waitForTimeout(80)
      let pn = await t.panel(); let g = 0
      while (pn && pn.kind === 'prompt' && g++ < 3) {
        if (pn.options?.length && pn.index < 0) { await t.press(reasonDigit); await page.waitForTimeout(60) }
        if (text) { try { await t.promptFill(text) } catch {} }
        await page.getByTestId('prompt-text').press('Enter'); await page.waitForTimeout(100); pn = await t.panel()
      }
      if (pn) await page.keyboard.press('Escape')
      return { adoptPanel: ap, toast: await t.toast() }
    },
    async decline(id, sid) { await t.press('6'); const r = await t.setCellKey(id, `q.leadDays@${sid}`, '取扱なし'); await t.press('Escape'); return r },
    async status(id) { return t.cellText(id, 'status') },
    async pm7Has(id) { const v0 = await t.view(); await t.press('7'); const r = (await t.viewRows()).includes(id); return r },
    async ballOf(id) { return page.evaluate(async (id) => { const d = await import(window.__m('/src/model/derive.ts')); const s = (await import(window.__m('/src/model/store.ts'))).useStore.getState(); const p = s.project(); return d.ball(p, p.rows.find((r) => r.id === id)) }, id) },
    async caseOf(id) { return page.evaluate(async (id) => { const m = await import(window.__m('/src/actions/pm.ts')); const s = (await import(window.__m('/src/model/store.ts'))).useStore.getState(); const p = s.project(); return m.pmCaseOf(p, p.rows.find((r) => r.id === id)) }, id) },
    async inView(role, view, id) { await t.role(role); await t.press(String(view)); return (await t.viewRows()).includes(id) },
  }
  return h
}
