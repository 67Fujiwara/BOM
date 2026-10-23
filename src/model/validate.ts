import type { Project, Row, Workspace } from './types'
import { DEFAULT_RULES, DEFAULT_SETTINGS, SAMPLE_SUPPLIERS, newRow } from './sample'
import { DEFAULT_WEIGHTS } from './score'

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const arr = <T,>(v: unknown, fallback: T[] = []): T[] => (Array.isArray(v) ? (v as T[]) : fallback)

const str = (v: unknown): v is string => typeof v === 'string' && v !== ''
const numOrNull = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const ROLES_OK = ['design', 'purchasing', 'pm']
const ISSUE_STATUS_OK = ['draft', 'open', 'inProgress', 'fixed', 'answered', 'confirmed', 'wontfix']
const userOf = (v: unknown, fallback: Workspace['user']): Workspace['user'] => (isObj(v) && typeof v.name === 'string' && ROLES_OK.includes(String(v.role)) ? (v as unknown as Workspace['user']) : fallback)

/** 読み込んだワークスペースを検証し、欠けている項目を既定値で補う。直せない項目は外して warnings に、全体が読めなければ error を返す */
export function sanitizeWorkspace(raw: unknown): { ws?: Workspace; error?: string; warnings?: string[] } {
  try {
    return sanitizeInner(raw)
  } catch (e) {
    return { error: `データの形式が読めません: ${(e as Error).message}` }
  }
}

function sanitizeInner(raw: unknown): { ws?: Workspace; error?: string; warnings?: string[] } {
  const warnings: string[] = []
  if (!isObj(raw)) return { error: 'ワークスペースの形式ではありません（{ projects: [...] } が必要）' }
  if (!Array.isArray(raw.projects)) return { error: 'projects が配列ではありません' }
  if (raw.projects.length === 0) return { error: '案件が 1 つもありません' }
  const projects: Project[] = []
  for (const [i, p0] of raw.projects.entries()) {
    if (!isObj(p0)) return { error: `projects[${i}] が案件の形式ではありません` }
    if (typeof p0.id !== 'string' || !p0.id) return { error: `projects[${i}] に id がありません` }
    // id の無い行・重複した行は外して読み、何を外したかを知らせる（1 行の欠陥で全体を捨てない）
    const rows: Partial<Row>[] = []
    const seenRow = new Set<string>()
    for (const [ri, r] of arr<unknown>(p0.rows).entries()) {
      if (!isObj(r) || !str(r.id)) warnings.push(`案件 ${p0.id} の rows[${ri}] は id が無いので外しました`)
      else if (seenRow.has(r.id)) warnings.push(`案件 ${p0.id} の行 ${r.id} が重複していたので 2 つ目以降を外しました`)
      else {
        seenRow.add(r.id)
        rows.push(r as Partial<Row>)
      }
    }
    const rowIds = seenRow
    const fallbackUser = { name: '不明', role: 'design' as const }
    const issues0 = arr<unknown>(p0.issues)
    const issues = issues0
      .filter((x): x is Record<string, unknown> => isObj(x) && str(x.id) && str(x.rowId) && rowIds.has(x.rowId as string) && typeof x.kind === 'string')
      .map((x) => ({ ...x, by: userOf(x.by, fallbackUser), status: ISSUE_STATUS_OK.includes(String(x.status)) ? x.status : 'open', text: typeof x.text === 'string' ? x.text : '', replies: arr<unknown>(x.replies).filter(isObj).map((rp) => ({ ...rp, by: userOf(rp.by, fallbackUser), text: typeof rp.text === 'string' ? rp.text : '' })), bounceCount: Number(x.bounceCount) || 0 })) as unknown as Project['issues']
    if (issues.length < issues0.length) warnings.push(`案件 ${p0.id} の指摘 ${issues0.length - issues.length} 件は形式が読めないので外しました`)
    const quotes0 = arr<unknown>(p0.quotes)
    const quotes = quotes0
      .filter((q): q is Record<string, unknown> => isObj(q) && str(q.rowId) && str(q.supplierId) && rowIds.has(q.rowId as string))
      .map((q) => ({ ...q, unitPrice: numOrNull(q.unitPrice), leadDays: numOrNull(q.leadDays), moq: numOrNull(q.moq), quoteQty: numOrNull(q.quoteQty), formalPrice: numOrNull(q.formalPrice), formalLeadDays: numOrNull(q.formalLeadDays), note: typeof q.note === 'string' ? q.note : '' })) as unknown as Project['quotes']
    if (quotes.length < quotes0.length) warnings.push(`案件 ${p0.id} の見積 ${quotes0.length - quotes.length} 件は形式が読めないので外しました`)
    const now = new Date().toISOString()
    const p: Project = {
      ...(p0 as unknown as Project),
      name: typeof p0.name === 'string' ? p0.name : p0.id,
      dueDate: typeof p0.dueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p0.dueDate) ? p0.dueDate : null,
      members: isObj(p0.members) ? (p0.members as Project['members']) : { design: '', purchasing: '', pm: '' },
      preferredSupplierIds: arr(p0.preferredSupplierIds),
      supplierIds: arr(p0.supplierIds),
      rows: rows.map((r) => ({ ...newRow(r.id as string), ...r, flags: isObj(r.flags) ? r.flags : {}, ackRules: arr(r.ackRules), deferredRules: arr(r.deferredRules) }) as Row),
      quotes,
      issues,
      submissions: arr<Project['submissions'][number]>(p0.submissions).filter(isObj).map((s) => ({ ...s, rowIds: arr(s.rowIds), acked: arr(s.acked), causes: isObj(s.causes) ? s.causes : {}, snapshot: isObj(s.snapshot) ? s.snapshot : {} })),
      decisions: arr<Project['decisions'][number]>(p0.decisions).filter(isObj).map((d) => ({ ...d, by: userOf(d.by, fallbackUser) })),
      weights: isObj(p0.weights) ? { ...DEFAULT_WEIGHTS, ...(p0.weights as object) } : { ...DEFAULT_WEIGHTS },
      rowWeights: isObj(p0.rowWeights) ? (p0.rowWeights as Project['rowWeights']) : {},
      settings: isObj(p0.settings) ? { ...DEFAULT_SETTINGS, ...(p0.settings as object), holidays: arr(p0.settings.holidays) } : { ...DEFAULT_SETTINGS },
      events: arr<Project['events'][number]>(p0.events).filter(isObj).map((ev) => ({ ...ev, by: userOf(ev.by, fallbackUser), text: typeof ev.text === 'string' ? ev.text : '' })),
      createdAt: typeof p0.createdAt === 'string' ? p0.createdAt : now,
      updatedAt: typeof p0.updatedAt === 'string' ? p0.updatedAt : now,
      version: Number(p0.version) || 1,
      requestRevs: isObj(p0.requestRevs) ? (p0.requestRevs as Project['requestRevs']) : {},
      nextIssueNo: Number(p0.nextIssueNo) || arr(p0.issues).length + 1,
      nextDecisionNo: Number(p0.nextDecisionNo) || arr(p0.decisions).length + 1,
      caseDecisions: arr<Project['caseDecisions'][number]>(p0.caseDecisions).filter(isObj),
    }
    projects.push(p)
  }
  const ids = projects.map((p) => p.id.toLowerCase())
  const dup = ids.find((id, i) => ids.indexOf(id) !== i)
  if (dup) return { error: `案件 ID が重複しています: ${dup}` }
  const user = isObj(raw.user) && typeof raw.user.name === 'string' && ['design', 'purchasing', 'pm'].includes(String(raw.user.role)) ? (raw.user as unknown as Workspace['user']) : { name: '山田', role: 'design' as const }
  const currentProjectId = typeof raw.currentProjectId === 'string' && projects.some((p) => p.id === raw.currentProjectId) ? raw.currentProjectId : projects[0].id
  return { warnings, ws: { user, projects, suppliers: arr(raw.suppliers, SAMPLE_SUPPLIERS).length ? arr(raw.suppliers, SAMPLE_SUPPLIERS) : SAMPLE_SUPPLIERS, rules: Array.isArray(raw.rules) ? (raw.rules as Workspace['rules']) : DEFAULT_RULES, currentProjectId } }
}
