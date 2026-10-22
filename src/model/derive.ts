import type { DesignFields, Issue, Project, Role, Row, RowStatus, Supplier, Workspace } from './types'
import { addDays, addBusinessDays, businessDaysBetween, diffDays, todayStr } from './dates'

/** 作業中（未公開）の値を重ねた設計列 */
export function effective(row: Row): DesignFields {
  if (!row.working) return row
  return { ...row, ...row.working }
}

export function isActive(row: Row): boolean {
  return row.status !== 'cancelled' && row.status !== 'replaced'
}

/** 見積対象外（分母から外す） */
export function isQuotable(row: Row): boolean {
  const e = effective(row)
  return isActive(row) && (e.procurement === '相見積' || e.procurement === '指定商社')
}

export function orderQty(row: Row): number {
  return row.orderQty ?? effective(row).qtyNeeded
}

/** 案件の必要日 = 納期 − 社内工程日数 */
export function projectNeedDate(p: Project): string | null {
  if (!p.dueDate) return null
  return addDays(p.dueDate, -p.settings.processDays)
}
export function rowNeedDate(p: Project, row: Row): string | null {
  const e = effective(row)
  if (e.needDateFixed) return e.needDateFixed
  const base = projectNeedDate(p)
  if (!base) return null
  return e.needOffset ? addDays(base, e.needOffset) : base
}

export function openIssues(p: Project, rowId: string): Issue[] {
  return p.issues.filter((i) => i.rowId === rowId && i.status !== 'confirmed' && i.status !== 'wontfix' && i.status !== 'draft')
}

/** 次のアクション担当（ボール）。§2.1 の表を上から順に */
export function ball(p: Project, row: Row): Role | null {
  if (!isActive(row)) return null
  if (row.status === 'received') return null
  const f = row.flags
  if (f.pmPending || f.formalDiff || (f.leadNG && !f.countermeasure) || f.ltbPending) return 'pm'
  const issues = openIssues(p, row.id)
  if (issues.some((i) => i.bounceCount >= 2 && i.status === 'open')) return 'pm'
  if (issues.some((i) => (i.status === 'open' || i.status === 'inProgress') && resolverOfIssue(i) === 'design')) return 'design'
  if (issues.some((i) => (i.status === 'open' || i.status === 'inProgress') && resolverOfIssue(i) === 'purchasing')) return 'purchasing'
  const pending = issues.find((i) => i.status === 'fixed' || i.status === 'answered')
  if (pending) return pending.by.role
  if (f.altPending) return 'design'
  if (f.countermeasure === '代替品検討') return 'design'
  if (f.countermeasure === '商社変更' || f.delegated) return 'purchasing'
  if (f.requote || f.reconfirm || f.orderQtyCheck || f.notation || f.reissue) return 'purchasing'
  if (row.status === 'draft' || (row.working && Object.keys(row.working).length > 0)) return 'design'
  switch (row.status) {
    case 'submitted':
    case 'quoting':
      return 'purchasing'
    case 'quoted':
      return selectorRole(p)
    case 'selected':
      if (f.contested) return selectorRole(p)
      return 'purchasing'
    case 'formalRequested':
    case 'formalQuoted':
    case 'ordered':
      return 'purchasing'
    default:
      return null
  }
}

export function selectorRole(p: Project): Role {
  return p.settings.selector
}

export function resolverOfIssue(i: Issue): Role {
  if (i.kind === '質問') return i.by.role === 'design' ? 'purchasing' : 'design'
  return resolverOf(i.kind)
}

export function resolverOf(kind: Issue['kind']): Role {
  switch (kind) {
    case '最小ロット':
    case '納期NG':
    case '発注後変更依頼':
      return 'purchasing'
    case '質問':
      return 'design' // 起票者の相手。起票者が設計なら purchasing（issue 単位で上書き）
    default:
      return 'design'
  }
}

/** RACI の期限（営業日）。状態変更日時から起算 */
const DUE_DAYS: Partial<Record<RowStatus, number>> = { submitted: 1, quoted: 2, formalQuoted: 1, selected: 2 }
export function rowDue(p: Project, row: Row): string | null {
  if (row.dueAt) return row.dueAt
  const n = DUE_DAYS[row.status]
  if (!n) return null
  return addBusinessDays(row.statusChangedAt.slice(0, 10), n, p.settings.holidays)
}
export function waitingDays(p: Project, row: Row, today = todayStr()): number {
  return businessDaysBetween(row.statusChangedAt.slice(0, 10), today, p.settings.holidays)
}
export function isOverdue(p: Project, row: Row, today = todayStr()): boolean {
  const d = rowDue(p, row)
  return !!d && d < today && isActive(row) && row.status !== 'received'
}

export function supplierById(ws: Workspace, id?: string): Supplier | undefined {
  return ws.suppliers.find((s) => s.id === id)
}

export function adoptedQuote(p: Project, row: Row) {
  if (!row.adoptedSupplierId) return undefined
  return p.quotes.find((q) => q.rowId === row.id && q.supplierId === row.adoptedSupplierId && !q.stale)
}

export function lineAmount(p: Project, row: Row): { rough: number | null; formal: number | null } {
  const q = adoptedQuote(p, row)
  if (!q) return { rough: null, formal: null }
  const qty = orderQty(row)
  return { rough: q.unitPrice != null ? q.unitPrice * qty : null, formal: q.formalPrice != null ? q.formalPrice * qty : null }
}

export function totals(p: Project): { rough: number; formal: number; budget: number | null } {
  let rough = 0
  let formal = 0
  for (const r of p.rows) {
    if (!isActive(r)) continue
    const e = effective(r)
    if (e.procurement === '支給品' || e.procurement === '社内在庫') continue
    const a = lineAmount(p, r)
    rough += (a.rough ?? 0) + (r.extraCost ?? 0)
    formal += (a.formal ?? a.rough ?? 0) + (r.extraCost ?? 0)
  }
  return { rough, formal, budget: p.settings.budget }
}

export function ballCounts(p: Project): Record<Role, number> {
  const c: Record<Role, number> = { design: 0, purchasing: 0, pm: 0 }
  for (const r of p.rows) {
    const b = ball(p, r)
    if (b) c[b]++
  }
  return c
}

export function unpublishedCount(p: Project, userName?: string): { rows: number; issues: number } {
  const rows = p.rows.filter((r) => (r.working && Object.keys(r.working).length > 0) || (r.status === 'draft' && r.publishedRev == null && (r.name || r.model))).length
  const issues = p.issues.filter((i) => i.status === 'draft' && (!userName || i.by.name === userName)).length
  return { rows, issues }
}

/** 正規化後の型式（空白・全角半角・大文字小文字・区切り記号を無視） */
export function normalizeModel(s: string): string {
  return s
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[－—–]/g, '-')
    .replace(/[\s\u3000\-_/.,()（）]/g, '')
    .toUpperCase()
}

/** 商社ごとの丸め数量（MOQ・入数で切り上げ） */
export function roundedQty(qtyNeeded: number, moq: number | null | undefined, packQty: number | null | undefined): number {
  let q = Math.max(qtyNeeded, moq ?? 0)
  if (packQty && packQty > 0) q = Math.ceil(q / packQty) * packQty
  return q
}

export function quoteResponses(p: Project, row: Row): { answered: number; total: number } {
  const qs = p.quotes.filter((q) => q.rowId === row.id && !q.stale)
  return { answered: qs.filter((q) => q.unitPrice != null || q.leadDays === -1).length, total: qs.length }
}

/** 見積済の成立条件 */
export function quoteComplete(p: Project, row: Row, today = todayStr()): boolean {
  const { answered, total } = quoteResponses(p, row)
  if (total === 0) return false
  switch (p.settings.quoteCompleteRule) {
    case 'all':
      return answered === total
    case 'min2':
      return answered >= Math.min(2, total)
    case 'deadline':
      return answered === total || (!!p.settings.quoteDeadline && p.settings.quoteDeadline < today && answered > 0)
  }
}

export function daysLeft(p: Project, today = todayStr()): { due: number | null; need: number | null } {
  const nd = projectNeedDate(p)
  return { due: p.dueDate ? diffDays(p.dueDate, today) : null, need: nd ? diffDays(nd, today) : null }
}

export function fmtYen(n: number | null | undefined, currency = '¥'): string {
  if (n == null) return ''
  return currency + Math.round(n).toLocaleString('ja-JP')
}
