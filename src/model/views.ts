import type { Project, Role, Row, Workspace } from './types'
import { ball, isActive, isOverdue, openIssues } from './derive'
import { checkRow, type Problem } from './rules'
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
    filter: (r, c) => {
      if (!isActive(r)) return false
      const issues = openIssues(c.p, r.id)
      if (c.role === 'purchasing') return issues.some((i) => i.status === 'fixed' || i.status === 'answered' || (i.status === 'open' && i.by.role !== 'purchasing')) || r.flags.reconfirm === true || r.flags.requote === true || isOverdue(c.p, r) || (c.p.issues.some((i) => i.rowId === r.id && i.status === 'draft'))
      return issues.some((i) => i.status === 'open' || i.status === 'answered' && i.by.role === 'design') || (c.problems.get(r.id)?.length ?? 0) > 0 || r.flags.countermeasure === '代替品検討' || r.flags.altPending === true
    },
    defaultSort: (a, b, c) => kindOrder(a, c) - kindOrder(b, c) || a.id.localeCompare(b.id),
  },
  { id: 5, label: '変更あり', columns: ['id', 'ball', 'ref', 'name', 'model', 'maker', 'qtyNeeded', 'unit', 'status'], filter: (r, c) => changedInRev(r, c) },
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

function kindOrder(r: Row, c: ViewCtx): number {
  const i = openIssues(c.p, r.id)[0]
  if (i) return ['型式あいまい', 'メーカ未記入', '廃番', '代替提案', '最小ロット', '納期NG', '質問', 'コスト超過', '発注後変更依頼', 'その他'].indexOf(i.kind)
  const pr = c.problems.get(r.id)?.[0]
  if (pr) return 20 + (pr.severity === 'error' ? 0 : 1)
  return 30
}

export function changedInRev(r: Row, c: ViewCtx): boolean {
  const subs = c.p.submissions
  if (subs.length === 0) return false
  const rev = c.rev ?? subs.at(-1)!.rev
  const sub = subs.find((s) => s.rev === rev)
  if (!sub) return false
  if (sub.acked.includes(r.id)) return false
  return sub.rowIds.includes(r.id)
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
