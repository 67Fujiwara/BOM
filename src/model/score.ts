import type { Project, Quote, Row, ScoreWeights, Supplier } from './types'
import { addDays, diffDays, todayStr } from './dates'
import { effective, fixedSupplierId, isFixedProcurement, roundedQty, rowNeedDate } from './derive'

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
  /** MOQ・入数で丸めた数量と、余って買う分の金額 */
  roundedQty: number
  surplusAmount: number
}

export function weightsFor(p: Project, rowId: string): ScoreWeights {
  return p.rowWeights[rowId] ?? p.weights
}

/** 有効な（未回答・辞退・期限切れ・旧型式でない）見積 */
export function validQuotes(p: Project, row: Row, today = todayStr()): Quote[] {
  return p.quotes.filter((q) => q.rowId === row.id && !q.stale && q.unitPrice != null && q.unitPrice > 0 && q.leadDays !== -1 && (!q.validUntil || q.validUntil >= today))
}

/** 行に対する商社ごとのスコア内訳（降順）。§8.1: 基準数量は公開済の必要数、納期の基準日は見積済になった日 */
export function scoreRow(p: Project, row: Row, suppliers: Supplier[], today = todayStr()): ScoreBreakdown[] {
  // 指定商社・客先指定品は指定先 1 社だけ（スコアで他社を選ばない）
  const fixed = isFixedProcurement(row) ? fixedSupplierId(p, row, suppliers) : null
  // 相見積は、案件の相見積先にいて取引できる商社だけ（外した商社は推奨・採用しない。いまの採用は相見積先から外しても残す。取引停止の商社は採用中でも外す）
  const eligible = (sid: string) => suppliers.find((s) => s.id === sid)?.tradable !== false && (sid === row.adoptedSupplierId || p.supplierIds.includes(sid))
  const quotes = validQuotes(p, row, today).filter((q) => (fixed ? q.supplierId === fixed && suppliers.find((s) => s.id === fixed)?.tradable !== false : eligible(q.supplierId)))
  if (quotes.length === 0) return []
  const w = weightsFor(p, row.id)
  const sum = w.price + w.lead + w.record + w.terms || 1
  const qty = Math.max(row.qtyNeeded, 0)
  const need = rowNeedDate(p, row)
  const base = row.quotedAt && row.quotedAt <= today ? row.quotedAt : today
  const margin0 = Math.max(1, p.settings.leadMarginDays || 5)
  // 価格: MOQ・入数で丸めた数量を買ったときの実質単価で比べる
  const rq = (q: Quote) => roundedQty(qty, q.moq, row.packQty, row.unit)
  const eff = (q: Quote) => (qty > 0 ? (q.unitPrice! * rq(q)) / qty : q.unitPrice!)
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
      const margin = diffDays(need, addDays(base, ld))
      if (margin >= 0) lead = 100
      else {
        lead = Math.max(0, 100 * (1 + margin / margin0))
        reasons.push(`納期NG(${-margin}日超過)`)
      }
      if (q.stock === '在庫') reasons.push('在庫即納')
    }
    // 実績: 商社マスタの値。無ければ入荷記録（発注日 + 回答納期 までに入荷したか）から集計する（§8.1）
    const rs = sup?.onTimeRate == null ? receiptStats(p, q.supplierId) : null
    const onTime = sup?.onTimeRate ?? (rs ? rs.ok / rs.total : null)
    if (rs) reasons.push(`実績: この案件の入荷 ${rs.ok}/${rs.total} 件が納期内`)
    const noRecord = !sup || onTime == null
    const record = noRecord ? 50 : Math.max(0, Math.min(100, onTime! * 100 - (sup!.defectRate ?? 0) * 200))
    if (noRecord) reasons.push('実績なし')
    let terms = 100
    if (q.moq && q.moq > qty) {
      terms = qty > 0 ? Math.max(0, (100 * qty) / q.moq) : 0
      reasons.push(`MOQ ${q.moq}`)
    }
    const rounded = rq(q)
    const total = (price * w.price + lead * w.lead + record * w.record + terms * w.terms) / sum
    return { supplierId: q.supplierId, total: Math.round(total * 10) / 10, price: Math.round(price), lead: Math.round(lead), record: Math.round(record), terms: Math.round(terms), reasons, quote: q, effectivePrice: ep, noRecord, roundedQty: rounded, surplusAmount: (rounded - qty) * q.unitPrice! }
  })
  // 同点は納期 → 価格
  return res.sort((a, b) => b.total - a.total || b.lead - a.lead || b.price - a.price)
}

/** 次点: 必要日を満たし、概算の有効期限内で、いまの採用先を除いた最高スコア（§9.1） */
export function nextBest(p: Project, row: Row, suppliers: Supplier[], today = todayStr()): ScoreBreakdown | undefined {
  const need = rowNeedDate(p, row)
  return scoreRow(p, row, suppliers, today).find((sc) => {
    if (sc.supplierId === row.adoptedSupplierId) return false
    const ld = sc.quote.stock === '在庫' ? 0 : sc.quote.leadDays
    if (ld == null) return false
    return !need || addDays(today, ld) <= need
  })
}

/** 拮抗: 1 位と 2 位の差が拮抗閾値「以内」（例外選定と同じ境界） */
export function isContested(scores: ScoreBreakdown[], tie: number): boolean {
  return scores.length >= 2 && scores[0].total - scores[1].total <= tie
}

/** 例外選定（1位以外）が PM 承認を要するか */
export function needsPmApproval(p: Project, row: Row, scores: ScoreBreakdown[], chosen: ScoreBreakdown): boolean {
  if (scores.length === 0 || chosen.supplierId === scores[0].supplierId) return false
  const s = p.settings
  if (scores[0].total - chosen.total <= s.tieThreshold) return false
  const qty = row.qtyNeeded
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

/** 行の見積を順位順に並べる（スコアの付かない未回答・辞退は後ろ）。詳細の表と ↓ の選択で同じ並びを使う */
export function rankedQuotes(p: Project, row: Row, suppliers: Supplier[]): Quote[] {
  const scores = scoreRow(p, row, suppliers)
  const rank = (q: Quote) => {
    const i = scores.findIndex((x) => x.supplierId === q.supplierId)
    return i < 0 ? Number.MAX_SAFE_INTEGER : i
  }
  return p.quotes.filter((q) => q.rowId === row.id && !q.stale).sort((a, b) => rank(a) - rank(b))
}

/** 入荷記録からの納期遵守率（発注日 + 正式納期（無ければ概算の納期。在庫は 0 日）までに入荷した割合）。記録が無ければ null */
export function receiptStats(p: Project, supplierId: string): { ok: number; total: number } | null {
  const done = p.rows.filter((r) => r.received && r.adoptedSupplierId === supplierId && r.orderedAt && r.receivedAt)
  if (!done.length) return null
  const ok = done.filter((r) => {
    const q = p.quotes.find((x) => x.rowId === r.id && x.supplierId === supplierId && !x.stale)
    const lead = q?.formalLeadDays ?? (q?.stock === '在庫' ? 0 : (q?.leadDays ?? 0))
    return r.receivedAt! <= addDays(r.orderedAt!, Math.max(0, lead))
  }).length
  return { ok, total: done.length }
}
