import type { Project, Quote, Row, ScoreWeights, Supplier } from './types'
import { addDays, diffDays, todayStr } from './dates'
import { effective, orderQty, rowNeedDate } from './derive'

export const DEFAULT_WEIGHTS: ScoreWeights = { price: 40, lead: 30, record: 20, terms: 10 }

export interface ScoreBreakdown {
  supplierId: string
  total: number
  price: number
  lead: number
  record: number
  terms: number
  reasons: string[]
  quote: Quote
  /** 余剰を含む実質単価 */
  effectivePrice: number
  noRecord: boolean
}

export function weightsFor(p: Project, rowId: string): ScoreWeights {
  return p.rowWeights[rowId] ?? p.weights
}

/** 有効な（未回答・辞退・期限切れ・旧型式でない）見積 */
export function validQuotes(p: Project, row: Row, today = todayStr()): Quote[] {
  return p.quotes.filter((q) => q.rowId === row.id && !q.stale && q.unitPrice != null && q.unitPrice > 0 && q.leadDays !== -1 && (!q.validUntil || q.validUntil >= today))
}

/** 行に対する商社ごとのスコア内訳（降順） */
export function scoreRow(p: Project, row: Row, suppliers: Supplier[], today = todayStr()): ScoreBreakdown[] {
  const quotes = validQuotes(p, row, today)
  if (quotes.length === 0) return []
  const w = weightsFor(p, row.id)
  const sum = w.price + w.lead + w.record + w.terms || 1
  const qty = orderQty(row)
  const need = rowNeedDate(p, row)
  // 価格: MOQ 超過分を加算した実質単価で比較
  const eff = (q: Quote) => {
    const moq = q.moq ?? 0
    if (moq > qty) return (q.unitPrice! * moq) / qty
    return q.unitPrice!
  }
  const minEff = Math.min(...quotes.map(eff))
  const res = quotes.map((q) => {
    const sup = suppliers.find((s) => s.id === q.supplierId)
    const reasons: string[] = []
    const ep = eff(q)
    const price = Math.max(0, Math.min(100, (minEff / ep) * 100))
    if (ep === minEff) reasons.push('最安')
    let lead: number
    const ld = q.stock === '在庫' ? 0 : q.leadDays
    if (ld == null) {
      lead = 0
      reasons.push('納期未回答')
    } else if (!need) {
      lead = Math.max(0, 100 - (ld / 30) * 100)
    } else {
      const arrive = addDays(today, ld)
      const margin = diffDays(need, arrive)
      if (margin < 0) {
        lead = 0
        reasons.push(`納期NG(${-margin}日超過)`)
      } else {
        const span = Math.max(1, diffDays(need, today))
        lead = Math.min(100, 60 + (margin / span) * 40)
      }
      if (q.stock === '在庫') reasons.push('在庫即納')
    }
    const noRecord = !sup || sup.onTimeRate == null
    const record = noRecord ? 50 : Math.max(0, Math.min(100, sup!.onTimeRate! * 100 - (sup!.defectRate ?? 0) * 200))
    if (noRecord) reasons.push('実績なし')
    let terms = 100
    if (q.moq && q.moq > qty) {
      terms = Math.max(0, (100 * qty) / q.moq)
      reasons.push(`MOQ ${q.moq}`)
    }
    const total = (price * w.price + lead * w.lead + record * w.record + terms * w.terms) / sum
    return { supplierId: q.supplierId, total: Math.round(total * 10) / 10, price: Math.round(price), lead: Math.round(lead), record: Math.round(record), terms: Math.round(terms), reasons, quote: q, effectivePrice: ep, noRecord }
  })
  // 同点は納期 → 価格
  return res.sort((a, b) => b.total - a.total || b.lead - a.lead || b.price - a.price)
}

export function isContested(scores: ScoreBreakdown[], tie: number): boolean {
  return scores.length >= 2 && scores[0].total - scores[1].total < tie
}

/** 例外選定（1位以外）が PM 承認を要するか */
export function needsPmApproval(p: Project, row: Row, scores: ScoreBreakdown[], chosen: ScoreBreakdown): boolean {
  if (scores.length === 0 || chosen.supplierId === scores[0].supplierId) return false
  const s = p.settings
  if (scores[0].total - chosen.total <= s.tieThreshold) return false
  const qty = orderQty(row)
  const diff = (chosen.effectivePrice - scores[0].effectivePrice) * qty
  const pct = scores[0].effectivePrice > 0 ? (chosen.effectivePrice - scores[0].effectivePrice) / scores[0].effectivePrice : 0
  if (diff <= s.exceptionAmount && pct <= s.exceptionPct) return false
  return true
}

export function cheapest(scores: ScoreBreakdown[]): ScoreBreakdown | undefined {
  return [...scores].sort((a, b) => a.effectivePrice - b.effectivePrice)[0]
}

export function describe(e: DesignFieldsLike): string {
  return `${e.name} ${e.model}`.trim()
}
type DesignFieldsLike = { name: string; model: string }
export { effective }
