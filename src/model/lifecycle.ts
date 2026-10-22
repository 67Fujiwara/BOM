import type { Project, Row, Workspace } from './types'
import { addDays, todayStr } from './dates'
import { isActive, isQuotable, orderQty, quoteComplete, rowNeedDate } from './derive'

/** 変更後に状態・フラグを整合させる（commit の最後に必ず呼ぶ） */
export function normalize(p: Project, _ws: Workspace, today = todayStr()) {
  const now = new Date().toISOString()
  for (const r of p.rows) {
    if (!isActive(r)) continue
    // 見積対象外は選定をスキップして「選定済（固定）」
    if (!isQuotable(r) && ['submitted', 'quoting', 'quoted'].includes(r.status)) {
      r.status = 'selected'
      r.statusChangedAt = now
    }
    // 見積中 → 見積済
    if (r.status === 'quoting' && quoteComplete(p, r, today)) {
      r.status = 'quoted'
      r.statusChangedAt = now
      r.quotedAt = today
      // 先行発注判断: 商社納期 > 必要日 − 正式見積の所要日数
      const need = rowNeedDate(p, r)
      if (need) {
        const best = p.quotes.filter((q) => q.rowId === r.id && !q.stale && q.unitPrice != null && q.leadDays != null && q.leadDays >= 0).map((q) => (q.stock === '在庫' ? 0 : q.leadDays!))
        if (best.length && Math.min(...best) > 0 && addDays(today, Math.min(...best)) > addDays(need, -p.settings.formalDays)) {
          r.flags.ltbPending = true
          r.flags.pmReason = '先行採用'
        }
      }
      // 期限到達で未回答の商社は辞退扱い
      for (const q of p.quotes) if (q.rowId === r.id && !q.stale && q.unitPrice == null && q.leadDays == null && p.settings.quoteDeadline && p.settings.quoteDeadline < today) q.leadDays = -1
    }
    // 正式見積の回答 → 正式見積済 / 差分超過
    if (r.status === 'formalRequested' && r.adoptedSupplierId) {
      const q = p.quotes.find((x) => x.rowId === r.id && x.supplierId === r.adoptedSupplierId && !x.stale)
      if (q?.formalPrice != null) {
        r.status = 'formalQuoted'
        r.statusChangedAt = now
      }
    }
    if (r.status === 'formalQuoted' && r.adoptedSupplierId) {
      const q = p.quotes.find((x) => x.rowId === r.id && x.supplierId === r.adoptedSupplierId && !x.stale)
      if (q?.formalPrice != null && q.unitPrice != null) {
        const qty = orderQty(r)
        const diff = (q.formalPrice - q.unitPrice) * qty
        const pct = (q.formalPrice - q.unitPrice) / q.unitPrice
        const over = pct > p.settings.formalDiffPct || diff > p.settings.formalDiffAmount
        if (over && !r.flags.formalDiff && !p.decisions.some((d) => d.rowId === r.id && (d.kind === '受入' || d.kind === '承認') && d.at > r.statusChangedAt)) r.flags.formalDiff = true
        if (!over) r.flags.formalDiff = false
      }
    }
    // 納期NG（採用済みの商社納期が必要日を超える）。対策区分が付いていれば外す
    const need = rowNeedDate(p, r)
    if (need && r.adoptedSupplierId && ['selected', 'formalRequested', 'formalQuoted'].includes(r.status)) {
      const q = p.quotes.find((x) => x.rowId === r.id && x.supplierId === r.adoptedSupplierId && !x.stale)
      const ld = q?.stock === '在庫' ? 0 : (q?.formalLeadDays ?? q?.leadDays)
      if (ld != null && ld >= 0) {
        const arrive = addDays(today, ld)
        r.flags.leadNG = arrive > need && !r.flags.countermeasure
      }
    } else if (r.status === 'ordered' && r.promisedDate && need) {
      r.flags.leadNG = r.promisedDate > need && !r.flags.countermeasure
    }
    if (r.status === 'received') r.flags.leadNG = false
    // 発注・入荷のチェックと状態
    if (r.received && r.status !== 'received') {
      r.status = 'received'
      r.statusChangedAt = now
    } else if (r.ordered && !r.received && !['ordered', 'received'].includes(r.status)) {
      r.status = 'ordered'
      r.statusChangedAt = now
    }
  }
}

export function nextRowId(p: Project): string {
  const max = p.rows.reduce((m, r) => Math.max(m, Number(r.id.slice(1)) || 0), 0)
  return 'R' + String(max + 1).padStart(3, '0')
}

export function setStatus(r: Row, s: Row['status']) {
  if (r.status !== s) {
    r.status = s
    r.statusChangedAt = new Date().toISOString()
    r.dueAt = undefined
  }
}
