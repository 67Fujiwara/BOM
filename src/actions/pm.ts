import { useStore } from '@/model/store'
import type { Decision, DecisionKind, Project, Row, ScoreWeights, User } from '@/model/types'
import { scoreRow } from '@/model/score'
import { effective, isActive, orderQty, rowNeedDate, totals } from '@/model/derive'
import { normalize, setStatus } from '@/model/lifecycle'
import { addDays, todayStr } from '@/model/dates'

function st() {
  return useStore.getState()
}

function pushDecision(p: Project, by: User, kind: DecisionKind, reason: string, rowId?: string, extra?: Partial<Decision>): Decision {
  const d: Decision = { id: 'D-' + String(p.nextDecisionNo++).padStart(3, '0'), rowId, kind, by, at: new Date().toISOString(), reason, ...extra }
  p.decisions.push(d)
  return d
}

/** 要決定の種別（§9.1） */
export type PmCase = '例外選定' | '先行採用' | '変更セット' | '差分超過' | '納期NG' | '差戻し2回目' | '閾値超' | '再選定提案' | '先行発注判断' | 'なし'

export function pmCaseOf(p: Project, row: Row): PmCase {
  const f = row.flags
  if (f.formalDiff) return '差分超過'
  if (f.pmPending) return f.pmReason === '変更セット' ? '変更セット' : f.pmReason === '先行採用' ? '先行採用' : f.pmReason === '閾値超' ? '閾値超' : f.pmReason === '再選定提案' ? '再選定提案' : '例外選定'
  if (f.ltbPending) return '先行発注判断'
  if (f.leadNG && !f.countermeasure) return '納期NG'
  if (p.issues.some((i) => i.rowId === row.id && i.status === 'open' && i.bounceCount >= 2)) return '差戻し2回目'
  return 'なし'
}

export interface PmOption {
  key: string
  label: string
  kind: DecisionKind
}

/** 種別ごとの決定パネルの選択肢 */
export function pmOptions(c: PmCase): PmOption[] {
  switch (c) {
    case '例外選定':
      return [{ key: 'y', label: '承認 → 選定済', kind: '承認' }, { key: 'Y', label: '却下 → 見積済（選定者へ）', kind: '却下' }, { key: 'b', label: '次点（スコア2位）へ', kind: '次点商社へ' }]
    case '先行採用':
    case '先行発注判断':
      return [{ key: 'y', label: '先行発注を許可', kind: '先行発注許可' }, { key: 'Y', label: '却下 → 元の状態', kind: '却下' }]
    case '変更セット':
      return [{ key: 'y', label: '承認 → 公開確定', kind: '承認' }, { key: 'Y', label: '却下 → 公開を取り消し作業中に戻す', kind: '却下' }]
    case '差分超過':
      return [{ key: 'y', label: '受入 → 正式見積済', kind: '受入' }, { key: 'b', label: '次点商社へ', kind: '次点商社へ' }, { key: 'g', label: '再交渉（購買へ）', kind: '再交渉' }, { key: 'd', label: '設計へ代替依頼（コスト超過を起票）', kind: '設計へ代替依頼' }, { key: 'q', label: '数量見直し依頼（設計へ）', kind: '数量見直し依頼' }]
    case '納期NG':
      return [{ key: 'Y', label: '受入（遅延許容）', kind: '受入' }, { key: 'b', label: '次点へ（自動）', kind: '次点商社へ' }, { key: 'p', label: '購買が再選定（委譲）', kind: '委譲' }, { key: 'd', label: '設計が代替品検討', kind: '設計へ代替依頼' }, { key: 'e', label: '特急・分納（上限入力）', kind: '特急・分納' }]
    case '差戻し2回目':
      return [{ key: 'y', label: '購買の指摘を支持 → 設計へ', kind: '指摘を支持' }, { key: 'Y', label: '設計の回答を支持 → 確認済', kind: '回答を支持' }]
    case '閾値超':
      return [{ key: 'y', label: '承認（余剰 / 価格差を受入）', kind: '承認' }, { key: 'Y', label: '却下 → 起票者に戻す', kind: '却下' }, { key: 'q', label: '数量見直し依頼', kind: '数量見直し依頼' }, { key: 'd', label: '設計へ代替依頼', kind: '設計へ代替依頼' }]
    case '再選定提案':
      return [{ key: 'y', label: '再選定 → 見積済（選定者へ）', kind: '再選定' }, { key: 'Y', label: '現状維持', kind: '現状維持' }]
    default:
      return []
  }
}

/** 上長決裁（ツール外）が必要か */
export function needsExternalApproval(p: Project, row: Row): boolean {
  const q = row.adoptedSupplierId ? p.quotes.find((x) => x.rowId === row.id && x.supplierId === row.adoptedSupplierId && !x.stale) : undefined
  const diff = q?.formalPrice != null && q.unitPrice != null ? (q.formalPrice - q.unitPrice) * orderQty(row) : 0
  const t = totals(p)
  const overBudget = t.budget != null && t.formal > t.budget * (1 + p.settings.externalApprovalBudgetPct)
  return diff >= p.settings.externalApprovalAmount || overBudget
}

/** PM の決定を適用 */
export function decide(rowId: string, kind: DecisionKind, reason: string, extra?: { external?: Decision['external']; amount?: number }): boolean {
  const s = st()
  if (s.user().role !== 'pm') {
    s.toastMsg('権限なし（決定は PM）', 'err')
    return false
  }
  const user = s.user()
  let ok = true
  s.commit(`決定: ${kind}`, (p, ws) => {
    const r = p.rows.find((x) => x.id === rowId)
    if (!r) return
    const c = pmCaseOf(p, r)
    if (!pmOptions(c).some((o) => o.kind === kind)) {
      ok = false
      return `この行（${c}）では「${kind}」は選べません`
    }
    if (needsExternalApproval(p, r) && (kind === '受入' || kind === '承認') && !extra?.external?.approver) {
      ok = false
      return '上長決裁の条件に該当します。承認者・日付・決裁書 No. を入力してください'
    }
    const d = pushDecision(p, user, kind, reason, rowId, { external: extra?.external, payload: extra?.amount != null ? { amount: extra.amount } : undefined })
    const scores = scoreRow(p, r, ws.suppliers)
    switch (kind) {
      case '承認':
        if (c === '変更セット') {
          const sub = p.submissions.find((sb) => sb.rowIds.includes(rowId) && sb.changeSet && !sb.changeSet.approved)
          if (sub) {
            sub.changeSet!.approved = true
            sub.changeSet!.decisionId = d.id
            for (const id of sub.rowIds) {
              const rr = p.rows.find((x) => x.id === id)!
              rr.flags.pmPending = false
              rr.flags.pmReason = undefined
            }
          }
        } else {
          r.flags.pmPending = false
          r.flags.pmReason = undefined
          if (r.status === 'quoted' || r.status === 'quoting') setStatus(r, 'selected')
        }
        break
      case '却下':
        if (c === '変更セット') {
          const sub = p.submissions.find((sb) => sb.rowIds.includes(rowId) && sb.changeSet && !sb.changeSet.approved)
          if (sub) {
            sub.changeSet!.rejected = true
            sub.revoked = true
            for (const id of sub.rowIds) {
              const rr = p.rows.find((x) => x.id === id)!
              const snap = sub.snapshot[id]
              const prev = [...p.submissions].reverse().find((sb) => sb.rev < sub.rev && sb.snapshot[id])?.snapshot[id]
              if (snap && prev) {
                // 公開を取り消し、公開値を作業中に戻す
                const w: Record<string, unknown> = {}
                const sn = snap as unknown as Record<string, unknown>
              const pv = prev as unknown as Record<string, unknown>
              for (const k of Object.keys(sn)) if (k !== 'status' && JSON.stringify(sn[k]) !== JSON.stringify(pv[k])) w[k] = sn[k]
                Object.assign(rr, prev, { status: rr.status })
                rr.working = Object.keys(w).length ? w : undefined
                rr.publishedRev = sub.rev - 1
              }
              rr.flags.pmPending = false
              rr.flags.pmReason = undefined
              rr.flags.requote = false
            }
          }
        } else if (c === '閾値超') {
          r.flags.pmPending = false
          r.flags.pmReason = undefined
        } else {
          r.flags.pmPending = false
          r.flags.pmReason = undefined
          r.flags.ltbPending = false
          r.adoptedSupplierId = undefined
          r.adoptReason = undefined
          r.scoreSnapshot = undefined
          if (r.status === 'selected') setStatus(r, 'quoted')
        }
        break
      case '先行発注許可':
        r.flags.early = true
        r.flags.ltbPending = false
        r.flags.pmPending = false
        r.flags.pmReason = undefined
        if (r.adoptedSupplierId && (r.status === 'quoted' || r.status === 'quoting')) setStatus(r, 'selected')
        break
      case '受入':
        if (c === '差分超過') r.flags.formalDiff = false
        if (c === '納期NG') {
          r.flags.countermeasure = '受入'
          r.flags.leadNG = false
        }
        break
      case '次点商社へ': {
        const next = scores.find((x) => x.supplierId !== r.adoptedSupplierId)
        if (!next) {
          ok = false
          return '次点の有効な見積がありません（期限切れなら再見積を依頼）'
        }
        r.adoptedSupplierId = next.supplierId
        r.adoptReason = `次点へ（${kind}）`
        r.scoreSnapshot = next.total
        r.flags.formalDiff = false
        r.flags.pmPending = false
        r.flags.pmReason = undefined
        r.flags.leadNG = false
        if (c === '納期NG') r.flags.countermeasure = '商社変更'
        setStatus(r, 'selected')
        p.requestRevs[next.supplierId] = (p.requestRevs[next.supplierId] ?? 0) + 1
        break
      }
      case '再交渉':
        r.flags.formalDiff = false
        setStatus(r, 'formalRequested')
        r.dueAt = addDays(todayStr(), 7)
        break
      case '設計へ代替依頼':
        r.flags.formalDiff = false
        r.flags.pmPending = false
        if (c === '納期NG') {
          r.flags.countermeasure = '代替品検討'
          r.flags.leadNG = false
        }
        p.issues.push({ id: 'I-' + String(p.nextIssueNo++).padStart(3, '0'), rowId, field: 'model', kind: c === '納期NG' ? '納期NG' : 'コスト超過', text: reason || (c === '納期NG' ? '納期NG: 代替品を検討してください' : '正式見積が概算を超過。安価な代替を検討してください'), by: user, at: d.at, status: 'open', replies: [], bounceCount: 0, dueAt: addDays(todayStr(), 2), rev: p.submissions.at(-1)?.rev })
        break
      case '数量見直し依頼':
        r.flags.formalDiff = false
        r.flags.pmPending = false
        p.issues.push({ id: 'I-' + String(p.nextIssueNo++).padStart(3, '0'), rowId, field: 'qtyNeeded', kind: '数量見直し依頼', text: reason || `必要数 ${effective(r).qtyNeeded} を減らせますか（発注数 ${orderQty(r)}）`, by: user, at: d.at, status: 'open', replies: [], bounceCount: 0, dueAt: addDays(todayStr(), 2), rev: p.submissions.at(-1)?.rev })
        break
      case '委譲':
        r.flags.delegated = true
        r.flags.countermeasure = '商社変更'
        r.flags.leadNG = false
        r.adoptReason = '納期'
        break
      case '特急・分納':
        r.flags.countermeasure = '分納・特急'
        r.flags.leadNG = false
        break
      case '指摘を支持':
        for (const i of p.issues) if (i.rowId === rowId && i.status === 'open' && i.bounceCount >= 2) i.replies.push({ by: user, at: d.at, text: `PM: 指摘を支持。${reason}` })
        r.flags.pmReason = undefined
        break
      case '回答を支持':
        for (const i of p.issues) if (i.rowId === rowId && i.status === 'open' && i.bounceCount >= 2) {
          i.status = 'confirmed'
          i.resolution = `PM が回答を支持: ${reason}`
        }
        r.flags.pmReason = undefined
        break
      case '再選定':
        r.flags.pmPending = false
        r.flags.pmReason = undefined
        r.adoptedSupplierId = undefined
        r.scoreSnapshot = undefined
        setStatus(r, 'quoted')
        break
      case '現状維持':
        r.flags.pmPending = false
        r.flags.pmReason = undefined
        break
    }
    normalize(p, ws)
  }, { rowId })
  return ok
}

/** 案件レベルの決定（案件設定確定） */
export function confirmSettings(reason = '既定で確定') {
  const s = st()
  if (s.user().role !== 'pm') return s.toastMsg('権限なし（案件設定の確定は PM）', 'err')
  s.commit('案件設定を確定', (p) => {
    p.settings.pmConfirmed = true
    for (const c of p.caseDecisions) if (c.kind === '案件設定確定') c.status = 'done'
    pushDecision(p, s.user(), '案件設定確定', reason)
  })
}

export interface Impact {
  leadNG: Array<{ rowId: string; status: string }>
  recommendChanged: string[]
  fixedNeed: string[]
  reissue: string[]
  totalDelta: number
}

/** 案件設定変更の影響試算 */
export function simulateSettings(p: Project, patch: { dueDate?: string | null; processDays?: number; weights?: ScoreWeights }): Impact {
  const s = st()
  const next = structuredClone(p)
  if (patch.dueDate !== undefined) next.dueDate = patch.dueDate
  if (patch.processDays !== undefined) next.settings.processDays = patch.processDays
  if (patch.weights) next.weights = patch.weights
  const impact: Impact = { leadNG: [], recommendChanged: [], fixedNeed: [], reissue: [], totalDelta: 0 }
  const today = todayStr()
  for (const r of next.rows) {
    if (!isActive(r)) continue
    const e = effective(r)
    if (e.needDateFixed) impact.fixedNeed.push(r.id)
    const need = rowNeedDate(next, r)
    const oldNeed = rowNeedDate(p, r)
    if (r.adoptedSupplierId) {
      const q = next.quotes.find((x) => x.rowId === r.id && x.supplierId === r.adoptedSupplierId && !x.stale)
      const ld = q?.stock === '在庫' ? 0 : (q?.formalLeadDays ?? q?.leadDays)
      if (need && ld != null && ld >= 0 && addDays(today, ld) > need) impact.leadNG.push({ rowId: r.id, status: r.status })
      if (['formalRequested', 'formalQuoted'].includes(r.status) && need !== oldNeed) impact.reissue.push(r.id)
      const before = scoreRow(p, r, s.ws.suppliers)[0]
      const after = scoreRow(next, r, s.ws.suppliers)[0]
      if (before && after && before.supplierId !== after.supplierId) impact.recommendChanged.push(r.id)
    }
  }
  return impact
}

export function applySettings(patch: Partial<Project['settings']> & { dueDate?: string | null; weights?: ScoreWeights; name?: string }, reason: string, opts: { fixedNeed?: 'shift' | 'keep'; proposeReselect?: boolean } = {}) {
  const s = st()
  const role = s.user().role
  const PM_KEYS = ['dueDate', 'budget', 'weights', 'changeNeedsPmApproval', 'externalApprovalAmount', 'externalApprovalBudgetPct', 'pmConfirmed', 'selector']
  const keys = Object.keys(patch)
  const pmOnly = keys.filter((k) => PM_KEYS.includes(k))
  if (pmOnly.length && role !== 'pm') return s.toastMsg(`権限なし（${pmOnly.join('・')} は PM 項目）`, 'err')
  if (keys.some((k) => !PM_KEYS.includes(k)) && role === 'design') return s.toastMsg('権限なし（購買項目は購買、PM 項目は PM）', 'err')
  s.commit('案件設定を変更', (p, ws) => {
    const oldNeed = new Map(p.rows.map((r) => [r.id, rowNeedDate(p, r)]))
    const oldDueBase = p.dueDate ? addDays(p.dueDate, -p.settings.processDays) : null
    const { dueDate, weights, name, ...rest } = patch
    if (dueDate !== undefined) p.dueDate = dueDate
    if (weights) p.weights = weights
    if (name) p.name = name
    Object.assign(p.settings, rest)
    pushDecision(p, s.user(), '案件設定変更', reason, undefined, { payload: patch as Record<string, unknown> })
    const newBase = p.dueDate ? addDays(p.dueDate, -p.settings.processDays) : null
    // 固定必要日の行
    if (oldDueBase && newBase && oldDueBase !== newBase && opts.fixedNeed === 'shift') {
      const delta = (new Date(newBase).getTime() - new Date(oldDueBase).getTime()) / 86400000
      for (const r of p.rows) if (r.needDateFixed) r.needDateFixed = addDays(r.needDateFixed, Math.round(delta))
    }
    for (const r of p.rows) {
      if (!isActive(r)) continue
      const need = rowNeedDate(p, r)
      if (need !== oldNeed.get(r.id) && ['formalRequested', 'formalQuoted'].includes(r.status)) r.flags.reissue = true
      if (opts.proposeReselect && r.adoptedSupplierId && ['selected'].includes(r.status)) {
        const best = scoreRow(p, r, ws.suppliers)[0]
        if (best && best.supplierId !== r.adoptedSupplierId) {
          r.flags.pmPending = true
          r.flags.pmReason = '再選定提案'
        }
      }
    }
    if (dueDate !== undefined || rest.processDays !== undefined) {
      const sub = p.submissions.at(-1)
      if (sub) for (const r of p.rows) if (isActive(r) && rowNeedDate(p, r) !== oldNeed.get(r.id)) {
        if (!sub.rowIds.includes(r.id)) sub.rowIds.push(r.id)
        sub.causes[r.id] = '案件納期変更'
        sub.acked = sub.acked.filter((x) => x !== r.id)
      }
    }
    normalize(p, ws)
  })
}

/** 購買: 先行発注を申請 */
export function requestEarlyOrder(rowId: string, reason: string) {
  const s = st()
  s.commit('先行発注を申請', (p, ws) => {
    const r = p.rows.find((x) => x.id === rowId)
    if (!r) return
    r.flags.ltbPending = true
    r.flags.pmReason = '先行採用'
    r.adoptReason = reason
    normalize(p, ws)
  }, { rowId })
}

export { pushDecision }
