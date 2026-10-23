import type { Project, Row, Workspace } from './types'
import { DEFAULT_RULES, DEFAULT_SETTINGS, SAMPLE_SUPPLIERS, newRow } from './sample'
import { DEFAULT_WEIGHTS } from './score'

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const arr = <T,>(v: unknown, fallback: T[] = []): T[] => (Array.isArray(v) ? (v as T[]) : fallback)

const str = (v: unknown): v is string => typeof v === 'string' && v !== ''
// 文字で書いた数（"1200"）も数として読む
const numOrNull = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && /^\s*-?\d+(\.\d+)?\s*$/.test(v) ? Number(v) : null)
/** 日付を YYYY-MM-DD にそろえる（時刻つき・0 の無い月日も日付の部分を読む）。実在しなければ null */
const normDate = (v: unknown): string | null => {
  if (typeof v !== 'string') return null
  const m = /^\s*(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ]\d{1,2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?\s*$/.exec(v)
  if (!m) return null
  const d = `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
  return realDate(d) ? d : null
}
/** 見積の単価・数量は 0 以上、納期は 0 以上か -1（取扱なし） */
const nonNeg = (v: unknown, allowDecline = false): number | null => {
  const n = numOrNull(v)
  return n == null ? null : (n >= 0 && n <= 1e12) || (allowDecline && n === -1) ? n : null
}
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
    for (const [ri, r0] of arr<unknown>(p0.rows).entries()) {
      // 数字の id（R を付けずに書いた 81 など）は文字にして読む
      const r = isObj(r0) && typeof r0.id === 'number' && Number.isFinite(r0.id) ? { ...r0, id: String(r0.id) } : r0
      if (!isObj(r) || !str(r.id)) warnings.push(`案件 ${p0.id} の rows[${ri}] は id が無いので外しました`)
      else if (seenRow.has(r.id)) warnings.push(`案件 ${p0.id} の行 ${r.id} が重複していたので 2 つ目以降を外しました`)
      else {
        seenRow.add(r.id)
        rows.push(r as Partial<Row>)
      }
    }
    const rowIds = seenRow
    // 値を直して読んだ項目（数量の無い・読めない・負の値、存在しない日付）を数えて知らせる
    const fixes: Record<string, number> = {}
    const fallbackUser = { name: '不明', role: 'design' as const }
    for (const k of ['rows', 'quotes', 'issues', 'submissions', 'decisions'] as const) if (p0[k] !== undefined && !Array.isArray(p0[k])) warnings.push(`案件 ${p0.id} の ${k} が一覧の形ではないので読めませんでした`)
    const issues0 = arr<unknown>(p0.issues).map((x) => (isObj(x) && typeof x.id === 'number' && Number.isFinite(x.id) ? { ...x, id: String(x.id) } : x))
    // 数字で書いた行 ID（81 など）は、行と同じく文字にして突き合わせる
    const idStr = (x: unknown) => (isObj(x) && typeof x.rowId === 'number' && Number.isFinite(x.rowId) ? { ...x, rowId: String(x.rowId) } : x)
    const issues = issues0
      .map(idStr)
      .filter((x): x is Record<string, unknown> => isObj(x) && str(x.id) && str(x.rowId) && rowIds.has(x.rowId as string) && typeof x.kind === 'string')
      .map((x) => ({ ...x, by: userOf(x.by, fallbackUser), status: ISSUE_STATUS_OK.includes(String(x.status)) ? x.status : 'open', text: typeof x.text === 'string' ? x.text : '', replies: arr<unknown>(x.replies).filter(isObj).map((rp) => ({ ...rp, by: userOf(rp.by, fallbackUser), text: typeof rp.text === 'string' ? rp.text : '' })), bounceCount: Number(x.bounceCount) || 0 })) as unknown as Project['issues']
    if (issues.length < issues0.length) warnings.push(`案件 ${p0.id} の指摘 ${issues0.length - issues.length} 件は形式が読めないので外しました`)
    const quotes0 = arr<unknown>(p0.quotes)
    const quotes = quotes0
      .map(idStr)
      .filter((q): q is Record<string, unknown> => isObj(q) && str(q.rowId) && str(q.supplierId) && rowIds.has(q.rowId as string))
      .map((q) => ({ ...q, validUntil: normDate(q.validUntil), formalValidUntil: normDate(q.formalValidUntil), stock: q.stock === '在庫' || q.stock === '取寄' || q.stock === '受注生産' ? q.stock : null, source: typeof q.source === 'string' ? q.source : undefined, formalDiffReason: typeof q.formalDiffReason === 'string' ? q.formalDiffReason : '', unitPrice: nonNeg(q.unitPrice), leadDays: nonNeg(q.leadDays, true), moq: nonNeg(q.moq), quoteQty: nonNeg(q.quoteQty), formalPrice: nonNeg(q.formalPrice), formalLeadDays: nonNeg(q.formalLeadDays, true), note: typeof q.note === 'string' ? q.note : '' })) as unknown as Project['quotes']
    const negs = quotes0.filter((q) => isObj(q) && ['unitPrice', 'leadDays', 'moq', 'quoteQty', 'formalPrice', 'formalLeadDays'].some((k) => typeof q[k] === 'number' && nonNeg(q[k], k === 'leadDays' || k === 'formalLeadDays') === null)).length
    if (negs) warnings.push(`案件 ${p0.id} の見積 ${negs} 件に負の値・範囲外の値（単価・納期・MOQ・数量）があったので空にしました`)
    const badDates = quotes0.filter((q) => isObj(q) && ['validUntil', 'formalValidUntil'].some((k) => q[k] != null && q[k] !== '' && !normDate(q[k]))).length
    if (badDates) warnings.push(`案件 ${p0.id} の見積 ${badDates} 件の有効期限が日付（YYYY-MM-DD）として読めないので空にしました`)
    if (p0.dueDate != null && p0.dueDate !== '' && !normDate(p0.dueDate)) warnings.push(`案件 ${p0.id} の納期「${String(p0.dueDate)}」は日付（YYYY-MM-DD）として読めないので空にしました（案件設定で入れ直してください）`)
    const hol0 = isObj(p0.settings) ? arr<unknown>(p0.settings.holidays) : []
    const badHol = hol0.filter((x) => !normDate(x)).length
    if (badHol) warnings.push(`案件 ${p0.id} の休日 ${badHol} 件は日付として読めないので外しました`)
    const holN = new Set(hol0.map(normDate).filter(Boolean)).size
    if (holN > 3000) warnings.push(`案件 ${p0.id} の休日 ${holN} 件のうち、3,000 件まで読みました`)
    if (quotes.length < quotes0.length) warnings.push(`案件 ${p0.id} の見積 ${quotes0.length - quotes.length} 件は形式が読めないので外しました`)
    const now = new Date().toISOString()
    const p: Project = {
      ...(p0 as unknown as Project),
      name: typeof p0.name === 'string' ? p0.name : p0.id,
      dueDate: normDate(p0.dueDate),
      members: isObj(p0.members) ? (p0.members as Project['members']) : { design: '', purchasing: '', pm: '' },
      preferredSupplierIds: arr(p0.preferredSupplierIds),
      supplierIds: arr(p0.supplierIds),
      rows: rows.map((r) => coerceRow(r as Record<string, unknown>, fixes)),
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
      settings: isObj(p0.settings) ? clampSettings(coerceLike(DEFAULT_SETTINGS, { ...(p0.settings as object), holidays: [...new Set(arr<unknown>(p0.settings.holidays).map(normDate).filter((x): x is string => !!x))].slice(0, 3000) })) : { ...DEFAULT_SETTINGS },
      events: arr<Project['events'][number]>(p0.events).filter(isObj).map((ev) => ({ ...ev, by: userOf(ev.by, fallbackUser), text: typeof ev.text === 'string' ? ev.text : '' })),
      createdAt: typeof p0.createdAt === 'string' ? p0.createdAt : now,
      updatedAt: typeof p0.updatedAt === 'string' ? p0.updatedAt : now,
      version: Number(p0.version) || 1,
      requestRevs: isObj(p0.requestRevs) ? (p0.requestRevs as Project['requestRevs']) : {},
      nextIssueNo: Number(p0.nextIssueNo) || arr(p0.issues).length + 1,
      nextDecisionNo: Number(p0.nextDecisionNo) || arr(p0.decisions).length + 1,
      caseDecisions: arr<Project['caseDecisions'][number]>(p0.caseDecisions).filter((c) => isObj(c) && str(c.id) && typeof c.kind === 'string' && (c.status === 'open' || c.status === 'done')),
    }
    for (const [k, n] of Object.entries(fixes)) warnings.push(`案件 ${p0.id}: ${k} ${n} 行`)
    // 前の版で残った「発注済 · 再発行」の印は、読み込んだときに外す（発注後の変更は発注後変更依頼で扱う）
    for (const r of p.rows) if (r.flags?.reissue && (r.status === 'ordered' || r.status === 'received')) r.flags.reissue = false
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
function coerceRow(r0: Record<string, unknown>, fixes: Record<string, number> = {}): Row {
  let r = r0
  // 直した項目は、件数と最初の行 ID を知らせる
  const note = (k: string) => {
    const key = Object.keys(fixes).find((x) => x.startsWith(k + '（')) ?? `${k}（例: ${String(r0.id)}）`
    fixes[key] = (fixes[key] ?? 0) + 1
  }
  const q = r.qtyNeeded
  if (q === undefined || q === null || typeof q === 'boolean' || Array.isArray(q) || q === '' || (typeof q === 'number' && !Number.isFinite(q)) || (typeof q !== 'number' && !Number.isFinite(Number(q)))) {
    note('必要数が無い・読めないので 1 にした')
    r = { ...r, qtyNeeded: 1 }
  } else if (Number(q) < 0) note('必要数が負なので 0 にした')
  else if (Number(q) > 1e9) {
    note('必要数が大きすぎるので 1,000,000,000 にした')
    r = { ...r, qtyNeeded: 1e9 }
  }
  for (const k of ['packQty', 'orderQty'] as const) if (typeof r[k] === 'number' && (r[k] as number) < (k === 'packQty' ? 1 : 0)) {
    note(`${k === 'packQty' ? '入数' : '発注数'}が範囲外なので外した`)
    r = { ...r, [k]: null }
  }
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
  if (typeof out.qtyNeeded === 'number' && out.qtyNeeded < 0) out.qtyNeeded = 0
  // 日付の項目は、実在する YYYY-MM-DD だけ（「2026-02-30」「明日」は外す）
  for (const k of ['needDateFixed', 'promisedDate']) {
    const v = out[k]
    if (typeof v === 'string' && v !== '' && !realDate(v)) {
      out[k] = null
      note('日付が読めないので外した')
    }
  }
  if (!STATUSES.includes(String(out.status))) out.status = 'draft'
  out.flags = isObj(r.flags) ? r.flags : {}
  out.ackRules = arr<unknown>(r.ackRules).filter((x) => typeof x === 'string')
  out.quoteTargets = r.quoteTargets === undefined ? undefined : arr<unknown>(r.quoteTargets).filter((x): x is string => typeof x === 'string')
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
      else if (f === 'needDateFixed' ? typeof v === 'string' && realDate(v) : f === 'needOffset' || f === 'packQty' ? typeof v === 'number' && Number.isFinite(v) : typeof def === typeof v && (typeof v !== 'number' || Number.isFinite(v))) kept[f] = v
      else note('作業中の値が読めないので外した')
    }
    // 作業中の必要数・入数も、行の値と同じ範囲に
    if (typeof kept.qtyNeeded === 'number' && (kept.qtyNeeded < 0 || kept.qtyNeeded > 1e9)) {
      kept.qtyNeeded = Math.min(1e9, Math.max(0, kept.qtyNeeded))
      note('作業中の必要数が範囲外なので直した')
    }
    if (typeof kept.packQty === 'number' && kept.packQty < 1) {
      kept.packQty = null
      note('作業中の入数が 1 未満なので外した')
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

function realDate(v: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v)
  if (!m) return false
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return d.getFullYear() === Number(m[1]) && d.getMonth() === Number(m[2]) - 1 && d.getDate() === Number(m[3])
}
