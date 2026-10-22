import { useStore } from '@/model/store'
import type { Project, Row } from '@/model/types'
import { ADOPT_REASONS } from '@/model/types'
import { cheapest, isContested, needsPmApproval, scoreRow, type ScoreBreakdown } from '@/model/score'
import { effective, isQuotable, roundedQty } from '@/model/derive'
import { normalize, setStatus } from '@/model/lifecycle'
import { businessDaysBetween, todayStr } from '@/model/dates'

function st() {
  return useStore.getState()
}

export function canAdopt(p: Project, row: Row, allowQuoting = false): string | null {
  const role = st().user().role
  void p
  const allowed = p.settings.selector === role || (row.flags.delegated && role === 'purchasing')
  if (!allowed) return `権限なし（選定者は${p.settings.selector === 'design' ? '設計' : '購買'}）`
  if (!isQuotable(row)) return '見積対象外の行です（選定済・固定）'
  if (row.working && Object.keys(row.working).length) return '設計作業中の行は選定できません（公開を待つ）'
  if (row.flags.pmPending) return 'PM承認待ちの行です'
  if (row.status === 'quoting' && !allowQuoting) {
    const qs = p.quotes.filter((q) => q.rowId === row.id && !q.stale)
    const answered = qs.filter((q) => q.unitPrice != null || q.leadDays === -1).length
    return `回答 ${answered}/${qs.length} 待ち（Shift+A / Alt+A で先行採用）`
  }
  if (!['quoted', 'selected', 'quoting'].includes(row.status)) return `${row.status === 'submitted' ? '見積前' : '選定済以降'}の行は採用できません`
  return null
}

function applyAdoption(_p: Project, r: Row, chosen: ScoreBreakdown, reason: string | undefined, pending: boolean, pmReason?: Row['flags']['pmReason']) {
  r.adoptedSupplierId = chosen.supplierId
  r.adoptReason = reason
  r.scoreSnapshot = chosen.total
  r.orderQty = roundedQty(effective(r).qtyNeeded, chosen.quote.moq, effective(r).packQty)
  if (pending) {
    r.flags.pmPending = true
    r.flags.pmReason = pmReason ?? '例外選定'
  } else {
    r.flags.pmPending = false
    r.flags.pmReason = undefined
    setStatus(r, 'selected')
  }
  r.flags.contested = false
}

/** a: 推奨（最高スコア）で採用 */
export function adoptBest(rowId: string): boolean {
  const s = st()
  const p = s.project()
  const row = p.rows.find((r) => r.id === rowId)
  if (!row) return false
  const err = canAdopt(p, row)
  if (err) {
    s.toastMsg(err, 'err')
    return false
  }
  const scores = scoreRow(p, row, s.ws.suppliers)
  if (!scores.length) {
    s.toastMsg('有効な見積がありません', 'err')
    return false
  }
  if (row.quotedAt && businessDaysBetween(row.quotedAt, todayStr(), p.settings.holidays) >= 5) s.toastMsg('注意: 見積済から5営業日以上経過（納期スコアの基準日が古い）', 'info')
  const best = scores[0]
  const sup = s.ws.suppliers.find((x) => x.id === best.supplierId)
  s.commit(`推奨採用 ${sup?.name ?? ''} スコア${best.total}`, (p2, ws) => {
    const r = p2.rows.find((x) => x.id === rowId)!
    applyAdoption(p2, r, best, isContested(scores, p2.settings.tieThreshold) ? '拮抗' : undefined, false)
    normalize(p2, ws)
  }, { rowId })
  s.toastMsg(`${row.id} を ${sup?.name} で採用（スコア ${best.total}${best.reasons.length ? ' / ' + best.reasons.join('・') : ''}）`, 'ok')
  return true
}

/** Alt+A: 最安で採用（スコア無視）。見積中なら先行採用 */
export function adoptCheapest(rowId: string): boolean {
  const s = st()
  const p = s.project()
  const row = p.rows.find((r) => r.id === rowId)
  if (!row) return false
  const err = canAdopt(p, row, true)
  if (err) {
    s.toastMsg(err, 'err')
    return false
  }
  const scores = scoreRow(p, row, s.ws.suppliers)
  const c = cheapest(scores)
  if (!c) {
    s.toastMsg('有効な見積がありません', 'err')
    return false
  }
  return adoptChoose(rowId, c.supplierId, '最安（スコア無視）')
}

/** Shift+A → 商社を選んで採用。1位以外は理由必須、閾値超は PM 承認待ち */
export function adoptChoose(rowId: string, supplierId: string, reason?: string): boolean {
  const s = st()
  const p = s.project()
  const row = p.rows.find((r) => r.id === rowId)
  if (!row) return false
  const err = canAdopt(p, row, true)
  if (err) {
    s.toastMsg(err, 'err')
    return false
  }
  const scores = scoreRow(p, row, s.ws.suppliers)
  const chosen = scores.find((x) => x.supplierId === supplierId)
  if (!chosen) {
    s.toastMsg('その商社の有効な見積がありません', 'err')
    return false
  }
  const early = row.status === 'quoting'
  const isTop = scores[0].supplierId === supplierId
  if (!isTop && !reason) {
    s.toastMsg('1位以外を選ぶには理由が必要です', 'err')
    return false
  }
  const pending = early || needsPmApproval(p, row, scores, chosen)
  const sup = s.ws.suppliers.find((x) => x.id === supplierId)
  s.commit(`採用 ${sup?.name ?? ''}${reason ? '（' + reason + '）' : ''}${pending ? ' PM承認待ち' : ''}`, (p2, ws) => {
    const r = p2.rows.find((x) => x.id === rowId)!
    applyAdoption(p2, r, chosen, early ? `先行採用: ${reason ?? ''}` : reason, pending, early ? '先行採用' : '例外選定')
    normalize(p2, ws)
  }, { rowId })
  s.toastMsg(pending ? `${row.id}: ${sup?.name} を仮採用。PM の承認待ち（7 要決定）` : `${row.id} を ${sup?.name} で採用`, pending ? 'info' : 'ok')
  return true
}

/** 一括採用 */
export function bulkAdopt(mode: 'best' | 'cheapest'): { adopted: number; contested: number; pending: number; skipped: number } {
  const s = st()
  const p = s.project()
  const result = { adopted: 0, contested: 0, pending: 0, skipped: 0 }
  s.commit(mode === 'best' ? '未採用を推奨で一括採用' : '未採用を最安で一括採用（スコア無視）', (p2, ws) => {
    for (const r of p2.rows) {
      if (r.status !== 'quoted' || r.adoptedSupplierId) {
        if (r.status === 'quoting') result.skipped++
        continue
      }
      if (canAdopt(p, p.rows.find((x) => x.id === r.id)!)) {
        result.skipped++
        continue
      }
      const scores = scoreRow(p2, r, ws.suppliers)
      if (!scores.length) {
        result.skipped++
        continue
      }
      const chosen = mode === 'best' ? scores[0] : cheapest(scores)!
      const pending = needsPmApproval(p2, r, scores, chosen)
      applyAdoption(p2, r, chosen, mode === 'cheapest' ? '最安（スコア無視）' : undefined, pending)
      if (pending) result.pending++
      else if (isContested(scores, p2.settings.tieThreshold)) {
        r.flags.contested = true
        result.contested++
        result.adopted++
      } else result.adopted++
    }
    normalize(p2, ws)
  })
  s.toastMsg(`採用 ${result.adopted} / 拮抗 ${result.contested}（要見直し）/ 承認要 ${result.pending} / スキップ ${result.skipped}`, 'ok')
  return result
}

/** 商社集約の試算 */
export function consolidateOptions(): Array<{ label: string; detail: string; supplierIds: string[]; delta: number }> {
  const s = st()
  const p = s.project()
  const rows = p.rows.filter((r) => r.status === 'quoted' || r.status === 'selected')
  const current = rows.reduce((sum, r) => {
    const sc = scoreRow(p, r, s.ws.suppliers)
    const a = r.adoptedSupplierId ? sc.find((x) => x.supplierId === r.adoptedSupplierId) : sc[0]
    return sum + (a ? a.effectivePrice * effective(r).qtyNeeded : 0)
  }, 0)
  const combos: string[][] = []
  for (const a of p.supplierIds) combos.push([a])
  for (let i = 0; i < p.supplierIds.length; i++) for (let j = i + 1; j < p.supplierIds.length; j++) combos.push([p.supplierIds[i], p.supplierIds[j]])
  const out = combos.map((ids) => {
    let total = 0
    let covered = 0
    let worstLead = 0
    for (const r of rows) {
      const sc = scoreRow(p, r, s.ws.suppliers).filter((x) => ids.includes(x.supplierId))
      if (!sc.length) continue
      covered++
      const best = [...sc].sort((a, b) => a.effectivePrice - b.effectivePrice)[0]
      total += best.effectivePrice * effective(r).qtyNeeded
      worstLead = Math.max(worstLead, best.quote.leadDays ?? 0)
    }
    const names = ids.map((id) => s.ws.suppliers.find((x) => x.id === id)?.name ?? id).join(' + ')
    return { label: names, detail: `対象 ${covered}/${rows.length} 行、総額 ¥${Math.round(total).toLocaleString()}（差 ${total - current >= 0 ? '+' : ''}¥${Math.round(total - current).toLocaleString()}）、最長納期 ${worstLead} 日`, supplierIds: ids, delta: total - current }
  })
  return out.sort((a, b) => a.delta - b.delta)
}

export function applyConsolidation(supplierIds: string[]) {
  const s = st()
  let n = 0
  let pending = 0
  s.commit('商社を集約', (p, ws) => {
    for (const r of p.rows) {
      if (!(r.status === 'quoted' || r.status === 'selected')) continue
      const scores = scoreRow(p, r, ws.suppliers)
      const sc = scores.filter((x) => supplierIds.includes(x.supplierId))
      if (!sc.length) continue
      const chosen = [...sc].sort((a, b) => a.effectivePrice - b.effectivePrice)[0]
      const pend = needsPmApproval(p, r, scores, chosen)
      applyAdoption(p, r, chosen, '集約', pend)
      n++
      if (pend) pending++
    }
    normalize(p, ws)
  })
  s.toastMsg(`集約: ${n} 行を付け替え（PM承認待ち ${pending}）`, 'ok')
}

export function rowScores(p: Project, row: Row) {
  return scoreRow(p, row, st().ws.suppliers)
}

export { ADOPT_REASONS }
