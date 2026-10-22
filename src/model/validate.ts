import type { Project, Row, Workspace } from './types'
import { DEFAULT_RULES, DEFAULT_SETTINGS, SAMPLE_SUPPLIERS, newRow } from './sample'
import { DEFAULT_WEIGHTS } from './score'

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const arr = <T,>(v: unknown, fallback: T[] = []): T[] => (Array.isArray(v) ? (v as T[]) : fallback)

/** 読み込んだワークスペースを検証し、欠けている項目を既定値で補う。直せなければ error を返す */
export function sanitizeWorkspace(raw: unknown): { ws?: Workspace; error?: string } {
  if (!isObj(raw)) return { error: 'ワークスペースの形式ではありません（{ projects: [...] } が必要）' }
  if (!Array.isArray(raw.projects)) return { error: 'projects が配列ではありません' }
  if (raw.projects.length === 0) return { error: '案件が 1 つもありません' }
  const projects: Project[] = []
  for (const [i, p0] of raw.projects.entries()) {
    if (!isObj(p0)) return { error: `projects[${i}] が案件の形式ではありません` }
    if (typeof p0.id !== 'string' || !p0.id) return { error: `projects[${i}] に id がありません` }
    const rows = arr<Partial<Row>>(p0.rows)
    const badRow = rows.findIndex((r) => !isObj(r) || typeof r.id !== 'string')
    if (badRow >= 0) return { error: `案件 ${p0.id} の rows[${badRow}] に id がありません` }
    const now = new Date().toISOString()
    const p: Project = {
      ...(p0 as unknown as Project),
      name: typeof p0.name === 'string' ? p0.name : p0.id,
      dueDate: typeof p0.dueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p0.dueDate) ? p0.dueDate : null,
      members: isObj(p0.members) ? (p0.members as Project['members']) : { design: '', purchasing: '', pm: '' },
      preferredSupplierIds: arr(p0.preferredSupplierIds),
      supplierIds: arr(p0.supplierIds),
      rows: rows.map((r) => ({ ...newRow(r.id as string), ...r, flags: isObj(r.flags) ? r.flags : {}, ackRules: arr(r.ackRules), deferredRules: arr(r.deferredRules) }) as Row),
      quotes: arr(p0.quotes),
      issues: arr<Project['issues'][number]>(p0.issues).map((x) => ({ ...x, replies: arr(x.replies), bounceCount: Number(x.bounceCount) || 0 })),
      submissions: arr<Project['submissions'][number]>(p0.submissions).map((s) => ({ ...s, rowIds: arr(s.rowIds), acked: arr(s.acked), causes: isObj(s.causes) ? s.causes : {}, snapshot: isObj(s.snapshot) ? s.snapshot : {} })),
      decisions: arr(p0.decisions),
      weights: isObj(p0.weights) ? { ...DEFAULT_WEIGHTS, ...(p0.weights as object) } : { ...DEFAULT_WEIGHTS },
      rowWeights: isObj(p0.rowWeights) ? (p0.rowWeights as Project['rowWeights']) : {},
      settings: isObj(p0.settings) ? { ...DEFAULT_SETTINGS, ...(p0.settings as object), holidays: arr(p0.settings.holidays) } : { ...DEFAULT_SETTINGS },
      events: arr(p0.events),
      createdAt: typeof p0.createdAt === 'string' ? p0.createdAt : now,
      updatedAt: typeof p0.updatedAt === 'string' ? p0.updatedAt : now,
      version: Number(p0.version) || 1,
      requestRevs: isObj(p0.requestRevs) ? (p0.requestRevs as Project['requestRevs']) : {},
      nextIssueNo: Number(p0.nextIssueNo) || arr(p0.issues).length + 1,
      nextDecisionNo: Number(p0.nextDecisionNo) || arr(p0.decisions).length + 1,
      caseDecisions: arr(p0.caseDecisions),
    }
    projects.push(p)
  }
  const ids = projects.map((p) => p.id.toLowerCase())
  const dup = ids.find((id, i) => ids.indexOf(id) !== i)
  if (dup) return { error: `案件 ID が重複しています: ${dup}` }
  const user = isObj(raw.user) && typeof raw.user.name === 'string' && ['design', 'purchasing', 'pm'].includes(String(raw.user.role)) ? (raw.user as unknown as Workspace['user']) : { name: '山田', role: 'design' as const }
  const currentProjectId = typeof raw.currentProjectId === 'string' && projects.some((p) => p.id === raw.currentProjectId) ? raw.currentProjectId : projects[0].id
  return { ws: { user, projects, suppliers: arr(raw.suppliers, SAMPLE_SUPPLIERS).length ? arr(raw.suppliers, SAMPLE_SUPPLIERS) : SAMPLE_SUPPLIERS, rules: Array.isArray(raw.rules) ? (raw.rules as Workspace['rules']) : DEFAULT_RULES, currentProjectId } }
}
