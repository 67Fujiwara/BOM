import type { Project, Row, Workspace } from './types'
import { addDays, todayStr } from './dates'
import { fixedSupplierId, isActive, isFixedProcurement, isQuotable, orderQty, quoteComplete, roundedQty, rowNeedDate } from './derive'

/** 変更後に状態・フラグを整合させる（commit の最後に必ず呼ぶ） */
export function normalize(p: Project, ws: Workspace, today = todayStr()) {
  const now = new Date().toISOString()
  for (const r of p.rows) {
    if (!isActive(r)) continue
    // 見積対象外は選定をスキップして「選定済（固定）」
    if (!isQuotable(r) && ['submitted', 'quoting', 'quoted'].includes(r.status)) {
      r.status = 'selected'
      r.statusChangedAt = now
    }
    // 指定商社・客先指定品: 指定先の有効な見積が来たら、スコアなしで指定先を採用して選定済（§3.4）
    if (isFixedProcurement(r) && !r.adoptedSupplierId && !r.flags.pmPending && ['submitted', 'quoting', 'quoted', 'selected'].includes(r.status)) {
      const sid = fixedSupplierId(p, r, ws.suppliers)
      const q = sid ? p.quotes.find((x) => x.rowId === r.id && x.supplierId === sid && !x.stale && x.unitPrice != null && x.leadDays !== -1) : undefined
      if (q && sid && r.publishedRev != null) {
        r.adoptedSupplierId = sid
        r.adoptReason = '指定先（固定）'
        r.orderQty = roundedQty(r.qtyNeeded, q.moq, r.packQty, r.unit)
        if (r.status !== 'selected') {
          if (!r.quotedAt) r.quotedAt = today
          r.status = 'selected'
          r.statusChangedAt = now
        }
      } else if (r.status === 'selected') {
        // 指定先の見積がまだ無いのに選定済で止まっている行は、見積の依頼に戻す
        r.status = 'submitted'
        r.statusChangedAt = now
      }
    }
    // 見積中 → 見積済（指定系の行は、指定先の有効な見積が来たとき。辞退だけなら購買が次の商社に頼むまで見積中のまま）
    const fixedWaiting = isFixedProcurement(r) && !p.quotes.some((x) => x.rowId === r.id && !x.stale && x.unitPrice != null && x.leadDays !== -1)
    if (r.status === 'quoting' && !fixedWaiting && quoteComplete(p, r, today)) {
      r.status = 'quoted'
      r.statusChangedAt = now
      r.quotedAt = today
      // 先行発注判断: 商社納期 > 必要日 − 正式見積の所要日数
      const need = rowNeedDate(p, r)
      if (need) {
        const best = p.quotes.filter((q) => q.rowId === r.id && !q.stale && q.unitPrice != null && q.leadDays != null && q.leadDays >= 0).map((q) => (q.stock === '在庫' ? 0 : q.leadDays!))
        if (best.length && Math.min(...best) > 0 && addDays(today, Math.min(...best)) > addDays(need, -p.settings.formalDays)) {
          r.flags.ltbPending = true
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
        r.flags.renegotiating = false
        r.statusChangedAt = now
      }
    }
    if (r.status === 'formalQuoted' && r.adoptedSupplierId) {
      const q = p.quotes.find((x) => x.rowId === r.id && x.supplierId === r.adoptedSupplierId && !x.stale)
      if (q?.formalPrice != null && q.unitPrice != null) {
        // §9.2: 差が「±割合 または 金額 の大きい方」を超えたら差分超過。PM が対応した同じ正式単価には戻さない
        const qty = orderQty(r)
        const diff = Math.abs(q.formalPrice - q.unitPrice) * qty
        const threshold = Math.max(p.settings.formalDiffPct * q.unitPrice * qty, p.settings.formalDiffAmount)
        const key = `${q.supplierId}:${q.formalPrice}`
        r.flags.formalDiff = diff > threshold && r.flags.formalDiffKey !== key
      }
    }
    // 納期NG（採用済みの商社納期が必要日を超える）。対策区分が付いていれば外す
    const need = rowNeedDate(p, r)
    if (need && r.adoptedSupplierId && ['selected', 'formalRequested', 'formalQuoted'].includes(r.status)) {
      const q = p.quotes.find((x) => x.rowId === r.id && x.supplierId === r.adoptedSupplierId && !x.stale)
      const ld = q?.stock === '在庫' ? 0 : (q?.formalLeadDays ?? q?.leadDays)
      if (ld != null && ld >= 0) {
        const arrive = addDays(today, ld)
        r.flags.leadNG = arrive > need && !leadAccepted(r)
        // 商社を変えてもまだ間に合わないなら対策区分を外して PM に戻す
        if (arrive > need && r.flags.countermeasure === '商社変更' && !r.flags.delegated) {
          r.flags.countermeasure = undefined
          r.flags.leadNG = true
        }
      }
    } else if (r.status === 'ordered' && r.promisedDate && need) {
      r.flags.leadNG = r.promisedDate > need && !leadAccepted(r)
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

/** 納期NG に PM が手を打った（受入・特急・代替品検討・委譲中）なら NG として PM に出さない */
function leadAccepted(r: Row): boolean {
  const cm = r.flags.countermeasure
  // 先行発注を PM が許可した行は、納期を承知のうえでの判断（§4 先行発注許可）
  // 再交渉中（正式見積の回答待ち）は、回答が来てから判定する
  if (r.flags.renegotiating && r.status === 'formalRequested') return true
  return cm === '受入' || cm === '分納・特急' || cm === '代替品検討' || (cm === '商社変更' && !!r.flags.delegated) || !!r.flags.early
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
