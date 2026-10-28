import { useStore } from '@/model/store'
import type { Project, ScoreWeights } from '@/model/types'
import { scoreRow } from '@/model/score'
import { effective, isActive, rowNeedDate } from '@/model/derive'
import { normalize } from '@/model/lifecycle'
import { addDays, todayStr } from '@/model/dates'

function st() {
  return useStore.getState()
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
      const ld = q?.formalLeadDays ?? (q?.stock === '在庫' ? 0 : q?.leadDays)
      if (need && ld != null && ld >= 0 && addDays(today, ld) > need) impact.leadNG.push({ rowId: r.id, status: r.status })
      if (['formalRequested', 'formalQuoted'].includes(r.status) && need !== oldNeed) impact.reissue.push(r.id)
      const before = scoreRow(p, r, s.ws.suppliers)[0]
      const afterScores = scoreRow(next, r, s.ws.suppliers)
      const after = afterScores[0]
      if (before && after && before.supplierId !== after.supplierId) {
        impact.recommendChanged.push(r.id)
        const cur = afterScores.find((x) => x.supplierId === r.adoptedSupplierId)
        if (cur) impact.totalDelta += (after.effectivePrice - cur.effectivePrice) * r.qtyNeeded
      }
    }
  }
  return impact
}

/** 案件設定を保存する（納期・予算・重み・購買項目）。納期や工程日数が変わると、正式依頼中の行は再発行の対象になる */
export function applySettings(patch: Partial<Project['settings']> & { dueDate?: string | null; weights?: ScoreWeights; name?: string }, opts: { fixedNeed?: 'shift' | 'keep' } = {}) {
  const s = st()
  s.commit('案件設定を変更', (p, ws) => {
    const oldNeed = new Map(p.rows.map((r) => [r.id, rowNeedDate(p, r)]))
    const oldDueBase = p.dueDate ? addDays(p.dueDate, -p.settings.processDays) : null
    const { dueDate, weights, name, ...rest } = patch
    if (dueDate !== undefined) p.dueDate = dueDate
    if (weights) p.weights = weights
    if (name) p.name = name
    Object.assign(p.settings, rest)
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
    }
    if (dueDate !== undefined || rest.processDays !== undefined) {
      const sub = [...p.submissions].reverse().find((x) => !x.revoked)
      if (sub)
        for (const r of p.rows)
          if (isActive(r) && rowNeedDate(p, r) !== oldNeed.get(r.id)) {
            if (!sub.rowIds.includes(r.id)) sub.rowIds.push(r.id)
            sub.causes[r.id] = '案件納期変更'
            sub.acked = sub.acked.filter((x) => x !== r.id && !x.startsWith(r.id + '@'))
          }
    }
    normalize(p, ws)
  })
}
