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
      .map((q) => ({ ...q, validUntil: typeof q.validUntil === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(q.validUntil) ? q.validUntil : null, formalValidUntil: typeof q.formalValidUntil === 'string' ? q.formalValidUntil : null, stock: q.stock === '在庫' || q.stock === '取寄' || q.stock === '受注生産' ? q.stock : null, source: typeof q.source === 'string' ? q.source : undefined, formalDiffReason: typeof q.formalDiffReason === 'string' ? q.formalDiffReason : '', unitPrice: numOrNull(q.unitPrice), leadDays: numOrNull(q.leadDays), moq: numOrNull(q.moq), quoteQty: numOrNull(q.quoteQty), formalPrice: numOrNull(q.formalPrice), formalLeadDays: numOrNull(q.formalLeadDays), note: typeof q.note === 'string' ? q.note : '' })) as unknown as Project['quotes']
    if (quotes.length < quotes0.length) warnings.push(`案件 ${p0.id} の見積 ${quotes0.length - quotes.length} 件は形式が読めないので外しました`)
    const now = new Date().toISOString()
    const p: Project = {
      ...(p0 as unknown as Project),
      name: typeof p0.name === 'string' ? p0.name : p0.id,
      dueDate: typeof p0.dueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p0.dueDate) ? p0.dueDate : null,
      members: isObj(p0.members) ? (p0.members as Project['members']) : { design: '', purchasing: '', pm: '' },
      preferredSupplierIds: arr(p0.preferredSupplierIds),
      supplierIds: arr(p0.supplierIds),
      rows: rows.map((r) => coerceRow(r as Record<string, unknown>)),
      quotes,
      issues,
      submissions: arr<Project['submissions'][number]>(p0.submissions).filter((x) => isObj(x) && typeof (x as { rev?: unknown }).rev === 'number').map((s) => ({
        ...s,
        by: userOf(s.by, fallbackUser),
        at: typeof s.at === 'string' ? s.at : now,
        summary: isObj(s.summary) ? { added: 0, modelChanged: 0, qtyChanged: 0, other: 0, cancelled: 0, ...(s.summary as object) } : { added: 0, modelChanged: 0, qtyChanged: 0, other: 0, cancelled: 0 },
        rowIds: arr<unknown>(s.rowIds).filter((x): x is string => typeof x === 'string'),
        acked: arr<unknown>(s.acked).filter((x): x is string => typeof x === 'string'),
        causes: isObj(s.causes) ? Object.fromEntries(Object.entries(s.causes).filter(([, v]) => typeof v === 'string')) : {},
        snapshot: isObj(s.snapshot) ? Object.fromEntries(Object.entries(s.snapshot).filter(([, v]) => isObj(v))) : {},
        changeSet: isObj(s.changeSet) ? s.changeSet : undefined,
      })),
      decisions: arr<Project['decisions'][number]>(p0.decisions).filter(isObj).map((d) => ({ ...d, by: userOf(d.by, fallbackUser) })),
      weights: isObj(p0.weights) ? coerceLike(DEFAULT_WEIGHTS, p0.weights as Record<string, unknown>) : { ...DEFAULT_WEIGHTS },
      rowWeights: isObj(p0.rowWeights) ? (p0.rowWeights as Project['rowWeights']) : {},
      settings: isObj(p0.settings) ? clampSettings(coerceLike(DEFAULT_SETTINGS, { ...(p0.settings as object), holidays: arr<unknown>(p0.settings.holidays).filter((x) => typeof x === 'string') })) : { ...DEFAULT_SETTINGS },
      events: arr<Project['events'][number]>(p0.events).filter(isObj).map((ev) => ({ ...ev, by: userOf(ev.by, fallbackUser), text: typeof ev.text === 'string' ? ev.text : '' })),
      createdAt: typeof p0.createdAt === 'string' ? p0.createdAt : now,
      updatedAt: typeof p0.updatedAt === 'string' ? p0.updatedAt : now,
      version: Number(p0.version) || 1,
      requestRevs: isObj(p0.requestRevs) ? (p0.requestRevs as Project['requestRevs']) : {},
      nextIssueNo: Number(p0.nextIssueNo) || arr(p0.issues).length + 1,
      nextDecisionNo: Number(p0.nextDecisionNo) || arr(p0.decisions).length + 1,
      caseDecisions: arr<Project['caseDecisions'][number]>(p0.caseDecisions).filter((c) => isObj(c) && str(c.id) && typeof c.kind === 'string' && (c.status === 'open' || c.status === 'done')),
    }
    projects.push(p)
  }
  const ids = projects.map((p) => p.id.toLowerCase())
  const dup = ids.find((id, i) => ids.indexOf(id) !== i)
  if (dup) return { error: `案件 ID が重複しています: ${dup}` }
  const user = isObj(raw.user) && typeof raw.user.name === 'string' && ['design', 'purchasing', 'pm'].includes(String(raw.user.role)) ? (raw.user as unknown as Workspace['user']) : { name: '山田', role: 'design' as const }
  const currentProjectId = typeof raw.currentProjectId === 'string' && projects.some((p) => p.id === raw.currentProjectId) ? raw.currentProjectId : projects[0].id
  return { warnings, ws: { user, projects, suppliers: suppliersOf(raw.suppliers, warnings), rules: rulesOf(raw.rules, warnings), currentProjectId } }
}

const STATUSES = ['draft', 'submitted', 'quoting', 'quoted', 'selected', 'formalRequested', 'formalQuoted', 'ordered', 'received', 'cancelled', 'replaced']
/** 行の各項目を既定の型にそろえる（数値の欄に文字・文字の欄に数値やオブジェクトが入った JSON でも画面が壊れないように） */
function coerceRow(r: Record<string, unknown>): Row {
  const base = newRow(r.id as string) as unknown as Record<string, unknown>
  const out: Record<string, unknown> = { ...base, ...r }
  for (const [k, def] of Object.entries(base)) {
    const v = out[k]
    if (v === undefined) continue
    if (typeof def === 'string' && typeof v !== 'string') out[k] = v == null || typeof v === 'object' ? def : String(v)
    else if (typeof def === 'number' && (typeof v !== 'number' || !Number.isFinite(v))) out[k] = Number.isFinite(Number(v)) && v !== null && typeof v !== 'object' && v !== '' ? Number(v) : def
    else if (typeof def === 'boolean' && typeof v !== 'boolean') out[k] = v === true || v === 'true' || v === 1
  }
  // 任意の文字の項目（起因・置換元／先・採用理由など）に文字以外が入っていたら外す
  for (const k of ['lastChangeCause', 'replaces', 'replacedBy', 'adoptReason', 'fromIssue', 'adoptedSupplierId', 'statusChangedAt']) if (out[k] != null && typeof out[k] !== 'string') out[k] = undefined
  for (const k of ['packQty', 'orderQty', 'needOffset', 'extraCost', 'scoreSnapshot']) if (out[k] != null && (typeof out[k] !== 'number' || !Number.isFinite(out[k] as number))) out[k] = null
  for (const k of ['needDateFixed', 'promisedDate', 'dueAt', 'quotedAt']) if (out[k] != null && typeof out[k] !== 'string') out[k] = null
  if (!STATUSES.includes(String(out.status))) out.status = 'draft'
  out.flags = isObj(r.flags) ? r.flags : {}
  out.ackRules = arr<unknown>(r.ackRules).filter((x) => typeof x === 'string')
  out.deferredRules = arr<unknown>(r.deferredRules).filter((x) => typeof x === 'string')
  for (const k of ['working', 'pendingApproval', 'removal', 'pendingRemoval']) if (out[k] != null && !isObj(out[k])) out[k] = undefined
  // 作業中・承認待ちの値も、行の項目と同じ型にそろえる（型の違う値は捨てる）
  for (const k of ['working', 'pendingApproval']) {
    const w = out[k] as Record<string, unknown> | undefined
    if (!w) continue
    const kept: Record<string, unknown> = {}
    for (const [f, v] of Object.entries(w)) {
      const def = (base as Record<string, unknown>)[f]
      if (!(f in base)) continue
      if (v === null && (def === null || f === 'needOffset' || f === 'needDateFixed' || f === 'packQty')) kept[f] = null
      else if (f === 'needDateFixed' ? typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) : f === 'needOffset' || f === 'packQty' ? typeof v === 'number' && Number.isFinite(v) : typeof def === typeof v && (typeof v !== 'number' || Number.isFinite(v))) kept[f] = v
    }
    out[k] = Object.keys(kept).length ? kept : undefined
  }
  return out as unknown as Row
}

/** 既定値と同じ型の値だけを残す（型の違う値は既定値に戻す） */
function coerceLike<T extends object>(def: T, v: Record<string, unknown>): T {
  const out = { ...def } as Record<string, unknown>
  for (const [k, d] of Object.entries(def)) {
    const x = v[k]
    if (x === undefined) continue
    // 既定が null の項目（予算・回答期限など）は、null・数値・日付の文字だけ受け付ける
    if (d === null) {
      if (x === null || (typeof x === 'number' && Number.isFinite(x)) || (typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x))) out[k] = x
      continue
    }
    if (typeof d === typeof x) {
      if (typeof x === 'number' && !Number.isFinite(x)) continue
      if (Array.isArray(d) !== Array.isArray(x)) continue
      out[k] = x
    }
  }
  for (const [k, x] of Object.entries(v)) if (!(k in out)) out[k] = x
  return out as unknown as T
}

/** 商社マスタ: id と名前が文字の商社だけ。足りない項目は既定で補う。1 社も無ければサンプルの商社 */
function suppliersOf(v: unknown, warnings: string[]): Workspace['suppliers'] {
  const list = arr<unknown>(v)
  const ok = list
    .filter((x): x is Record<string, unknown> => isObj(x) && str(x.id) && str(x.name))
    .map((x, i) => {
      const def = SAMPLE_SUPPLIERS[i % SAMPLE_SUPPLIERS.length]
      return { ...def, ...x, color: typeof x.color === 'string' ? x.color : def.color, order: typeof x.order === 'number' ? x.order : i, kind: x.kind === '直販' ? '直販' : '商社', tradable: x.tradable !== false, avl: x.avl !== false, handledMakers: arr<unknown>(x.handledMakers).filter((m) => typeof m === 'string'), onTimeRate: typeof x.onTimeRate === 'number' && Number.isFinite(x.onTimeRate) ? x.onTimeRate : null } as Workspace['suppliers'][number]
    })
  if (ok.length < list.length) warnings.push(`商社マスタの ${list.length - ok.length} 件は形式が読めないので外しました`)
  return ok.length ? ok : SAMPLE_SUPPLIERS
}

/** ルール: id・種類・項目が文字のものだけ */
function rulesOf(v: unknown, warnings: string[]): Workspace['rules'] {
  if (!Array.isArray(v)) return DEFAULT_RULES
  const regexOk = (x: unknown) => {
    if (x == null || x === '') return true
    if (typeof x !== 'string') return false
    try {
      new RegExp(x)
      return true
    } catch {
      return false
    }
  }
  const ok = v.filter((x): x is Workspace['rules'][number] => isObj(x) && str(x.id) && str(x.type) && str(x.field) && typeof x.message === 'string' && regexOk(x.pattern) && regexOk(x.when))
  if (ok.length < v.length) warnings.push(`ルールの ${v.length - ok.length} 件は形式が読めないので外しました`)
  return ok
}

/** 案件設定の日数・金額を、設定画面と同じ範囲に収める（JSON の 1e8 日などで処理が止まらないように） */
function clampSettings<T extends object>(st: T): T {
  const out = { ...st } as unknown as Record<string, unknown>
  const clamp = (k: string, min: number, max: number, int = false) => {
    const v = out[k]
    if (typeof v !== 'number' || !Number.isFinite(v)) return
    const c = Math.min(max, Math.max(min, int ? Math.round(v) : v))
    out[k] = c
  }
  for (const k of ['processDays', 'quoteDays', 'formalDays', 'leadMarginDays']) clamp(k, 0, 365, true)
  for (const k of ['externalApprovalBudgetPct', 'exceptionPct', 'formalDiffPct', 'qtyTolerancePct', 'tieThreshold']) clamp(k, 0, 100)
  for (const k of ['externalApprovalAmount', 'exceptionAmount', 'formalDiffAmount', 'surplusAmount', 'budget']) clamp(k, 0, 1e12)
  return out as unknown as T
}
