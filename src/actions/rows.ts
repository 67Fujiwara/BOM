import { useStore } from '@/model/store'
import type { ChangeReason, DesignFields, Issue, Project, Role, Row, Submission } from '@/model/types'
import { DESIGN_FIELDS, ISSUE_KINDS, ROLE_LABEL } from '@/model/types'
import { colDef, supplierOfCol } from '@/model/columns'
import { effective, isActive, normalizeModel, orderQty, resolverOfIssue, roundedQty } from '@/model/derive'
import { normalize, nextRowId, setStatus } from '@/model/lifecycle'
import { emptyQuote, newRow } from '@/model/sample'
import { checkRow } from '@/model/rules'
import { addBusinessDays, todayStr } from '@/model/dates'

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

export function parseValue(colKey: string, raw: string): unknown {
  const d = colDef(colKey)!
  const s = raw.trim()
  switch (d.kind) {
    case 'num': {
      if (s === '') return null
      if (/^即納$/.test(s)) return 0
      if (/^(取扱なし|辞退)$/.test(s)) return -1
      const n = Number(s.replace(/[,¥￥]/g, ''))
      return Number.isFinite(n) ? n : null
    }
    case 'select': {
      if (s === '') return null
      const opts = d.options ?? []
      return opts.find((o) => o === s) ?? opts.find((o) => o.startsWith(s)) ?? opts.find((o) => o.toLowerCase().startsWith(s.toLowerCase())) ?? s
    }
    case 'date': {
      if (s === '' || s === '未定') return null
      const m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/) ?? s.match(/^(\d{1,2})[-/](\d{1,2})$/)
      if (!m) return s
      const y = m.length === 4 ? m[1] : String(new Date().getFullYear())
      const mo = m.length === 4 ? m[2] : m[1]
      const dd = m.length === 4 ? m[3] : m[2]
      return `${y}-${mo.padStart(2, '0')}-${dd.padStart(2, '0')}`
    }
    case 'bool':
      return /^(1|y|yes|true|済|○|o)$/i.test(s)
    default:
      return raw
  }
}

/** セルの値を書く（設計列は公開済み以降なら作業中に積む） */
export function setCell(rowId: string, colKey: string, raw: string, label = 'セル編集'): boolean {
  const err = canEdit(colKey)
  if (err) {
    st().toastMsg(err, 'err')
    return false
  }
  const d = colDef(colKey)!
  const value = parseValue(colKey, raw)
  let ok = true
  st().commit(
    label,
    (p, ws) => {
      const r = p.rows.find((x) => x.id === rowId)
      if (!r) return '行がありません'
      if (!isActive(r)) return '取消・置換済の行は編集できません'
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
        ;(r as unknown as Record<string, unknown>)[colKey] = value
        if (colKey === 'ordered' && value === true && r.status !== 'formalQuoted' && !r.flags.early && !['ordered', 'received'].includes(r.status)) {
          ok = false
          return '正式見積済でないと発注できません（先行発注は PM の許可「7」が要ります）'
        }
        if (colKey === 'received' && value === true) r.ordered = true
        if (colKey === 'ordered' && value === false) r.received = false
      }
      normalize(p, ws)
    },
    { rowId },
  )
  return ok
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
  st().commit(
    '行を削除',
    (p, ws) => {
      const idx = p.rows.findIndex((r) => r.id === rowId)
      if (idx < 0) return
      const r = p.rows[idx]
      if (r.status === 'draft' && r.publishedRev == null) p.rows.splice(idx, 1)
      else {
        if (['ordered', 'received'].includes(r.status)) return '発注済の行は取り消せません（発注後変更依頼を起票）'
        setStatus(r, 'cancelled')
        r.working = undefined
      }
      normalize(p, ws)
    },
    { rowId },
  )
}

export function moveRow(rowId: string, dir: -1 | 1) {
  st().commit('行を移動', (p) => {
    const idx = p.rows.findIndex((r) => r.id === rowId)
    const j = idx + dir
    if (idx < 0 || j < 0 || j >= p.rows.length) return
    ;[p.rows[idx], p.rows[j]] = [p.rows[j], p.rows[idx]]
  })
}

export function toggleHidden(rowId: string) {
  st().commit('行を隠す/戻す', (p) => {
    const r = p.rows.find((x) => x.id === rowId)
    if (r) r.hidden = !r.hidden
  })
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
      if (['ordered', 'received'].includes(old.status)) return '発注済の行は置換できません'
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
  /** 指摘対応でない変更がある行（変更セット） */
  nonIssueChanges: string[]
  /** 指摘対応の行 */
  issueFixes: Array<{ rowId: string; issue: Issue }>
  /** 直前の Rev に追記できるか */
  canAppend: boolean
}

/** 提出（公開）の計画。ゲート判定と変更理由の要否 */
export function planPublish(p: Project, rules: Parameters<typeof checkRow>[1], user: { name: string; role: Role }, rowIds?: string[]): PublishPlan {
  const targets = user.role === 'design' ? p.rows.filter((r) => isActive(r) && (rowIds ? rowIds.includes(r.id) : true) && ((r.status === 'draft' && r.publishedRev == null && (r.name || r.model)) || (r.working && Object.keys(r.working).length > 0))) : []
  const draftIssues = p.issues.filter((i) => i.status === 'draft' && i.by.name === user.name)
  const last = p.submissions.at(-1)
  const plan: PublishPlan = { rows: targets, draftIssues, blockedErrors: [], blockedWarnings: [], deferred: [], nonIssueChanges: [], issueFixes: [], canAppend: !!last && last.by.name === user.name && last.acked.length === 0 && !last.revoked && !last.changeSet }
  for (const r of targets) {
    for (const pr of checkRow(r, rules, p)) {
      if (pr.severity === 'error') plan.blockedErrors.push({ rowId: r.id, message: pr.message })
      else if (!r.ackRules.includes(pr.ruleId)) plan.blockedWarnings.push({ rowId: r.id, message: pr.message })
    }
    if (r.deferredRules.length) plan.deferred.push(r.id)
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

export type PublishMode = 'new' | 'append'

/** 公開（Ctrl+Enter）：自分の未公開の行 ＋ 自分の下書き指摘 */
export function publish(rowIds: string[] | undefined, changeSet?: { reason: ChangeReason; changeNo: string }, mode: PublishMode = 'new'): boolean {
  const s = st()
  const user = s.user()
  const plan = planPublish(s.project(), s.ws.rules, user, rowIds)
  if (plan.rows.length === 0 && plan.draftIssues.length === 0) {
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
    s.toastMsg(`公開できません: 「あとで」にした問題が ${plan.deferred.length} 行に残っています`, 'err')
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
    const revs: number[] = []
    const needsApproval = !!changeSet && p.settings.changeNeedsPmApproval
    for (const [group, isCs] of [[fixRows, false], [csRows, true]] as Array<[Row[], boolean]>) {
      if (group.length === 0) continue
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
          const before = { ...r }
          const changed = Object.keys(r.working) as (keyof DesignFields)[]
          Object.assign(r, r.working)
          r.working = undefined
          const fixed = plan.issueFixes.filter((f) => f.rowId === r.id)
          for (const f of fixed) {
            const i = p.issues.find((x) => x.id === f.issue.id)!
            i.status = 'fixed'
            i.resolution = changed.map((c) => `${c}: ${String((before as unknown as Record<string, unknown>)[c] ?? '')} → ${String((r as unknown as Record<string, unknown>)[c] ?? '')}`).join(', ')
          }
          // 他セルだけ変わった未対応指摘は「対応中」
          for (const i of p.issues) if (i.rowId === r.id && i.status === 'open' && resolverOfIssue(i) === 'design' && !fixed.some((f) => f.issue.id === i.id)) i.status = 'inProgress'
          sub.causes[r.id] = fixed.length ? fixed.map((f) => f.issue.id).join(',') : `変更セット #${sub.rev}${changeSet?.changeNo ? ' ' + changeSet.changeNo : ''}`
          const inFlight = ['quoting', 'quoted', 'selected', 'formalRequested', 'formalQuoted'].includes(r.status)
          const formalStage = ['formalRequested', 'formalQuoted'].includes(r.status)
          if (changed.includes('model') || changed.includes('maker')) {
            sub.summary.modelChanged++
            const sameNorm = normalizeModel(before.model) === normalizeModel(r.model) && before.maker === r.maker
            if (inFlight) {
              if (sameNorm) r.flags.notation = true
              else if (fixed.length) {
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
              }
              if (formalStage && !sameNorm) r.flags.reissue = true
            }
          } else if (changed.includes('qtyNeeded')) {
            sub.summary.qtyChanged++
            const q0 = before.qtyNeeded || 1
            const q1 = r.qtyNeeded
            const pct = Math.abs(q1 - q0) / q0
            const crossMoq = p.quotes.some((x) => x.rowId === r.id && !x.stale && x.moq != null && (x.moq > q0) !== (x.moq > q1))
            if (formalStage) {
              r.flags.reissue = true
              r.flags.requote = true
            } else if (inFlight && (pct > p.settings.qtyTolerancePct || crossMoq)) r.flags.requote = true
            else if (inFlight) r.flags.priceCheck = true
            // 発注数の再計算
            if (r.adoptedSupplierId) {
              const aq = p.quotes.find((x) => x.rowId === r.id && x.supplierId === r.adoptedSupplierId && !x.stale)
              const recalculated = roundedQty(q1, aq?.moq, r.packQty)
              const wasManual = r.orderQty != null && r.orderQty !== roundedQty(q0, aq?.moq, before.packQty)
              r.orderQty = recalculated
              if (wasManual) r.flags.orderQtyCheck = true
            }
          } else if (changed.includes('needOffset') || changed.includes('needDateFixed')) {
            sub.summary.other++
            if (formalStage) r.flags.reissue = true
          } else sub.summary.other++
          if (isCs && needsApproval) {
            r.flags.pmPending = true
            r.flags.pmReason = '変更セット'
          }
        }
        r.publishedRev = sub.rev
        r.lastChangeCause = sub.causes[r.id]
        r.deferredRules = []
        sub.snapshot[r.id] = { ...pick(effective(r)), status: r.status }
        if (r.status === 'submitted') r.dueAt = addBusinessDays(today, 1, p.settings.holidays)
      }
      // 取消行も差分に
      for (const r of p.rows) if (r.status === 'cancelled' && !p.submissions.some((sb) => sb.causes[r.id] === '取消')) {
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
  })
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
    else r.ackRules.push(ruleId)
  })
}

export function deferRule(rowId: string, ruleId: string) {
  st().commit('あとで直す', (p) => {
    const r = p.rows.find((x) => x.id === rowId)
    if (r && !r.deferredRules.includes(ruleId)) r.deferredRules.push(ruleId)
  })
}

export function applyFix(rowId: string, patch: Partial<Row>, label: string) {
  for (const [k, v] of Object.entries(patch)) setCell(rowId, k, v == null ? '' : String(v), label)
}

/** Excel 貼り付け（タブ区切り）を複数セルに流し込む */
export function pasteCells(startRowId: string, startCol: string, visibleCols: string[], orderedRowIds: string[], text: string) {
  const lines = text.replace(/\r/g, '').split('\n').filter((l, i, a) => !(i === a.length - 1 && l === ''))
  const c0 = visibleCols.indexOf(startCol)
  const r0 = orderedRowIds.indexOf(startRowId)
  if (c0 < 0 || r0 < 0) return
  let count = 0
  lines.forEach((line, i) => {
    const cells = line.split('\t')
    let rowId = orderedRowIds[r0 + i]
    if (!rowId) {
      rowId = insertBelow(orderedRowIds[orderedRowIds.length - 1]) ?? ''
      if (!rowId) return
      orderedRowIds.push(rowId)
    }
    cells.forEach((v, j) => {
      const col = visibleCols[c0 + j]
      if (!col || canEdit(col)) return
      setCell(rowId, col, v, '貼り付け')
      count++
    })
  })
  st().toastMsg(`${count} セルを貼り付けました`, 'ok')
}
