import { useStore } from '@/model/store'
import type { Decision, DecisionKind, Issue, Project, Row, ScoreWeights, User } from '@/model/types'
import { ISSUE_KINDS } from '@/model/types'
import { nextBest, scoreRow } from '@/model/score'
import { addWithdrawn, capPending, effective, isActive, overCap, orderQty, rowNeedDate, roundedQty, totals } from '@/model/derive'
import { normalize, setStatus } from '@/model/lifecycle'
import { addBusinessDays, addDays, todayStr } from '@/model/dates'
import { applyDesignChange, applyRemoval } from './rows'

function st() {
  return useStore.getState()
}

function pushDecision(p: Project, by: User, kind: DecisionKind, reason: string, rowId?: string, extra?: Partial<Decision>): Decision {
  const d: Decision = { id: 'D-' + String(p.nextDecisionNo++).padStart(3, '0'), rowId, kind, by, at: new Date().toISOString(), reason, ...extra }
  p.decisions.push(d)
  return d
}

/** 要決定の種別（§9.1） */
export type PmCase = '例外選定' | '先行採用' | '変更セット' | '差分超過' | '納期NG' | '差戻し2回目' | '閾値超' | '再選定提案' | '先行発注判断' | '対策不成立' | '発注後変更依頼' | '上限超過' | 'なし'

/** 購買が起票した発注後変更依頼で、PM の判断がまだのもの */
export function openChangeAfterOrder(p: Project, row: Row) {
  return p.issues.find((i) => i.rowId === row.id && i.kind === '発注後変更依頼' && ['open', 'inProgress'].includes(i.status) && !i.pmRuled)
}

export function pmCaseOf(p: Project, row: Row): PmCase {
  const f = row.flags
  if (f.pmPending && f.pmReason === '対策不成立') return '対策不成立'
  if (f.formalDiff) return '差分超過'
  if (f.pmPending) return f.pmReason === '変更セット' ? '変更セット' : f.pmReason === '先行採用' ? '先行採用' : f.pmReason === '閾値超' ? '閾値超' : f.pmReason === '再選定提案' ? '再選定提案' : '例外選定'
  if (f.ltbPending) return '先行発注判断'
  if (openChangeAfterOrder(p, row) && !f.orderCancelApproved) return '発注後変更依頼'
  if (f.leadNG && !f.countermeasure) return '納期NG'
  if (p.issues.some((i) => i.rowId === row.id && i.status === 'open' && i.bounceCount >= 2 && !i.pmRuled)) return '差戻し2回目'
  if (capPending(p, row)) return '上限超過'
  return 'なし'
}

export interface PmOption {
  key: string
  label: string
  kind: DecisionKind
}

/** 種別ごとの決定パネルの選択肢（発注済の行は「次点」「委譲」を出さない） */
export function pmOptions(c: PmCase, row?: Row): PmOption[] {
  const ordered = !!row && (row.status === 'ordered' || row.status === 'received')
  switch (c) {
    case '例外選定':
      return [{ key: 'y', label: '承認 → 選定済', kind: '承認' }, { key: 'Y', label: '却下 → 見積済（選定者へ）', kind: '却下' }, { key: 'b', label: '次点へ（必要日を満たす最高スコア）', kind: '次点商社へ' }]
    case '先行採用':
      return [{ key: 'y', label: '先行発注を許可（選んだ商社のまま選定済）', kind: '先行発注許可' }, { key: 'Y', label: '却下 → 元の状態', kind: '却下' }]
    case '発注後変更依頼':
      return [{ key: 'y', label: '承認 → 購買が発注を取り消し、設計が Alt+r で置き換える', kind: '承認' }, { key: 'Y', label: '却下 → 元の発注のまま受入', kind: '却下' }]
    case '先行発注判断':
      return [{ key: 'y', label: '先行発注を許可（推奨商社で選定済）', kind: '先行発注許可' }, { key: 'Y', label: '却下 → 正式見積を待つ', kind: '却下' }]
    case '変更セット':
      {
        // 変更セットは Rev ごとにまとめて決める（この行だけではない）
        const n = row ? st().project().rows.filter((x) => x.pendingRev === row.pendingRev && x.flags.pmPending && x.flags.pmReason === '変更セット').length : 0
        const scope = row?.pendingRev != null ? `Rev.${row.pendingRev} の変更セット ${n} 行まとめて` : '変更セットまとめて'
        return [{ key: 'y', label: `承認 → ${scope}公開値に反映`, kind: '承認' }, { key: 'Y', label: `却下 → ${scope}設計の作業中に戻す`, kind: '却下' }]
      }
    case '差分超過':
      if (ordered) return [{ key: 'y', label: '受入', kind: '受入' }, { key: 'd', label: '設計へ代替依頼（コスト超過を起票）', kind: '設計へ代替依頼' }]
      return [{ key: 'y', label: '受入 → 正式見積済', kind: '受入' }, { key: 'b', label: '次点商社へ', kind: '次点商社へ' }, { key: 'g', label: '再交渉（購買へ）', kind: '再交渉' }, { key: 'd', label: '設計へ代替依頼（コスト超過を起票）', kind: '設計へ代替依頼' }, { key: 'q', label: '数量見直し依頼（設計へ）', kind: '数量見直し依頼' }]
    case '納期NG':
      if (ordered) return [{ key: 'Y', label: '受入（遅延許容）', kind: '受入' }, { key: 'e', label: '特急・分納・納期短縮交渉（購買）', kind: '特急・分納' }, { key: 'd', label: '設計が代替品検討', kind: '設計へ代替依頼' }]
      return [{ key: 'Y', label: '受入（遅延許容）', kind: '受入' }, { key: 'b', label: '次点へ（必要日を満たす商社）', kind: '次点商社へ' }, { key: 'p', label: '購買が再選定（委譲）', kind: '委譲' }, { key: 'd', label: '設計が代替品検討', kind: '設計へ代替依頼' }, { key: 'e', label: '特急・分納（上限入力）', kind: '特急・分納' }]
    case '対策不成立':
      if (ordered) return [{ key: 'Y', label: '受入（遅延・価格を受け入れる）', kind: '受入' }, { key: 'e', label: '特急・分納・納期短縮交渉（購買）', kind: '特急・分納' }]
      {
        // 再交渉は正式見積の単価についてのもの（正式依頼の前の行には出さない）
        const formal = !!row && (row.status === 'formalRequested' || row.status === 'formalQuoted')
        return [{ key: 'Y', label: '受入（遅延・価格を受け入れる）', kind: '受入' }, { key: 'b', label: '次点へ', kind: '次点商社へ' }, ...(formal ? [{ key: 'g', label: '再交渉（購買へ）', kind: '再交渉' as const }] : []), { key: 'e', label: '特急・分納（上限入力）', kind: '特急・分納' }]
      }
    case '差戻し2回目':
      return [{ key: 'y', label: '購買の指摘を支持 → 設計へ', kind: '指摘を支持' }, { key: 'Y', label: '設計の回答を支持 → 確認済', kind: '回答を支持' }]
    case '閾値超':
      return [{ key: 'y', label: '承認（余剰 / 価格差を受入）', kind: '承認' }, { key: 'Y', label: '却下 → 起票者に戻す', kind: '却下' }, { key: 'q', label: '数量見直し依頼', kind: '数量見直し依頼' }, { key: 'd', label: '設計へ代替依頼', kind: '設計へ代替依頼' }]
    case '上限超過': {
      const oc = row ? overCap(st().project(), row) : null
      const amt = row?.extraCost != null ? `¥${row.extraCost.toLocaleString()}` : '実費'
      return [{ key: 'y', label: `追加費用 ${amt} を承認（上限${oc ? ` ¥${oc.cap.toLocaleString()}` : ''}を実費まで引き上げ）`, kind: '承認' }, { key: 'Y', label: '却下 → 購買が上限内で手配し直す', kind: '却下' }]
    }
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

function formalKey(p: Project, r: Row): string | undefined {
  const q = r.adoptedSupplierId ? p.quotes.find((x) => x.rowId === r.id && x.supplierId === r.adoptedSupplierId && !x.stale) : undefined
  return q?.formalPrice != null ? `${q.supplierId}:${q.formalPrice}` : undefined
}

function newIssue(p: Project, rowId: string, kind: Issue['kind'], field: string, text: string, by: User, at: string): Issue {
  const i: Issue = { id: 'I-' + String(p.nextIssueNo++).padStart(3, '0'), rowId, field: field as keyof Row, kind, text, by, at, status: 'open', replies: [], bounceCount: 0, dueAt: addBusinessDays(todayStr(), ISSUE_KINDS.find((k) => k.kind === kind)?.dueDays ?? 2, p.settings.holidays), rev: p.submissions.at(-1)?.rev }
  p.issues.push(i)
  return i
}

/** PM の決定を適用。うまくいかなければ理由を返す（ダイアログは閉じない） */
export function decide(rowId: string, kind: DecisionKind, reason: string, extra?: { external?: Decision['external']; amount?: number }): string | null {
  const s = st()
  if (s.user().role !== 'pm') return '権限なし（決定は PM）'
  const user = s.user()
  let err: string | null = null
  const ok = s.commit(
    `決定: ${kind}`,
    (p, ws) => {
      const r = p.rows.find((x) => x.id === rowId)
      if (!r) return (err = '行がありません')
      const c = pmCaseOf(p, r)
      if (!pmOptions(c, r).some((o) => o.kind === kind)) return (err = `この行（${c}）では「${kind}」は選べません`)
      if (needsExternalApproval(p, r) && (kind === '受入' || kind === '承認') && !extra?.external?.approver?.trim()) return (err = '上長決裁の条件に該当します。承認者・日付・決裁書 No. を入力してください')
      const d = pushDecision(p, user, kind, reason, rowId, { external: extra?.external, payload: extra?.amount != null ? { amount: extra.amount } : undefined })
      const today = todayStr()
      // 対策不成立への決定で、もとになった PM の依頼（コスト超過・数量見直し・納期NG の指摘）は決着（§16）
      if (c === '対策不成立')
        for (const i of p.issues)
          if (i.rowId === r.id && i.by.role === 'pm' && (i.kind === 'コスト超過' || i.kind === '数量見直し依頼' || i.kind === '納期NG') && ['open', 'inProgress', 'answered'].includes(i.status)) {
            i.status = 'confirmed'
            i.resolution = `PM の決定: ${kind}`
          }
      switch (kind) {
        case '承認':
          if (c === '上限超過') {
            d.payload = { ...(d.payload ?? {}), amount: r.extraCost ?? 0, cap: true }
            r.flags.capRuled = undefined
            break
          }
          if (c === '発注後変更依頼') {
            const i = openChangeAfterOrder(p, r)!
            i.pmRuled = true
            i.status = 'inProgress'
            i.resolution = 'PM 承認: 発注取消・代替品へ'
            r.flags.orderCancelApproved = true
            // もとになった PM の依頼（納期NG・コスト超過の代替品検討）は、この承認で決着
            for (const o of p.issues)
              if (o.rowId === r.id && o.by.role === 'pm' && (o.kind === '納期NG' || o.kind === 'コスト超過' || o.kind === '数量見直し依頼') && ['open', 'inProgress', 'answered'].includes(o.status)) {
                o.status = 'confirmed'
                o.resolution = 'PM の決定: 発注後変更依頼を承認（代替品へ）'
              }
            break
          }
          if (c === '変更セット') {
            const rev = r.pendingRev
            const sub = p.submissions.find((sb) => sb.rev === rev)
            if (sub?.changeSet) {
              sub.changeSet.approved = true
              sub.changeSet.decisionId = d.id
            }
            // 同じ変更セットの行をまとめて反映
            for (const rr of p.rows.filter((x) => x.pendingRev === rev && x.flags.pmPending && x.flags.pmReason === '変更セット')) {
              rr.flags.pmPending = false
              rr.flags.pmReason = undefined
              if (rr.pendingApproval) {
                const v = rr.pendingApproval
                const pre = { ...rr } as unknown as Record<string, unknown>
                rr.pendingApproval = undefined
                applyDesignChange(p, rr, v, [], sub?.summary)
                // 承認待ちのあいだに出した後の Rev（指摘対応など）のスナップショットは承認前の値。承認した値に直す（変更点・差分で戻したように見せない）
                for (const later of p.submissions.filter((sb) => rev != null && sb.rev > rev && sb.snapshot[rr.id])) {
                  const snap = later.snapshot[rr.id] as unknown as Record<string, unknown>
                  for (const [k, nv] of Object.entries(v)) if (JSON.stringify(snap[k]) === JSON.stringify(pre[k])) snap[k] = nv
                }
              }
              if (rr.pendingRemoval) applyRemoval(p, rr, rr.pendingRemoval, sub)
              rr.pendingRev = undefined
            }
          } else {
            // 最小ロットの閾値超を承認したら、その指摘は決着（余剰を受け入れる。発注数は丸めた数）
            if (c === '閾値超') r.flags.surplusRejected = undefined
            if (c === '閾値超')
              for (const i of p.issues.filter((x) => x.rowId === r.id && x.kind === '最小ロット' && ['open', 'inProgress', 'fixed'].includes(x.status))) {
                i.status = 'confirmed'
                i.resolution = 'PM の決定: 余剰を受け入れる（発注数は丸めた数）'
              }
            r.flags.pmPending = false
            r.flags.pmReason = undefined
            // 採用のある判断（例外選定・先行採用など）だけ選定済に。最小ロットの閾値超など採用の無い行は、選定者が選ぶまで今の状態
            if ((r.status === 'quoted' || r.status === 'quoting') && r.adoptedSupplierId) setStatus(r, 'selected')
          }
          break
        case '却下':
          if (c === '上限超過') {
            r.flags.capRuled = r.extraCost ?? undefined
            break
          }
          if (c === '発注後変更依頼') {
            const i = openChangeAfterOrder(p, r)!
            i.pmRuled = true
            i.status = 'wontfix'
            i.resolution = 'PM 却下: 元の発注のまま受入'
            r.flags.countermeasure = '受入'
            r.flags.leadNG = false
            break
          }
          if (c === '変更セット') {
            const rev = r.pendingRev
            const sub = p.submissions.find((sb) => sb.rev === rev)
            if (sub?.changeSet) sub.changeSet.rejected = true
            if (sub) sub.revoked = true
            for (const rr of p.rows.filter((x) => x.pendingRev === rev && x.flags.pmPending && x.flags.pmReason === '変更セット')) {
              rr.flags.pmPending = false
              rr.flags.pmReason = undefined
              if (rr.pendingRemoval) {
                // 取消・置換も公開値はそのまま。設計の作業中に戻す
                rr.removal = rr.pendingRemoval
                rr.pendingRemoval = undefined
              }
              if (rr.pendingApproval) {
                // 公開値はそのまま。変更は設計の作業中に戻す（見積は失わない）
                rr.working = { ...rr.pendingApproval, ...(rr.working ?? {}) }
                rr.pendingApproval = undefined
              } else if (rr.publishedRev === rev && !p.submissions.some((sb) => sb.rev < (rev ?? 0) && sb.rowIds.includes(rr.id)) && !['ordered', 'received'].includes(rr.status)) {
                // この変更セットで足した行（客先指定品などで自動で選定済になった行も）は下書きに戻す
                rr.adoptedSupplierId = undefined
                rr.scoreSnapshot = undefined
                // 承認待ちだった追加行は下書きに戻す
                setStatus(rr, 'draft')
                rr.publishedRev = undefined
              }
              rr.pendingRev = undefined
            }
          } else if (c === '閾値超') {
            r.flags.pmPending = false
            r.flags.pmReason = undefined
            // 余剰を受け入れないので、先に丸めた発注数は必要数に戻し、最小ロットの指摘は購買に戻す（ほかの商社・数量で手配し直す）。
            // 却下を覚えて、同じ商社のまま発注数を丸め直せないようにする
            r.flags.surplusRejected = r.adoptedSupplierId ?? '-'
            if (r.orderQty != null && r.orderQty > r.qtyNeeded && !r.ordered) {
              r.orderQty = r.qtyNeeded
              r.flags.orderQtyCheck = true
            }
            for (const i of p.issues.filter((x) => x.rowId === r.id && x.kind === '最小ロット' && x.status === 'fixed')) {
              i.status = 'open'
              i.resolution = 'PM の決定: 余剰は受け入れない（発注数を戻した）'
            }
          } else if (c === '先行発注判断') {
            r.flags.ltbPending = false
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
        case '先行発注許可': {
          // 申請の理由・金額を決定の記録に残す
          if (r.ltbRequest) {
            d.payload = { ...(d.payload ?? {}), amount: r.ltbRequest.amount, request: r.ltbRequest.reason }
            if (!d.reason) d.reason = `申請: ${r.ltbRequest.reason}`
          }
          if (r.flags.requote) return (err = '型式・数量の変更で見積が失効しています（再見積要）。見積を取り直してから判断してください')
          const adoptedValid = r.adoptedSupplierId && p.quotes.some((x) => x.rowId === r.id && x.supplierId === r.adoptedSupplierId && !x.stale && x.unitPrice != null)
          if (r.adoptedSupplierId && !adoptedValid) r.adoptedSupplierId = undefined
          if (!r.adoptedSupplierId) {
            const best = scoreRow(p, r, ws.suppliers)[0]
            if (!best) return (err = '有効な見積がありません（推奨商社を決められません）')
            r.adoptedSupplierId = best.supplierId
            r.scoreSnapshot = best.total
            r.adoptReason = '先行発注（推奨）'
            r.orderQty = roundedQty(r.qtyNeeded, best.quote.moq, r.packQty, r.unit)
          }
          r.flags.early = true
          r.flags.ltbPending = false
          r.flags.pmPending = false
          r.flags.pmReason = undefined
          if (r.status === 'quoted' || r.status === 'quoting') setStatus(r, 'selected')
          break
        }
        case '受入':
          if (c === '差分超過' || r.flags.formalDiff) {
            r.flags.formalDiffKey = formalKey(p, r)
            r.flags.formalDiff = false
          }
          if (c === '納期NG' || r.flags.leadNG || c === '対策不成立') {
            r.flags.countermeasure = '受入'
            r.flags.leadNG = false
          }
          if (c === '対策不成立') {
            r.flags.pmPending = false
            r.flags.pmReason = undefined
            r.flags.formalDiffKey = formalKey(p, r) ?? r.flags.formalDiffKey
          }
          break
        case '次点商社へ': {
          const next = nextBest(p, r, ws.suppliers)
          if (!next) return (err = '必要日を満たす次点の商社がありません（有効期限切れなら再見積を依頼。受入・特急・代替依頼から選んでください）')
          const from = r.adoptedSupplierId
          // 前の商社への正式依頼は取り下げる（購買に知らせる）。前の正式回答も外す
          const fq = from ? p.quotes.find((x) => x.rowId === r.id && x.supplierId === from && !x.stale) : undefined
          if (fq) {
            if (fq.formalRequestNo && ['formalRequested', 'formalQuoted'].includes(r.status)) r.flags.formalWithdrawn = addWithdrawn(r.flags.formalWithdrawn, `${ws.suppliers.find((x) => x.id === fq.supplierId)?.name ?? fq.supplierId} ${fq.formalRequestNo}`)
            fq.formalPrice = null
            fq.formalLeadDays = null
            fq.formalValidUntil = null
            fq.formalRequestNo = undefined
          }
          r.adoptedSupplierId = next.supplierId
          r.adoptReason = `次点へ（${c}）`
          r.scoreSnapshot = next.total
          r.orderQty = roundedQty(r.qtyNeeded, next.quote.moq, r.packQty, r.unit)
          r.flags.formalDiff = false
          r.flags.formalDiffKey = undefined
          r.flags.pmPending = false
          r.flags.pmReason = undefined
          r.flags.leadNG = false
          if (c === '納期NG' || c === '対策不成立') r.flags.countermeasure = '商社変更'
          if (['formalRequested', 'formalQuoted'].includes(r.status) || from) setStatus(r, 'selected')
          break
        }
        case '再交渉': {
          const q = r.adoptedSupplierId ? p.quotes.find((x) => x.rowId === r.id && x.supplierId === r.adoptedSupplierId && !x.stale) : undefined
          if (q) {
            q.prevFormalPrice = q.formalPrice
            q.formalPrice = null
          }
          r.flags.formalDiff = false
          r.flags.formalDiffKey = undefined
          r.flags.pmPending = false
          r.flags.pmReason = undefined
          // 再交渉は遅れ・価格を受け入れたのではない。対策区分を外し、交渉の結果で納期NG・差分超過を判定し直す（PM に戻る）
          r.flags.countermeasure = undefined
          r.flags.renegotiating = true
          setStatus(r, 'formalRequested')
          r.dueAt = addBusinessDays(today, 5, p.settings.holidays)
          break
        }
        case '設計へ代替依頼': {
          const lead = c === '納期NG' || (c === '対策不成立' && r.flags.countermeasure === '代替品検討')
          r.flags.formalDiffKey = formalKey(p, r) ?? r.flags.formalDiffKey
          r.flags.formalDiff = false
          r.flags.pmPending = false
          r.flags.pmReason = undefined
          if (lead) {
            r.flags.countermeasure = '代替品検討'
            r.flags.leadNG = false
          }
          newIssue(p, rowId, lead ? '納期NG' : 'コスト超過', 'model', reason || (lead ? '納期NG: 必要日に間に合う代替品を検討してください' : '正式見積が概算を超過。安価な代替を検討してください'), user, d.at)
          break
        }
        case '数量見直し依頼':
          r.flags.formalDiffKey = formalKey(p, r) ?? r.flags.formalDiffKey
          r.flags.formalDiff = false
          r.flags.pmPending = false
          r.flags.pmReason = undefined
          newIssue(p, rowId, '数量見直し依頼', 'qtyNeeded', reason || `必要数 ${r.qtyNeeded} を減らせますか（発注数 ${orderQty(r)}）`, user, d.at)
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
          r.flags.pmPending = false
          r.flags.pmReason = undefined
          break
        case '指摘を支持':
          for (const i of p.issues)
            if (i.rowId === rowId && i.status === 'open' && i.bounceCount >= 2) {
              i.replies.push({ by: user, at: d.at, text: `PM: 指摘を支持。${reason}` })
              i.pmRuled = true
            }
          r.flags.pmReason = undefined
          break
        case '回答を支持':
          for (const i of p.issues)
            if (i.rowId === rowId && i.status === 'open' && i.bounceCount >= 2) {
              i.status = 'confirmed'
              i.pmRuled = true
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
    },
    { rowId, quietError: true },
  )
  return ok ? null : (err ?? '決定できませんでした')
}

/** 案件レベルの決定（案件設定確定） */
export function confirmSettings(reason = '既定で確定') {
  const s = st()
  if (s.user().role !== 'pm') return s.toastMsg('権限なし（案件設定の確定は PM）', 'err')
  if (s.project().settings.pmConfirmed) return s.toastMsg('案件設定はもう確定しています（変えるときは Ctrl+K →「案件設定」）', 'info')
  s.commit('案件設定を確定', (p) => {
    p.settings.pmConfirmed = true
    for (const c of p.caseDecisions) if (c.kind === '案件設定確定') c.status = 'done'
    pushDecision(p, s.user(), '案件設定確定', reason)
  })
  s.toastMsg('案件設定を確定しました（購買・設計に伝わります）', 'ok')
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
      // 承認待ち・却下の変更セットの Rev には書かない（却下で起因が消える・購買の変更点に出ないため）。決まった最後の Rev に
      const sub = [...p.submissions].reverse().find((x) => !x.revoked && !(x.changeSet && (!x.changeSet.approved || x.changeSet.rejected)))
      if (sub) for (const r of p.rows) if (isActive(r) && rowNeedDate(p, r) !== oldNeed.get(r.id)) {
        if (!sub.rowIds.includes(r.id)) sub.rowIds.push(r.id)
        sub.causes[r.id] = '案件納期変更'
        sub.acked = sub.acked.filter((x) => x !== r.id && !x.startsWith(r.id + '@'))
      }
    }
    normalize(p, ws)
  })
}

/** 購買: 先行発注を申請 */
export function requestEarlyOrder(rowId: string, reason: string, amount: number | null = null) {
  const s = st()
  s.commit('先行発注を申請', (p, ws) => {
    const r = p.rows.find((x) => x.id === rowId)
    if (!r) return
    if (r.flags.ltbPending) return `${rowId} はもう PM の判断待ちです`
    r.flags.ltbPending = true
    // 設計の採用理由は変えず、申請は別に残す（PM の決定パネル・決定の記録に出す）
    r.ltbRequest = { reason, amount, by: s.user().name, at: new Date().toISOString() }
    normalize(p, ws)
  }, { rowId })
}

export { pushDecision }
