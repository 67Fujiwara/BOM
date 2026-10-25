// ラウンド19 中堅: 変更セット（承認 ON）のシナリオ用の共通手順
import ExcelJS from '/home/user/BOM/node_modules/exceljs/excel.js'
import { log } from './lib.mjs'

export function csHelpers(t, h) {
  const { page } = t
  const c = {
    subs: (p) => JSON.stringify(p.submissions.filter((s) => s.changeSet).map((s) => [s.rev, s.changeSet.reason, s.changeSet.rejected ? 'rej' : s.changeSet.approved ? 'appr' : s.changeSet.supersededBy != null ? 'merged→' + s.changeSet.supersededBy : 'pend', s.rowIds.join(','), s.changeSet.merged ?? null, s.revoked ? 'revoked' : ''])),
    async sheetsOf(from) { const out = []; for (const dl of t.downloads.slice(from)) { const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(dl.name); wb.eachSheet((sh) => { const rows = []; sh.eachRow((r) => rows.push(r.values.slice(1))); out.push({ f: dl.suggested, sh: sh.name, rows }) }) } return out },
    async excel(idx = 0) { const n0 = t.downloads.length; await page.locator('.gridwrap').focus(); await page.keyboard.press('Control+e'); await page.waitForTimeout(120); for (let k = 0; k < idx; k++) await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter')
      // ダウンロードの保存を待つ（負荷が高いと 2 秒では間に合わない）
      for (let i = 0; i < 40; i++) { await page.waitForTimeout(250); if (t.downloads.length > n0) { await page.waitForTimeout(300); break } }
      if (t.downloads.length <= n0) log('WARN Excel のダウンロードが来ない')
      return c.sheetsOf(n0) },
    /** 役割の社内 Excel の変更点のうち id の行 → [rev, 理由, 内容, 承認] */
    async chg(role, id) { await t.role(role); const ex = await c.excel(0); return ex.filter((s) => s.sh === '変更点').flatMap((s) => s.rows).filter((r) => r[3] === id && r[0] !== '').map((r) => [r[0], r[5], String(r[7] ?? ''), String(r[8] ?? '')]) },
    /** 承認 ON・一括採用まで。選定済の相見積の行を返す */
    async setup() {
      await t.open('design')
      log('publish drafts first →', await t.publish('1'))
      await t.role('pm'); log('approval ON →', await h.setting('changeNeedsPmApproval', 'はい', '承認制'))
      await t.role('design'); log('bulk →', await t.bulk())
      const p = await t.proj()
      const clean = await page.evaluate(async () => { const m = await import(window.__m('/src/model/rules.ts')); const s = (await import(window.__m('/src/model/store.ts'))).useStore.getState(); const p = s.project(); return p.rows.filter((r) => !m.checkRow(r, s.ws.rules, p).length).map((r) => r.id) })
      return p.rows.filter((r) => clean.includes(r.id) && !r.working && r.status === 'selected' && r.procurement === '相見積' && !r.flags.contested && !r.flags.leadNG && r.qtyNeeded >= 5)
    },
    async panelOf(id) { await t.role('pm'); await t.press('7'); await t.goto(id); await t.press('Enter'); await page.waitForTimeout(100); const pn = await t.panel(); await t.press('Escape'); if (await t.panel()) await t.press('Escape'); return pn },
    row: (p, id) => p.rows.find((r) => r.id === id),
  }
  return c
}
