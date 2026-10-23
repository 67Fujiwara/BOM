import { useStore } from '@/model/store'
import type { ChangeReason, DesignFields, Issue, Project, Role, Row, Submission } from '@/model/types'
import { DESIGN_FIELDS, ISSUE_KINDS, ROLE_LABEL } from '@/model/types'
import { colDef, supplierOfCol } from '@/model/columns'
import { effective, isActive, normalizeModel, orderQty, resolverOfIssue, roundedQty } from '@/model/derive'
import { normalize, nextRowId, setStatus } from '@/model/lifecycle'
import { emptyQuote, newRow } from '@/model/sample'
import { checkRow } from '@/model/rules'
import { addBusinessDays, todayStr } from '@/model/dates'
import { parseDate, parseNumber, toHalf, type Parsed } from '@/model/parse'

function st() {
  return useStore.getState()
}

export function canEdit(colKey: string): string | null {
  const d = colDef(colKey)
  if (!d) return '編集できない列です'
  if (d.kind === 'computed') return 'この列は自動計算です'
  const role = st().user().role
  if (!d.editableBy.includes(role)) return `権限なし（${d.editableBy.map((r) => ROLE_LABEL[r]).join('・')}の列）`
  return null
}

const SELECT_ALIASES: Record<string, Record<string, string>> = {
  unit: { k: '個', ko: '個', pcs: '個', h: '本', hon: '本', s: 'セット', set: 'セット', p: 'パック', pack: 'パック', pk: 'パック', shiki: '式', m: 'm', ｍ: 'm', メートル: 'm' },
  procurement: { a: '相見積', ai: '相見積', sh: '指定商社', k: '客先指定品', kyaku: '客先指定品', shi: '支給品', z: '社内在庫', zaiko: '社内在庫' },
  altPolicy: { k: '可', ka: '可', d: '同等品可', f: '不可', fuka: '不可', no: '不可', ng: '不可', kyaku: '客先承認要' },
  makerLock: { s: '指定', shitei: '指定', r: '推奨', suisho: '推奨', n: '任意', nini: '任意' },
  'q.stock': { z: '在庫', zaiko: '在庫', t: '取寄', toriyose: '取寄', j: '受注生産' },
  extraCostKind: { t: '特急', s: '送料', b: '分納', o: 'その他' },
}

const NUM_RULES: Record<string, { min?: number; max?: number; integer?: boolean; label: string }> = {
  qtyNeeded: { min: 0, max: 1e9, label: '必要数' },
  packQty: { min: 1, max: 1e7, integer: true, label: '入数' },
  orderQty: { min: 0, max: 1e9, label: '発注数' },
  needOffset: { min: -730, max: 730, integer: true, label: '必要日(前倒し日数)' },
  extraCost: { min: 0, max: 1e10, label: '追加費用' },
  'q.unitPrice': { min: 0, max: 1e10, label: '単価' },
  'q.formalPrice': { min: 0, max: 1e10, label: '正式単価' },
  'q.moq': { min: 1, max: 1e9, integer: true, label: 'MOQ' },
  'q.leadDays': { min: 0, max: 3650, integer: true, label: '納期（日）' },
  'q.formalLeadDays': { min: 0, max: 3650, integer: true, label: '正式納期（日）' },
}
const TEXT_MAX: Record<string, number> = { note: 1000, name: 200, model: 200, maker: 100, ref: 100, drawing: 100, designated: 200, tags: 100, category: 50, receivedLot: 100, 'q.formalDiffReason': 200 }

/** 入力値を列の型で解釈する。読めないときは ok:false と理由を返す（黙って捨てない） */
export function parseValue(colKey: string, raw: string): Parsed<unknown> {
  const d = colDef(colKey)!
  const base = colKey.includes('@') ? colKey.slice(0, colKey.indexOf('@')) : colKey
  const s = toHalf(raw).trim()
  switch (d.kind) {
    case 'num': {
      if (base === 'q.leadDays' || base === 'q.formalLeadDays') {
        if (/^(即納|在庫|0日?)$/.test(s)) return { ok: true, value: 0 }
        if (/^(取扱なし|取り扱いなし|辞退|-1|×)$/.test(s)) return { ok: true, value: -1 }
        const w = /^(\d+)\s*(週|w)$/i.exec(s)
        if (w) return { ok: true, value: Number(w[1]) * 7 }
        const mo = /^(\d+)\s*(ヶ月|か月|カ月|ヵ月)$/.exec(s)
        if (mo) return { ok: true, value: Number(mo[1]) * 30 }
      }
      return parseNumber(raw, NUM_RULES[base] ?? { label: d.label })
    }
    case 'select': {
      const opts = d.options ?? []
      if (s === '') return { ok: false, error: `${d.label}は空にできません（${opts.join(' / ')}）` }
      const lower = s.toLowerCase()
      const hit = opts.find((o) => o === s) ?? SELECT_ALIASES[base]?.[lower] ?? opts.find((o) => o.startsWith(s)) ?? opts.find((o) => o.toLowerCase().startsWith(lower)) ?? opts.find((o) => o.includes(s))
      if (!hit) return { ok: false, error: `${d.label}に「${raw}」はありません（${opts.join(' / ')}）` }
      return { ok: true, value: hit }
    }
    case 'date':
      return parseDate(raw, { label: d.label })
    case 'bool':
      if (/^(1|y|yes|true|済|○|o|✓|v)$/i.test(s)) return { ok: true, value: true }
      if (/^(|0|n|no|false|×|x|-|未)$/i.test(s)) return { ok: true, value: false }
      return { ok: false, error: `${d.label}は ✓（1）か 空（0）です` }
    default: {
      const v = raw.replace(/[\t\r\n]+/g, ' ')
      const max = TEXT_MAX[base] ?? 500
      if (v.length > max) return { ok: false, error: `${d.label}が長すぎます（${v.length} 文字。上限 ${max}）` }
      return { ok: true, value: v }
    }
  }
}

/** セルの値を書く（設計列は公開済み以降なら作業中に積む）。書けなかったら理由をトーストして false */
export function setCell(rowId: string, colKey: string, raw: string, label = 'セル編集', opts: { quiet?: boolean } = {}): boolean {
  const err = canEdit(colKey)
  if (err) {
    if (!opts.quiet) st().toastMsg(err, 'err')
    return false
  }
  const parsed = parseValue(colKey, raw)
  if (!parsed.ok) {
    if (!opts.quiet) st().toastMsg(parsed.error, 'err')
    return false
  }
  const value = parsed.value
  return st().commit(
    label,
    (p, ws) => {
      const r = p.rows.find((x) => x.id === rowId)
      if (!r) return '行がありません'
      const e = applyCellValue(p, r, colKey, value)
      if (e) return e
      normalize(p, ws)
    },
    { rowId },
  )
}

/** 1 セルの書き込み（commit の中で使う）。書けなければ理由を返す */
export function applyCellValue(p: Project, r: Row, colKey: string, value: unknown): string | void {
  const d = colDef(colKey)!
  const rowId = r.id
  if (!isActive(r)) return `${r.id} は${r.status === 'cancelled' ? '取消' : '置換'}済の行です（編集できません）`
  if (d.perSupplier) {
    const sid = supplierOfCol(colKey)!
    let q = p.quotes.find((x) => x.rowId === rowId && x.supplierId === sid && !x.stale)
    if (!q) {
      q = emptyQuote(rowId, sid)
      p.quotes.push(q)
    }
    const f = colKey.slice(2, colKey.indexOf('@')) as keyof typeof q
    ;(q as unknown as Record<string, unknown>)[f] = value
    if (f === 'unitPrice' && q.quoteQty == null) q.quoteQty = orderQty(r)
    if (f === 'unitPrice' || f === 'leadDays') q.source = '手入力'
    if (r.status === 'submitted' && value != null) setStatus(r, 'quoting')
  } else if (d.design) {
    if (['ordered', 'received'].includes(r.status)) return '発注済以降の行は設計列を変えられません（発注後変更依頼を起票してください）'
    const f = colKey as keyof DesignFields
    if (r.status === 'draft' || r.publishedRev == null) {
      ;(r as unknown as Record<string, unknown>)[f] = value
    } else {
      const w = { ...(r.working ?? {}) } as Record<string, unknown>
      if (JSON.stringify((r as unknown as Record<string, unknown>)[f]) === JSON.stringify(value)) delete w[f]
      else w[f] = value
      r.working = Object.keys(w).length ? (w as Partial<DesignFields>) : undefined
    }
  } else {
    if (colKey === 'ordered' && value === true && r.status !== 'formalQuoted' && !r.flags.early && !['ordered', 'received'].includes(r.status)) return '正式見積済でないと発注できません（先行発注は PM の許可が要ります。Ctrl+K → 先行発注を申請）'
    // PM の決定待ち（差分超過・承認待ち・納期NG）の行は、決定が出るまで発注しない
    if (colKey === 'ordered' && value === true && !r.ordered) {
      if (r.flags.formalDiff) return '正式見積が概算から差分超過です。PM の決定（7 要決定）が出るまで発注できません'
      if (r.flags.pmPending || r.pendingApproval) return 'PM の承認待ちの行です。承認が出るまで発注できません'
      if (r.flags.leadNG) return '納期NG の行です。対策（PM の受入・別商社など）が決まるまで発注できません'
    }
    if (colKey === 'received' && value === true && !r.ordered && r.status !== 'formalQuoted' && !r.flags.early) return '発注前の行は入荷にできません'
    if (colKey === 'ordered' && value === false && r.received) return '入荷済の行です。先に入荷（i）を外してください'
    ;(r as unknown as Record<string, unknown>)[colKey] = value
    if (colKey === 'received' && value === true) r.ordered = true
    if (colKey === 'ordered' && value === false && r.status === 'ordered') setStatus(r, r.flags.early ? 'selected' : 'formalQuoted')
    if (colKey === 'received' && value === false && r.status === 'received') setStatus(r, 'ordered')
  }
}

export function clearCell(rowId: string, colKey: string) {
  setCell(rowId, colKey, '', 'セルを空にする')
}

export function insertBelow(afterId: string | null): string | null {
  if (st().user().role !== 'design') {
    st().toastMsg('権限なし（行の追加は設計）', 'err')
    return null
  }
  let id: string | null = null
  st().commit('行を追加', (p) => {
    id = nextRowId(p)
    const idx = afterId ? p.rows.findIndex((r) => r.id === afterId) : p.rows.length - 1
    const base = idx >= 0 ? p.rows[idx] : undefined
    p.rows.splice(idx + 1, 0, newRow(id, { category: base ? effective(base).category : '', drawing: base ? effective(base).drawing : '' }))
  })
  return id
}

export function duplicateRow(rowId: string): string | null {
  if (st().user().role !== 'design') {
    st().toastMsg('権限なし（行の複製は設計）', 'err')
    return null
  }
  let id: string | null = null
  st().commit('行を複製', (p) => {
    const idx = p.rows.findIndex((r) => r.id === rowId)
    if (idx < 0) return
    id = nextRowId(p)
    const e = effective(p.rows[idx])
    const copy: Partial<Row> = {}
    for (const f of DESIGN_FIELDS) (copy as Record<string, unknown>)[f] = e[f]
    copy.ref = ''
    p.rows.splice(idx + 1, 0, newRow(id, copy))
  })
  return id
}

export function deleteRow(rowId: string) {
  if (st().user().role !== 'design') return st().toastMsg('権限なし（行の削除は設計）', 'err')
  let msg = ''
  st().commit(
    '行を削除',
    (p, ws) => {
      const idx = p.rows.findIndex((r) => r.id === rowId)
      if (idx < 0) return
      const r = p.rows[idx]
      if (!isActive(r)) return `${r.id} はすでに${r.status === 'cancelled' ? '取消' : '置換'}済です`
      if (r.status === 'draft' && r.publishedRev == null) {
        p.rows.splice(idx, 1)
        msg = `${rowId} を削除しました（Ctrl+Z で戻せます）`
      } else {
        if (['ordered', 'received'].includes(r.status)) return '発注済の行は取り消せません（発注後変更依頼を起票）'
        setStatus(r, 'cancelled')
        r.working = undefined
        msg = `${rowId} を取消にしました（提出済の行は取り消し線で残り、次の公開で購買に伝わります。Ctrl+Z で戻せます）`
      }
      normalize(p, ws)
    },
    { rowId },
  )
  if (msg) st().toastMsg(msg, 'info')
}

export function moveRow(rowId: string, dir: -1 | 1) {
  if (st().user().role !== 'design') return st().toastMsg('権限なし（行の並びは設計）', 'err')
  st().commit('行を移動', (p) => {
    const idx = p.rows.findIndex((r) => r.id === rowId)
    const j = idx + dir
    if (idx < 0 || j < 0 || j >= p.rows.length) return
    ;[p.rows[idx], p.rows[j]] = [p.rows[j], p.rows[idx]]
  })
}

export function toggleHidden(rowId: string) {
  let hidden = false
  st().commit('行を隠す/戻す', (p) => {
    const r = p.rows.find((x) => x.id === rowId)
    if (r) {
      r.hidden = !r.hidden
      hidden = r.hidden
    }
  })
  st().toastMsg(hidden ? `${rowId} を隠しました（「1 すべて」で薄く表示。h でもう一度押すと戻る）` : `${rowId} を表示に戻しました`, 'info')
}

/** 置き換え品を作る。指摘・見積・状態を新行に引き継ぎ「要再確認」 */
export function replaceRow(rowId: string, preset?: { model: string; maker: string }): string | null {
  if (st().user().role !== 'design') {
    st().toastMsg('権限なし（置換は設計）', 'err')
    return null
  }
  let id: string | null = null
  st().commit(
    `置換 ${rowId}`,
    (p, ws) => {
      const idx = p.rows.findIndex((r) => r.id === rowId)
      if (idx < 0) return
      const old = p.rows[idx]
      if (!isActive(old)) return `${old.id} は${old.status === 'cancelled' ? '取消' : '置換'}済の行です（置換できません）`
      if (['ordered', 'received'].includes(old.status)) return '発注済の行は置換できません（発注後変更依頼を起票）'
      id = nextRowId(p)
      const e = effective(old)
      const copy: Partial<Row> = {}
      for (const f of DESIGN_FIELDS) (copy as Record<string, unknown>)[f] = e[f]
      if (preset) {
        copy.model = preset.model
        copy.maker = preset.maker
      }
      const nr = newRow(id, { ...copy, replaces: old.id, status: 'draft' })
      if (old.status !== 'draft') nr.flags.reconfirm = true
      p.rows.splice(idx + 1, 0, nr)
      // 見積のコピー
      for (const q of p.quotes.filter((x) => x.rowId === old.id && !x.stale)) p.quotes.push({ ...structuredClone(q), rowId: id!, formalPrice: null, formalLeadDays: null, formalValidUntil: null, formalDiffReason: '', formalRequestNo: undefined })
      // 指摘の引き継ぎ
      for (const i of p.issues.filter((x) => x.rowId === old.id && (x.status === 'open' || x.status === 'answered'))) {
        i.status = 'fixed'
        i.resolution = `置換 → ${id}`
        i.movedTo = id!
      }
      old.replacedBy = id!
      old.working = undefined
      setStatus(old, 'replaced')
      normalize(p, ws)
    },
    { rowId },
  )
  return id
}

export interface PublishPlan {
  rows: Row[]
  draftIssues: Issue[]
  blockedErrors: Array<{ rowId: string; message: string }>
  blockedWarnings: Array<{ rowId: string; message: string }>
  deferred: string[]
  /** 指摘対応でない変更がある行（変更セット。提出後の追加・置換・取消も含む） */
  nonIssueChanges: string[]
  /** 取消して、まだ購買に伝えていない行 */
  cancelled: string[]
  /** 指摘対応の行 */
  issueFixes: Array<{ rowId: string; issue: Issue }>
  /** 直前の Rev に追記できるか */
  canAppend: boolean
}

/** 「あとで」にした問題のうち、まだ残っているもの */
export function activeDeferred(r: Row, rules: Parameters<typeof checkRow>[1], p: Project): string[] {
  if (!r.deferredRules.length) return []
  const live = new Set(checkRow(r, rules, p).map((x) => x.ruleId))
  return r.deferredRules.filter((id) => live.has(id))
}

/** 提出（公開）の計画。ゲート判定と変更理由の要否 */
export function planPublish(p: Project, rules: Parameters<typeof checkRow>[1], user: { name: string; role: Role }, rowIds?: string[]): PublishPlan {
  const isDesign = user.role === 'design'
  const targets = isDesign ? p.rows.filter((r) => isActive(r) && (rowIds ? rowIds.includes(r.id) : true) && ((r.status === 'draft' && r.publishedRev == null && (r.name || r.model)) || (r.working && Object.keys(r.working).length > 0))) : []
  const cancelled = isDesign ? p.rows.filter((r) => r.status === 'cancelled' && r.publishedRev != null && !p.submissions.some((sb) => sb.causes[r.id] === '取消')).map((r) => r.id) : []
  const draftIssues = p.issues.filter((i) => i.status === 'draft' && i.by.name === user.name)
  const last = p.submissions.at(-1)
  const plan: PublishPlan = { rows: targets, draftIssues, blockedErrors: [], blockedWarnings: [], deferred: [], nonIssueChanges: [...cancelled], cancelled, issueFixes: [], canAppend: !!last && last.by.name === user.name && last.acked.length === 0 && !last.revoked && !last.changeSet }
  const afterFirst = p.submissions.length > 0
  for (const r of targets) {
    for (const pr of checkRow(r, rules, p)) {
      if (pr.severity === 'error') plan.blockedErrors.push({ rowId: r.id, message: pr.message })
      else if (!r.ackRules.includes(pr.ruleId) && !r.deferredRules.includes(pr.ruleId)) plan.blockedWarnings.push({ rowId: r.id, message: pr.message })
    }
    if (activeDeferred(r, rules, p).length) plan.deferred.push(r.id)
    // 提出後に足した行・手で置き換えた行は設計変更（提案の適用で作った行は指摘対応）
    if (r.status === 'draft' && r.publishedRev == null && afterFirst && !r.fromIssue) plan.nonIssueChanges.push(r.id)
    if (r.working) {
      const changed = Object.keys(r.working)
      const open = p.issues.filter((i) => i.rowId === r.id && (i.status === 'open' || i.status === 'inProgress') && resolverOfIssue(i) === 'design')
      // 指摘が付いたセルが変わったときだけ対応済
      const fixes = open.filter((i) => (i.field ? changed.includes(i.field as string) : changed.includes('model') || changed.includes('maker')))
      for (const i of fixes) plan.issueFixes.push({ rowId: r.id, issue: i })
      const explained = new Set(fixes.map((i) => i.field as string))
      if (changed.some((f) => !explained.has(f) && !(fixes.length && (f === 'maker' || f === 'model') && fixes.some((i) => i.kind === '廃番' || i.kind === '代替提案')))) plan.nonIssueChanges.push(r.id)
    }
  }
  return plan
}

/** 公開済の行に設計の変更を反映する（公開時、または変更セットの PM 承認時）。見積・状態・フラグも仕様どおりに動かす */
export function applyDesignChange(p: Project, r: Row, values: Partial<DesignFields>, fixedIssueIds: string[], summary?: Submission['summary']) {
  const before = { ...r }
  const changed = (Object.keys(values) as (keyof DesignFields)[]).filter((k) => JSON.stringify(values[k]) !== JSON.stringify(before[k]))
  Object.assign(r, values)
  const inFlight = ['quoting', 'quoted', 'selected', 'formalRequested', 'formalQuoted'].includes(r.status)
  const formalStage = ['formalRequested', 'formalQuoted'].includes(r.status)
  if (changed.includes('model') || changed.includes('maker')) {
    if (summary) summary.modelChanged++
    const sameNorm = normalizeModel(before.model) === normalizeModel(r.model) && before.maker === r.maker
    const hasQuotes = p.quotes.some((x) => x.rowId === r.id && !x.stale && x.unitPrice != null)
    if (inFlight) {
      if (sameNorm) r.flags.notation = true
      else if (fixedIssueIds.length && hasQuotes) {
        r.flags.reconfirm = true
        r.flags.pmReason = undefined
      } else {
        r.flags.requote = true
        r.adoptedSupplierId = undefined
        r.scoreSnapshot = undefined
        for (const q of p.quotes.filter((x) => x.rowId === r.id && !x.stale)) {
          q.stale = true
          q.staleModel = before.model
          p.quotes.push(emptyQuote(r.id, q.supplierId))
        }
        if (['selected', 'formalRequested', 'formalQuoted'].includes(r.status)) setStatus(r, 'submitted')
      }
      if (formalStage && !sameNorm) r.flags.reissue = true
    }
    if (r.altPolicy === '客先承認要' && !sameNorm) r.flags.altPending = true
  }
  if (changed.includes('qtyNeeded')) {
    if (summary && !changed.includes('model')) summary.qtyChanged++
    const q0 = before.qtyNeeded || 1
    const q1 = r.qtyNeeded
    const pct = Math.abs(q1 - q0) / q0
    const crossMoq = p.quotes.some((x) => x.rowId === r.id && !x.stale && x.moq != null && (x.moq > q0) !== (x.moq > q1))
    if (formalStage) {
      r.flags.reissue = true
      r.flags.requote = true
    } else if (inFlight && (pct > p.settings.qtyTolerancePct || crossMoq)) r.flags.requote = true
    else if (inFlight) r.flags.priceCheck = true
    if (r.adoptedSupplierId) {
      const aq = p.quotes.find((x) => x.rowId === r.id && x.supplierId === r.adoptedSupplierId && !x.stale)
      const recalculated = roundedQty(q1, aq?.moq, r.packQty, r.unit)
      const wasManual = r.orderQty != null && r.orderQty !== roundedQty(q0, aq?.moq, before.packQty, before.unit)
      r.orderQty = recalculated
      if (wasManual) r.flags.orderQtyCheck = true
    }
  }
  if ((changed.includes('needOffset') || changed.includes('needDateFixed')) && formalStage) r.flags.reissue = true
  if (summary && !changed.some((c) => c === 'model' || c === 'maker' || c === 'qtyNeeded')) summary.other++
}

export type PublishMode = 'new' | 'append'

/** 公開（Ctrl+Enter）：自分の未公開の行 ＋ 自分の下書き指摘 */
export function publish(rowIds: string[] | undefined, changeSet?: { reason: ChangeReason; changeNo: string }, mode: PublishMode = 'new'): boolean {
  const s = st()
  const user = s.user()
  const plan = planPublish(s.project(), s.ws.rules, user, rowIds)
  if (plan.rows.length === 0 && plan.draftIssues.length === 0 && plan.cancelled.length === 0) {
    s.toastMsg('公開するものがありません（未公開の行・下書き指摘なし）', 'info')
    return false
  }
  if (plan.blockedErrors.length) {
    const b = plan.blockedErrors[0]
    s.toastMsg(`公開できません: エラー ${plan.blockedErrors.length} 件（${b.rowId} ${b.message} … n で移動して直す）`, 'err')
    return false
  }
  if (plan.blockedWarnings.length) {
    const b = plan.blockedWarnings[0]
    s.toastMsg(`公開できません: 未確認の警告 ${plan.blockedWarnings.length} 件（${b.rowId} ${b.message} … 直すか x で確認済みに）`, 'err')
    return false
  }
  if (plan.deferred.length) {
    s.toastMsg(`公開できません: 「あとで」にした問題が ${plan.deferred.length} 行に残っています（${plan.deferred[0]}。直すか、警告なら x で確認済みに）`, 'err')
    return false
  }
  if (plan.nonIssueChanges.length && !changeSet) return false // UI が理由を聞いてから再呼び出し
  let msg = ''
  s.commit(`公開`, (p, ws) => {
    const now = new Date().toISOString()
    const today = todayStr()
    // 指摘の発行
    let issued = 0
    for (const i of p.issues) if (i.status === 'draft' && i.by.name === user.name) {
      i.status = 'open'
      i.rev = p.submissions.at(-1)?.rev
      i.at = now
      const def = ISSUE_KINDS.find((k) => k.kind === i.kind)!
      i.dueAt = addBusinessDays(today, def.dueDays, p.settings.holidays)
      issued++
    }
    // 行の公開：指摘対応と変更セットを別 Rev に分ける
    const fixRows = plan.rows.filter((r) => !plan.nonIssueChanges.includes(r.id))
    const csRows = plan.rows.filter((r) => plan.nonIssueChanges.includes(r.id))
    const cancelGroupIsCs = plan.cancelled.length > 0
    const revs: number[] = []
    const needsApproval = !!changeSet && p.settings.changeNeedsPmApproval
    for (const [group, isCs] of [[fixRows, false], [csRows, true]] as Array<[Row[], boolean]>) {
      if (group.length === 0 && !(isCs && cancelGroupIsCs)) continue
      let sub: Submission
      const last = p.submissions.at(-1)
      if (mode === 'append' && !isCs && last && plan.canAppend) sub = last
      else {
        sub = { rev: (last?.rev ?? 0) + 1, at: now, by: user, rowIds: [], summary: { added: 0, modelChanged: 0, qtyChanged: 0, other: 0, cancelled: 0 }, snapshot: {}, causes: {}, acked: [] }
        if (isCs && changeSet) sub.changeSet = { ...changeSet, approved: !needsApproval }
        p.submissions.push(sub)
      }
      revs.push(sub.rev)
      for (const t of group) {
        const r = p.rows.find((x) => x.id === t.id)!
        if (!sub.rowIds.includes(r.id)) sub.rowIds.push(r.id)
        if (r.status === 'draft' && r.publishedRev == null) {
          setStatus(r, 'submitted')
          sub.summary.added++
          sub.causes[r.id] = r.replaces ? `置換 ${r.replaces}` : '追加'
          const targets = quoteTargets(p, r)
          for (const sid of targets) if (!p.quotes.some((q) => q.rowId === r.id && q.supplierId === sid && !q.stale)) p.quotes.push(emptyQuote(r.id, sid))
        } else if (r.working) {
          const values = r.working
          r.working = undefined
          const fixed = plan.issueFixes.filter((f) => f.rowId === r.id)
          for (const f of fixed) {
            const i = p.issues.find((x) => x.id === f.issue.id)!
            i.status = 'fixed'
            i.resolution = Object.keys(values).map((c) => `${c}: ${String((r as unknown as Record<string, unknown>)[c] ?? '')} → ${String((values as Record<string, unknown>)[c] ?? '')}`).join(', ')
          }
          // 他セルだけ変わった未対応指摘は「対応中」
          for (const i of p.issues) if (i.rowId === r.id && i.status === 'open' && resolverOfIssue(i) === 'design' && !fixed.some((f) => f.issue.id === i.id)) i.status = 'inProgress'
          sub.causes[r.id] = fixed.length ? fixed.map((f) => f.issue.id).join(',') : `変更セット #${sub.rev}${changeSet?.changeNo ? ' ' + changeSet.changeNo : ''}`
          if (isCs && needsApproval) {
            // PM の承認まで公開値は変えない（購買には「承認待ちの変更あり」だけ見える）
            r.pendingApproval = { ...(r.pendingApproval ?? {}), ...values }
            r.pendingRev = sub.rev
            r.flags.pmPending = true
            r.flags.pmReason = '変更セット'
            sub.summary.other++
          } else applyDesignChange(p, r, values, fixed.map((f) => f.issue.id), sub.summary)
        }
        if (isCs && needsApproval && r.status === 'submitted' && !r.pendingApproval) {
          // 提出後に追加した行も承認まで保留
          r.flags.pmPending = true
          r.flags.pmReason = '変更セット'
          r.pendingRev = sub.rev
        }
        r.publishedRev = sub.rev
        r.lastChangeCause = sub.causes[r.id]
        r.deferredRules = r.deferredRules.filter((id) => activeDeferred(r, ws.rules, p).includes(id))
        sub.snapshot[r.id] = { ...pick({ ...r, ...(r.pendingApproval ?? {}) }), status: r.status }
        if (r.status === 'submitted') r.dueAt = addBusinessDays(today, 1, p.settings.holidays)
      }
      // 取消行も差分に（変更セットの Rev に入れる）
      if (isCs || !cancelGroupIsCs) for (const r of p.rows) if (r.status === 'cancelled' && r.publishedRev != null && !p.submissions.some((sb) => sb.causes[r.id] === '取消')) {
        sub.rowIds.push(r.id)
        sub.causes[r.id] = '取消'
        sub.summary.cancelled++
        r.publishedRev = sub.rev
      }
      const sm = sub.summary
      p.events.push({ id: (p.events.at(-1)?.id ?? 0) + 1, at: now, by: user, text: `公開 Rev.${sub.rev}（追加${sm.added} / 型式${sm.modelChanged} / 数量${sm.qtyChanged} / その他${sm.other} / 取消${sm.cancelled}）${isCs && needsApproval ? ' PM承認待ち' : ''}` })
    }
    // Rev.1 で案件設定確定を PM の要決定に載せる
    if (revs.includes(1) && !p.settings.pmConfirmed && !p.caseDecisions.some((c) => c.kind === '案件設定確定')) p.caseDecisions.push({ id: 'C1', kind: '案件設定確定', status: 'open', at: now })
    normalize(p, ws)
    msg = [plan.rows.length ? `行 ${plan.rows.length}（Rev.${revs.join('・')}）` : '', issued ? `指摘 ${issued} 件` : ''].filter(Boolean).join(' / ') + ' を公開しました'
  }, { kind: plan.rows.length ? 'publish' : 'normal' })
  s.toastMsg(msg, 'ok')
  return true
}

/** 見積を依頼する商社（調達区分に応じて） */
export function quoteTargets(p: Project, r: Row): string[] {
  const e = effective(r)
  if (e.procurement === '支給品' || e.procurement === '社内在庫') return []
  if (e.procurement === '指定商社' || e.procurement === '客先指定品') return e.designated && p.supplierIds.includes(e.designated) ? [e.designated] : e.designated && /^S\d+$/.test(e.designated) ? [e.designated] : p.supplierIds.slice(0, 1)
  return p.supplierIds
}

function pick(e: DesignFields): DesignFields {
  const o = {} as DesignFields
  for (const f of DESIGN_FIELDS) (o as unknown as Record<string, unknown>)[f] = e[f]
  return o
}


export function ackRule(rowId: string, ruleId: string) {
  st().commit('警告を確認済み', (p) => {
    const r = p.rows.find((x) => x.id === rowId)
    if (!r) return
    if (r.ackRules.includes(ruleId)) r.ackRules = r.ackRules.filter((x) => x !== ruleId)
    else {
      r.ackRules.push(ruleId)
      r.deferredRules = r.deferredRules.filter((x) => x !== ruleId)
    }
  })
}

/** 「あとで」の切り替え（もう一度で外す） */
export function deferRule(rowId: string, ruleId: string): boolean {
  let on = false
  st().commit('あとで直す', (p) => {
    const r = p.rows.find((x) => x.id === rowId)
    if (!r) return
    if (r.deferredRules.includes(ruleId)) r.deferredRules = r.deferredRules.filter((x) => x !== ruleId)
    else {
      r.deferredRules.push(ruleId)
      on = true
    }
  })
  return on
}

export function applyFix(rowId: string, patch: Partial<Row>, label: string) {
  for (const [k, v] of Object.entries(patch)) setCell(rowId, k, v == null ? '' : String(v), label)
}

/** Excel 貼り付け（タブ区切り）を複数セルに流し込む。1 回の操作として記録し、読めないセルは理由を出す */
export function pasteCells(startRowId: string, startCol: string, visibleCols: string[], orderedRowIds: string[], text: string) {
  const lines = text.replace(/\r/g, '').split('\n')
  if (lines.at(-1) === '') lines.pop()
  const c0 = visibleCols.indexOf(startCol)
  const r0 = orderedRowIds.indexOf(startRowId)
  if (c0 < 0 || r0 < 0) return
  const role = st().user().role
  const cells: Array<{ row: number; col: string; value: unknown }> = []
  const errors: string[] = []
  let skipped = 0
  lines.forEach((line, i) => {
    line.split('\t').forEach((v, j) => {
      const col = visibleCols[c0 + j]
      if (!col) return
      if (canEdit(col)) {
        skipped++
        return
      }
      const parsed = parseValue(col, v)
      if (!parsed.ok) errors.push(`${i + 1}行目 ${colDef(col)?.label}: ${parsed.error}`)
      else cells.push({ row: i, col, value: parsed.value })
    })
  })
  if (errors.length) {
    st().toastMsg(`貼り付けできません（${errors.length} セル）: ${errors[0]}`, 'err')
    return
  }
  const needNew = Math.max(0, r0 + lines.length - orderedRowIds.length)
  if (needNew && role !== 'design') {
    st().toastMsg('貼り付けが表の最後を超えています（行の追加は設計）', 'err')
    return
  }
  let count = 0
  const ok = st().commit('貼り付け', (p, ws) => {
    const ids = [...orderedRowIds]
    for (let k = 0; k < needNew; k++) {
      const id = nextRowId(p)
      const last = p.rows.findIndex((r) => r.id === ids[ids.length - 1])
      p.rows.splice(last + 1, 0, newRow(id))
      ids.push(id)
    }
    for (const c of cells) {
      const r = p.rows.find((x) => x.id === ids[r0 + c.row])
      if (!r) continue
      const e = applyCellValue(p, r, c.col, c.value)
      if (e) return `${r.id}: ${e}`
      count++
    }
    normalize(p, ws)
  })
  if (ok) st().toastMsg(`${count} セルを貼り付けました${needNew ? `（${needNew} 行追加）` : ''}${skipped ? `。書けない列 ${skipped} セルは飛ばしました` : ''}（Ctrl+Z で一度に戻せます）`, 'ok')
}
