import type { Project, Role, Row, Workspace } from './types'
import { designatedDeclined, isActive, openIssues, resolverOfIssue, valuesFor } from './derive'
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

/** 在庫から使う行（調達区分が社内在庫）。設計が直した値（作業中）もすぐ見る */
function isStockRow(r: Row, c: ViewCtx): boolean {
  return isActive(r) && valuesFor(r, c.role).procurement === '社内在庫'
}

/**
 * 設計中: 設計が見る・直す行（下書き・設計に指摘が来ている・エラーのある行・取消や置換の済んだ行・隠した行）。提出して見積に回った行は見積もりへ。
 * 在庫の行と見積もりの行は含まない。どの行も 在庫 / 設計中 / 見積もり のどれか 1 つに入る
 */
function isDesigning(r: Row, c: ViewCtx): boolean {
  if (!isActive(r)) return !(c.role === 'purchasing' && r.flags.formalWithdrawn)
  if (r.hidden || r.status === 'draft' || r.flags.altPending) return true
  // 設計が直す指摘が来ている行、指定先が辞退した行、エラーのある行。商社の選定待ち（見積済）は見積もりの仕事
  if (openIssues(c.p, r.id).some((i) => (i.status === 'open' || i.status === 'inProgress') && resolverOfIssue(i) === 'design')) return true
  if (r.procurement === '指定商社' && designatedDeclined(c.p, r)) return true
  return (c.problems.get(r.id) ?? []).some((x) => x.severity === 'error')
}

export const VIEWS: ViewDef[] = [
  {
    id: 1,
    label: '在庫',
    columns: ['id', 'name', 'model', 'maker', 'qtyNeeded', 'unit', 'procurement', 'note', 'status'],
    filter: (r, c) => isStockRow(r, c),
  },
  { id: 2, label: '設計中', columns: DESIGN_COLS, filter: (r, c) => !isStockRow(r, c) && isDesigning(r, c) },
  {
    id: 3,
    label: '見積もり',
    // 商社ごとの見積（単価・納期・MOQ・在庫・正式単価）の列は商社の数だけ後ろに付く
    columns: ['id', 'ball', 'ref', 'name', 'model', 'maker', 'qtyNeeded', 'unit', 'procurement', 'altPolicy', 'needDate', 'orderQty', 'adopted', 'score', 'unitPrice', 'amount', 'lead', 'status', 'due', 'waiting', 'ordered', 'received'],
    filter: (r, c) => !isStockRow(r, c) && !isDesigning(r, c),
  },
]

/** この行が出るビュー（Ctrl+G や問題へのジャンプで、いまのビューに無い行を出すときに使う） */
export function viewOfRow(r: Row, c: ViewCtx): ViewId {
  return (VIEWS.find((v) => v.filter(r, c) && (!r.hidden || v.id === 2)) ?? VIEWS[1]).id
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
  return VIEWS.find((v) => v.id === id) ?? VIEWS[0]
}

export function buildProblems(ws: Workspace, p: Project): Map<string, Problem[]> {
  const m = new Map<string, Problem[]>()
  for (const r of p.rows) {
    const ps = checkRow(r, ws.rules, p)
    if (ps.length) m.set(r.id, ps)
  }
  return m
}
