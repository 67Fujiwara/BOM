import type { Project, Role, Row, Workspace } from './types'
import { ball, isActive, isOverdue, openIssues, resolverOfIssue } from './derive'
import { checkRow, type Problem } from './rules'
import { todayStr } from './dates'
import type { ViewId } from './store'

export interface ViewDef {
  id: ViewId
  label: string
  /** 既定の列（undefined は全列） */
  columns?: string[]
  filter: (row: Row, ctx: ViewCtx) => boolean
  /** 既定の並び */
  defaultSort?: (a: Row, b: Row, ctx: ViewCtx) => number
  roles?: Role[]
}

export interface ViewCtx {
  ws: Workspace
  p: Project
  problems: Map<string, Problem[]>
  role: Role
  rev: number | null
}

const DESIGN_COLS = ['id', 'ball', 'ref', 'category', 'name', 'model', 'maker', 'qtyNeeded', 'unit', 'procurement', 'altPolicy', 'needDate', 'note', 'status']

export const VIEWS: ViewDef[] = [
  { id: 1, label: 'すべて', filter: () => true },
  { id: 2, label: '購買提出用', columns: [...DESIGN_COLS, 'due'], filter: (r) => isActive(r) && !r.hidden },
  { id: 3, label: '発注・入荷', columns: ['id', 'ball', 'name', 'model', 'maker', 'orderQty', 'unit', 'adopted', 'unitPrice', 'amount', 'lead', 'ordered', 'received', 'promisedDate', 'receivedLot', 'status'], filter: (r) => isActive(r) && ['selected', 'formalRequested', 'formalQuoted', 'ordered', 'received'].includes(r.status) },
  {
    id: 4,
    label: '要確認',
    columns: ['id', 'ball', 'ref', 'name', 'model', 'maker', 'qtyNeeded', 'unit', 'altPolicy', 'status', 'due', 'waiting'],
    // §11: 役割ごと。自分がボールを持つ行（指摘・選定待ち・拮抗・代替承認待ち・要再確認など）＋設計はチェックNG
    filter: (r, c) => {
      if (!isActive(r)) return false
      const b = ball(c.p, r)
      if (c.role === 'design') return b === 'design' || (c.problems.get(r.id)?.length ?? 0) > 0 || r.flags.contested === true
      if (c.role === 'purchasing' && purchasingAttention(r, c)) return true
      if (c.role === 'purchasing') return b === 'purchasing' && (r.flags.reconfirm === true || r.flags.requote === true || r.flags.notation === true || r.flags.orderQtyCheck === true || r.flags.importMismatch != null || isOverdue(c.p, r) || openIssues(c.p, r.id).some((i) => i.status === 'fixed' || i.status === 'answered' || ((i.status === 'open' || i.status === 'inProgress') && resolverOfIssue(i) === 'purchasing'))) || c.p.issues.some((i) => i.rowId === r.id && i.status === 'draft' && i.by.name === c.ws.user.name)
      return b === 'pm'
    },
    defaultSort: (a, b, c) => kindOrder(a, c) - kindOrder(b, c) || a.id.localeCompare(b.id),
  },
  { id: 5, label: '変更あり', columns: ['id', 'ball', 'cause', 'ref', 'name', 'model', 'maker', 'qtyNeeded', 'unit', 'status'], filter: (r, c) => changedInRev(r, c) },
  { id: 6, label: '商社別', columns: ['id', 'name', 'model', 'maker', 'qtyNeeded', 'unit', 'status'], filter: (r) => isActive(r) && r.status !== 'draft' },
  {
    id: 7,
    label: '要決定',
    columns: ['id', 'ball', 'name', 'model', 'maker', 'qtyNeeded', 'adopted', 'score', 'unitPrice', 'formalPrice', 'formalDiff', 'lead', 'status', 'due', 'waiting'],
    filter: (r, c) => isActive(r) && (ball(c.p, r) === 'pm' || r.flags.leadNG === true || r.flags.pmPending === true || r.flags.formalDiff === true),
  },
  { id: 8, label: '正式見積', columns: ['id', 'name', 'model', 'maker', 'orderQty', 'adopted', 'unitPrice', 'formalPrice', 'formalDiff', 'lead', 'status', 'due'], filter: (r) => isActive(r) && ['selected', 'formalRequested', 'formalQuoted', 'ordered', 'received'].includes(r.status) },
  { id: 9, label: '購買作業', columns: ['id', 'ball', 'name', 'model', 'maker', 'qtyNeeded', 'unit', 'packQty', 'procurement', 'makerLock', 'altPolicy', 'needDate', 'orderQty', 'status', 'due', 'waiting'], filter: (r) => isActive(r) && (['submitted', 'quoting', 'quoted'].includes(r.status) || r.flags.requote === true) },
]

/** 購買の 4（§11）: ボールに関係なく、見積の期限切れ・未回答（回答が揃っていない見積中）を出す */
function purchasingAttention(r: Row, c: ViewCtx): boolean {
  if (!['quoting', 'quoted', 'selected', 'formalRequested'].includes(r.status)) return false
  const today = todayStr()
  const qs = c.p.quotes.filter((q) => q.rowId === r.id && !q.stale)
  // 採用済みなら採用商社の見積だけ、未採用ならどの商社の見積でも
  const expired = qs.some((q) => q.unitPrice != null && q.validUntil != null && q.validUntil < today && (!r.adoptedSupplierId || q.supplierId === r.adoptedSupplierId))
  if (expired) return true
  if (r.status !== 'quoting') return false
  const answered = qs.filter((q) => q.unitPrice != null || q.leadDays != null).length
  const deadlinePassed = !!c.p.settings.quoteDeadline && c.p.settings.quoteDeadline < today
  return answered < qs.length && (answered > 0 || deadlinePassed)
}

function kindOrder(r: Row, c: ViewCtx): number {
  const i = openIssues(c.p, r.id)[0]
  if (i) return ['型式あいまい', 'メーカ未記入', '廃番', '代替提案', '最小ロット', '納期NG', '質問', 'コスト超過', '発注後変更依頼', 'その他'].indexOf(i.kind)
  const pr = c.problems.get(r.id)?.[0]
  if (pr) return 20 + (pr.severity === 'error' ? 0 : 1)
  return 30
}

/** その役割が差分を確認済か（確認は役割ごと。§5「自分が未確認の差分」。印の無い古い確認は全員の確認として扱う） */
export function isAcked(sub: { acked: string[] }, rowId: string, role: string): boolean {
  return sub.acked.includes(rowId) || sub.acked.includes(`${rowId}@${role}`)
}

/** 5 変更あり: 既定は Rev をまたいで未確認の差分すべて。Rev を選んだらその Rev だけ（§5） */
export function changedInRev(r: Row, c: ViewCtx): boolean {
  const subs = c.p.submissions.filter((s) => !s.revoked)
  if (c.rev != null) {
    const sub = subs.find((s) => s.rev === c.rev)
    return !!sub && sub.rowIds.includes(r.id)
  }
  return subs.some((s) => s.rowIds.includes(r.id) && !isAcked(s, r.id, c.role))
}

/** 行の最新の起因（指摘 ID / 変更セット / 追加 / 取消 / 案件納期変更） */
export function causeOf(r: Row, c: ViewCtx): string {
  const subs = c.p.submissions.filter((s) => !s.revoked && s.rowIds.includes(r.id) && (c.rev == null ? !isAcked(s, r.id, c.role) : s.rev === c.rev))
  const sub = subs.at(-1)
  return sub ? `Rev.${sub.rev} ${sub.causes[r.id] ?? ''}`.trim() : ''
}

export function viewDef(id: ViewId): ViewDef {
  return VIEWS.find((v) => v.id === id)!
}

export function buildProblems(ws: Workspace, p: Project): Map<string, Problem[]> {
  const m = new Map<string, Problem[]>()
  for (const r of p.rows) {
    const ps = checkRow(r, ws.rules, p)
    if (ps.length) m.set(r.id, ps)
  }
  return m
}
