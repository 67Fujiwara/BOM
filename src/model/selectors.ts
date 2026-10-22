import type { Project, Role, Row, Workspace } from './types'
import { STATUS_LABEL, ROLE_LABEL } from './types'
import { COLUMNS, colDef, supplierOfCol } from './columns'
import { VIEWS, buildProblems, type ViewCtx } from './views'
import type { Problem } from './rules'
import type { State, ViewId } from './store'
import { adoptedQuote, ball, effective, isActive, isOverdue, lineAmount, openIssues, orderQty, rowDue, rowNeedDate, waitingDays, fmtYen } from './derive'
import { fmtDate } from './dates'

export type Item = { kind: 'group'; key: string; category: string; count: number } | { kind: 'row'; key: string; row: Row } | { kind: 'detail'; key: string; row: Row }

export interface ViewModel {
  ctx: ViewCtx
  columns: string[]
  items: Item[]
  rows: Row[] // 表示順の行
  counts: Record<ViewId, number>
  problems: Map<string, Problem[]>
}

export function makeCtx(ws: Workspace, p: Project, rev: number | null): ViewCtx {
  return { ws, p, problems: buildProblems(ws, p), role: ws.user.role, rev }
}

export function viewColumns(st: State, p: Project): string[] {
  const v = VIEWS.find((x) => x.id === st.view)!
  let cols: string[]
  if (v.columns) cols = [...v.columns]
  else cols = COLUMNS.filter((c) => !c.perSupplier && !st.hiddenCols.includes(c.key)).map((c) => c.key)
  if (st.view === 6) for (const sid of p.supplierIds) cols.push(`q.unitPrice@${sid}`, `q.leadDays@${sid}`, `q.moq@${sid}`, `q.stock@${sid}`, `q.validUntil@${sid}`)
  if (st.view === 9) for (const sid of p.supplierIds) cols.push(`q.unitPrice@${sid}`, `q.leadDays@${sid}`, `q.moq@${sid}`, `q.stock@${sid}`)
  if (st.view === 8) cols.push('q.formalPrice@A', 'q.formalLeadDays@A', 'q.formalValidUntil@A', 'q.formalDiffReason@A')
  if (st.view === 3) cols.push('extraCost', 'extraCostKind')
  return cols
}

function matchText(row: Row, p: Project, q: string): boolean {
  if (!q) return true
  const e = effective(row)
  const hay = [row.id, e.ref, e.name, e.model, e.maker, e.category, e.note, STATUS_LABEL[row.status], ...openIssues(p, row.id).map((i) => i.kind + i.text)].join(' ').toLowerCase()
  return q.toLowerCase().split(/\s+/).every((t) => hay.includes(t))
}

let cacheKey: unknown[] | null = null
let cacheVal: ViewModel | null = null

export function buildViewModel(st: State): ViewModel {
  const key = [st.ws, st.view, st.sort, st.filter, st.cellFilter, st.hiddenCols, st.collapsed, st.openRows, st.revView]
  if (cacheKey && cacheVal && key.every((k, i) => k === cacheKey![i])) return cacheVal
  const v = buildViewModelUncached(st)
  cacheKey = key
  cacheVal = v
  return v
}

function buildViewModelUncached(st: State): ViewModel {
  const ws = st.ws
  const p = st.project()
  const ctx = makeCtx(ws, p, st.revView)
  const columns = viewColumns(st, p)
  const counts = {} as Record<ViewId, number>
  for (const v of VIEWS) counts[v.id] = p.rows.filter((r) => v.filter(r, ctx) && (v.id === 1 || !r.hidden)).length
  const v = VIEWS.find((x) => x.id === st.view)!
  let rows = p.rows.filter((r) => v.filter(r, ctx) && (st.view === 1 || !r.hidden) && matchText(r, p, st.filter))
  if (st.cellFilter) rows = rows.filter((r) => cellText(r, st.cellFilter!.col, ctx).text === st.cellFilter!.value)
  const sort = st.sort
  if (sort) {
    const dir = sort.dir === 'asc' ? 1 : -1
    rows = [...rows].sort((a, b) => {
      const ta = cellText(a, sort.col, ctx)
      const tb = cellText(b, sort.col, ctx)
      const na = Number(ta.raw)
      const nb = Number(tb.raw)
      if (ta.raw !== '' && tb.raw !== '' && Number.isFinite(na) && Number.isFinite(nb)) return (na - nb) * dir
      return String(ta.raw).localeCompare(String(tb.raw), 'ja') * dir
    })
  } else if (v.defaultSort) rows = [...rows].sort((a, b) => v.defaultSort!(a, b, ctx))
  const items: Item[] = []
  const grouped = !sort && !v.defaultSort && st.view !== 7 && st.view !== 4
  let lastCat: string | null = null
  const ordered: Row[] = []
  for (const r of rows) {
    const cat = effective(r).category || '（分類なし）'
    if (grouped && cat !== lastCat) {
      lastCat = cat
      items.push({ kind: 'group', key: 'g:' + cat + ':' + r.id, category: cat, count: rows.filter((x) => (effective(x).category || '（分類なし）') === cat).length })
    }
    if (grouped && st.collapsed.includes(cat)) continue
    items.push({ kind: 'row', key: r.id, row: r })
    ordered.push(r)
    if (st.openRows.includes(r.id)) items.push({ kind: 'detail', key: 'd:' + r.id, row: r })
  }
  return { ctx, columns, items, rows: ordered, counts, problems: ctx.problems }
}

export interface CellText {
  text: string
  raw: string | number
  cls?: string
  sev?: 'err' | 'warn'
  title?: string
}

export function cellText(row: Row, col: string, ctx: ViewCtx): CellText {
  const p = ctx.p
  const e = effective(row)
  const d = colDef(col)
  const w = row.working ?? {}
  const working = (k: string) => (k in w ? ' changed' : '')
  if (!d) return { text: '', raw: '' }
  if (d.perSupplier) {
    let sid = supplierOfCol(col)!
    if (sid === 'A') sid = row.adoptedSupplierId ?? ''
    const q = p.quotes.find((x) => x.rowId === row.id && x.supplierId === sid && !x.stale)
    const f = col.slice(2, col.indexOf('@')) as keyof NonNullable<typeof q>
    const v = q ? (q[f] as string | number | null) : null
    if (f === 'leadDays') return { text: v == null ? '' : v === -1 ? '辞退' : v === 0 ? '即納' : `${v}日`, raw: v ?? '', cls: 'num' }
    if (f === 'unitPrice' || f === 'formalPrice') return { text: v == null ? '' : fmtYen(Number(v), p.settings.currency), raw: v ?? '', cls: 'num' + (q?.reconfirm === 'proposal' ? ' changed' : ''), title: q?.source }
    if (f === 'validUntil' || f === 'formalValidUntil') return { text: fmtDate(v as string | null), raw: v ?? '', sev: v && String(v) < new Date().toISOString().slice(0, 10) ? 'warn' : undefined }
    return { text: v == null ? '' : String(v), raw: v ?? '', cls: d.numeric ? 'num' : '' }
  }
  switch (col) {
    case 'id':
      return { text: row.id, raw: row.id, cls: 'id' }
    case 'ball': {
      const b = ball(p, row)
      return { text: b ? ROLE_LABEL[b] : '—', raw: b ?? '', cls: b === ctx.role ? 'mine' : 'muted' }
    }
    case 'needDate': {
      const nd = rowNeedDate(p, row)
      return { text: fmtDate(nd), raw: nd ?? '', title: e.needDateFixed ? '固定' : e.needOffset ? `案件必要日 ${e.needOffset} 日` : '案件必要日' }
    }
    case 'needOffset':
      return { text: e.needOffset == null ? '' : String(e.needOffset), raw: e.needOffset ?? '', cls: 'num' + working('needOffset') }
    case 'needDateFixed':
      return { text: fmtDate(e.needDateFixed), raw: e.needDateFixed ?? '', cls: working('needDateFixed') }
    case 'designated': {
      const sup = ctx.ws.suppliers.find((s) => s.id === e.designated)
      return { text: sup ? sup.name : e.designated, raw: e.designated, cls: working('designated') }
    }
    case 'adopted': {
      const sup = ctx.ws.suppliers.find((s) => s.id === row.adoptedSupplierId)
      return { text: sup ? sup.name : '', raw: sup?.name ?? '', cls: row.flags.pmPending ? 'warn-text' : '', title: row.adoptReason }
    }
    case 'score':
      return { text: row.scoreSnapshot == null ? '' : String(row.scoreSnapshot), raw: row.scoreSnapshot ?? '', cls: 'num' }
    case 'unitPrice': {
      const q = adoptedQuote(p, row)
      return { text: q?.unitPrice == null ? '' : fmtYen(q.unitPrice, p.settings.currency), raw: q?.unitPrice ?? '', cls: 'num' }
    }
    case 'amount': {
      const a = lineAmount(p, row)
      return { text: a.rough == null ? '' : fmtYen(a.rough, p.settings.currency), raw: a.rough ?? '', cls: 'num' }
    }
    case 'formalPrice': {
      const q = adoptedQuote(p, row)
      return { text: q?.formalPrice == null ? '' : fmtYen(q.formalPrice, p.settings.currency), raw: q?.formalPrice ?? '', cls: 'num' }
    }
    case 'formalDiff': {
      const q = adoptedQuote(p, row)
      if (!q || q.formalPrice == null || q.unitPrice == null) return { text: '', raw: '' }
      const pct = ((q.formalPrice - q.unitPrice) / q.unitPrice) * 100
      return { text: `${pct >= 0 ? '+' : ''}${pct.toFixed(0)}%`, raw: pct, cls: 'num', sev: row.flags.formalDiff ? 'err' : undefined }
    }
    case 'lead': {
      const q = adoptedQuote(p, row)
      const ld = q?.formalLeadDays ?? q?.leadDays
      return { text: ld == null ? '' : ld === -1 ? '辞退' : ld === 0 || q?.stock === '在庫' ? '即納' : `${ld}日`, raw: ld ?? '', cls: 'num', sev: row.flags.leadNG ? 'err' : undefined }
    }
    case 'status': {
      const flags: string[] = []
      const f = row.flags
      if (openIssues(p, row.id).length) flags.push('指摘')
      if (f.requote) flags.push('再見積要')
      if (f.reconfirm) flags.push('要再確認')
      if (f.notation) flags.push('表記修正')
      if (f.orderQtyCheck) flags.push('発注数要確認')
      if (f.reissue) flags.push('再発行')
      if (f.pmPending) flags.push('PM承認待ち')
      if (f.formalDiff) flags.push('差分超過')
      if (f.leadNG) flags.push('納期NG')
      if (f.ltbPending) flags.push('先行発注判断')
      if (f.altPending) flags.push('代替承認待ち')
      if (f.contested) flags.push('拮抗')
      if (f.early) flags.push('先行')
      if (f.countermeasure) flags.push(f.countermeasure)
      if (f.delegated) flags.push('委譲')
      if (row.working && Object.keys(row.working).length) flags.push('作業中●')
      let text = STATUS_LABEL[row.status]
      if (row.status === 'quoting') {
        const qs = p.quotes.filter((q) => q.rowId === row.id && !q.stale)
        text += ` ${qs.filter((q) => q.unitPrice != null || q.leadDays === -1).length}/${qs.length}`
      }
      if (row.status === 'replaced' && row.replacedBy) text += ` →${row.replacedBy}`
      return { text: flags.length ? `${text} · ${flags.join('·')}` : text, raw: row.status, cls: 's-' + row.status, sev: isOverdue(p, row) ? 'err' : undefined, title: flags.join(' / ') }
    }
    case 'due': {
      const d = rowDue(p, row)
      return { text: fmtDate(d), raw: d ?? '', sev: isOverdue(p, row) ? 'err' : undefined }
    }
    case 'waiting': {
      const n = isActive(row) && row.status !== 'received' ? waitingDays(p, row) : 0
      return { text: n ? `${n}日` : '', raw: n, cls: 'num' }
    }
    case 'ordered':
      return { text: row.ordered ? '✓' : '', raw: row.ordered ? 1 : 0 }
    case 'received':
      return { text: row.received ? '✓' : '', raw: row.received ? 1 : 0 }
    case 'orderQty':
      return { text: String(orderQty(row)), raw: orderQty(row), cls: 'num' + (row.flags.orderQtyCheck ? ' changed' : '') }
    case 'extraCost':
      return { text: row.extraCost == null ? '' : fmtYen(row.extraCost, p.settings.currency), raw: row.extraCost ?? '', cls: 'num' }
    case 'promisedDate':
      return { text: fmtDate(row.promisedDate), raw: row.promisedDate ?? '' }
    default: {
      const v = (e as unknown as Record<string, unknown>)[col] ?? (row as unknown as Record<string, unknown>)[col]
      const txt = v == null ? '' : String(v)
      const pr = ctx.problems.get(row.id)?.find((x) => x.field === col)
      return { text: txt, raw: (v as string | number) ?? '', cls: (d.numeric ? 'num' : col === 'model' ? 'model' : '') + working(col), sev: pr ? pr.severity === 'error' ? 'err' : 'warn' : undefined, title: pr?.message }
    }
  }
}

export function cellSev(row: Row, col: string, ctx: ViewCtx): 'err' | 'warn' | undefined {
  const pr = ctx.problems.get(row.id)?.find((x) => x.field === col)
  if (pr) return pr.severity === 'error' ? 'err' : 'warn'
  const iss = openIssues(ctx.p, row.id).find((i) => i.field === col && (i.status === 'open' || i.status === 'inProgress'))
  if (iss) return 'err'
  return undefined
}

export function roleOf(ws: Workspace): Role {
  return ws.user.role
}
