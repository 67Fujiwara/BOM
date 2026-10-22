import { useStore, type Panel, type ViewId, type State } from '@/model/store'
import { KEYMAP, bindingsFor, eventToKey, lookupBinding } from '@/keys/keymap'
import { buildViewModel, cellText } from '@/model/selectors'
import { colDef, supplierOfCol } from '@/model/columns'
import type { ChangeReason, IssueKind, Project, Role, Row } from '@/model/types'
import { CHANGE_REASONS, ISSUE_KINDS, ROLE_LABEL } from '@/model/types'
import { VIEWS } from '@/model/views'
import { effective, openIssues, isActive } from '@/model/derive'
import { checkRow, type Problem } from '@/model/rules'
import * as rows from '@/actions/rows'
import * as issues from '@/actions/issues'
import * as adopt from '@/actions/adopt'
import * as pm from '@/actions/pm'
import * as quotes from '@/actions/quotes'
import { scoreRow } from '@/model/score'
import { makeSampleProject, makeSupplier, newProject, newRow, rowId as mkRowId, DEFAULT_SETTINGS } from '@/model/sample'
import { resetWorkspace } from '@/io/persist'
import { addDays, todayStr } from '@/model/dates'

const st = () => useStore.getState()
const set = (p: Partial<State>) => useStore.setState(p)
const toast = (t: string, k: 'ok' | 'err' | 'info' = 'ok') => st().toastMsg(t, k)
const vm = () => buildViewModel(st())

function cursorRow(): Row | undefined {
  const s = st()
  return s.cursorRow ? s.project().rows.find((r) => r.id === s.cursorRow) : undefined
}

export function openPanel(panel: Panel) {
  set({ panel, mode: panel.kind === 'palette' ? 'palette' : 'panel' })
}
export function closePanel() {
  set({ panel: null, mode: 'nav' })
}

function prompt(title: string, opts: { options?: string[]; requireText?: boolean; placeholder?: string; extra?: Record<string, string> }, onSubmit: (choice: string | null, text: string, extra?: Record<string, string>) => void) {
  openPanel({ kind: 'prompt', title, options: opts.options, index: 0, text: '', placeholder: opts.placeholder, requireText: opts.requireText, extra: opts.extra, onSubmit: (c, t) => onSubmit(c, t, (st().panel as Extract<Panel, { kind: 'prompt' }> | null)?.extra) })
}

// ---------- 移動 ----------
function navItems() {
  return vm().items.filter((i) => i.kind !== 'detail')
}
function moveCursorRow(delta: number) {
  const items = navItems()
  if (!items.length) return
  const s = st()
  const idx = items.findIndex((i) => i.key === s.cursorRow)
  if (idx < 0) {
    // カーソル無し: 最初（最後）の行に乗る
    const firstRow = delta > 0 ? items.find((i) => i.kind === 'row') : [...items].reverse().find((i) => i.kind === 'row')
    set({ cursorRow: (firstRow ?? items[0]).key, detailIndex: 0 })
    return
  }
  const next = Math.max(0, Math.min(items.length - 1, idx + delta))
  set({ cursorRow: items[next].key, detailIndex: 0 })
}
function setCursorRowAbs(pos: 'top' | 'bottom') {
  const items = navItems()
  if (items.length) set({ cursorRow: pos === 'top' ? items[0].key : items[items.length - 1].key, detailIndex: 0 })
}
function moveCol(delta: number) {
  const cols = vm().columns
  const idx = cols.indexOf(st().cursorCol)
  const next = Math.max(0, Math.min(cols.length - 1, (idx < 0 ? 0 : idx) + delta))
  set({ cursorCol: cols[next] })
}
function ensureCursor() {
  const s = st()
  const items = navItems()
  if (!items.length) return
  if (!s.cursorRow || !items.some((i) => i.key === s.cursorRow)) set({ cursorRow: items.find((i) => i.kind === 'row')?.key ?? items[0].key })
  if (!vm().columns.includes(s.cursorCol)) set({ cursorCol: vm().columns.includes('name') ? 'name' : vm().columns[0] })
}
export function jumpToRow(id: string, col?: string) {
  const s = st()
  const p = s.project()
  const r = p.rows.find((x) => x.id === id)
  if (!r) return
  if (!vm().rows.some((x) => x.id === id)) set({ view: 1, filter: '', cellFilter: null })
  set({ cursorRow: id, cursorCol: col && vm().columns.includes(col) ? col : s.cursorCol, detailIndex: 0 })
  const cat = effective(r).category || '（分類なし）'
  if (st().collapsed.includes(cat)) set({ collapsed: st().collapsed.filter((c) => c !== cat) })
}

// ---------- 編集 ----------
export function startEdit(initial?: string) {
  const s = st()
  const r = cursorRow()
  if (!r) return
  const err = rows.canEdit(s.cursorCol)
  if (err) return toast(err, 'err')
  if (!isActive(r)) return toast('取消・置換済の行は編集できません', 'err')
  const d = colDef(s.cursorCol)!
  const cur = cellText(r, s.cursorCol, vm().ctx)
  const value = initial ?? (d.kind === 'bool' ? '' : String(cur.raw ?? ''))
  set({ mode: 'edit', editValue: value, editCandidates: d.kind === 'select' ? candidates(d.options ?? [], value) : null })
}
function candidates(options: string[], v: string): string[] {
  const q = v.trim().toLowerCase()
  const list = options.filter((o) => !q || o.toLowerCase().startsWith(q) || o.includes(v.trim()))
  return list.length ? list : options
}
export function updateEditValue(v: string) {
  const d = colDef(st().cursorCol)
  set({ editValue: v, editCandidates: d?.kind === 'select' ? candidates(d.options ?? [], v) : null })
}
export function commitEdit(dir: 'down' | 'right' | 'left' | 'stay' = 'down') {
  const s = st()
  const r = cursorRow()
  if (!r) return cancelEdit()
  const d = colDef(s.cursorCol)!
  let value = s.editValue
  if (d.kind === 'select' && s.editCandidates?.length) value = s.editCandidates[0]
  const cur = cellText(r, s.cursorCol, vm().ctx)
  set({ mode: 'nav', editCandidates: null })
  if (value !== String(cur.raw ?? '')) {
    let col = s.cursorCol
    if (supplierOfCol(col) === 'A') {
      if (!r.adoptedSupplierId) return toast('採用商社が無いので正式見積を入れられません', 'err')
      col = col.replace('@A', '@' + r.adoptedSupplierId)
    }
    rows.setCell(r.id, col, value)
  }
  if (dir === 'down') moveCursorRow(1)
  else if (dir === 'right') moveCol(1)
  else if (dir === 'left') moveCol(-1)
}
export function cancelEdit() {
  set({ mode: 'nav', editCandidates: null })
}

// ---------- x の対象 ----------
export function nextAckTarget(p: Project, row: Row, role: Role): string | null {
  const iss = p.issues.filter((i) => i.rowId === row.id)
  if (role !== 'design') {
    if (iss.some((i) => i.status === 'fixed' && i.by.name === st().ws.user.name)) return '指摘を確認済に'
    if (iss.some((i) => i.status === 'answered' && i.by.name === st().ws.user.name)) return '回答を受け入れて見送り'
  }
  if (row.flags.notation) return '表記修正を確認'
  if (row.flags.orderQtyCheck) return '発注数を確認'
  if (row.flags.contested) return '拮抗を確認'
  if (row.flags.priceCheck) return '単価要確認を確認'
  const pr = checkRow(row, st().ws.rules, p).find((x) => x.severity === 'warn' && x.field === st().cursorCol) ?? checkRow(row, st().ws.rules, p).find((x) => x.severity === 'warn')
  if (pr) return row.ackRules.includes(pr.ruleId) ? '警告の確認済みを外す' : '警告を確認済み'
  if (st().view === 5) return '差分を確認済'
  return null
}
function ackCurrent() {
  const s = st()
  const r = cursorRow()
  if (!r) return
  const p = s.project()
  const role = s.user().role
  const iss = p.issues.filter((i) => i.rowId === r.id)
  const mine = (i: (typeof iss)[number]) => i.by.name === s.ws.user.name
  if (role !== 'design') {
    const f = iss.find((i) => i.status === 'fixed' && mine(i)) ?? iss.find((i) => i.status === 'answered' && mine(i))
    if (f) return issues.confirmIssue(f.id)
  }
  if (r.flags.notation) return issues.ackFlag(r.id, 'notation')
  if (r.flags.orderQtyCheck) return issues.ackFlag(r.id, 'orderQtyCheck')
  if (r.flags.contested) return issues.ackFlag(r.id, 'contested')
  if (r.flags.priceCheck) return issues.ackFlag(r.id, 'priceCheck')
  const prs = checkRow(r, s.ws.rules, p)
  const pr = prs.find((x) => x.severity === 'warn' && x.field === s.cursorCol) ?? prs.find((x) => x.severity === 'warn')
  if (pr) return rows.ackRule(r.id, pr.ruleId)
  if (s.view === 5) {
    s.commit('差分を確認済', (p2) => {
      for (const sub of p2.submissions) if (sub.rowIds.includes(r.id) && !sub.acked.includes(r.id)) sub.acked.push(r.id)
    })
    return
  }
  toast('このセルに確認するものはありません', 'info')
}

// ---------- 問題へのジャンプ ----------
function problemCells(): Array<{ rowId: string; field: string }> {
  const s = st()
  const p = s.project()
  const role = s.user().role
  const out: Array<{ rowId: string; field: string; order: number }> = []
  const kinds = ISSUE_KINDS.map((k) => k.kind)
  for (const r of p.rows) {
    if (!isActive(r)) continue
    for (const i of openIssues(p, r.id)) {
      const ball = i.status === 'open' || i.status === 'inProgress' ? issues.issueBallRole(i) : i.by.role
      if (ball === role) out.push({ rowId: r.id, field: (i.field as string) ?? 'model', order: kinds.indexOf(i.kind) })
    }
    if (role === 'design') for (const pr of checkRow(r, s.ws.rules, p)) out.push({ rowId: r.id, field: pr.field, order: 20 + (pr.severity === 'error' ? 0 : 1) })
    if (role === 'purchasing' && (r.flags.reconfirm || r.flags.requote || r.flags.notation || r.flags.orderQtyCheck)) out.push({ rowId: r.id, field: 'model', order: 30 })
  }
  const sorted = out.sort((a, b) => a.order - b.order || a.rowId.localeCompare(b.rowId))
  const seen = new Set<string>()
  return sorted.filter((x) => {
    const k = x.rowId + x.field
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}
function gotoProblem(delta: 1 | -1) {
  const list = problemCells()
  if (!list.length) return toast('問題はありません', 'info')
  const s = st()
  const idx = list.findIndex((x) => x.rowId === s.cursorRow && x.field === s.cursorCol)
  const next = idx < 0 ? (delta > 0 ? 0 : list.length - 1) : (idx + delta + list.length) % list.length
  jumpToRow(list[next].rowId, list[next].field)
}

// ---------- Ctrl+. 候補 ----------
export function quickfixOptions(r: Row, field: string): Array<{ label: string; run: () => void }> {
  const s = st()
  const p = s.project()
  const role = s.user().role
  const opts: Array<{ label: string; run: () => void }> = []
  const iss = p.issues.filter((i) => i.rowId === r.id)
  for (const i of iss) {
    if (i.proposal && (i.status === 'open' || i.status === 'inProgress') && role === 'design') opts.push({ label: `購買の提案 ${i.proposal.model} を適用して置換（${i.id}）`, run: () => void issues.applyProposal(i.id) })
  }
  const prs: Problem[] = checkRow(r, s.ws.rules, p)
  for (const pr of prs.filter((x) => x.field === field).concat(prs.filter((x) => x.field !== field))) {
    for (const f of pr.fixes) opts.push({ label: `${pr.message}: ${f.label}`, run: () => rows.applyFix(r.id, f.apply(r), f.label) })
    if (!pr.fixes.length) opts.push({ label: `${pr.message}: 編集する`, run: () => { jumpToRow(r.id, pr.field); startEdit() } })
    if (pr.severity === 'warn') opts.push({ label: `${pr.message}: 確認済みにする（x）`, run: () => rows.ackRule(r.id, pr.ruleId) })
    opts.push({ label: `${pr.message}: あとで（Shift+→）`, run: () => rows.deferRule(r.id, pr.ruleId) })
  }
  if (role === 'purchasing') {
    if (r.flags.reconfirm) for (const q of p.quotes.filter((x) => x.rowId === r.id && !x.stale && !x.reconfirm)) {
      const name = s.ws.suppliers.find((x) => x.id === q.supplierId)?.name
      opts.push({ label: `要再確認 ${name}: 1 据え置き`, run: () => issues.reconfirmQuote(r.id, q.supplierId, 'keep') }, { label: `要再確認 ${name}: 2 再見積`, run: () => issues.reconfirmQuote(r.id, q.supplierId, 'requote') })
      if (q.source?.startsWith('提案')) opts.push({ label: `要再確認 ${name}: 3 提案値で確定`, run: () => issues.reconfirmQuote(r.id, q.supplierId, 'proposal') })
    }
    if (r.flags.requote) opts.push({ label: '再見積要: 1 据え置き（旧見積を有効に戻す）', run: () => s.commit('再見積要: 据え置き', (p2, ws) => { const rr = p2.rows.find((x) => x.id === r.id)!; rr.flags.requote = false; for (const q of p2.quotes.filter((x) => x.rowId === r.id && x.stale)) { const live = p2.quotes.find((x) => x.rowId === r.id && x.supplierId === q.supplierId && !x.stale); if (live && live.unitPrice == null) { Object.assign(live, { unitPrice: q.unitPrice, leadDays: q.leadDays, moq: q.moq, stock: q.stock, validUntil: q.validUntil }) } } void ws }) }, { label: '再見積要: 2 再見積（概算見積を依頼）', run: () => runCommand('quotes.request') })
    if (r.working && Object.keys(r.working).length) opts.push({ label: '設計に公開を依頼（質問を自動起票）', run: () => void issues.raiseIssue(r.id, undefined, '質問', '作業中の変更を公開してください（選定・正式依頼に含めるため）', undefined, true) })
    const fixedOrAnswered = iss.find((i) => (i.status === 'fixed' || i.status === 'answered') && i.by.name === s.ws.user.name)
    if (fixedOrAnswered) opts.push({ label: `${fixedOrAnswered.id} からルールを作る（全案件）`, run: () => { const rule = issues.ruleFromIssue(fixedOrAnswered.id); if (rule) toast(`ルールを追加: ${rule.name}`) } })
  }
  for (const i of iss) if ((i.by.name === s.ws.user.name || role === 'pm') && (i.status === 'open' || i.status === 'inProgress' || i.status === 'answered')) opts.push({ label: `${i.id} を見送りにする（理由）`, run: () => prompt(`見送り ${i.id}`, { requireText: true }, (_c, t) => issues.wontfixIssue(i.id, t)) })
  return opts
}
function openQuickfix() {
  const s = st()
  const r = cursorRow()
  if (!r) return
  const options = quickfixOptions(r, s.cursorCol)
  openPanel({ kind: 'quickfix', rowId: r.id, field: s.cursorCol, index: 0, options })
}

// ---------- 指摘パネル（detail 内） ----------
function detailItems(r: Row) {
  const p = st().project()
  return p.issues.filter((i) => i.rowId === r.id)
}
function issueActionPanel(issueId: string) {
  const s = st()
  const p = s.project()
  const i = p.issues.find((x) => x.id === issueId)!
  const role = s.user().role
  const options: Array<{ label: string; run: () => void }> = [{ label: '1 返信', run: () => openPanel({ kind: 'replyIssue', issueId, text: '' }) }]
  if (role === 'design' && (i.status === 'open' || i.status === 'inProgress')) {
    options.push({ label: '2 直さず回答（理由必須）', run: () => prompt(`回答 ${i.id}`, { requireText: true }, (_c, t) => issues.answerIssue(i.id, t, '説明')) })
    options.push({ label: '3 客先承認取得（番号・日付）', run: () => prompt(`客先承認 ${i.id}`, { requireText: true, placeholder: '承認番号', extra: { 日付: todayStr() } }, (_c, t, ex) => issues.answerIssue(i.id, `客先承認取得 ${t}`, '客先承認取得', { no: t, date: ex?.['日付'] ?? todayStr() })) })
    if (i.proposal) options.push({ label: '4 提案を適用（置換）', run: () => void issues.applyProposal(i.id) })
    if (i.kind === '納期NG' || i.kind === 'コスト超過' || i.kind === '数量見直し依頼') options.push({ label: `7 ${i.kind === '数量見直し依頼' ? '数量変更不可' : '代替なし'}（対策不成立として PM へ）`, run: () => prompt(`${i.id} 対策不成立の理由`, { requireText: true }, (_c, t) => { issues.answerIssue(i.id, t, '説明'); s.commit('対策不成立', (p2) => { const rr = p2.rows.find((x) => x.id === i.rowId)!; rr.flags.pmPending = true; rr.flags.pmReason = '差分超過'; rr.flags.formalDiff = true }) }) })
  }
  if (i.by.name === s.ws.user.name || role === 'pm') {
    options.push({ label: '5 この指摘からルールを作る', run: () => { const rule = issues.ruleFromIssue(i.id); if (rule) toast(`ルールを追加: ${rule.name}`) } })
    if (i.status !== 'confirmed' && i.status !== 'wontfix') options.push({ label: '6 見送り（理由）', run: () => prompt(`見送り ${i.id}`, { requireText: true }, (_c, t) => issues.wontfixIssue(i.id, t)) })
  }
  openPanel({ kind: 'quickfix', rowId: i.rowId, field: i.field as string, index: 0, options })
}

// ---------- 公開（Ctrl+Enter） ----------
export function publishFlow(rowIds?: string[]) {
  const s = st()
  const plan = rows.planPublish(s.project(), s.ws.rules, s.user(), rowIds)
  if (plan.nonIssueChanges.length && s.user().role === 'design') {
    prompt(`変更セット（${plan.nonIssueChanges.length} 行）の理由`, { options: [...CHANGE_REASONS], placeholder: '変更番号（任意）' }, (choice, text) => {
      const mode = plan.canAppend ? 'new' : 'new'
      rows.publish(rowIds, { reason: (choice as ChangeReason) ?? 'その他', changeNo: text }, mode)
    })
    return
  }
  if (plan.canAppend && plan.rows.length) {
    prompt('公開の Rev', { options: ['新しい Rev', '直前の Rev に追記'] }, (choice) => rows.publish(rowIds, undefined, choice === '直前の Rev に追記' ? 'append' : 'new'))
    return
  }
  rows.publish(rowIds)
}

// ---------- 決定パネル（7） ----------
function decisionPanel(r: Row) {
  const s = st()
  const p = s.project()
  const c = pm.pmCaseOf(p, r)
  if (c === 'なし') return toast('この行は要決定ではありません', 'info')
  const options = pm.pmOptions(c).map((o) => ({ label: `${o.key === 'Y' ? 'Shift+Y' : o.key} ${o.label}`, run: () => decideWithReason(r.id, o.kind) }))
  openPanel({ kind: 'quickfix', rowId: r.id, field: 'status', index: 0, options })
}
function decideWithReason(rowId: string, kind: Parameters<typeof pm.decide>[1]) {
  const s = st()
  const p = s.project()
  const r = p.rows.find((x) => x.id === rowId)!
  const ext = pm.needsExternalApproval(p, r) && (kind === '受入' || kind === '承認')
  prompt(`決定: ${kind}（理由）`, { requireText: kind === '却下' || kind === '回答を支持' || kind === '指摘を支持', extra: ext ? { 承認者: '', 日付: todayStr(), '決裁書No': '' } : kind === '特急・分納' ? { 上限金額: '' } : undefined }, (_c, text, extra) => {
    pm.decide(rowId, kind, text, { external: ext ? { approver: extra?.['承認者'] ?? '', date: extra?.['日付'] ?? '', ref: extra?.['決裁書No'] ?? '' } : undefined, amount: extra?.['上限金額'] ? Number(extra['上限金額']) : undefined })
  })
}

// ---------- 案件設定 ----------
function openSettings() {
  openPanel({ kind: 'settings', index: 0, draft: {}, editing: false, value: '' })
}
function saveSettings(draft: Record<string, string>) {
  const s = st()
  const p = s.project()
  const patch: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(draft)) {
    switch (k) {
      case 'dueDate':
        patch.dueDate = v === '未定' || v === '' ? null : v
        break
      case 'weights': {
        const [a, b, c, d] = v.split(',').map(Number)
        patch.weights = { price: a, lead: b, record: c, terms: d }
        break
      }
      case 'members': {
        const [d, pu, m] = v.split(',')
        s.commit('担当者を変更', (p2) => { p2.members = { design: d ?? '', purchasing: pu ?? '', pm: m ?? '' } })
        break
      }
      case 'supplierIds':
        s.commit('相見積先を設定', (p2) => { p2.supplierIds = v.split(',').map((x) => x.trim()).filter(Boolean) })
        break
      case 'changeNeedsPmApproval':
        patch[k] = /^(はい|y|yes|true|1)$/i.test(v)
        break
      case 'budget':
        patch.budget = v === '' ? null : Number(v)
        break
      case 'quoteDeadline':
        patch.quoteDeadline = v || null
        break
      case 'holidays':
        patch.holidays = v.split(',').map((x) => x.trim()).filter(Boolean)
        break
      case 'exceptionPct':
      case 'formalDiffPct':
      case 'qtyTolerancePct':
      case 'externalApprovalBudgetPct':
        patch[k] = Number(v) / 100
        break
      case 'name':
      case 'currency':
      case 'quoteCompleteRule':
      case 'selector':
        patch[k] = v
        break
      default:
        patch[k] = Number(v)
    }
  }
  if (!Object.keys(patch).length) return closePanel()
  const needImpact = 'dueDate' in patch || 'processDays' in patch || 'weights' in patch
  const finish = (reason: string, opts?: { fixedNeed?: 'shift' | 'keep'; proposeReselect?: boolean }) => {
    pm.applySettings(patch as Parameters<typeof pm.applySettings>[0], reason, opts)
    closePanel()
  }
  if (needImpact) {
    const im = pm.simulateSettings(p, { dueDate: patch.dueDate as string | null | undefined, processDays: patch.processDays as number | undefined, weights: patch.weights as Project['weights'] | undefined })
    const lines = [`納期NG になる行: ${im.leadNG.length}（${Object.entries(im.leadNG.reduce((m, x) => ({ ...m, [x.status]: (m[x.status] ?? 0) + 1 }), {} as Record<string, number>)).map(([k, n]) => `${k} ${n}`).join(' / ') || 'なし'}）`, `推奨が変わる行: ${im.recommendChanged.length}（${im.recommendChanged.slice(0, 8).join(', ')}）`, `行必要日が固定の行: ${im.fixedNeed.length}（${im.fixedNeed.join(', ')}）`, `正式依頼中で必要納期が変わる行（再発行対象）: ${im.reissue.length}`]
    openPanel({ kind: 'impact', title: '影響試算（確定前）', lines, onConfirm: () => {
      prompt('変更理由', { requireText: true, options: im.fixedNeed.length ? ['固定必要日の行: 同じ日数だけ前倒し', '固定必要日の行: 据え置き'] : undefined }, (choice, reason) => {
        const fixedNeed = choice?.includes('据え置き') ? 'keep' : 'shift'
        if (im.recommendChanged.length) prompt(`推奨が変わる ${im.recommendChanged.length} 行を 7 に再選定提案として載せますか`, { options: ['載せる', '載せない'] }, (c2) => finish(reason, { fixedNeed, proposeReselect: c2 === '載せる' }))
        else finish(reason, { fixedNeed })
      })
    } })
    return
  }
  prompt('変更理由', { requireText: true }, (_c, reason) => finish(reason))
}

// ---------- 新しい BOM ----------
function createProjectFromWizard(d: Record<string, string>, picks: string[], inputMode: number) {
  const s = st()
  const id = d.id?.trim() || `P-${new Date().getFullYear()}-${String(s.ws.projects.length + 1).padStart(3, '0')}`
  const p = newProject(id, d.name?.trim() || '新しいBOM', { dueDate: d.due && d.due !== '未定' ? d.due : null, preferredSupplierIds: picks, supplierIds: picks, members: { design: s.ws.user.name, purchasing: d.buyer ?? '', pm: '' }, settings: { ...DEFAULT_SETTINGS, processDays: Number(d.processDays) || 10, budget: d.budget ? Number(d.budget) : null } })
  if (inputMode !== 2 && d.paste?.trim()) {
    const lines = d.paste.replace(/\r/g, '').split('\n').filter((l) => l.trim())
    const first = lines[0].split('\t')
    const hasHeader = /部品名|型式/.test(lines[0])
    const body = hasHeader ? lines.slice(1) : lines
    const idx = (name: string, def: number) => (hasHeader ? Math.max(first.findIndex((h) => h.includes(name)), -1) : def)
    const ci = { category: idx('分類', 0), name: idx('部品名', 1), model: idx('型式', 2), maker: idx('メーカ', 3), qty: idx('数量', 4), unit: idx('単位', 5), ref: idx('回路', 6) }
    body.forEach((line, i) => {
      const c = line.split('\t')
      const g = (k: number) => (k >= 0 ? (c[k] ?? '').trim() : '')
      p.rows.push(newRow(mkRowId(i + 1), { category: g(ci.category), name: g(ci.name), model: g(ci.model), maker: g(ci.maker), qtyNeeded: Number(g(ci.qty)) || 1, unit: (g(ci.unit) as Row['unit']) || '個', ref: g(ci.ref) }))
    })
  } else if (inputMode === 2) p.rows.push(newRow('R001'))
  s.commitWs(`案件を作成: ${p.name}`, (ws) => {
    ws.projects.push(p)
    ws.currentProjectId = p.id
  })
  closePanel()
  set({ view: 4, cursorRow: null })
  toast(`${p.name} を作成しました。4 要確認で問題を直し、Ctrl+Enter で提出`, 'ok')
}

// ---------- コマンド ----------
export function runCommand(id: string, e?: KeyboardEvent): void {
  const s = st()
  const p = s.project()
  const role = s.user().role
  const r = cursorRow()
  const need = (): Row | undefined => {
    if (!r) toast('行を選んでください', 'info')
    return r
  }
  switch (id) {
    case 'palette.open':
      return openPanel({ kind: 'palette', query: '', index: 0 })
    case 'project.switch':
      return openPanel({ kind: 'inbox', index: 0, query: '' })
    case 'project.save':
      s.commitWs('保存しました', () => {})
      return
    case 'undo':
      return s.undoLast()
    case 'redo':
      return s.redoLast()
    case 'export.excel':
      return openPanel({ kind: 'export', index: 0, options: [{ label: '1 社内（採用・金額・状態つき）', run: () => void import('@/io/excel').then((m) => m.exportBomExcel(s.ws, p, 'internal')) }, { label: '2 商社向け（価格列なし）', run: () => void import('@/io/excel').then((m) => m.exportBomExcel(s.ws, p, 'supplier')) }, { label: '3 保管用（全列・商社別見積つき）', run: () => void import('@/io/excel').then((m) => m.exportBomExcel(s.ws, p, 'archive')) }] })
    case 'copy.formatted': {
      const v = vm()
      const headers = v.columns.map((c) => colDef(c)?.label ?? c)
      const data = v.rows.map((row) => v.columns.map((c) => cellText(row, c, v.ctx).text))
      void import('@/io/excel').then((m) => m.copyFormatted(headers, data)).then(() => toast(`${data.length} 行 × ${headers.length} 列を書式つきでコピーしました`))
      return
    }
    case 'goto':
      return prompt('ジャンプ（ID・型式・No）', { placeholder: 'R034 / FX5U / 34' }, (_c, t) => {
        const q = t.trim().toLowerCase()
        const hit = p.rows.find((x) => x.id.toLowerCase() === q) ?? p.rows.find((x) => x.id === 'R' + q.padStart(3, '0')) ?? p.rows.find((x) => effective(x).model.toLowerCase().includes(q) || effective(x).ref.toLowerCase() === q)
        if (hit) jumpToRow(hit.id)
        else toast('見つかりません', 'err')
      })
    case 'filter.focus':
      document.querySelector<HTMLInputElement>('input.filter')?.focus()
      return
    case 'help':
      return openPanel({ kind: 'help' })
    case 'escape':
      if (s.panel) return closePanel()
      if (s.mode === 'edit') return cancelEdit()
      if (s.detailIndex > 0) return set({ detailIndex: 0 })
      if (s.cellFilter || s.filter) return set({ cellFilter: null, filter: '' })
      if (r && s.openRows.includes(r.id)) return set({ openRows: s.openRows.filter((x) => x !== r.id) })
      return set({ cursorRow: null })
    case 'move.up':
      if (r && s.detailIndex > 0) return set({ detailIndex: s.detailIndex - 1 })
      return moveCursorRow(-1)
    case 'move.down': {
      if (r && s.openRows.includes(r.id)) {
        const n = detailItems(r).length
        if (s.detailIndex < n) return set({ detailIndex: s.detailIndex + 1 })
      }
      return moveCursorRow(1)
    }
    case 'row.next':
      return moveCursorRow(1)
    case 'row.prev':
      return moveCursorRow(-1)
    case 'move.left':
    case 'move.shiftTab':
      return moveCol(-1)
    case 'move.right':
    case 'move.tab':
      return moveCol(1)
    case 'move.home':
      return set({ cursorCol: vm().columns[0] })
    case 'move.end':
      return set({ cursorCol: vm().columns.at(-1)! })
    case 'move.top':
      return setCursorRowAbs('top')
    case 'move.bottom':
      return setCursorRowAbs('bottom')
    case 'move.pageUp':
      return moveCursorRow(-20)
    case 'move.pageDown':
      return moveCursorRow(20)
    case 'row.toggleOpen': {
      if (s.cursorRow?.startsWith('g:')) {
        const cat = s.cursorRow.split(':')[1]
        return set({ collapsed: s.collapsed.includes(cat) ? s.collapsed.filter((c) => c !== cat) : [...s.collapsed, cat] })
      }
      if (!need()) return
      return set({ openRows: s.openRows.includes(r!.id) ? s.openRows.filter((x) => x !== r!.id) : [...s.openRows, r!.id], detailIndex: 0 })
    }
    case 'category.prev':
    case 'category.next': {
      const items = navItems()
      const gs = items.map((it, i) => (it.kind === 'group' ? i : -1)).filter((i) => i >= 0)
      if (!gs.length) return toast('分類の見出しがありません（並び替え中）', 'info')
      const cur = items.findIndex((it) => it.key === s.cursorRow)
      const next = id === 'category.next' ? gs.find((i) => i > cur) ?? gs[0] : [...gs].reverse().find((i) => i < cur) ?? gs[gs.length - 1]
      return set({ cursorRow: items[next].key })
    }
    case 'cell.edit':
      if (role === 'pm' && r && s.view === 7) return decisionPanel(r)
      if (r && s.detailIndex > 0) {
        const it = detailItems(r)[s.detailIndex - 1]
        if (it) return issueActionPanel(it.id)
      }
      return startEdit()
    case 'cell.clear':
      if (!need()) return
      return rows.clearCell(r!.id, s.cursorCol)
    case 'row.insertBelow': {
      const nid = rows.insertBelow(r?.id ?? null)
      if (nid) {
        jumpToRow(nid, 'name')
        startEdit('')
      }
      return
    }
    case 'row.duplicate': {
      if (!need()) return
      const nid = rows.duplicateRow(r!.id)
      if (nid) jumpToRow(nid)
      return
    }
    case 'row.delete':
      if (!need()) return
      rows.deleteRow(r!.id)
      return
    case 'row.moveUp':
      if (!need()) return
      return rows.moveRow(r!.id, -1)
    case 'row.moveDown':
      if (!need()) return
      return rows.moveRow(r!.id, 1)
    case 'cell.copy': {
      if (!need()) return
      const t = cellText(r!, s.cursorCol, vm().ctx).text
      void navigator.clipboard.writeText(t)
      set({ clipboard: t })
      return toast(`コピー: ${t}`, 'info')
    }
    case 'cell.paste': {
      if (!need()) return
      e?.preventDefault()
      const v = vm()
      void navigator.clipboard.readText().then((text) => {
        const t = text ?? s.clipboard ?? ''
        if (/\t|\n/.test(t.trim())) rows.pasteCells(r!.id, s.cursorCol, v.columns, v.rows.map((x) => x.id), t)
        else rows.setCell(r!.id, s.cursorCol, t, '貼り付け')
      }).catch(() => { if (s.clipboard) rows.setCell(r!.id, s.cursorCol, s.clipboard, '貼り付け') })
      return
    }
    case 'adopt.best':
      if (!need()) return
      adopt.adoptBest(r!.id)
      return
    case 'adopt.cheapest':
      if (!need()) return
      adopt.adoptCheapest(r!.id)
      return
    case 'adopt.choose': {
      if (!need()) return
      const err = adopt.canAdopt(p, r!, true)
      if (err) return toast(err, 'err')
      return openPanel({ kind: 'adopt', rowId: r!.id, index: 0 })
    }
    case 'row.replace': {
      if (!need()) return
      const nid = rows.replaceRow(r!.id)
      if (nid) {
        jumpToRow(nid, 'model')
        startEdit()
      }
      return
    }
    case 'row.toggleOrdered':
      if (!need()) return
      rows.setCell(r!.id, 'ordered', r!.ordered ? '' : '1', r!.ordered ? '発注済を外す' : '発注済')
      return
    case 'row.toggleReceived':
      if (!need()) return
      rows.setCell(r!.id, 'received', r!.received ? '' : '1', r!.received ? '入荷済を外す' : '入荷済')
      return
    case 'row.toggleHidden':
      if (!need()) return
      return rows.toggleHidden(r!.id)
    case 'sort.asc':
    case 'sort.desc': {
      const dir = id === 'sort.asc' ? 'asc' : 'desc'
      if (s.sort?.col === s.cursorCol && s.sort.dir === dir) return set({ sort: null })
      return set({ sort: { col: s.cursorCol, dir } })
    }
    case 'filter.byCell': {
      if (!need()) return
      if (s.cellFilter?.col === s.cursorCol) return set({ cellFilter: null })
      return set({ cellFilter: { col: s.cursorCol, value: cellText(r!, s.cursorCol, vm().ctx).text } })
    }
    case 'columns.panel':
      return openPanel({ kind: 'columns', index: 0 })
    case 'issue.next':
      return gotoProblem(1)
    case 'issue.prev':
      return gotoProblem(-1)
    case 'issue.quickfix':
      if (!need()) return
      return openQuickfix()
    case 'issue.ack':
      return ackCurrent()
    case 'issue.sequence': {
      set({ sequence: true })
      gotoProblem(1)
      if (cursorRow()) openQuickfix()
      return
    }
    case 'issue.defer': {
      if (!need()) return
      const pr = checkRow(r!, s.ws.rules, p).find((x) => x.field === s.cursorCol) ?? checkRow(r!, s.ws.rules, p)[0]
      if (pr) rows.deferRule(r!.id, pr.ruleId)
      return gotoProblem(1)
    }
    case 'publish':
      return publishFlow()
    case 'issue.raise': {
      if (!need()) return
      return openPanel({ kind: 'issue', rowId: r!.id, field: s.cursorCol, step: 'kind', text: '', proposal: { model: '', maker: '', supplierId: '', unitPrice: '', leadDays: '' } })
    }
    case 'issue.reply': {
      if (!need()) return
      const list = detailItems(r!)
      const target = s.detailIndex > 0 ? list[s.detailIndex - 1] : list.at(-1)
      if (!target) return toast('この行に指摘はありません', 'info')
      return openPanel({ kind: 'replyIssue', issueId: target.id, text: '' })
    }
    case 'issue.bounce': {
      if (!need()) return
      const list = detailItems(r!).filter((i) => i.status === 'fixed' || i.status === 'answered' || i.status === 'inProgress')
      const target = s.detailIndex > 0 ? detailItems(r!)[s.detailIndex - 1] : list.at(-1)
      if (!target) return toast('差戻しできる指摘がありません（対応済・回答済・対応中）', 'info')
      return prompt(`差戻し ${target.id}（理由必須）`, { requireText: true }, (_c, t) => issues.bounceIssue(target.id, t))
    }
    case 'pm.approve':
      if (!need()) return
      if (role !== 'pm') return toast('権限なし（承認は PM）', 'err')
      return decideWithReason(r!.id, pm.pmOptions(pm.pmCaseOf(p, r!)).find((o) => o.key === 'y')?.kind ?? '承認')
    case 'pm.reject': {
      if (!need()) return
      if (role !== 'pm') return toast('権限なし（却下は PM）', 'err')
      const o = pm.pmOptions(pm.pmCaseOf(p, r!)).find((x) => x.key === 'Y')
      if (!o) return toast('この行では Shift+Y は使えません', 'info')
      return decideWithReason(r!.id, o.kind)
    }
    case 'weights.row':
      if (!need()) return
      return openPanel({ kind: 'weights', rowId: r!.id, index: 0 })
    case 'rev.prev':
    case 'rev.next': {
      const revs = p.submissions.map((x) => x.rev)
      if (!revs.length) return
      const cur = s.revView
      const idx = cur == null ? revs.length : revs.indexOf(cur)
      const next = id === 'rev.prev' ? Math.max(0, idx - 1) : Math.min(revs.length, idx + 1)
      return set({ revView: next >= revs.length ? null : revs[next] })
    }
    case 'quotes.request': {
      if (role !== 'purchasing') return toast('権限なし（概算見積の依頼は購買）', 'err')
      const ids = p.supplierIds.length ? p.supplierIds : p.preferredSupplierIds
      return prompt('概算見積を依頼', { options: s.ws.suppliers.filter((x) => x.tradable).map((x) => `${x.id} ${x.name}${ids.includes(x.id) ? '（相見積先）' : ''}`), placeholder: `回答期限（既定 ${addDays(todayStr(), p.settings.quoteDays)}）。Enter で相見積先すべてに依頼、1〜9 で1社だけ`, requireText: true }, (choice, text) => {
        const deadline = text.trim() || addDays(todayStr(), p.settings.quoteDays)
        const sids = choice ? [choice.split(' ')[0]] : ids
        void quotes.requestRoughQuotes(sids, deadline).then((m) => toast(m, m.startsWith('権限') || m.startsWith('依頼する行') ? 'err' : 'ok'))
      })
    }
    case 'quotes.import': {
      if (role !== 'purchasing') return toast('権限なし（取り込みは購買）', 'err')
      return prompt('どの商社の回答ですか', { options: p.supplierIds.map((sid) => `${sid} ${s.ws.suppliers.find((x) => x.id === sid)?.name}`) }, (choice) => {
        const sid = (choice ?? p.supplierIds[0]).split(' ')[0]
        openPanel({ kind: 'import', title: `見積回答を取り込む（${s.ws.suppliers.find((x) => x.id === sid)?.name}）`, text: '', onSubmit: (text) => {
          const res = quotes.importQuoteAnswers(text, sid)
          toast(`取り込み ${res.updated} 行 / 突合不能 ${res.unmatched.length} / 型式不一致 ${res.modelMismatch.length} / 代替提案の下書き ${res.proposals}`, res.unmatched.length ? 'info' : 'ok')
        } })
      })
    }
    case 'quotes.formal':
      return void quotes.requestFormalQuotes().then((m) => toast(m, m.startsWith('権限') || m.startsWith('依頼する行') ? 'err' : 'ok'))
    case 'export.selection':
      return void import('@/io/excel').then((m) => m.exportSelectionRecord(s.ws, p, (row) => scoreRow(p, row, s.ws.suppliers)))
    case 'adopt.bulkBest':
      adopt.bulkAdopt('best')
      return
    case 'adopt.bulkCheapest':
      adopt.bulkAdopt('cheapest')
      return
    case 'consolidate': {
      const options = adopt.consolidateOptions().map((o) => ({ label: o.label, detail: o.detail, run: () => adopt.applyConsolidation(o.supplierIds) }))
      return openPanel({ kind: 'consolidate', index: 0, options })
    }
    case 'settings':
      return openSettings()
    case 'settings.confirm':
      return pm.confirmSettings()
    case 'ltb.request':
      if (!need()) return
      return prompt(`先行発注を申請 ${r!.id}（理由）`, { requireText: true }, (_c, t) => pm.requestEarlyOrder(r!.id, t))
    case 'project.new':
      return openPanel({ kind: 'wizard', step: 0, data: {}, sel: 0, picks: [] })
    case 'history':
      return openPanel({ kind: 'history', rowId: r?.id ?? '', index: 0 })
    case 'rule.add': {
      if (!need()) return
      const iss = p.issues.filter((i) => i.rowId === r!.id && i.status !== 'draft')
      const options = iss.map((i) => ({ label: `${i.id} ${i.kind}: ${i.text.slice(0, 30)} → ルール化（全案件）`, run: () => { const rule = issues.ruleFromIssue(i.id); if (rule) toast(`ルールを追加: ${rule.name}`) } }))
      options.push({ label: '型式の前後空白チェック（この列・警告）', run: () => s.commitWs('ルールを追加', (ws) => ws.rules.push({ id: `rule.ws.${Date.now()}`, name: `${s.cursorCol} の前後空白なし`, field: s.cursorCol as keyof Row, type: 'noWhitespace', severity: 'warn', message: `${colDef(s.cursorCol)?.label} の前後に空白があります`, owner: s.ws.user.name, scope: 'all', enabled: true })) })
      return openPanel({ kind: 'rule', rowId: r!.id, field: s.cursorCol, index: 0, options })
    }
    case 'theme.toggle': {
      const cur = document.documentElement.dataset.theme
      const next = cur === 'dark' ? 'light' : 'dark'
      document.documentElement.dataset.theme = next
      localStorage.setItem('bom-pro.theme', next)
      return toast(`テーマ: ${next}`, 'info')
    }
    case 'density.toggle': {
      const cur = document.documentElement.dataset.density
      document.documentElement.dataset.density = cur === 'compact' ? '' : 'compact'
      return
    }
    case 'data.reset':
      return prompt('サンプルデータに戻しますか（保存内容は消えます）', { options: ['戻す', 'やめる'] }, (c) => {
        if (c !== '戻す') return
        resetWorkspace()
        s.commitWs('サンプルに戻しました', (ws) => {
          const sp = makeSampleProject()
          ws.projects = [sp]
          ws.currentProjectId = sp.id
        })
      })
    case 'data.exportJson': {
      const blob = new Blob([JSON.stringify(s.ws, null, 2)], { type: 'application/json' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `bom-workspace-${todayStr()}.json`
      a.click()
      return
    }
    case 'data.importJson':
      return openPanel({ kind: 'import', title: 'JSON を読み込む（共有ストアの書き出しを貼り付け）', text: '', onSubmit: (text) => {
        try {
          const ws = JSON.parse(text)
          if (!ws.projects) throw new Error('形式が違います')
          s.commitWs('JSON を読み込みました', (w) => Object.assign(w, ws))
        } catch (err) {
          toast(`読み込めません: ${(err as Error).message}`, 'err')
        }
      } })
    case 'supplier.add':
      return prompt('商社を追加（名前）', { requireText: true }, (_c, name) => s.commitWs(`商社を追加: ${name}`, (ws) => { ws.suppliers.push(makeSupplier('S' + (ws.suppliers.length + 1), name, ws.suppliers.length)) }))
    case 'role.switch':
      return prompt('役割を切り替え（ログイン）', { options: ['設計', '購買', 'PM'], placeholder: '氏名（空なら案件の担当者名）' }, (choice, name) => {
        const role: Role = choice === '購買' ? 'purchasing' : choice === 'PM' ? 'pm' : 'design'
        s.commitWs(`役割: ${ROLE_LABEL[role]}`, (ws) => { ws.user = { role, name: name.trim() || ws.projects.find((x) => x.id === ws.currentProjectId)?.members[role] || ws.user.name } })
      })
    default:
      if (id.startsWith('view.')) {
        const v = Number(id.slice(5)) as ViewId
        set({ view: v, cursorRow: null, detailIndex: 0, revView: null })
        ensureCursor()
        return
      }
      toast(`未実装: ${id}`, 'err')
  }
}

// ---------- パレット ----------
export interface PaletteItem {
  id: string
  section: string
  label: string
  desc?: string
  keys?: string[]
  run: () => void
}

const STATIC: Array<{ id: string; label: string; section: string; desc?: string; keywords?: string }> = [
  { id: 'publish', label: '公開（提出 / 指摘を発行）', section: '流れ', desc: '自分の未公開の行と下書き指摘' },
  { id: 'quotes.request', label: '概算見積を依頼', section: '流れ', desc: '購買。商社向け依頼 Excel を出す' },
  { id: 'quotes.import', label: '見積回答を取り込む', section: '流れ', desc: '購買。貼り付けで突合' },
  { id: 'adopt.bulkBest', label: '未採用を推奨で一括採用', section: '流れ' },
  { id: 'adopt.bulkCheapest', label: '未採用を最安で一括採用（スコア無視）', section: '流れ' },
  { id: 'consolidate', label: '商社を集約', section: '流れ', desc: '1社/2社に集約した総額差を試算' },
  { id: 'quotes.formal', label: '正式見積を依頼（社外）', section: '流れ', desc: '購買。選定済の行を商社ごとに' },
  { id: 'export.selection', label: '選定記録を出力（社内）', section: '流れ', desc: 'スコア内訳つき' },
  { id: 'ltb.request', label: '先行発注を申請', section: '流れ', desc: '購買 → PM の要決定へ' },
  { id: 'settings', label: '案件設定', section: '案件', desc: 'PM 項目 / 購買項目。納期変更は影響試算つき' },
  { id: 'settings.confirm', label: '案件設定を確定（PM）', section: '案件' },
  { id: 'project.new', label: '新しいBOM', section: '案件' },
  { id: 'project.switch', label: '受信箱・案件を切り替える', section: '案件' },
  { id: 'rule.add', label: 'ルールを追加', section: 'チェック' },
  { id: 'export.excel', label: 'Excelで出力', section: '出力' },
  { id: 'copy.formatted', label: '表示中の行と列を書式つきでコピー', section: '出力' },
  { id: 'data.exportJson', label: 'JSON を書き出す', section: 'データ' },
  { id: 'data.importJson', label: 'JSON を読み込む', section: 'データ' },
  { id: 'data.reset', label: 'サンプルデータに戻す', section: 'データ' },
  { id: 'supplier.add', label: '商社を追加', section: '案件' },
  { id: 'role.switch', label: '役割を切り替え（ログイン）', section: '案件' },
  { id: 'history', label: '履歴', section: '案件' },
  { id: 'theme.toggle', label: 'ダークモード切替', section: '表示' },
  { id: 'density.toggle', label: 'コンパクト表示切替', section: '表示' },
  { id: 'help', label: 'ショートカット一覧', section: '表示' },
]

export function paletteItems(query: string): PaletteItem[] {
  const s = st()
  const p = s.project()
  const q = query.trim()
  const items: PaletteItem[] = []
  const wrap = (fn: () => void) => () => {
    closePanel()
    fn()
  }
  // 文の形: <ID> 採用 [商社] / 置換 / 発注 / 入荷 / 隠す / 指摘 <種別>
  const m = q.match(/^(r?\d{1,3}|R\d{3})\s*(.*)$/i)
  if (m) {
    const id = /^r?\d+$/i.test(m[1]) ? 'R' + m[1].replace(/\D/g, '').padStart(3, '0') : m[1].toUpperCase()
    const row = p.rows.find((x) => x.id === id)
    if (row) {
      const rest = m[2].trim()
      const e = effective(row)
      const scores = scoreRow(p, row, s.ws.suppliers)
      if (!rest || '採用'.startsWith(rest) || rest.startsWith('採用')) {
        const supQ = rest.replace(/^採用\s*/, '').trim()
        const cands = supQ ? scores.filter((sc) => s.ws.suppliers.find((x) => x.id === sc.supplierId)?.name.includes(supQ)) : scores
        cands.forEach((sc, i) => {
          const sup = s.ws.suppliers.find((x) => x.id === sc.supplierId)!
          items.push({ id: `adopt:${id}:${sc.supplierId}`, section: id, label: `${id} を ${sup.name} で採用 ¥${sc.quote.unitPrice?.toLocaleString()} スコア${sc.total}${i === 0 ? ' 推奨' : ''}`, desc: e.name, keys: i === 0 ? ['a'] : ['Shift+A', String(i + 1)], run: wrap(() => { jumpToRow(id); if (i === 0) adopt.adoptBest(id); else prompt('1位以外の理由', { options: [...adopt.ADOPT_REASONS] }, (c) => adopt.adoptChoose(id, sc.supplierId, c ?? 'その他')) }) })
        })
      }
      const rowCmds: Array<[string, string, string]> = [['置換', 'row.replace', 'r'], ['発注', 'row.toggleOrdered', 'o'], ['入荷', 'row.toggleReceived', 'i'], ['隠す', 'row.toggleHidden', 'h'], ['指摘', 'issue.raise', 'Shift+I'], ['開く', 'row.toggleOpen', ' ']]
      for (const [label, cmd, key] of rowCmds) if (!rest || label.startsWith(rest)) items.push({ id: `${cmd}:${id}`, section: id, label: `${id} を${label}`, desc: e.name + ' ' + e.model, keys: [key], run: wrap(() => { jumpToRow(id); runCommand(cmd) }) })
      if (!rest) items.push({ id: `goto:${id}`, section: id, label: `${id} へジャンプ`, desc: e.name, keys: ['Ctrl+G'], run: wrap(() => jumpToRow(id)) })
    }
  }
  // ビュー
  for (const v of VIEWS) if (!q || `ビュー ${v.label}`.includes(q) || v.label.includes(q)) items.push({ id: `view.${v.id}`, section: 'ビュー', label: `ビュー: ${v.label}`, keys: [String(v.id)], run: wrap(() => runCommand(`view.${v.id}`)) })
  // 案件
  for (const pr of s.ws.projects) if (q && (pr.id + pr.name).toLowerCase().includes(q.toLowerCase().replace(/^案件\s*/, ''))) items.push({ id: `project:${pr.id}`, section: '案件', label: `案件: ${pr.id} ${pr.name}`, keys: ['Ctrl+P'], run: wrap(() => s.commitWs('', (ws) => { ws.currentProjectId = pr.id })) })
  // 静的
  for (const c of STATIC) if (!q || c.label.toLowerCase().includes(q.toLowerCase()) || (c.desc ?? '').includes(q)) items.push({ id: c.id, section: c.section, label: c.label, desc: c.desc, keys: bindingsFor(c.id), run: wrap(() => runCommand(c.id)) })
  // キーマップのコマンド
  for (const b of KEYMAP) if (q && b.label.includes(q) && !items.some((i) => i.id === b.id)) items.push({ id: b.id, section: b.section, label: b.label, keys: b.keys, run: wrap(() => runCommand(b.id)) })
  // 最近使ったものを上に
  const recent = s.recentCommands
  items.sort((a, b) => {
    const ra = recent.indexOf(a.id)
    const rb = recent.indexOf(b.id)
    if (ra >= 0 || rb >= 0) return (rb >= 0 ? rb : -1) - (ra >= 0 ? ra : -1)
    return 0
  })
  return items
}

// ---------- パネルのキー処理 ----------
function handlePanelKey(key: string, e: KeyboardEvent): boolean {
  const s = st()
  const panel = s.panel!
  const p = s.project()
  const up = (n: number, len: number) => Math.max(0, Math.min(Math.max(len - 1, 0), n))
  if (key === 'Escape') {
    if (panel.kind === 'wizard' && panel.step > 0) return (set({ panel: { ...panel, step: panel.step - 1 } }), true)
    closePanel()
    if (s.sequence) set({ sequence: false })
    return true
  }
  switch (panel.kind) {
    case 'palette': {
      const items = paletteItems(panel.query)
      if (key === 'ArrowDown') return (set({ panel: { ...panel, index: up(panel.index + 1, items.length) } }), true)
      if (key === 'ArrowUp') return (set({ panel: { ...panel, index: up(panel.index - 1, items.length) } }), true)
      if (key === 'Enter') {
        const it = items[panel.index]
        if (it) {
          set({ recentCommands: [it.id, ...s.recentCommands.filter((x) => x !== it.id)].slice(0, 20) })
          it.run()
        }
        return true
      }
      return key === 'Ctrl+K' ? (closePanel(), true) : false
    }
    case 'help':
    case 'history':
      return key === '?' || key === 'Enter' ? (closePanel(), true) : false
    case 'columns': {
      const cols = colsForPanel()
      if (key === 'ArrowDown') return (set({ panel: { ...panel, index: up(panel.index + 1, cols.length) } }), true)
      if (key === 'ArrowUp') return (set({ panel: { ...panel, index: up(panel.index - 1, cols.length) } }), true)
      if (key === ' ' || key === 'Enter') {
        const c = cols[panel.index]
        set({ hiddenCols: s.hiddenCols.includes(c) ? s.hiddenCols.filter((x) => x !== c) : [...s.hiddenCols, c] })
        return true
      }
      return false
    }
    case 'issue': {
      if (panel.step === 'kind') {
        const def = ISSUE_KINDS.find((k) => k.key === key && k.kind !== '納期NG' && k.kind !== 'コスト超過')
        if (def) {
          const row = p.rows.find((r) => r.id === panel.rowId)!
          const err = issues.canRaise(row, def.kind)
          if (err) {
            toast(err, 'err')
            return true
          }
          set({ panel: { ...panel, step: 'text', issueKind: def.kind } })
          return true
        }
        return true
      }
      if (key === 'Tab') {
        e.preventDefault()
        set({ panel: { ...panel, step: 'proposal' } })
        return true
      }
      if (key === 'Enter' || key === 'Ctrl+Enter') {
        const kind = panel.issueKind as IssueKind
        const pr = panel.proposal
        const proposal = pr.model ? { model: pr.model, maker: pr.maker, supplierId: pr.supplierId || undefined, unitPrice: pr.unitPrice ? Number(pr.unitPrice) : null, leadDays: pr.leadDays ? Number(pr.leadDays) : null } : undefined
        const id = issues.raiseIssue(panel.rowId, panel.field, kind, panel.text, proposal)
        closePanel()
        if (id) toast(`${id} ${kind} を下書きに追加（Ctrl+Enter で発行、J で次の行）`, 'ok')
        return true
      }
      if (key === 'J' && panel.step === 'text' && !panel.text) {
        moveCursorRow(1)
        const r = cursorRow()
        if (r) set({ panel: { ...panel, rowId: r.id } })
        return true
      }
      return false
    }
    case 'adopt': {
      const row = p.rows.find((r) => r.id === panel.rowId)!
      const scores = scoreRow(p, row, s.ws.suppliers)
      if (key === 'ArrowDown') return (set({ panel: { ...panel, index: up(panel.index + 1, scores.length) } }), true)
      if (key === 'ArrowUp') return (set({ panel: { ...panel, index: up(panel.index - 1, scores.length) } }), true)
      const n = /^[1-9]$/.test(key) ? Number(key) - 1 : key === 'Enter' ? panel.index : -1
      if (n >= 0 && scores[n]) {
        const sc = scores[n]
        closePanel()
        if (n === 0 && row.status !== 'quoting') adopt.adoptChoose(row.id, sc.supplierId)
        else prompt(row.status === 'quoting' ? '先行採用の理由（PM 承認待ちになります）' : '1位以外を選ぶ理由', { options: [...adopt.ADOPT_REASONS] }, (c, t) => adopt.adoptChoose(row.id, sc.supplierId, (c ?? 'その他') + (t ? `: ${t}` : '')))
        return true
      }
      return true
    }
    case 'prompt': {
      const n = panel.options?.length ?? 0
      if (panel.options && /^[1-9]$/.test(key) && Number(key) <= n) {
        const choice = panel.options[Number(key) - 1]
        if (panel.requireText && !panel.text.trim()) return (set({ panel: { ...panel, index: Number(key) - 1 } }), true)
        closePanel()
        panel.onSubmit(choice, panel.text)
        return true
      }
      if (key === 'ArrowDown' && panel.options) return (set({ panel: { ...panel, index: up(panel.index + 1, n) } }), true)
      if (key === 'ArrowUp' && panel.options) return (set({ panel: { ...panel, index: up(panel.index - 1, n) } }), true)
      if (key === 'Enter' || key === 'Ctrl+Enter') {
        if (panel.requireText && !panel.text.trim()) return (toast('入力は必須です', 'err'), true)
        const choice = panel.options ? panel.options[panel.index] : null
        closePanel()
        panel.onSubmit(choice, panel.text)
        return true
      }
      return key === 'Tab' ? false : false
    }
    case 'quickfix':
    case 'rule':
    case 'export':
    case 'consolidate': {
      const opts = panel.options
      if (key === 'ArrowDown') return (set({ panel: { ...panel, index: up(panel.index + 1, opts.length) } }), true)
      if (key === 'ArrowUp') return (set({ panel: { ...panel, index: up(panel.index - 1, opts.length) } }), true)
      let n = /^[1-9]$/.test(key) ? Number(key) - 1 : key === 'Enter' ? panel.index : -1
      if (n < 0 && panel.kind === 'quickfix') {
        // 決定パネル・指摘アクションの文字キー（b g d q e p y Y 1〜7）
        const hit = opts.findIndex((o) => o.label.startsWith(key + ' ') || o.label.startsWith((key === 'Shift+Y' ? 'Shift+Y' : key) + ' '))
        if (hit >= 0) n = hit
      }
      if (n >= 0 && opts[n]) {
        closePanel()
        opts[n].run()
        if (s.sequence && panel.kind === 'quickfix') setTimeout(() => { gotoProblem(1); if (cursorRow() && problemCells().length) openQuickfix(); else set({ sequence: false }) }, 0)
        return true
      }
      return true
    }
    case 'impact':
      if (key === 'Enter') {
        closePanel()
        panel.onConfirm()
        return true
      }
      return true
    case 'import':
      if (key === 'Ctrl+Enter') {
        closePanel()
        panel.onSubmit(panel.text)
        return true
      }
      return false
    case 'replyIssue':
      if (key === 'Enter') {
        if (!panel.text.trim()) return true
        closePanel()
        issues.replyIssue(panel.issueId, panel.text)
        return true
      }
      return false
    case 'inbox': {
      const q = panel.query.toLowerCase()
      const list = s.ws.projects.filter((x) => !q || (x.id + x.name).toLowerCase().includes(q))
      if (key === 'ArrowDown') return (set({ panel: { ...panel, index: up(panel.index + 1, list.length + 1) } }), true)
      if (key === 'ArrowUp') return (set({ panel: { ...panel, index: up(panel.index - 1, list.length + 1) } }), true)
      if (key === 'Enter') {
        if (panel.index >= list.length) {
          runCommand('project.new')
          return true
        }
        const target = list[panel.index]
        closePanel()
        s.commitWs('', (ws) => { ws.currentProjectId = target.id })
        // 自分宛の最初の行へ
        const p2 = st().project()
        const role = st().user().role
        const first = p2.rows.find((r) => isActive(r) && (vm().ctx, true) && ballOf(p2, r) === role)
        set({ view: role === 'design' ? 4 : role === 'purchasing' ? 9 : 7, cursorRow: first?.id ?? null })
        if (first) jumpToRow(first.id)
        return true
      }
      return false
    }
    case 'settings': {
      const fields = settingsFieldsOf(p)
      if (panel.editing) {
        if (key === 'Enter') return (set({ panel: { ...panel, editing: false, draft: { ...panel.draft, [fields[panel.index].key]: panel.value } } }), true)
        return false
      }
      if (key === 'ArrowDown') return (set({ panel: { ...panel, index: up(panel.index + 1, fields.length) } }), true)
      if (key === 'ArrowUp') return (set({ panel: { ...panel, index: up(panel.index - 1, fields.length) } }), true)
      if (key === 'Enter') {
        const f = fields[panel.index]
        const role = s.user().role
        if ((f.owner === 'PM' && role !== 'pm') || (f.owner === '購買' && role === 'design')) return (toast(`権限なし（${f.label} は ${f.owner} 項目）`, 'err'), true)
        return (set({ panel: { ...panel, editing: true, value: panel.draft[f.key] ?? f.value } }), true)
      }
      if (key === 'Ctrl+Enter') return (saveSettings(panel.draft), true)
      if (key === 'y') {
        if (s.user().role !== 'pm') return (toast('権限なし（確定は PM）', 'err'), true)
        if (Object.keys(panel.draft).length) saveSettings(panel.draft)
        pm.confirmSettings()
        closePanel()
        return true
      }
      return true
    }
    case 'weights': {
      const keys = ['price', 'lead', 'record', 'terms'] as const
      if (key === 'ArrowDown') return (set({ panel: { ...panel, index: up(panel.index + 1, 4) } }), true)
      if (key === 'ArrowUp') return (set({ panel: { ...panel, index: up(panel.index - 1, 4) } }), true)
      if (key === 'ArrowLeft' || key === 'ArrowRight') {
        const d = key === 'ArrowLeft' ? -5 : 5
        s.commit('行の重みを変更', (p2) => {
          const w = { ...(p2.rowWeights[panel.rowId] ?? p2.weights) }
          w[keys[panel.index]] = Math.max(0, Math.min(100, w[keys[panel.index]] + d))
          p2.rowWeights[panel.rowId] = w
        }, { rowId: panel.rowId })
        return true
      }
      if (key === 'Delete') {
        s.commit('行の重みを既定に戻す', (p2) => { delete p2.rowWeights[panel.rowId] }, { rowId: panel.rowId })
        return true
      }
      return true
    }
    case 'wizard': {
      const n = s.ws.suppliers.length
      if (key === 'Alt+ArrowLeft') return (set({ panel: { ...panel, step: Math.max(0, panel.step - 1) } }), true)
      if (panel.step === 6) {
        if (key === 'ArrowDown') return (set({ panel: { ...panel, sel: up(panel.sel + 1, n) } }), true)
        if (key === 'ArrowUp') return (set({ panel: { ...panel, sel: up(panel.sel - 1, n) } }), true)
        if (key === ' ') {
          const id = s.ws.suppliers[panel.sel].id
          return (set({ panel: { ...panel, picks: panel.picks.includes(id) ? panel.picks.filter((x) => x !== id) : [...panel.picks, id] } }), true)
        }
      }
      if (panel.step === 7 && /^[1-3]$/.test(key) && !(e.target instanceof HTMLTextAreaElement)) return (set({ panel: { ...panel, sel: Number(key) - 1 } }), true)
      if (key === 'Enter' && !(e.target instanceof HTMLTextAreaElement && !e.ctrlKey) || key === 'Ctrl+Enter') {
        if (panel.step < 8) return (set({ panel: { ...panel, step: panel.step + 1 } }), true)
        createProjectFromWizard(panel.data, panel.picks, panel.sel)
        return true
      }
      return false
    }
  }
}
function colsForPanel() {
  return (st().ws, ['id', 'ball', 'ref', 'drawing', 'category', 'name', 'model', 'maker', 'qtyNeeded', 'unit', 'packQty', 'procurement', 'makerLock', 'altPolicy', 'designated', 'needOffset', 'needDateFixed', 'needDate', 'tags', 'orderQty', 'adopted', 'score', 'unitPrice', 'amount', 'formalPrice', 'formalDiff', 'lead', 'status', 'due', 'waiting', 'ordered', 'received', 'promisedDate', 'receivedLot', 'extraCost', 'extraCostKind', 'note'])
}
import { settingsFields as settingsFieldsOf } from '@/ui/Panels'
import { ball as ballOf } from '@/model/derive'

// ---------- 全体のキー処理 ----------
export function handleKeyDown(e: KeyboardEvent) {
  if (e.isComposing || e.key === 'Process') {
    // 日本語入力の変換中は何もしない。ナビモードで IME が始まったら編集に入る
    if (e.key === 'Process' && st().mode === 'nav' && !st().panel) startEdit('')
    return
  }
  const s = st()
  const key = eventToKey(e)
  const target = e.target as HTMLElement | null
  const inInput = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement
  // 絞り込み入力中
  if (inInput && target?.classList.contains('filter')) {
    if (key === 'Escape' || key === 'Enter') {
      ;(target as HTMLInputElement).blur()
      document.querySelector<HTMLElement>('.gridwrap')?.focus()
      if (key === 'Enter') ensureCursor()
      e.preventDefault()
    }
    return
  }
  if (s.panel) {
    if (handlePanelKey(key, e)) {
      e.preventDefault()
      return
    }
    // パネル内の入力はそのまま
    if (key === 'Ctrl+K' || key === 'Ctrl+Z' || key === 'Ctrl+Shift+Z') e.preventDefault()
    return
  }
  if (s.mode === 'edit') {
    switch (key) {
      case 'Enter':
        e.preventDefault()
        return commitEdit('down')
      case 'Tab':
        e.preventDefault()
        return commitEdit('right')
      case 'Shift+Tab':
        e.preventDefault()
        return commitEdit('left')
      case 'Escape':
        e.preventDefault()
        return cancelEdit()
      case 'ArrowDown':
      case 'ArrowUp': {
        const c = s.editCandidates
        if (c && c.length > 1) {
          e.preventDefault()
          const rot = key === 'ArrowDown' ? [...c.slice(1), c[0]] : [c[c.length - 1], ...c.slice(0, -1)]
          set({ editCandidates: rot })
        }
        return
      }
    }
    const b = lookupBinding(key, 'edit')
    if (b && b.mode === 'any' && ['palette.open', 'undo', 'redo', 'project.save', 'help'].includes(b.id)) {
      e.preventDefault()
      commitEdit('stay')
      runCommand(b.id, e)
    }
    return
  }
  // ナビモード
  const b = lookupBinding(key, 'nav')
  if (b) {
    if (!(b.id === 'cell.paste' || b.id === 'cell.copy')) e.preventDefault()
    if (b.id === 'cell.copy' && window.getSelection()?.toString()) return
    if (b.id === 'cell.paste') e.preventDefault()
    if (!(b.id.startsWith('move.') || b.id === 'row.next' || b.id === 'row.prev' || b.id.startsWith('view.'))) ensureCursor()
    runCommand(b.id, e)
    return
  }
  // 未割り当ての印字可能文字 → 上書き編集
  if (key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && !inInput) {
    ensureCursor()
    if (cursorRow() && !rows.canEdit(st().cursorCol)) {
      e.preventDefault()
      startEdit(key)
    }
  }
}
