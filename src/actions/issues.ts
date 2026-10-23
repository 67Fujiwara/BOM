import { useStore } from '@/model/store'
import type { Issue, IssueKind, Project, Role, Row, Rule } from '@/model/types'
import { ISSUE_KINDS, ROLE_LABEL } from '@/model/types'
import { effective, isActive as isActiveRow, openIssues, orderQty, resolverOfIssue, roundedQty } from '@/model/derive'
import { replaceRow } from './rows'
import { normalize } from '@/model/lifecycle'
import { addBusinessDays, todayStr } from '@/model/dates'

function st() {
  return useStore.getState()
}

export function issueKindDef(kind: IssueKind) {
  return ISSUE_KINDS.find((k) => k.kind === kind)!
}

/** この行にこの種別を起票できるか */
export function canRaise(row: Row, kind: IssueKind): string | null {
  const def = issueKindDef(kind)
  const e = effective(row)
  if (def.blockedFor.includes(e.procurement)) return `${e.procurement} の行には「${kind}」を起票できません`
  if (def.blockedIfNoAlt && e.altPolicy === '不可') return `代替不可の行には「${kind}」を起票できません`
  return null
}

/** 役割ごとに手で起票できる種別（納期NG・コスト超過は PM の決定からだけ自動起票） */
export function kindsForRole(role: Role): IssueKind[] {
  if (role === 'purchasing') return ['型式あいまい', 'メーカ未記入', '廃番', '代替提案', '最小ロット', '数量見直し依頼', '質問', '発注後変更依頼', 'その他']
  return ['質問', 'その他']
}

export function raiseIssue(rowId: string, field: string | undefined, kind: IssueKind, text: string, proposal?: Issue['proposal'], publishNow = false): string | null {
  const s = st()
  const user = s.user()
  const row = s.project().rows.find((r) => r.id === rowId)
  if (!row) return null
  if (!isActiveRow(row)) {
    s.toastMsg(`${row.id} は取消・置換済の行です（指摘は付けられません）`, 'err')
    return null
  }
  if (!publishNow && !kindsForRole(user.role).includes(kind)) {
    s.toastMsg(`${ROLE_LABEL[user.role]}は「${kind}」を起票できません（${kindsForRole(user.role).join('・')}）`, 'err')
    return null
  }
  if (!text.trim() && kind !== '最小ロット' && !proposal?.model) {
    s.toastMsg('本文を入れてください（何がどう問題か。相手が聞き直さずに済むように）', 'err')
    return null
  }
  const err = canRaise(row, kind)
  if (err) {
    s.toastMsg(err, 'err')
    return null
  }
  // 種別で対象のセルが決まるものは、カーソルの列に関係なくそのセルに付ける（直したら対応済になるように）
  const KIND_FIELD: Partial<Record<IssueKind, string>> = { 型式あいまい: 'model', メーカ未記入: 'maker', 数量見直し依頼: 'qtyNeeded', 廃番: 'model', 代替提案: 'model' }
  field = KIND_FIELD[kind] ?? field
  let id = ''
  s.commit(
    `指摘 ${kind}`,
    (p) => {
      id = 'I-' + String(p.nextIssueNo++).padStart(3, '0')
      const def = issueKindDef(kind)
      const prior = p.issues.find((i) => i.rowId === rowId && i.kind === kind && i.status === 'wontfix')
      let body = text
      if (kind === '最小ロット' && !text) {
        // 選定後は採用商社、選定前は MOQ がいちばん効く商社で丸め数量を出す
        const qs = p.quotes.filter((x) => x.rowId === rowId && !x.stale && x.unitPrice != null)
        const q = (row.adoptedSupplierId ? qs.find((x) => x.supplierId === row.adoptedSupplierId) : undefined) ?? [...qs].sort((a, b) => (b.moq ?? 0) - (a.moq ?? 0))[0]
        const need = row.qtyNeeded
        const rq = roundedQty(need, q?.moq, row.packQty, row.unit)
        const name = q ? (s.ws.suppliers.find((x) => x.id === q.supplierId)?.name ?? q.supplierId) : ''
        body = `必要数 ${need} → 丸め数量 ${rq}${name ? `（${name}${q?.moq ? ` MOQ ${q.moq}` : ''}）` : ''}、余剰 ${rq - need}（¥${((rq - need) * (q?.unitPrice ?? 0)).toLocaleString()}）`
      }
      const i: Issue = { id, rowId, field: field as keyof Row | undefined, kind, text: body, proposal, by: user, at: new Date().toISOString(), status: publishNow ? 'open' : 'draft', replies: [], bounceCount: 0, dueAt: addBusinessDays(todayStr(), def.dueDays, p.settings.holidays), rev: p.submissions.at(-1)?.rev }
      p.issues.push(i)
      if (prior) s.toastMsg(`注意: この行の「${kind}」は見送り済（${prior.answer ?? prior.resolution ?? ''}）`, 'info')
    },
    { rowId },
  )
  return id
}

/** 指摘に返信 */
export function replyIssue(issueId: string, text: string) {
  const s = st()
  s.commit('指摘に返信', (p) => {
    const i = p.issues.find((x) => x.id === issueId)
    if (i) i.replies.push({ by: s.user(), at: new Date().toISOString(), text })
  })
}

/** 直さず回答（設計）。種別: 説明 / 客先承認取得 */
export function answerIssue(issueId: string, text: string, kind: '説明' | '客先承認取得' = '説明', approvalRef?: { no: string; date: string }) {
  const s = st()
  s.commit(
    '指摘に回答',
    (p, ws) => {
      const i = p.issues.find((x) => x.id === issueId)
      if (!i) return
      if (!text.trim() && kind === '説明') return '回答の理由は必須です'
      i.status = 'answered'
      i.answer = text
      i.answerKind = kind
      i.approvalRef = approvalRef
      if (kind === '客先承認取得') {
        const r = p.rows.find((x) => x.id === i.rowId)
        if (r) r.flags.altPending = false
      }
      normalize(p, ws)
    },
    { rowId: s.project().issues.find((x) => x.id === issueId)?.rowId },
  )
}

/** x: 対応済 → 確認済 / 回答済 → 回答を受け入れて見送り */
export function confirmIssue(issueId: string) {
  const s = st()
  s.commit('指摘を確認済', (p, ws) => {
    const i = p.issues.find((x) => x.id === issueId)
    if (!i) return
    if (i.status === 'fixed') i.status = 'confirmed'
    else if (i.status === 'answered') {
      i.status = 'wontfix'
      i.resolution = `回答を受け入れて見送り: ${i.answer ?? ''}`
    } else return '確認できるのは対応済・回答済の指摘です'
    normalize(p, ws)
  })
}

/** Shift+X: 差戻し専用 */
export function bounceIssue(issueId: string, reason: string) {
  const s = st()
  s.commit('指摘を差戻し', (p, ws) => {
    const i = p.issues.find((x) => x.id === issueId)
    if (!i) return
    if (!(i.status === 'fixed' || i.status === 'answered' || i.status === 'inProgress')) return '差戻しできるのは対応済・回答済・対応中の指摘です'
    if (!reason.trim()) return '差戻し理由は必須です'
    i.status = 'open'
    i.bounceCount++
    i.replies.push({ by: s.user(), at: new Date().toISOString(), text: `差戻し(${i.bounceCount}回目): ${reason}` })
    const def = issueKindDef(i.kind)
    i.dueAt = addBusinessDays(todayStr(), def.dueDays, p.settings.holidays)
    const r = p.rows.find((x) => x.id === i.rowId)
    if (r && i.bounceCount >= 2) r.flags.pmReason = '差戻し2回目'
    normalize(p, ws)
  })
}

/** 見送り（起票者・PM） */
export function wontfixIssue(issueId: string, reason: string) {
  const s = st()
  s.commit('指摘を見送り', (p, ws) => {
    const i = p.issues.find((x) => x.id === issueId)
    if (!i) return
    if (i.by.name !== s.user().name && s.user().role !== 'pm') return '見送りは起票者または PM だけができます'
    if (!reason.trim()) return '見送り理由は必須です'
    i.status = 'wontfix'
    i.resolution = `見送り: ${reason}`
    normalize(p, ws)
  })
}

/** 提案を適用して置換（提案値を提案商社の列に書き込む） */
export function applyProposal(issueId: string): string | null {
  const s = st()
  const p = s.project()
  const i = p.issues.find((x) => x.id === issueId)
  if (!i?.proposal) {
    s.toastMsg('この指摘には提案がありません', 'err')
    return null
  }
  const oldRow = p.rows.find((r) => r.id === i.rowId)
  const oldAdopted = oldRow?.adoptedSupplierId ? p.quotes.find((q) => q.rowId === oldRow.id && q.supplierId === oldRow.adoptedSupplierId && !q.stale)?.unitPrice ?? null : null
  const newId = replaceRow(i.rowId, { model: i.proposal.model, maker: i.proposal.maker })
  if (!newId) return null
  s.commit(
    `提案 ${issueId} を適用`,
    (p2, ws) => {
      const nr = p2.rows.find((r) => r.id === newId)!
      const prop = i.proposal!
      // 新行の見積は旧型式の履歴に落とし、提案商社に提案値を入れる
      for (const q of p2.quotes.filter((x) => x.rowId === newId && !x.stale)) {
        q.stale = true
        q.staleModel = effective(oldRow!).model
      }
      for (const sid of p2.supplierIds) {
        // 購買が商社ごとに「据え置き / 再見積 / 提案値で確定」を選ぶ（既定: 提案商社＝提案値、他＝再見積）
        const q = { rowId: newId, supplierId: sid, unitPrice: null as number | null, leadDays: null as number | null, moq: null as number | null, stock: null, quoteQty: null, validUntil: null, note: '', formalPrice: null, formalLeadDays: null, formalValidUntil: null, formalDiffReason: '', source: undefined as string | undefined, reconfirmDefault: 'requote' as 'keep' | 'requote' | 'proposal' }
        if (prop.supplierId === sid) {
          q.unitPrice = prop.unitPrice ?? null
          q.leadDays = prop.leadDays ?? null
          q.moq = prop.moq ?? null
          q.source = `提案 ${issueId}`
          q.reconfirmDefault = 'proposal'
        }
        p2.quotes.push(q)
      }
      if (prop.supplierId && !p2.supplierIds.includes(prop.supplierId)) {
        p2.quotes.push({ rowId: newId, supplierId: prop.supplierId, unitPrice: prop.unitPrice ?? null, leadDays: prop.leadDays ?? null, moq: prop.moq ?? null, stock: null, quoteQty: null, validUntil: null, note: '', formalPrice: null, formalLeadDays: null, formalValidUntil: null, formalDiffReason: '', source: `提案 ${issueId}`, reconfirmDefault: 'proposal' })
      }
      // 代替可否＝客先承認要 → 代替承認待ち
      if (effective(nr).altPolicy === '客先承認要') nr.flags.altPending = true
      // 価格差の閾値判定
      if (oldAdopted != null && prop.unitPrice != null) {
        const diff = (prop.unitPrice - oldAdopted) * orderQty(nr)
        if (diff > p2.settings.formalDiffAmount) {
          nr.flags.pmPending = true
          nr.flags.pmReason = '閾値超'
        }
      }
      nr.fromIssue = issueId
      const issue = p2.issues.find((x) => x.id === issueId)!
      issue.status = 'fixed'
      issue.resolution = `提案を適用 → ${newId}`
      issue.movedTo = newId
      // 同じ行の他の提案は「見送り（この提案を適用）」にして起票者に知らせる
      for (const o of p2.issues)
        if (o.id !== issueId && o.rowId === i.rowId && o.proposal && ['open', 'inProgress', 'answered'].includes(o.status)) {
          o.status = 'wontfix'
          o.resolution = `見送り（${issueId} を適用）`
          o.replies.push({ by: s.user(), at: new Date().toISOString(), text: `${issueId} の提案を適用したので、この提案は見送りました` })
        }
      normalize(p2, ws)
    },
    { rowId: newId },
  )
  return newId
}

/** 要再確認: 商社ごとに 据え置き / 再見積 / 提案値で確定 */
export function reconfirmQuote(rowId: string, supplierId: string, choice: 'keep' | 'requote' | 'proposal') {
  const s = st()
  s.commit(`要再確認: ${choice === 'keep' ? '据え置き' : choice === 'requote' ? '再見積' : '提案値で確定'}`, (p, ws) => {
    const r = p.rows.find((x) => x.id === rowId)
    if (!r) return
    const q = p.quotes.find((x) => x.rowId === rowId && x.supplierId === supplierId && !x.stale)
    if (!q) return
    q.reconfirm = choice
    if (choice === 'requote') {
      q.unitPrice = null
      q.leadDays = null
      q.moq = null
      q.validUntil = null
      q.source = undefined
    } else if (choice === 'keep') {
      const prev = p.quotes.filter((x) => x.rowId === rowId && x.supplierId === supplierId && x.stale).at(-1)
      if (prev && q.unitPrice == null) {
        q.unitPrice = prev.unitPrice
        q.leadDays = prev.leadDays
        q.moq = prev.moq
        q.validUntil = prev.validUntil
        q.stock = prev.stock
      }
    }
    // 全商社が決まったらフラグを外す
    const remaining = p.quotes.filter((x) => x.rowId === rowId && !x.stale && !x.reconfirm)
    if (remaining.length === 0) {
      r.flags.reconfirm = false
      // 再見積があれば見積中へ。据え置き・提案値だけでも、残した見積で見積済に進める（normalize が判定）
      const requote = p.quotes.some((x) => x.rowId === rowId && !x.stale && x.reconfirm === 'requote')
      if ((requote && r.status !== 'draft') || r.status === 'submitted') {
        r.status = 'quoting'
        r.statusChangedAt = new Date().toISOString()
      }
    }
    normalize(p, ws)
  })
}

/** 確認系フラグを外す（x） */
export function ackFlag(rowId: string, flag: 'notation' | 'orderQtyCheck' | 'contested' | 'priceCheck') {
  st().commit('確認', (p, ws) => {
    const r = p.rows.find((x) => x.id === rowId)
    if (r) r.flags[flag] = false
    normalize(p, ws)
  })
}

/** 指摘からルールを作る（種別ごとのテンプレ） */
export function ruleFromIssue(issueId: string, scope: 'all' | 'project' = 'all'): Rule | null {
  const s = st()
  const p = s.project()
  const i = p.issues.find((x) => x.id === issueId)
  if (!i) return null
  const row = p.rows.find((r) => r.id === i.rowId)
  const e = row ? effective(row) : null
  let rule: Rule | null = null
  const base = { owner: s.user().name, scope: scope === 'all' ? 'all' : p.id, enabled: true, fromIssueKind: i.kind } as const
  switch (i.kind) {
    case 'メーカ未記入':
      rule = { id: `rule.maker.required.${Date.now()}`, name: 'メーカは必須', field: 'maker', type: 'required', severity: 'error', message: 'メーカが空です', ...base }
      break
    case '型式あいまい': {
      const prefix = (e?.model ?? '').split(/[\s-]/)[0]
      rule = { id: `rule.model.${Date.now()}`, name: `${e?.maker ?? ''} ${prefix} の型式書式`, field: 'model', type: 'regex', pattern: `^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-.+`, when: `^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, maker: e?.maker || undefined, severity: 'warn', message: `${prefix} は ${i.text.slice(0, 30)}`, ...base }
      break
    }
    case '最小ロット':
      rule = { id: `rule.pack.${Date.now()}`, name: '数量は入数の倍数', field: 'qtyNeeded', type: 'packMultiple', severity: 'warn', message: 'パック品の数量が入数の倍数ではありません', ...base }
      break
    default:
      rule = { id: `rule.custom.${Date.now()}`, name: `${i.kind}: ${i.text.slice(0, 20)}`, field: (i.field as keyof Row) ?? 'model', type: 'required', severity: 'warn', message: i.text, ...base }
  }
  if (!rule) return null
  const r = rule
  s.commitWs(`ルールを追加: ${r.name}`, (ws) => {
    ws.rules.push(r)
  })
  return rule
}

export function issuesForRow(p: Project, rowId: string): Issue[] {
  return p.issues.filter((i) => i.rowId === rowId)
}

export function issueBallRole(i: Issue): Role {
  if (i.status === 'fixed' || i.status === 'answered') return i.by.role
  return resolverOfIssue(i)
}

export { openIssues }
