import { useStore } from '@/model/store'
import type { Project, Row } from '@/model/types'
import { ADOPT_REASONS } from '@/model/types'
import { cheapest, isContested, needsPmApproval, scoreRow, type ScoreBreakdown } from '@/model/score'
import { effective, hasWork, isActive, isFixedProcurement, isQuotable, quoteResponses, roundedQty } from '@/model/derive'
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
  if (!isActive(row)) return '取消・置換済の行は採用できません'
  if (!isQuotable(row)) return `見積対象外の行です（調達区分: ${effective(row).procurement}。選定済・固定）`
  if (isFixedProcurement(row)) return `${effective(row).procurement}の行は指定先で固定です（スコアでは選びません。指定先を変えるときは設計が「指定先」を直す）`
  if (hasWork(row)) return '設計作業中の行は選定できません（公開を待つ）'
  if (row.flags.pmPending) return 'PM承認待ちの行です'
  if (row.status === 'quoting' && !allowQuoting) {
    const { answered, total } = quoteResponses(p, row)
    return `回答 ${answered}/${total} 待ち（Alt+Shift+A / Ctrl+Alt+A で先行採用）`
  }
  if (row.status === 'draft') return '下書きの行です。設計が Ctrl+Enter で提出し、購買の見積が揃ってから採用できます'
  if (row.status === 'submitted') return '見積前の行です（購買が概算見積を依頼・回答待ち）'
  if (!isActive(row)) return '取消・置換済の行は採用できません'
  // PM が購買に再選定を委譲した行は、正式依頼中・正式見積済でも選び直せる
  if (row.flags.delegated && role === 'purchasing' && ['selected', 'formalRequested', 'formalQuoted'].includes(row.status)) return null
  if (!['quoted', 'selected', 'quoting'].includes(row.status)) return '正式見積の依頼以降は採用を変えられません（変えるときは PM の要決定で「次点へ」）'
  return null
}

function applyAdoption(_p: Project, r: Row, chosen: ScoreBreakdown, reason: string | undefined, pending: boolean, pmReason?: Row['flags']['pmReason']) {
  const wasDelegated = r.flags.delegated && ['formalRequested', 'formalQuoted'].includes(r.status)
  r.adoptedSupplierId = chosen.supplierId
  r.adoptReason = reason
  r.scoreSnapshot = chosen.total
  r.orderQty = roundedQty(r.qtyNeeded, chosen.quote.moq, r.packQty, r.unit)
  if (r.flags.delegated) {
    // 委譲された再選定は PM の決定が承認を兼ねる（例外閾値の承認は不要）
    pending = false
    r.flags.delegated = false
    r.flags.formalDiffKey = undefined
  }
  if (wasDelegated) setStatus(r, 'selected')
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
  // 理由をつけて別の商社を採用してある行（自分か別のタブ）を、推奨で黙って上書きしない
  if (row.adoptedSupplierId && row.adoptedSupplierId !== scores[0].supplierId && row.adoptReason && row.adoptReason !== '拮抗') {
    const now = s.ws.suppliers.find((x) => x.id === row.adoptedSupplierId)?.name ?? row.adoptedSupplierId
    s.toastMsg(`${row.id} は「${now}」で採用済みです（${row.adoptReason}）。変えるときは Alt+Shift+A で商社を選び直す`, 'err')
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

/** Ctrl+Alt+A: 最安で採用（スコア無視）。見積中なら先行採用 */
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
export function adoptChoose(rowId: string, supplierId: string, reason?: string, expectAdopted?: string | null): boolean {
  const s = st()
  const p = s.project()
  const row = p.rows.find((r) => r.id === rowId)
  if (!row) return false
  // 理由を入れているあいだに別のタブで採用が変わっていたら、黙って上書きしない
  if (expectAdopted !== undefined && (row.adoptedSupplierId ?? null) !== expectAdopted) {
    const now = s.ws.suppliers.find((x) => x.id === row.adoptedSupplierId)?.name ?? 'なし'
    s.toastMsg(`${row.id} の採用は、一覧・理由のダイアログを開いているあいだに別のタブで「${now}」に変わりました。採用しませんでした（見直してからもう一度）`, 'err')
    return false
  }
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
  s.toastMsg(pending ? `${row.id}: ${sup?.name} を仮採用${reason ? `（${reason}）` : ''}。PM の承認待ち（7 要決定）` : `${row.id} を ${sup?.name} で採用${reason ? `（${reason}）` : ''}`, pending ? 'info' : 'ok')
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

/** 商社集約の試算。対象は採用を変えられる行だけ。集約先が扱わない行はいまの採用（無ければ推奨）のまま比べる */
export function consolidateOptions(): Array<{ label: string; detail: string; supplierIds: string[]; delta: number }> {
  const s = st()
  const p = s.project()
  // 指定商社・客先指定品は指定先が決まっているので集約しない（§3.4）
  const rows = p.rows.filter((r) => (r.status === 'quoted' || r.status === 'selected') && !canAdopt(p, r) && !isFixedProcurement(r))
  const curOf = (r: Row) => {
    const sc = scoreRow(p, r, s.ws.suppliers)
    const a = r.adoptedSupplierId ? sc.find((x) => x.supplierId === r.adoptedSupplierId) : sc[0]
    return a ? { cost: a.effectivePrice * r.qtyNeeded, lead: a.quote.stock === '在庫' ? 0 : (a.quote.leadDays ?? 0) } : { cost: 0, lead: 0 }
  }
  const current = rows.reduce((sum, r) => sum + curOf(r).cost, 0)
  const combos: string[][] = []
  // 取引停止の商社は集約の候補にしない
  const ids0 = p.supplierIds.filter((id) => s.ws.suppliers.find((x) => x.id === id)?.tradable !== false)
  for (const a of ids0) combos.push([a])
  for (let i = 0; i < ids0.length; i++) for (let j = i + 1; j < ids0.length; j++) combos.push([ids0[i], ids0[j]])
  const out = combos.map((ids) => {
    let total = 0
    let covered = 0
    let worstLead = 0
    for (const r of rows) {
      const sc = scoreRow(p, r, s.ws.suppliers).filter((x) => ids.includes(x.supplierId))
      if (!sc.length) {
        const c = curOf(r)
        total += c.cost
        worstLead = Math.max(worstLead, c.lead)
        continue
      }
      covered++
      const best = [...sc].sort((a, b) => a.effectivePrice - b.effectivePrice)[0]
      total += best.effectivePrice * r.qtyNeeded
      worstLead = Math.max(worstLead, best.quote.stock === '在庫' ? 0 : (best.quote.leadDays ?? 0))
    }
    const names = ids.map((id) => s.ws.suppliers.find((x) => x.id === id)?.name ?? id).join(' + ')
    const delta = total - current
    const fixedN = p.rows.filter((r) => (r.status === 'quoted' || r.status === 'selected') && isFixedProcurement(r)).length
    return { label: names, detail: `${covered}/${rows.length} 行を集約（残りはいまの採用のまま${fixedN ? `。指定商社・客先指定品 ${fixedN} 行は指定先のまま対象外` : ''}）、総額 ¥${Math.round(total).toLocaleString()}（差 ${delta >= 0 ? '+' : ''}¥${Math.round(delta).toLocaleString()}）、最長納期 ${worstLead} 日`, supplierIds: ids, delta }
  })
  return out.sort((a, b) => a.delta - b.delta)
}

export function applyConsolidation(supplierIds: string[]) {
  const s = st()
  let n = 0
  let pending = 0
  let skipped = 0
  const p0 = s.project()
  s.commit('商社を集約', (p, ws) => {
    for (const r of p.rows) {
      if (!(r.status === 'quoted' || r.status === 'selected') || isFixedProcurement(r)) continue
      // 作業中・承認待ち・委譲中など、採用を変えられない行は飛ばす
      if (canAdopt(p0, p0.rows.find((x) => x.id === r.id)!)) {
        skipped++
        continue
      }
      const scores = scoreRow(p, r, ws.suppliers)
      const sc = scores.filter((x) => supplierIds.includes(x.supplierId))
      if (!sc.length) continue
      const chosen = [...sc].sort((a, b) => a.effectivePrice - b.effectivePrice)[0]
      if (chosen.supplierId === r.adoptedSupplierId) continue
      const pend = needsPmApproval(p, r, scores, chosen)
      applyAdoption(p, r, chosen, '集約', pend)
      n++
      if (pend) pending++
    }
    normalize(p, ws)
  })
  s.toastMsg(`集約: ${n} 行を付け替え（PM承認待ち ${pending}${skipped ? `、作業中・承認待ちの ${skipped} 行は対象外` : ''}）`, 'ok')
}

export function rowScores(p: Project, row: Row) {
  return scoreRow(p, row, st().ws.suppliers)
}

export { ADOPT_REASONS }
