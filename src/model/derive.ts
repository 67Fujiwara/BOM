import type { DesignFields, Issue, Project, Role, Row, RowStatus, Supplier, Workspace } from './types'
import { addDays, addBusinessDays, businessDaysBetween, diffDays, todayStr } from './dates'

/** 設計が見ている値（公開値 ＋ PM 承認待ちの変更 ＋ 作業中）。購買・PM や計算には使わない */
export function effective(row: Row): DesignFields {
  if (!row.working && !row.pendingApproval) return row
  return { ...row, ...(row.pendingApproval ?? {}), ...(row.working ?? {}) }
}

/** 役割に応じて見せる値（設計は作業中を含む、他は公開値） */
export function valuesFor(row: Row, role: Role): DesignFields {
  return role === 'design' ? effective(row) : row
}

export function isActive(row: Row): boolean {
  return row.status !== 'cancelled' && row.status !== 'replaced'
}

/** 見積対象外（分母から外す） */
export function isQuotable(row: Row): boolean {
  return isActive(row) && (row.procurement === '相見積' || isFixedProcurement(row))
}

/** 指定商社・客先指定品: 見積は指定先 1 社、スコアなしで選定済に固定（§3.4） */
export function isFixedProcurement(row: Pick<Row, 'procurement'>): boolean {
  return row.procurement === '指定商社' || row.procurement === '客先指定品'
}

/** 指定先の商社。指定商社は指定先、客先指定品は購買が見積を入れた商社（無ければそのメーカを扱う第 1 商社） */
/** メーカ名の表記ゆれ（英字の大小・全角・会社の種類・カナと英字）をそろえる */
const MAKER_ALIASES: Record<string, string> = {
  omron: 'オムロン', mitsubishi: '三菱', mitsubishielectric: '三菱', 三菱電機: '三菱', panasonic: 'パナソニック', keyence: 'キーエンス',
  fujielectric: '富士電機', misumi: 'ミスミ', murata: '村田製作所', murataseisakusho: '村田製作所', rohm: 'ローム', toshiba: '東芝',
  renesas: 'ルネサス', idec: 'idec', azbil: 'アズビル', hitachi: '日立', yaskawa: '安川電機', phoenixcontact: 'フエニックス・コンタクト',
  wago: 'ワゴ', taiyoyuden: '太陽誘電', kyocera: '京セラ', nichicon: 'ニチコン', patlite: 'パトライト', nidec: 'ニデック', 日本電産: 'ニデック',
  schneider: 'シュナイダー', schneiderelectric: 'シュナイダー', siemens: 'シーメンス', abb: 'abb', tdk: 'tdk', smc: 'smc', ckd: 'ckd',
}
export function makerKey(m: string): string {
  const k = m
    .normalize('NFKC')
    .toLowerCase()
    .replace(/株式会社|有限会社|\(株\)|\(有\)|corporation|corp\.?|co\.,?\s*ltd\.?|ltd\.?|inc\.?|gmbh|[\s・.,、]/g, '')
  return MAKER_ALIASES[k] ?? k
}
/** 商社の取扱メーカにそのメーカが入っているか（表記ゆれ・「三菱」と「三菱電機」のような前方一致も同じとみる） */
export function handlesMaker(handled: string[], maker: string): boolean {
  const m = makerKey(maker)
  if (!m) return false
  return handled.some((h) => {
    const k = makerKey(h)
    return !!k && (k === m || (Math.min(k.length, m.length) >= 2 && (k.startsWith(m) || m.startsWith(k))))
  })
}

export function fixedSupplierId(p: Project, row: Row, suppliers: Supplier[]): string | null {
  if (row.procurement === '指定商社') {
    const d = (row.designated ?? '').trim()
    return suppliers.find((x) => x.id === d || x.name === d)?.id ?? null
  }
  if (row.procurement === '客先指定品') {
    // 一度決まった商社（採用済み・見積を依頼した商社）は、値を入れた順番で変えない
    if (row.adoptedSupplierId) return row.adoptedSupplierId
    // 最初に頼んだ商社（辞退していないもの）。辞退したら次に頼んだ・単価を入れた商社 → そのメーカを扱う商社の順。
    // 頼んだ商社の回答前に別の商社の欄に値を入れても、指定先は変わらない
    const live = p.quotes.filter((x) => x.rowId === row.id && !x.stale && x.leadDays !== -1)
    if (live[0]) return live[0].supplierId
    const declined = new Set(p.quotes.filter((x) => x.rowId === row.id && !x.stale && x.leadDays === -1).map((x) => x.supplierId))
    let cands = p.supplierIds.map((id) => suppliers.find((x) => x.id === id)).filter((x): x is Supplier => !!x && !declined.has(x.id) && x.tradable !== false)
    // 案件の相見積先がすべて辞退したら、商社マスタの中から（メーカを扱う商社を先に）
    if (!cands.length) cands = suppliers.filter((x) => !declined.has(x.id) && x.tradable !== false)
    return (cands.find((x) => handlesMaker(x.handledMakers, row.maker)) ?? cands.find((x) => !x.handledMakers.length) ?? cands[0])?.id ?? null
  }
  return null
}

/** 発注数（購買が入れていなければ公開済の必要数） */
export function orderQty(row: Row): number {
  return row.orderQty ?? row.qtyNeeded
}

/** 案件の必要日 = 納期 − 社内工程日数 */
export function projectNeedDate(p: Project): string | null {
  if (!p.dueDate) return null
  return addDays(p.dueDate, -p.settings.processDays)
}
/** 行の必要日。計算には公開値を使う（working=true なら設計の作業中の値で） */
export function rowNeedDate(p: Project, row: Row, working = false): string | null {
  const e = working ? effective(row) : row
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
  if (f.pmPending || f.formalDiff || (f.leadNG && !f.countermeasure) || f.ltbPending || capPending(p, row)) return 'pm'
  if (f.importMismatch) return 'purchasing'
  const issues = openIssues(p, row.id)
  if (issues.some((i) => i.bounceCount >= 2 && i.status === 'open' && !i.pmRuled)) return 'pm'
  // 発注後変更依頼は PM の承認待ち（§6.2 A＝PM）
  if (issues.some((i) => i.kind === '発注後変更依頼' && (i.status === 'open' || i.status === 'inProgress') && !i.pmRuled) && !f.orderCancelApproved) return 'pm'
  if (f.orderCancelApproved) return 'purchasing'
  if (issues.some((i) => (i.status === 'open' || i.status === 'inProgress') && resolverOfIssue(i) === 'design')) return 'design'
  if (issues.some((i) => (i.status === 'open' || i.status === 'inProgress') && resolverOfIssue(i) === 'purchasing')) return 'purchasing'
  const pending = issues.find((i) => i.status === 'fixed' || i.status === 'answered')
  if (pending) return pending.by.role === 'pm' ? 'pm' : pending.by.role
  if (f.altPending) return 'design'
  // 指定商社の指定先が辞退（取扱なし）: 設計が指定先を変える
  if (row.procurement === '指定商社' && designatedDeclined(p, row)) return 'design'
  if (f.countermeasure === '代替品検討') return 'design'
  if (f.countermeasure === '商社変更' || f.delegated) return 'purchasing'
  if (row.status === 'draft' || hasWork(row)) return 'design'
  if (f.requote || f.reconfirm || f.orderQtyCheck || f.notation || f.reissue) return 'purchasing'
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
    if (r.procurement === '支給品' || r.procurement === '社内在庫') continue
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
  c.pm += p.caseDecisions.filter((x) => x.status === 'open').length
  return c
}

/** 設計待ちの内訳（指摘・選定待ち・その他） */
export function designBreakdown(p: Project): { issues: number; selecting: number; other: number } {
  const out = { issues: 0, selecting: 0, other: 0 }
  for (const r of p.rows) {
    if (ball(p, r) !== 'design') continue
    if (openIssues(p, r.id).some((i) => (i.status === 'open' || i.status === 'inProgress') && resolverOfIssue(i) === 'design')) out.issues++
    else if (r.status === 'quoted' || r.flags.contested) out.selecting++
    else out.other++
  }
  return out
}

export function unpublishedCount(p: Project, userName?: string): { rows: number; issues: number } {
  const rows = p.rows.filter((r) => hasWork(r) || (r.status === 'draft' && r.publishedRev == null && (r.name || r.model))).length
  const issues = p.issues.filter((i) => i.status === 'draft' && (!userName || i.by.name === userName)).length
  return { rows, issues }
}

/** 正規化後の型式（空白・全角半角・大文字小文字・区切り記号を無視） */
export function normalizeModel(s: string): string {
  // NFKC で全角の英数字・記号（．／＿，など）を半角にしてから、空白と区切り記号を除く（§4 型式の正規化）
  return s
    .normalize('NFKC')
    .replace(/[－—–−‐]/g, '-')
    .replace(/[\s\-_/.,()]/g, '')
    .toUpperCase()
}

/** 商社ごとの丸め数量（MOQ で切り上げ。単位が「個」などで入数があれば入数の倍数に。単位が「パック」なら数量はパック数なので入数では丸めない） */
export function roundedQty(qtyNeeded: number, moq: number | null | undefined, packQty: number | null | undefined, unit?: string): number {
  let q = Math.max(qtyNeeded, moq ?? 0)
  if (packQty && packQty > 1 && unit !== 'パック') q = Math.ceil(q / packQty) * packQty
  return q
}

export function quoteResponses(p: Project, row: Row): { answered: number; total: number } {
  const qs = p.quotes.filter((q) => q.rowId === row.id && !q.stale)
  const done = (q: (typeof qs)[number]) => q.unitPrice != null || q.leadDays === -1
  // 指定系の行は、いまの指定先 1 社の回答だけを見る（ほかの商社の見積は数えない）
  if (isFixedProcurement(row)) {
    const sid = fixedSupplierId(p, row, knownSuppliers as Supplier[])
    const q = sid ? qs.find((x) => x.supplierId === sid) : undefined
    return { answered: q && done(q) ? 1 : 0, total: 1 }
  }
  // 頼むつもりの商社（まだ依頼書を出していない商社も）を分母に入れる（1 社だけ頼んで 1 社の回答で見積済にしない）。
  // 案件の相見積先から外した・取引不可にした商社は、回答が無ければ待たない
  const waitable = (id: string) => p.supplierIds.includes(id) && knownSuppliers.find((x) => x.id === id)?.tradable !== false
  // 取引停止にした商社の回答は数えない（その回答では選べない）
  const tradable = (id: string) => knownSuppliers.find((x) => x.id === id)?.tradable !== false
  const counted = qs.filter((q) => done(q) && tradable(q.supplierId))
  const ids = new Set([...counted.map((q) => q.supplierId), ...qs.filter((q) => waitable(q.supplierId)).map((q) => q.supplierId), ...(row.quoteTargets ?? []).filter(waitable)])
  return { answered: counted.length, total: ids.size }
}

/** 見積済の成立条件 */
export function quoteComplete(p: Project, row: Row, today = todayStr()): boolean {
  const { answered, total } = quoteResponses(p, row)
  if (total === 0) return false
  // 取引できる商社の有効な回答（辞退でない）が 1 つも無ければ、選べないので見積済にしない（購買が次の商社に頼む）
  if (!isFixedProcurement(row) && !p.quotes.some((q) => q.rowId === row.id && !q.stale && q.unitPrice != null && q.leadDays !== -1 && knownSuppliers.find((x) => x.id === q.supplierId)?.tradable !== false)) return false
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

/** 設計の未公開の作業（値の変更・取消・置換）があるか */
export function hasWork(r: Row): boolean {
  return (!!r.working && Object.keys(r.working).length > 0) || !!r.removal
}

/** 決定の付帯情報（先行発注の申請内容・特急の上限金額）を文にする。詳細・Excel の変更点に出す */
export function decisionExtra(d: { kind?: string; payload?: Record<string, unknown> }): string {
  const pl = d.payload ?? {}
  const parts: string[] = []
  if (typeof pl.request === 'string' && pl.request) parts.push(`申請: ${pl.request}`)
  if (typeof pl.amount === 'number') parts.push(`${d.kind === '特急・分納' ? '上限' : '金額'} ¥${pl.amount.toLocaleString()}`)
  return parts.join('・')
}

/** 指定商社の指定先が辞退（取扱なし）したか */
export function designatedDeclined(p: Project, row: Row): boolean {
  const d = (row.designated ?? '').trim()
  // 指定先は商社 ID でも商社名でも書ける（画面はどちらも商社名で出す）
  const id = knownSuppliers.find((x) => x.id === d || x.name === d)?.id ?? d
  // 指定先を商社マスタで取引停止にした行も、設計が指定先を変える
  if (!!d && knownSuppliers.find((x) => x.id === id)?.tradable === false) return true
  return !!d && p.quotes.some((q) => q.rowId === row.id && !q.stale && q.supplierId === id && q.leadDays === -1)
}
/** 商社マスタ（指定先の名前から ID を引くため。ストアが読み込み・変更のたびに渡す） */
let knownSuppliers: Array<{ id: string; name: string; tradable?: boolean; handledMakers?: string[] }> = []
export function setKnownSuppliers(list: Array<{ id: string; name: string; tradable?: boolean; handledMakers?: string[] }>) {
  knownSuppliers = list
}

/** 追加費用が PM の決めた特急・分納の上限を超えているか（超えた額の上限の決定を返す） */
export function overCap(p: Project, r: Row): { cap: number; decisionId: string } | null {
  if (r.extraCost == null) return null
  // 上限は「特急・分納」の決定、または上限超過を承認した決定（上限を実費まで引き上げ）
  const d = [...p.decisions].reverse().find((x) => x.rowId === r.id && (x.kind === '特急・分納' || x.payload?.cap === true) && typeof x.payload?.amount === 'number')
  const cap = d?.payload?.amount as number | undefined
  return d && cap != null && r.extraCost > cap ? { cap, decisionId: d.id } : null
}
/** 上限超過で PM の決定を待っているか（却下した額のままなら待たない） */
export function capPending(p: Project, r: Row): boolean {
  return !!overCap(p, r) && r.flags.capRuled !== r.extraCost
}

/** PM 承認待ちの変更セットで足した行（承認まで購買には見せない。§5） */
export function pendingAdd(r: Row): boolean {
  return !!r.flags.pmPending && r.flags.pmReason === '変更セット' && r.status === 'submitted'
}

/** 相見積の依頼先: 案件の相見積先のうち取引できる商社を、行のメーカで絞る（§7）。
 *  扱うメーカが登録されていない商社は絞らない。メーカを扱うと登録した商社が 1 社も無いとき（表記ゆれ・マスタ未登録）は、取りこぼさないよう全社 */
export function makerTargets(p: Project, maker: string | undefined | null, suppliers: Supplier[]): string[] {
  const ids = p.supplierIds.filter((id) => suppliers.find((x) => x.id === id)?.tradable !== false)
  if (!maker) return ids
  const listed = (id: string) => (suppliers.find((x) => x.id === id)?.handledMakers.length ?? 0) > 0
  const explicit = ids.filter((id) => listed(id) && handlesMaker(suppliers.find((x) => x.id === id)!.handledMakers, maker))
  if (!explicit.length) return ids
  return ids.filter((id) => !listed(id) || explicit.includes(id))
}

/** 最小ロット・入数の丸めで余って買う金額（選定後は採用商社、選定前は MOQ がいちばん効く商社） */
export function surplusOf(p: Project, row: Row): { quote: Project['quotes'][number] | undefined; rounded: number; amount: number } {
  const qs = p.quotes.filter((x) => x.rowId === row.id && !x.stale && x.unitPrice != null)
  const q = (row.adoptedSupplierId ? qs.find((x) => x.supplierId === row.adoptedSupplierId) : undefined) ?? [...qs].sort((a, b) => (b.moq ?? 0) - (a.moq ?? 0))[0]
  const rounded = roundedQty(row.qtyNeeded, q?.moq, row.packQty, row.unit)
  return { quote: q, rounded, amount: (rounded - row.qtyNeeded) * (q?.unitPrice ?? 0) }
}

/** 最小ロットの指摘を発行したとき、余剰金額が閾値（§9.1）を超えていれば PM の要決定（閾値超）に載せる */
export function routeSurplusToPm(p: Project, issue: Issue): void {
  if (issue.kind !== '最小ロット') return
  const r = p.rows.find((x) => x.id === issue.rowId)
  if (!r || r.flags.pmPending) return
  if (surplusOf(p, r).amount > p.settings.surplusAmount) {
    r.flags.pmPending = true
    r.flags.pmReason = '閾値超'
  }
}

/**
 * 採用を外す前に呼ぶ: 採用商社に正式見積を依頼していれば「正式依頼取下げ」を付け（購買が元の商社に伝えて x）、
 * 前の正式回答を消す（選び直して依頼したら新しい回答を待つ）
 */
export function withdrawFormal(p: Project, r: Row, suppliers: Supplier[]): void {
  if (!r.adoptedSupplierId) return
  const q = p.quotes.find((x) => x.rowId === r.id && x.supplierId === r.adoptedSupplierId && !x.stale)
  if (!q) return
  if (q.formalRequestNo && ['formalRequested', 'formalQuoted'].includes(r.status)) r.flags.formalWithdrawn = addWithdrawn(r.flags.formalWithdrawn, `${suppliers.find((x) => x.id === q.supplierId)?.name ?? q.supplierId} ${q.formalRequestNo}`)
  q.formalPrice = null
  q.formalLeadDays = null
  q.formalValidUntil = null
  q.formalDiffReason = ''
  q.formalRequestNo = undefined
}

/** 相見積の行で、待つ回答は無いのに取引できる商社の有効な見積が無い（全社辞退・取引停止の商社だけが回答） */
export function noUsableQuote(p: Project, row: Row): boolean {
  if (isFixedProcurement(row) || row.status !== 'quoting') return false
  const { answered, total } = quoteResponses(p, row)
  return total > 0 && answered >= total && !p.quotes.some((q) => q.rowId === row.id && !q.stale && q.unitPrice != null && q.leadDays !== -1 && knownSuppliers.find((x) => x.id === q.supplierId)?.tradable !== false)
}

/** 正式依頼の取下げの印に足す（まだ伝えていない前の取下げを消さない。「商社 依頼No / 商社 依頼No」） */
export function addWithdrawn(cur: string | undefined, add: string): string {
  const list = (cur ?? '').split(' / ').filter(Boolean)
  return list.includes(add) ? list.join(' / ') : [...list, add].join(' / ')
}
