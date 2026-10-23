import { useStore, type Panel, type PanelOption, type ViewId, type State } from '@/model/store'
import { KEYMAP, bindingsFor, eventToKey, lookupBinding } from '@/keys/keymap'
import { buildViewModel, cellText } from '@/model/selectors'
import { colDef, supplierOfCol } from '@/model/columns'
import type { ChangeReason, IssueKind, Project, Role, Row, Workspace } from '@/model/types'
import { CHANGE_REASONS, ISSUE_KINDS, ROLE_LABEL } from '@/model/types'
import { VIEWS, isAcked } from '@/model/views'
import { ball as ballOf, effective, hasWork, isActive, openIssues } from '@/model/derive'
import { checkRow, type Problem } from '@/model/rules'
import * as rows from '@/actions/rows'
import * as issues from '@/actions/issues'
import * as adopt from '@/actions/adopt'
import * as pm from '@/actions/pm'
import * as quotes from '@/actions/quotes'
import { rankedQuotes, scoreRow } from '@/model/score'
import { makeSampleProject, makeSupplier, newProject, newRow, rowId as mkRowId, DEFAULT_SETTINGS } from '@/model/sample'
import { normalize, setStatus } from '@/model/lifecycle'
import { clearBackups, loadBackups, resetWorkspace, saveBackup, type Backup } from '@/io/persist'
import { addDays, fmtDateTime, todayStr } from '@/model/dates'
import { parseDate, parseNumber, toHalf } from '@/model/parse'
import { sanitizeWorkspace } from '@/model/validate'
import { parseBomPaste } from '@/io/paste'
import { settingsFields as settingsFieldsOf } from '@/ui/settingsFields'

const st = () => useStore.getState()
const set = (p: Partial<State>) => useStore.setState(p)
const toast = (t: string, k: 'ok' | 'err' | 'info' = 'ok') => st().toastMsg(t, k)
const vm = () => buildViewModel(st())

export const ROLE_DEFAULT_VIEW: Record<Role, ViewId> = { design: 4, purchasing: 9, pm: 7 }

/** 選択中の行（いま表示されている行だけ。絞り込みで隠れた行は対象にしない） */
function cursorRow(): Row | undefined {
  const s = st()
  if (!s.cursorRow || s.cursorRow.startsWith('g:')) return undefined
  return vm().rows.find((r) => r.id === s.cursorRow)
}

export function openPanel(panel: Panel) {
  set({ panel, mode: panel.kind === 'palette' ? 'palette' : 'panel' })
}
export function closePanel() {
  set({ panel: null, mode: 'nav' })
}

interface PromptOpts {
  options?: string[]
  requireText?: boolean
  showText?: boolean
  placeholder?: string
  extra?: Record<string, string>
  /** 最初に選ばれている選択肢（危ない操作は「やめる」を既定にする） */
  index?: number
  danger?: boolean
  /** 文字欄が空のとき数字キーで選択肢を選ぶ（理由の選択など） */
  digitsSelect?: boolean
}
/** 選択・入力のダイアログ。onSubmit が文字列を返したらエラーとしてダイアログを開いたままにする */
function prompt(title: string, opts: PromptOpts, onSubmit: (choice: string | null, text: string, extra?: Record<string, string>) => string | void) {
  openPanel({
    kind: 'prompt',
    title,
    options: opts.options,
    index: opts.index ?? 0,
    text: '',
    placeholder: opts.placeholder,
    requireText: opts.requireText,
    showText: opts.showText ?? (opts.requireText || !opts.options || !!opts.placeholder),
    digitsSelect: opts.digitsSelect,
    extra: opts.extra,
    danger: opts.danger,
    onSubmit,
  })
}
function confirmDanger(title: string, yesLabel: string, run: () => void) {
  prompt(title, { options: ['やめる', yesLabel], index: 0, danger: true, showText: false }, (c) => {
    if (c === yesLabel) run()
    else toast('やめました（何も変えていません）', 'info')
  })
}

// ---------- 移動 ----------
function navItems() {
  return vm().items.filter((i) => i.kind !== 'detail')
}
/** Tab で右へ入力してきたときの開始の列（Enter で次の行のこの列へ戻る） */
let tabAnchor: { row: string; col: string } | null = null

/** 1 画面に見えている行数（PageUp / PageDown の移動量） */
function pageRows(): number {
  const wrap = document.querySelector<HTMLElement>('.gridwrap')
  const head = wrap?.querySelector<HTMLElement>('table.grid > thead')?.offsetHeight ?? 30
  const row = wrap?.querySelector<HTMLElement>('table.grid > tbody > tr.row')?.offsetHeight ?? 30
  return wrap ? Math.max(1, Math.floor((wrap.clientHeight - head) / row) - 1) : 20
}
function moveCursorToRow(delta: 1 | -1) {
  const items = navItems()
  const idx = items.findIndex((i) => i.key === st().cursorRow)
  for (let i = idx + delta; i >= 0 && i < items.length; i += delta) if (items[i].kind === 'row') return set({ cursorRow: items[i].key, detailIndex: 0 })
}
function moveCursorRow(delta: number) {
  const items = navItems()
  if (!items.length) return toast('この条件に合う行はありません（Esc で絞り込みを解除）', 'info')
  const s = st()
  const idx = items.findIndex((i) => i.key === s.cursorRow)
  if (idx < 0) {
    const firstRow = delta > 0 ? items.find((i) => i.kind === 'row') : [...items].reverse().find((i) => i.kind === 'row')
    set({ cursorRow: (firstRow ?? items[0]).key, detailIndex: 0 })
    ensureCol()
    return
  }
  const next = Math.max(0, Math.min(items.length - 1, idx + delta))
  set({ cursorRow: items[next].key, detailIndex: 0 })
}
function setCursorRowAbs(pos: 'top' | 'bottom') {
  const items = navItems()
  if (items.length) set({ cursorRow: pos === 'top' ? items[0].key : items[items.length - 1].key, detailIndex: 0 })
  ensureCol()
}
function ensureCol() {
  const cols = vm().columns
  if (!cols.includes(st().cursorCol)) set({ cursorCol: cols.includes('name') ? 'name' : cols[0] })
}
function moveCol(delta: number) {
  const cols = vm().columns
  if (!st().cursorRow) return moveCursorRow(1)
  const idx = cols.indexOf(st().cursorCol)
  const next = Math.max(0, Math.min(cols.length - 1, (idx < 0 ? 0 : idx) + delta))
  set({ cursorCol: cols[next] })
}
export function ensureCursor() {
  const s = st()
  const items = navItems()
  if (!items.length) return
  if (!s.cursorRow || !items.some((i) => i.key === s.cursorRow)) set({ cursorRow: items.find((i) => i.kind === 'row')?.key ?? items[0].key })
  ensureCol()
}
export function jumpToRow(id: string, col?: string) {
  const s = st()
  const p = s.project()
  const r = p.rows.find((x) => x.id === id)
  if (!r) return
  if (!vm().rows.some((x) => x.id === id)) set({ view: 1, filter: '', cellFilter: null })
  const cat = effective(r).category || '（分類なし）'
  if (st().collapsed.includes(cat)) set({ collapsed: st().collapsed.filter((c) => c !== cat) })
  set({ cursorRow: id, cursorCol: col && vm().columns.includes(col) ? col : s.cursorCol, detailIndex: 0 })
  ensureCol()
}
export function setView(v: ViewId) {
  // 編集中にビューを切り替えたら、先に今のセルへ確定する（別の行に書き込まない）
  if (!commitEdit('stay')) return
  set({ view: v, detailIndex: 0, revView: null })
  if (!vm().rows.some((r) => r.id === st().cursorRow)) set({ cursorRow: null })
  ensureCursor()
}

// ---------- 編集 ----------
export function startEdit(initial?: string) {
  const s = st()
  const r = cursorRow()
  if (!r) return toast(s.cursorRow?.startsWith('g:') ? '分類の見出しです（Space で折りたたみ。↓ で行へ）' : '行を選んでください（↓ で先頭の行へ）', 'info')
  const err = rows.canEdit(s.cursorCol)
  if (err) return toast(`${err}${s.ws.user.role !== 'design' && colDef(s.cursorCol)?.design ? '。変えてほしいときは Alt+Shift+I で指摘' : ''}`, 'err')
  if (!isActive(r)) return toast(`${r.id} は${r.status === 'cancelled' ? '取消' : '置換'}済の行です（編集できません）`, 'err')
  const d = colDef(s.cursorCol)!
  // 打ち終わってから拒否しない: 発注済以降の行の設計列は入口で止める
  if (d.design && (r.status === 'ordered' || r.status === 'received')) return toast(`${r.id} は発注済以降の行です。設計列は変えられません（Alt+Shift+I → h 発注後変更依頼）`, 'err')
  if (d.kind === 'bool') return toggleBool(r, s.cursorCol)
  const cur = cellText(r, s.cursorCol, vm().ctx)
  const value = initial ?? String(cur.raw ?? '')
  editProject = projectIdentity()
  set({ mode: 'edit', editValue: value, editError: null, editAuto: false, editBase: String(cur.raw ?? ''), editCandidates: d.kind === 'select' ? candidates(d.options ?? [], initial ?? '') : null })
}
function toggleBool(r: Row, col: string) {
  const v = (r as unknown as Record<string, unknown>)[col] === true
  if (col === 'ordered') return runCommand('row.toggleOrdered')
  if (col === 'received') return runCommand('row.toggleReceived')
  rows.setCell(r.id, col, v ? '' : '1')
}
function candidates(options: string[], v: string): string[] {
  const q = toHalf(v).trim().toLowerCase()
  if (!q) return options
  const list = options.filter((o) => o.toLowerCase().startsWith(q) || o.includes(v.trim()))
  return list.length ? list : options
}
export function updateEditValue(v: string) {
  const d = colDef(st().cursorCol)
  set({ editValue: v, editError: null, editCandidates: d?.kind === 'select' ? candidates(d.options ?? [], v) : null })
}
/** 編集を確定する。読めない値なら編集を続けて理由を出す（値を捨てない） */
/** 編集を始めた案件（別のタブで JSON 読み込みなどにより案件が置き換わったら、確定しない） */
let editProject = ''
function projectIdentity(): string {
  const p = st().project()
  return `${p.id}|${p.createdAt}`
}
export function commitEdit(dir: 'down' | 'right' | 'left' | 'stay' = 'down'): boolean {
  const s = st()
  if (s.mode !== 'edit') return true
  if (editProject && editProject !== projectIdentity()) {
    const v = s.editValue
    cancelEdit()
    toast(`編集中に案件が別のタブで置き換わったので、入力「${v}」は保存していません`, 'err')
    return false
  }
  const r = s.cursorRow ? s.project().rows.find((x) => x.id === s.cursorRow) : undefined
  if (!r) {
    cancelEdit()
    return false
  }
  const d = colDef(s.cursorCol)!
  let value = s.editValue
  if (d.kind === 'select' && s.editCandidates?.length && value.trim() !== '' && !(d.options ?? []).includes(value)) {
    const narrowed = candidates(d.options ?? [], value)
    if (narrowed.length < (d.options ?? []).length || s.editCandidates[0] !== (d.options ?? [])[0]) value = s.editCandidates[0]
  }
  const cur = cellText(r, s.cursorCol, vm().ctx)
  const now = String(cur.raw ?? '')
  // 自動で始めた入力を空のまま確定したら、値は変えずに移動だけ
  if (s.editAuto && value.trim() === '') value = now
  // 編集している間に、別のタブ（別の人）が同じセルを変えていたら、黙って上書きしない
  if (s.editBase != null && now !== s.editBase && value !== now) {
    set({ editBase: now, editError: `別のタブで「${now || '（空）'}」に変更されています` })
    toast(`このセルは編集中に別のタブで「${now || '（空）'}」に変更されました。もう一度 Enter で上書き、Esc でやめる`, 'err')
    return false
  }
  if (value !== now) {
    let col = s.cursorCol
    if (supplierOfCol(col) === 'A') {
      if (!r.adoptedSupplierId) {
        set({ editError: '採用商社が無いので正式見積を入れられません' })
        toast('採用商社が無いので正式見積を入れられません', 'err')
        return false
      }
      col = col.replace('@A', '@' + r.adoptedSupplierId)
    }
    const parsed = rows.parseValue(col, value)
    if (!parsed.ok) {
      set({ editError: parsed.error })
      toast(`${parsed.error}（直して Enter、やめるときは Esc）`, 'err')
      return false
    }
    set({ mode: 'nav', editCandidates: null, editError: null })
    if (!rows.setCell(r.id, col, value)) return false
  } else set({ mode: 'nav', editCandidates: null, editError: null })
  // Enter の連続入力は次のデータ行へ（分類の見出しで止まらない）。
  // Tab で右へ入れてきた後の Enter は、Excel と同じく Tab を始めた列に戻る（単価 Tab 納期 Tab MOQ Enter → 次の行の単価）
  if (dir === 'down') {
    const anchor = tabAnchor && tabAnchor.row === r.id ? tabAnchor.col : null
    tabAnchor = null
    moveCursorToRow(1)
    // 最後の行（下に行が無い）では列を戻さない（同じ行の最初の値を上書きしない）
    if (st().cursorRow === r.id) return true
    if (anchor && vm().columns.includes(anchor)) set({ cursorCol: anchor })
  } else if (dir === 'right' || dir === 'left') {
    if (!tabAnchor || tabAnchor.row !== r.id) tabAnchor = { row: r.id, col: s.cursorCol }
    moveCol(dir === 'right' ? 1 : -1)
  } else tabAnchor = null
  // 6 商社別・8 正式見積: 単価 → Tab → 納期 … と数字を続けて打てるよう、次の数値セルの入力を始める
  const n = st()
  if (dir !== 'stay' && (n.view === 6 || n.view === 8) && colDef(n.cursorCol)?.numeric && !rows.canEdit(n.cursorCol) && cursorRow() && (n.cursorRow !== r.id || n.cursorCol !== s.cursorCol)) {
    startEdit('')
    set({ editAuto: true })
  }
  return true
}
export function cancelEdit() {
  set({ mode: 'nav', editCandidates: null, editError: null })
}

// ---------- x の対象 ----------
export function nextAckTarget(p: Project, row: Row, role: Role): string | null {
  const me = st().ws.user.name
  const iss = p.issues.filter((i) => i.rowId === row.id)
  if (role !== 'design') {
    if (iss.some((i) => i.status === 'fixed' && i.by.name === me)) return '指摘を確認済に'
    if (iss.some((i) => i.status === 'answered' && i.by.name === me)) return '回答を受け入れて見送り'
  }
  if (row.flags.notation) return '表記修正を確認'
  if (row.flags.orderQtyCheck) return '発注数を確認'
  if (row.flags.contested && role === p.settings.selector) return '拮抗を確認'
  if (row.flags.priceCheck) return '単価要確認を確認'
  if (role === 'design') {
    const prs = checkRow(row, st().ws.rules, p)
    const pr = prs.find((x) => x.severity === 'warn' && x.field === st().cursorCol) ?? prs.find((x) => x.severity === 'warn')
    if (pr) return row.ackRules.includes(pr.ruleId) ? '警告の確認済みを外す' : '警告を確認済み'
  }
  if (st().view === 5 && p.submissions.some((sb) => sb.rowIds.includes(row.id) && !isAcked(sb, row.id, role))) return '差分を確認済'
  return null
}
function ackCurrent() {
  const s = st()
  const r = cursorRow()
  if (!r) return toast('行を選んでください（↓ で先頭の行へ）', 'info')
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
  if (r.flags.contested && role === p.settings.selector) return issues.ackFlag(r.id, 'contested')
  if (r.flags.priceCheck) return issues.ackFlag(r.id, 'priceCheck')
  if (role === 'design') {
    const prs = checkRow(r, s.ws.rules, p)
    const pr = prs.find((x) => x.severity === 'warn' && x.field === s.cursorCol) ?? prs.find((x) => x.severity === 'warn')
    if (pr) {
      rows.ackRule(r.id, pr.ruleId)
      return toast(r.ackRules.includes(pr.ruleId) ? `確認済みを外しました: ${pr.message}` : `確認済みにしました: ${pr.message}`, 'info')
    }
    if (prs.some((x) => x.severity === 'error')) return toast('エラーは確認済みにできません。直してください（Ctrl+. で直し方の候補）', 'err')
  }
  if (p.submissions.some((sb) => sb.rowIds.includes(r.id) && !isAcked(sb, r.id, role)) && (s.view === 5 || role !== 'design')) {
    // 確認は自分の役割の分だけ。Rev を選んでいればその Rev だけ
    const rev = s.revView
    s.commit('差分を確認済', (p2) => {
      for (const sub of p2.submissions) if (sub.rowIds.includes(r.id) && !isAcked(sub, r.id, role) && (rev == null || sub.rev === rev)) sub.acked.push(`${r.id}@${role}`)
    })
    return toast(`${r.id} の差分を確認済にしました（${ROLE_LABEL[role]}として${rev != null ? `・Rev.${rev}` : ''}）`, 'info')
  }
  toast('この行に確認するもの（対応済の指摘・警告・表記修正など）はありません', 'info')
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
      const b = i.status === 'open' || i.status === 'inProgress' ? issues.issueBallRole(i) : i.by.role
      if (b === role) out.push({ rowId: r.id, field: (i.field as string) ?? 'model', order: kinds.indexOf(i.kind) })
    }
    if (role === 'design') for (const pr of checkRow(r, s.ws.rules, p)) out.push({ rowId: r.id, field: pr.field, order: 20 + (pr.severity === 'error' ? 0 : 1) })
    if (role === 'purchasing' && (r.flags.reconfirm || r.flags.requote || r.flags.notation || r.flags.orderQtyCheck)) out.push({ rowId: r.id, field: 'model', order: 30 })
    if (role === 'pm' && ballOf(p, r) === 'pm') out.push({ rowId: r.id, field: 'status', order: 30 })
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
function gotoProblem(delta: 1 | -1): boolean {
  const list = problemCells()
  if (!list.length) {
    toast(`${ROLE_LABEL[st().user().role]}がいま直す問題はありません${st().user().role === 'design' ? '（Ctrl+Enter で公開できます）' : ''}`, 'info')
    return false
  }
  const s = st()
  const idx = list.findIndex((x) => x.rowId === s.cursorRow && x.field === s.cursorCol)
  const next = idx < 0 ? (delta > 0 ? 0 : list.length - 1) : (idx + delta + list.length) % list.length
  jumpToRow(list[next].rowId, list[next].field)
  return true
}

// ---------- Ctrl+. 候補 ----------
export function quickfixOptions(r: Row, field: string): PanelOption[] {
  const s = st()
  const p = s.project()
  const role = s.user().role
  const opts: PanelOption[] = []
  const iss = p.issues.filter((i) => i.rowId === r.id)
  for (const i of iss) if (i.proposal && (i.status === 'open' || i.status === 'inProgress') && role === 'design') opts.push({ label: `購買の提案 ${i.proposal.model} を適用して置換（${i.id}）`, run: () => void issues.applyProposal(i.id) })
  if (role === 'design') {
    const prs: Problem[] = checkRow(r, s.ws.rules, p)
    for (const pr of prs.filter((x) => x.field === field).concat(prs.filter((x) => x.field !== field))) {
      for (const f of pr.fixes) opts.push({ label: `${pr.message}: ${f.label}`, run: () => rows.applyFix(r.id, f.apply(r), f.label) })
      if (!pr.fixes.length)
        opts.push({
          label: `${pr.message}: 編集する`,
          run: () => {
            jumpToRow(r.id, pr.field)
            startEdit()
          },
        })
      if (pr.severity === 'warn') opts.push({ label: `${pr.message}: 確認済みにする（x）`, run: () => rows.ackRule(r.id, pr.ruleId) })
      opts.push({ label: `${pr.message}: あとで（Shift+→）`, run: () => rows.deferRule(r.id, pr.ruleId) })
    }
  }
  if (role === 'purchasing') {
    if (r.flags.reconfirm)
      for (const q of p.quotes.filter((x) => x.rowId === r.id && !x.stale && !x.reconfirm)) {
        const name = s.ws.suppliers.find((x) => x.id === q.supplierId)?.name
        opts.push({ label: `要再確認 ${name}: 据え置き`, run: () => issues.reconfirmQuote(r.id, q.supplierId, 'keep') }, { label: `要再確認 ${name}: 再見積`, run: () => issues.reconfirmQuote(r.id, q.supplierId, 'requote') })
        if (q.source?.startsWith('提案')) opts.push({ label: `要再確認 ${name}: 提案値で確定`, run: () => issues.reconfirmQuote(r.id, q.supplierId, 'proposal') })
      }
    if (r.flags.requote)
      opts.push(
        {
          label: '再見積要: 据え置き（旧見積を有効に戻す）',
          run: () =>
            s.commit('再見積要: 据え置き', (p2, ws) => {
              const rr = p2.rows.find((x) => x.id === r.id)!
              rr.flags.requote = false
              for (const q of p2.quotes.filter((x) => x.rowId === r.id && x.stale)) {
                const live = p2.quotes.find((x) => x.rowId === r.id && x.supplierId === q.supplierId && !x.stale)
                if (live && live.unitPrice == null) Object.assign(live, { unitPrice: q.unitPrice, leadDays: q.leadDays, moq: q.moq, stock: q.stock, validUntil: q.validUntil })
              }
              // 旧見積が戻ったので、提出済に戻っていた行は見積済へ進める（選定者が選び直す）
              if (rr.status === 'submitted') setStatus(rr, 'quoting')
              normalize(p2, ws)
            }),
        },
        { label: '再見積要: 再見積（概算見積を依頼）', run: () => runCommand('quotes.request') },
      )
    if (r.working && Object.keys(r.working).length) opts.push({ label: '設計に公開を依頼（質問を自動起票）', run: () => void issues.raiseIssue(r.id, undefined, '質問', '作業中の変更を公開してください（選定・正式依頼に含めるため）', undefined, true) })
    const fixedOrAnswered = iss.find((i) => (i.status === 'fixed' || i.status === 'answered') && i.by.name === s.ws.user.name)
    if (fixedOrAnswered)
      opts.push({
        label: `${fixedOrAnswered.id} からルールを作る（全案件）`,
        run: () => {
          const rule = issues.ruleFromIssue(fixedOrAnswered.id)
          if (rule) toast(`ルールを追加: ${rule.name}`)
        },
      })
  }
  for (const i of iss) if ((i.by.name === s.ws.user.name || role === 'pm') && (i.status === 'open' || i.status === 'inProgress' || i.status === 'answered')) opts.push({ label: `${i.id} を見送りにする（理由）`, run: () => prompt(`見送り ${i.id}`, { requireText: true }, (_c, t) => issues.wontfixIssue(i.id, t)) })
  return opts
}
function openQuickfix() {
  const s = st()
  const r = cursorRow()
  if (!r) return toast('行を選んでください（↓ で先頭の行へ）', 'info')
  const options = quickfixOptions(r, s.cursorCol)
  if (!options.length) return toast(`${r.id} に直し方の候補はありません`, 'info')
  openPanel({ kind: 'quickfix', title: `直し方の候補 ${r.id} ${effective(r).name}`, rowId: r.id, field: s.cursorCol, index: 0, options })
}

// ---------- 行の詳細（Space）内の選択 ----------
/** 詳細で ↓ で選べるもの: 指摘（自分に見えるもの）→ 見積 */
export function detailItems(r: Row): Array<{ kind: 'issue'; id: string } | { kind: 'quote'; supplierId: string }> {
  const s = st()
  const p = s.project()
  const iss = p.issues.filter((i) => i.rowId === r.id && (i.status !== 'draft' || i.by.name === s.ws.user.name))
  const qs = rankedQuotes(p, r, s.ws.suppliers)
  return [...iss.map((i) => ({ kind: 'issue' as const, id: i.id })), ...qs.map((q) => ({ kind: 'quote' as const, supplierId: q.supplierId }))]
}
function issueActionPanel(issueId: string) {
  const s = st()
  const p = s.project()
  const i = p.issues.find((x) => x.id === issueId)!
  const role = s.user().role
  // 番号は仕様 §6.3 の番号に固定（使えないものは出さない）
  const options: PanelOption[] = [{ key: '1', label: '返信', run: () => openPanel({ kind: 'replyIssue', issueId, text: '' }) }]
  if (role === 'design' && (i.status === 'open' || i.status === 'inProgress')) {
    options.push({ key: '2', label: '直さず回答（理由必須）', run: () => prompt(`回答 ${i.id}`, { requireText: true }, (_c, t) => issues.answerIssue(i.id, t, '説明')) })
    options.push({
      key: '3',
      label: '客先承認取得（番号・日付）',
      run: () =>
        prompt(`客先承認 ${i.id}`, { requireText: true, placeholder: '承認番号', extra: { 日付: todayStr() } }, (_c, t, ex) => {
          const dd = parseDate(ex?.['日付'] ?? '', { label: '承認日' })
          if (!dd.ok || !dd.value) return dd.ok ? '承認日を入れてください' : dd.error
          issues.answerIssue(i.id, `客先承認取得 ${t}`, '客先承認取得', { no: t, date: dd.value })
        }),
    })
    if (i.proposal) options.push({ key: '4', label: `提案 ${i.proposal.model} を適用（置換）`, run: () => void issues.applyProposal(i.id) })
    // 対策不成立は、PM の決定から出た指摘への回答だけ（購買の依頼には「直さず回答」で返す。§6.3）
    if ((i.kind === '納期NG' || i.kind === 'コスト超過' || i.kind === '数量見直し依頼') && i.by.role === 'pm')
      options.push({
        key: '7',
        label: `${i.kind === '数量見直し依頼' ? '数量変更不可' : '代替なし'}（対策不成立として PM へ）`,
        run: () =>
          prompt(`${i.id} 対策不成立の理由`, { requireText: true }, (_c, t) => {
            issues.answerIssue(i.id, t, '説明')
            s.commit('対策不成立', (p2) => {
              const rr = p2.rows.find((x) => x.id === i.rowId)!
              rr.flags.pmPending = true
              rr.flags.pmReason = '対策不成立'
            })
          }),
      })
  }
  if (i.by.name === s.ws.user.name || role === 'pm') {
    options.push({
      key: '5',
      label: 'この指摘からルールを作る',
      run: () => {
        const rule = issues.ruleFromIssue(i.id)
        if (rule) toast(`ルールを追加: ${rule.name}`)
      },
    })
    if (i.status !== 'confirmed' && i.status !== 'wontfix') options.push({ key: '6', label: '見送り（理由）', run: () => prompt(`見送り ${i.id}`, { requireText: true }, (_c, t) => issues.wontfixIssue(i.id, t)) })
  }
  openPanel({ kind: 'quickfix', title: `指摘のアクション ${i.id} ${i.kind}`, rowId: i.rowId, field: i.field as string, index: 0, options })
}
function quoteActionPanel(r: Row, supplierId: string) {
  const s = st()
  const p = s.project()
  const sup = s.ws.suppliers.find((x) => x.id === supplierId)
  const q = p.quotes.find((x) => x.rowId === r.id && x.supplierId === supplierId && !x.stale)
  const options: PanelOption[] = []
  // 採用は、スコアの付く（単価のある・辞退でない）見積だけに出す
  const scored = scoreRow(p, r, s.ws.suppliers).some((x) => x.supplierId === supplierId)
  const noQuote = !q || q.unitPrice == null ? '未回答です' : q.leadDays === -1 ? '辞退（取扱なし）です' : null
  if (!adopt.canAdopt(p, r, true) && scored)
    options.push({
      key: 'a',
      label: `${sup?.name} で採用`,
      run: () => {
        const scores = scoreRow(p, r, s.ws.suppliers)
        if (scores[0]?.supplierId === supplierId && r.status !== 'quoting') adopt.adoptChoose(r.id, supplierId)
        else prompt('1位以外を選ぶ理由（数字か ↑↓ で選んで Enter）', { options: [...adopt.ADOPT_REASONS], index: -1, placeholder: '補足（任意）', showText: true, digitsSelect: true }, (c, t) => void adopt.adoptChoose(r.id, supplierId, (c ?? 'その他') + (t ? `: ${t}` : '')))
      },
    })
  if (s.user().role === 'purchasing' && r.flags.reconfirm && q && !q.reconfirm) {
    options.push({ key: '1', label: `${sup?.name}: 据え置き`, run: () => issues.reconfirmQuote(r.id, supplierId, 'keep') }, { key: '2', label: `${sup?.name}: 再見積`, run: () => issues.reconfirmQuote(r.id, supplierId, 'requote') })
    if (q.source?.startsWith('提案')) options.push({ key: '3', label: `${sup?.name}: 提案値で確定`, run: () => issues.reconfirmQuote(r.id, supplierId, 'proposal') })
  }
  if (s.user().role === 'purchasing')
    options.push({
      key: 'i',
      label: `6 商社別ビューで ${sup?.name} の見積を入力`,
      run: () => {
        setView(6)
        jumpToRow(r.id, `q.unitPrice@${supplierId}`)
      },
    })
  if (!options.length) return toast(noQuote ? `${sup?.name ?? ''} の見積は${noQuote}（採用できません）` : (adopt.canAdopt(p, r, true) ?? 'この見積でできる操作はありません'), 'info')
  openPanel({ kind: 'quickfix', title: `見積のアクション ${r.id} ${sup?.name ?? ''}`, rowId: r.id, field: 'adopted', index: 0, options })
}

// ---------- 公開（Ctrl+Enter） ----------
export function publishFlow(rowIds?: string[]) {
  const s = st()
  const user = s.user()
  const plan = rows.planPublish(s.project(), s.ws.rules, user, rowIds)
  if (plan.rows.length === 0 && plan.draftIssues.length === 0) {
    const errs = user.role === 'design' ? s.project().rows.filter((r) => isActive(r) && checkRow(r, s.ws.rules, s.project()).some((x) => x.severity === 'error')).length : 0
    return toast(user.role === 'design' ? `公開するもの（下書き・未公開の変更）はありません${errs ? `。エラーのある行が ${errs} 行あります（F8 で移動）` : ''}` : user.role === 'purchasing' ? '発行する下書きの指摘はありません（Alt+Shift+I で起票）' : '公開するものはありません（PM は y / Shift+Y で決定）', 'info')
  }
  // 先にゲートを確かめる（理由を聞いてから拒否しない）
  const gate = plan.blockedErrors[0] ?? plan.blockedWarnings[0]
  if (plan.blockedErrors.length) return toast(`公開できません: エラー ${plan.blockedErrors.length} 件（${gate.rowId} ${gate.message} … F8 で移動して直す）`, 'err')
  if (plan.blockedWarnings.length) return toast(`公開できません: 未確認の警告 ${plan.blockedWarnings.length} 件（${gate.rowId} ${gate.message} … 直すか Alt+x で確認済みに）`, 'err')
  if (plan.deferred.length) return toast(`公開できません: 「あとで」にした問題が ${plan.deferred.length} 行に残っています（${plan.deferred[0]}）`, 'err')
  if (plan.nonIssueChanges.length && user.role === 'design') {
    prompt(`変更セット（${plan.nonIssueChanges.length} 行: ${plan.nonIssueChanges.slice(0, 5).join(', ')}${plan.nonIssueChanges.length > 5 ? ' …' : ''}）の理由。数字か ↑↓ で選び、変更番号（任意）を入れて Enter`, { options: [...CHANGE_REASONS], index: -1, placeholder: '変更番号（任意。例: ECN-2026-012）', showText: true, digitsSelect: true }, (choice, text) => {
      rows.publish(rowIds, { reason: (choice as ChangeReason) ?? 'その他', changeNo: text })
    })
    return
  }
  if (plan.canAppend && plan.rows.length) {
    prompt('公開の Rev（購買がまだ確認していない直前の Rev があります）', { options: ['新しい Rev', '直前の Rev に追記'], showText: false }, (choice) => void rows.publish(rowIds, undefined, choice === '直前の Rev に追記' ? 'append' : 'new'))
    return
  }
  rows.publish(rowIds)
}

// ---------- 決定パネル（7） ----------
function decisionPanel(r: Row) {
  const s = st()
  const p = s.project()
  const c = pm.pmCaseOf(p, r)
  if (c === 'なし') return toast(`${r.id} は要決定ではありません（7 要決定ビューの行で使えます）`, 'info')
  const options = pm.pmOptions(c, r).map((o) => ({ key: o.key === 'Y' ? 'Shift+Y' : o.key, label: o.label, run: () => decideWithReason(r.id, o.kind) }))
  // 既定の選択は無し（Enter の連打で受入・承認が決まらないように、キーか ↑↓ で選ぶ）
  // 先行発注の申請は、理由と金額を見て決められるように題に出す
  const req = c === '先行発注判断' && r.ltbRequest ? ` 申請: ${r.ltbRequest.reason}${r.ltbRequest.amount != null ? `（¥${r.ltbRequest.amount.toLocaleString()}）` : ''}・${r.ltbRequest.by}` : ''
  openPanel({ kind: 'quickfix', title: `決定パネル ${r.id}（${c}）${req}`, rowId: r.id, field: 'status', index: -1, options })
}
function decideWithReason(rowId: string, kind: Parameters<typeof pm.decide>[1]) {
  const s = st()
  const p = s.project()
  const r = p.rows.find((x) => x.id === rowId)!
  const ext = pm.needsExternalApproval(p, r) && (kind === '受入' || kind === '承認')
  const must = kind === '却下' || kind === '回答を支持' || kind === '指摘を支持'
  // 変更セットの承認・却下は Rev の全行に効くので、対象を題に出す
  const cs = pm.pmCaseOf(p, r) === '変更セット' && r.pendingRev != null ? `・Rev.${r.pendingRev} の変更セット ${p.rows.filter((x) => x.pendingRev === r.pendingRev && x.flags.pmPending && x.flags.pmReason === '変更セット').length} 行まとめて` : ''
  prompt(`決定: ${kind}（${rowId}${cs}。理由${must ? '・必須' : '・任意'}）${ext ? '。上長決裁の条件に該当: 承認者を入れてください' : ''}`, { requireText: must, showText: true, extra: ext ? { 承認者: '', 日付: todayStr(), 決裁書No: '' } : kind === '特急・分納' ? { 上限金額: '' } : undefined }, (_c, text, extra) => {
    if (ext && !(extra?.['承認者'] ?? '').trim()) return '上長決裁の条件に該当します。承認者を入れてください'
    if (ext) {
      const dd = parseDate(extra?.['日付'] ?? '', { label: '決裁日' })
      if (!dd.ok) return dd.error
    }
    let amount: number | undefined
    // 特急・分納は上限金額を入れる（§9.1「上限入力」）
    if (kind === '特急・分納' && !(extra?.['上限金額'] ?? '').trim()) return '特急・分納の上限金額を入れてください（例: 30000）'
    if (extra?.['上限金額']) {
      const n = parseNumber(extra['上限金額'], { min: 0, label: '上限金額' })
      if (!n.ok) return n.error
      amount = n.value ?? undefined
    }
    const err = pm.decide(rowId, kind, text, { external: ext ? { approver: (extra?.['承認者'] ?? '').trim(), date: extra?.['日付'] ?? '', ref: extra?.['決裁書No'] ?? '' } : undefined, amount })
    if (err) return err
    toast(`${rowId}${cs}: ${kind}`, 'ok')
  })
}

// ---------- 案件設定 ----------
function openSettings() {
  openPanel({ kind: 'settings', index: 0, draft: {}, editing: false, value: '' })
}
/** 設定 1 項目の検証。OK なら null、だめなら理由 */
export function validateSetting(key: string, v: string, p: Project, ws = st().ws): string | null {
  const num = (o: Parameters<typeof parseNumber>[1]) => {
    const r = parseNumber(v, o)
    return r.ok ? (r.value == null && key !== 'budget' ? `${o?.label}を入れてください` : null) : r.error
  }
  switch (key) {
    case 'name':
      return v.trim() ? (v.length > 100 ? '案件名が長すぎます（100 文字まで）' : null) : '案件名を入れてください'
    case 'dueDate':
    case 'quoteDeadline': {
      const label = key === 'dueDate' ? '案件納期' : '回答期限'
      const r = parseDate(v, { label })
      if (!r.ok) return r.error
      // 年の打ち間違いを止める（今の値のまま保存し直すときは通す）
      const cur = key === 'dueDate' ? p.dueDate : p.settings.quoteDeadline
      return r.value && r.value < todayStr() && r.value !== cur ? `${label} ${r.value} が過去の日付です` : null
    }
    case 'processDays':
      return num({ min: 0, max: 365, integer: true, label: '社内工程日数' })
    case 'budget':
      return num({ min: 0, max: 1e12, label: '予算' })
    case 'weights': {
      const parts = toHalf(v).split(/[,、\s]+/).filter(Boolean)
      if (parts.length !== 4) return '重みは「価格,納期,実績,条件」の 4 つを入れてください（例: 40,30,20,10）'
      const ns = parts.map((x) => Number(x))
      if (ns.some((n) => !Number.isFinite(n) || n < 0 || n > 100)) return '重みは 0〜100 の数字にしてください'
      if (ns.reduce((a, b) => a + b, 0) === 0) return '重みの合計が 0 です'
      return null
    }
    case 'selector':
      return /^(design|purchasing|設計|購買)$/.test(v.trim()) ? null : '選定者は「設計」か「購買」です'
    case 'changeNeedsPmApproval':
      return /^(はい|いいえ|y|n|yes|no|true|false|1|0)$/i.test(v.trim()) ? null : '「はい」か「いいえ」で入れてください'
    case 'externalApprovalAmount':
    case 'exceptionAmount':
    case 'formalDiffAmount':
      return num({ min: 0, max: 1e12, label: '金額' })
    case 'externalApprovalBudgetPct':
    case 'exceptionPct':
    case 'formalDiffPct':
    case 'qtyTolerancePct':
      return num({ min: 0, max: 100, label: '割合（%）' })
    case 'tieThreshold':
      return num({ min: 0, max: 100, label: '拮抗閾値' })
    case 'quoteDays':
    case 'formalDays':
      return num({ min: 0, max: 365, integer: true, label: '日数' })
    case 'quoteCompleteRule':
      return /^(all|min2|deadline|全社|2社以上|期限)$/.test(v.trim()) ? null : '見積完了条件は「全社」「2社以上」「期限」のどれかです'
    case 'currency':
      return /^[¥$€£A-Z]{1,3}$/.test(v.trim()) ? null : '通貨は ¥ や USD のように 3 文字以内で入れてください'
    case 'holidays': {
      for (const h of v.split(/[,、\s]+/).filter(Boolean)) {
        const r = parseDate(h, { label: '休日' })
        if (!r.ok) return r.error
      }
      return null
    }
    case 'members': {
      const ms = toHalf(v).split(/[,、]/).map((x) => x.trim())
      if (ms.length !== 3) return '担当者は「設計,購買,PM」の 3 人をカンマ区切りで入れてください'
      if (ms.some((x) => !x)) return '担当者の名前を 3 人とも入れてください（未定なら「未定」など）'
      // 役割ごとに別の人として記録する（同じ名前だと Undo・「自分の」指摘・決定の記録が混ざる）
      const dup = ms.find((x, i) => ms.indexOf(x) !== i)
      return dup ? `同じ名前「${dup}」が複数の役割にあります。役割ごとに別の担当者を入れてください` : null
    }
    case 'supplierIds': {
      const ids = v.split(/[,、\s]+/).filter(Boolean)
      const bad = ids.filter((id) => !ws.suppliers.some((s) => s.id === id || s.name === id))
      return bad.length ? `商社マスタにありません: ${bad.join(', ')}（${ws.suppliers.map((s) => `${s.id} ${s.name}`).join(' / ')}）` : null
    }
    default:
      void p
      return null
  }
}
function saveSettings(draft: Record<string, string>) {
  const s = st()
  const p = s.project()
  for (const [k, v] of Object.entries(draft)) {
    const err = validateSetting(k, v, p)
    if (err) return toast(err, 'err')
  }
  const patch: Record<string, unknown> = {}
  const extraCommits: Array<() => void> = []
  for (const [k, v0] of Object.entries(draft)) {
    const v = v0.trim()
    switch (k) {
      case 'dueDate':
      case 'quoteDeadline': {
        const r = parseDate(v)
        patch[k] = r.ok ? r.value : null
        break
      }
      case 'weights': {
        const [a, b, c, d] = toHalf(v).split(/[,、\s]+/).filter(Boolean).map(Number)
        patch.weights = { price: a, lead: b, record: c, terms: d }
        break
      }
      case 'members': {
        const [d, pu, m] = toHalf(v).split(/[,、]/).map((x) => x.trim())
        extraCommits.push(() => s.commit('担当者を変更', (p2) => void (p2.members = { design: d ?? '', purchasing: pu ?? '', pm: m ?? '' })))
        break
      }
      case 'supplierIds': {
        const ids = v.split(/[,、\s]+/).filter(Boolean).map((id) => s.ws.suppliers.find((x) => x.id === id || x.name === id)!.id)
        extraCommits.push(() => s.commit('相見積先を設定', (p2) => void (p2.supplierIds = [...new Set(ids)])))
        break
      }
      case 'changeNeedsPmApproval':
        patch[k] = /^(はい|y|yes|true|1)$/i.test(v)
        break
      case 'selector':
        patch[k] = /^(purchasing|購買)$/.test(v) ? 'purchasing' : 'design'
        break
      case 'quoteCompleteRule':
        patch[k] = /^(all|全社)$/.test(v) ? 'all' : /^(min2|2社以上)$/.test(v) ? 'min2' : 'deadline'
        break
      case 'holidays':
        patch.holidays = v.split(/[,、\s]+/).filter(Boolean).map((h) => (parseDate(h) as { value: string }).value)
        break
      case 'exceptionPct':
      case 'formalDiffPct':
      case 'qtyTolerancePct':
      case 'externalApprovalBudgetPct':
        patch[k] = ((parseNumber(v) as { value: number }).value ?? 0) / 100
        break
      case 'name':
      case 'currency':
        patch[k] = v
        break
      default: {
        const r = parseNumber(v)
        patch[k] = r.ok ? r.value : null
      }
    }
  }
  const role = s.user().role
  for (const f of settingsFieldsOf(p)) if (f.key in draft && ((f.owner === 'PM' && role !== 'pm') || (f.owner === '購買' && role === 'design'))) return toast(`権限なし（${f.label} は ${f.owner} 項目）`, 'err')
  extraCommits.forEach((f) => f())
  if (!Object.keys(patch).length) {
    closePanel()
    return toast(extraCommits.length ? '案件設定を保存しました' : '変更はありません', 'info')
  }
  const needImpact = 'dueDate' in patch || 'processDays' in patch || 'weights' in patch
  const finish = (reason: string, opts?: { fixedNeed?: 'shift' | 'keep'; proposeReselect?: boolean }) => {
    pm.applySettings(patch as Parameters<typeof pm.applySettings>[0], reason, opts)
    closePanel()
    toast('案件設定を保存しました', 'ok')
  }
  if (needImpact) {
    const im = pm.simulateSettings(p, { dueDate: patch.dueDate as string | null | undefined, processDays: patch.processDays as number | undefined, weights: patch.weights as Project['weights'] | undefined })
    const lines = [`納期NG になる行: ${im.leadNG.length}（${Object.entries(im.leadNG.reduce((m, x) => ({ ...m, [x.status]: (m[x.status] ?? 0) + 1 }), {} as Record<string, number>)).map(([k, n]) => `${k} ${n}`).join(' / ') || 'なし'}）`, `推奨が変わる行: ${im.recommendChanged.length}（${im.recommendChanged.slice(0, 8).join(', ')}）`, `行必要日が固定の行: ${im.fixedNeed.length}（${im.fixedNeed.join(', ')}）`, `正式依頼中で必要納期が変わる行（再発行対象）: ${im.reissue.length}`, `総額差（推奨で選び直した場合）: ${im.totalDelta >= 0 ? '+' : ''}¥${Math.round(im.totalDelta).toLocaleString()}`, `特急費の概算: 納期NG ${im.leadNG.length} 行が対象（金額は商社の特急見積で決まる。決定パネル e で上限を入れる）`]
    openPanel({
      kind: 'impact',
      title: '影響試算（確定前）',
      lines,
      onConfirm: () => {
        prompt('変更理由（必須）', { requireText: true, showText: true, options: im.fixedNeed.length ? ['固定必要日の行: 同じ日数だけ前倒し', '固定必要日の行: 据え置き'] : undefined }, (choice, reason) => {
          const fixedNeed = choice?.includes('据え置き') ? 'keep' : 'shift'
          if (im.recommendChanged.length) prompt(`推奨が変わる ${im.recommendChanged.length} 行を 7 に再選定提案として載せますか`, { options: ['載せる', '載せない'], showText: false }, (c2) => finish(reason, { fixedNeed, proposeReselect: c2 === '載せる' }))
          else finish(reason, { fixedNeed })
        })
      },
    })
    return
  }
  prompt('変更理由（必須）', { requireText: true }, (_c, reason) => finish(reason))
}

// ---------- 新しい BOM ----------
export const WIZ_KEYS = ['id', 'name', 'due', 'processDays', 'budget', 'buyer', 'suppliers', 'input', 'check'] as const
/** ガイドの各段階の入力チェック。OK なら null */
export function validateWizardStep(step: number, d: Record<string, string>): string | null {
  const s = st()
  switch (step) {
    case 0: {
      const id = (d.id ?? '').trim()
      if (id && !/^[A-Za-z0-9_\-.]{1,40}$/.test(toHalf(id))) return '案件ID は英数字と - _ . で 40 文字までにしてください（例: P-2026-042）'
      if (id && s.ws.projects.some((p) => p.id.toLowerCase() === toHalf(id).toLowerCase())) return `案件ID「${id}」はもうあります（Ctrl+P で開けます）。別の ID にしてください`
      return null
    }
    case 1:
      return (d.name ?? '').length > 100 ? '案件名が長すぎます（100 文字まで）' : null
    case 2: {
      const r = parseDate(d.due ?? '', { label: '納期' })
      return r.ok ? (r.value && r.value < todayStr() ? `納期 ${r.value} が過去の日付です` : null) : r.error
    }
    case 3: {
      const r = parseNumber(d.processDays ?? '', { min: 0, max: 365, integer: true, label: '社内工程日数' })
      return r.ok ? null : r.error
    }
    case 4: {
      const r = parseNumber(d.budget ?? '', { min: 0, max: 1e12, label: '予算' })
      return r.ok ? null : r.error
    }
    case 5: {
      // 購買・PM の担当者（役割ごとに別の人。作った本人とも別）
      const names = toHalf(d.buyer ?? '').split(/[,、]/).map((x) => x.trim()).filter(Boolean)
      if (names.length > 2) return '購買担当, PM 担当 の 2 人までをカンマ区切りで入れてください'
      if (names.length === 2 && names[0] === names[1]) return `購買と PM に同じ名前「${names[0]}」があります。役割ごとに別の担当者を入れてください`
      if (names.includes(s.ws.user.name)) return `「${s.ws.user.name}」はいまの${ROLE_LABEL[s.ws.user.role]}担当（あなた）です。別の担当者を入れるか空にしてください`
      return null
    }
    case 7:
      if (d.inputMode !== '2' && !(d.paste ?? '').trim()) return '部品を貼り付けてください（またはファイルを選ぶ / 3 で 1 つずつ入力）'
      return null
    default:
      return null
  }
}
function createProjectFromWizard(d: Record<string, string>, picks: string[]) {
  const s = st()
  for (let i = 0; i < 8; i++) {
    const err = validateWizardStep(i, d)
    if (err) return toast(err, 'err')
  }
  const id = toHalf((d.id ?? '').trim()) || nextProjectId()
  const due = parseDate(d.due ?? '')
  const pd = parseNumber(d.processDays ?? '')
  const bd = parseNumber(d.budget ?? '')
  const p = newProject(id, d.name?.trim() || '新しいBOM', {
    dueDate: due.ok ? due.value : null,
    preferredSupplierIds: picks,
    supplierIds: picks,
    // 作った人は自分の役割の担当者にする（購買・PM が作っても設計担当にはしない）
    members: (() => {
      const [buyer = '', pmName = ''] = toHalf(d.buyer ?? '').split(/[,、]/).map((x) => x.trim())
      const me = s.ws.user
      return { design: me.role === 'design' ? me.name : '', purchasing: me.role === 'purchasing' ? me.name : buyer, pm: me.role === 'pm' ? me.name : pmName }
    })(),
    settings: { ...DEFAULT_SETTINGS, processDays: pd.ok && pd.value != null ? pd.value : 10, budget: bd.ok ? bd.value : null },
  })
  let warnings: string[] = []
  if (d.inputMode !== '2' && d.paste?.trim()) {
    const res = parseBomPaste(d.paste)
    warnings = res.warnings
    res.rows.forEach((r, i) => p.rows.push(newRow(mkRowId(i + 1), r)))
  }
  if (!p.rows.length) p.rows.push(newRow('R001'))
  s.commitWs('', (ws) => {
    ws.projects.push(p)
    ws.currentProjectId = p.id
  })
  set({ wizardDraft: null, view: 4, cursorRow: null, filter: '', cellFilter: null })
  closePanel()
  ensureCursor()
  const problems = p.rows.filter((r) => checkRow(r, st().ws.rules, p).length).length
  const note = warnings.length ? `。注意: ${warnings[0]}` : ''
  if (s.ws.user.role !== 'design') {
    setView(1)
    return toast(`${p.name}（${p.rows.length} 行）を作成しました。行の追加・編集は設計が行います（Ctrl+K → 役割 で設計に切り替え）${note}`, 'info')
  }
  if (!problems) {
    setView(1)
    return toast(`${p.name}（${p.rows.length} 行）を作成しました。Ctrl+Enter で提出します${note}`, warnings.length ? 'info' : 'ok')
  }
  // 最初の問題のセルにカーソルを置く（n は「次の」問題へ進むので、ここから直す）
  const first = problemCells()[0]
  if (first) jumpToRow(first.rowId, first.field)
  toast(`${p.name}（${p.rows.length} 行）を作成しました。問題のある行 ${problems} 行: カーソルのセルから直し、F8 で次の問題へ。終わったら Ctrl+Enter で提出します${note}`, warnings.length ? 'info' : 'ok')
}
function restoreBackup(b: Backup) {
  let res: ReturnType<typeof sanitizeWorkspace>
  try {
    res = sanitizeWorkspace(JSON.parse(b.raw))
  } catch (err) {
    return toast(`退避したデータは JSON として読めません（${(err as Error).message}）。「退避したデータを書き出す」で取り出して直してください`, 'err')
  }
  if (!res.ws) return toast(`退避したデータを読めません: ${res.error}。「退避したデータを書き出す」で取り出せます`, 'err')
  const ws = res.ws
  const cur = st().ws
  confirmDanger(`退避したデータ（${fmtDateTime(b.at)}・${b.reason}・案件 ${ws.projects.length} 件）に戻します。いまの内容は退避に入れます`, '戻す', () => {
    const backedUp = saveBackup(JSON.stringify(cur), '退避からの復元の前')
    if (!replaceWorkspace(ws)) return toast('保存領域が足りないため戻せませんでした（いまの内容のまま）', 'err')
    toast(`退避したデータに戻しました（案件 ${ws.projects.length} 件）${backedUp ? '' : '。いまの内容は容量不足で退避できませんでした'}`, backedUp ? 'ok' : 'info')
  })
}
function exportBackup(b: Backup) {
  const blob = new Blob([b.raw], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `bom-workspace-backup-${b.at.slice(0, 19).replace(/[:T]/g, '-')}.json`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 5000)
  toast(`退避したデータを書き出しました（${a.download}・${b.reason}）`, 'ok')
}

/** ワークスペースを丸ごと置き換える（JSON 読み込み・退避からの復元）。Undo 履歴は別の内容のものなので消す */
function replaceWorkspace(ws: Workspace): boolean {
  const prev = st().ws
  const ok = st().commitWs('', (w) => {
    w.projects = ws.projects
    w.suppliers = ws.suppliers
    w.rules = ws.rules
    w.currentProjectId = ws.currentProjectId
  })
  if (!ok) {
    // 保存できない置き換えは画面にも反映しない（「読み込みました」と言ってリロードで消えるのを防ぐ）
    set({ ws: prev })
    return false
  }
  st().clearHistory()
  set({ cursorRow: null, filter: '', cellFilter: null, openRows: [], sort: null })
  return true
}
function nextProjectId(): string {
  const y = new Date().getFullYear()
  for (let n = st().ws.projects.length + 1; ; n++) {
    const id = `P-${y}-${String(n).padStart(3, '0')}`
    if (!st().ws.projects.some((p) => p.id.toLowerCase() === id.toLowerCase())) return id
  }
}

// ---------- 役割 ----------
export function switchRole(role: Role, name?: string) {
  if (!commitEdit('stay')) return
  const p = st().project()
  st().commitWs('', (ws) => {
    // 役割を変えたら、その役割の担当者として操作する（前の役割の氏名を引き継がない）
    ws.user = { role, name: (name ?? '').trim() || p.members[role] || `${ROLE_LABEL[role]}担当` }
  })
  setView(ROLE_DEFAULT_VIEW[role])
  toast(`役割: ${ROLE_LABEL[role]}（${st().ws.user.name}）。既定のビュー ${ROLE_DEFAULT_VIEW[role]} ${VIEWS.find((v) => v.id === ROLE_DEFAULT_VIEW[role])?.label} を開きました`, 'info')
}

// ---------- コマンド ----------
export function runCommand(id: string, e?: KeyboardEvent): void {
  // クリックから呼ばれたときも、編集中の値は先に確定する
  if (st().mode === 'edit' && id !== 'escape' && !commitEdit('stay')) return
  const s = st()
  const p = s.project()
  const role = s.user().role
  const r = cursorRow()
  const need = (): Row | undefined => {
    if (!r) toast(s.cursorRow?.startsWith('g:') ? '分類の見出しです（↓ で行へ）' : s.cursorRow?.startsWith('case:') ? '案件の要決定です（y で既定のまま確定 / Enter で案件設定を開く）' : '行を選んでください（↓ で先頭の行へ）', 'info')
    return r
  }
  // 7 要決定の先頭にある「案件設定確定」の行
  if (s.cursorRow?.startsWith('case:')) {
    if (id === 'pm.approve') return pm.confirmSettings()
    if (id === 'cell.edit' || id === 'row.toggleOpen') return openSettings()
  }
  switch (id) {
    case 'palette.open':
      return openPanel({ kind: 'palette', query: '', index: 0 })
    case 'project.switch':
      return openPanel({ kind: 'inbox', index: 0, query: '' })
    case 'project.save':
      s.commitWs('', () => {})
      return toast('保存しました（編集は自動で保存されています）', 'ok')
    case 'undo':
      return s.undoLast()
    case 'redo':
      return s.redoLast()
    case 'export.excel': {
      const done = (label: string, sid?: string) => (m: typeof import('@/io/excel')) =>
        m
          .exportBomExcel(s.ws, p, label === 'internal' ? 'internal' : label === 'supplier' ? 'supplier' : 'archive', sid)
          .then(() => toast(`Excel を出力しました（${label === 'internal' ? '社内、BOM・変更点・チェック結果の 3 シート' : label === 'supplier' ? `商社向け${sid ? `・${s.ws.suppliers.find((x) => x.id === sid)?.name}` : ''}、BOM シートのみ・価格なし` : '保管用、全列'}）`, 'ok'))
          .catch((err: Error) => toast(`Excel を出力できませんでした: ${err.message}`, 'err'))
      const sups = p.supplierIds.map((id) => s.ws.suppliers.find((x) => x.id === id)).filter((x): x is NonNullable<typeof x> => !!x)
      return openPanel({
        kind: 'export',
        index: 0,
        options: [
          // 番号は仕様の 1 社内 / 2 商社向け / 3 保管用。商社ごとの商社向けは 4 以降
          { label: '社内（採用・金額・状態つき）', run: () => void import('@/io/excel').then(done('internal')) },
          { label: '商社向け: 全商社共通（提出済の全行・価格列なし）', run: () => void import('@/io/excel').then(done('supplier')) },
          { label: '保管用（全列・商社別見積つき）', run: () => void import('@/io/excel').then(done('archive')) },
          ...sups.map((x) => ({ label: `商社向け: ${x.name}（その商社に頼む行だけ・価格列なし）`, run: () => void import('@/io/excel').then(done('supplier', x.id)) })),
        ],
      })
    }
    case 'copy.formatted': {
      const v = vm()
      if (!v.rows.length) return toast('コピーする行がありません', 'info')
      const headers = v.columns.map((c) => colDef(c)?.label ?? c)
      const data = v.rows.map((row) => v.columns.map((c) => cellText(row, c, v.ctx).text))
      void import('@/io/excel')
        .then((m) => m.copyFormatted(headers, data))
        .then(() => toast(`${data.length} 行 × ${headers.length} 列を書式つきでコピーしました（Excel・メールに貼れます）`))
        .catch(() => toast('クリップボードに書けませんでした（ブラウザの許可を確認）', 'err'))
      return
    }
    case 'goto':
      return prompt('ジャンプ（ID・番号・型式・部品名・回路記号）', { placeholder: 'R034 / 34 / FX5U / リレー / KA1', showText: true }, (_c, t) => {
        const q = toHalf(t).trim().toLowerCase()
        if (!q) return
        const all = p.rows
        const num = /^r?(\d+)$/.exec(q)?.[1]
        const refs = (x: Row) => toHalf(effective(x).ref ?? '').toLowerCase().split(/[,、\s]+/).filter(Boolean)
        const hit =
          all.find((x) => x.id.toLowerCase() === q) ??
          (num ? all.find((x) => x.id === 'R' + num.padStart(3, '0')) : undefined) ??
          all.find((x) => refs(x).includes(q)) ??
          all.find((x) => refs(x).some((f) => f.startsWith(q))) ??
          all.find((x) => toHalf(effective(x).model).toLowerCase().includes(q)) ??
          all.find((x) => toHalf(effective(x).name).toLowerCase().includes(q))
        if (hit) jumpToRow(hit.id)
        else toast(`「${t}」に当たる行はありません`, 'err')
      })
    case 'filter.focus': {
      const el = document.querySelector<HTMLInputElement>('input.filter')
      el?.focus()
      el?.select()
      return
    }
    case 'help':
      return openPanel({ kind: 'help' })
    case 'escape':
      if (s.panel) return closePanel()
      if (s.mode === 'edit') return cancelEdit()
      if (s.detailIndex > 0) return set({ detailIndex: 0 })
      if (r && s.openRows.includes(r.id)) return set({ openRows: s.openRows.filter((x) => x !== r.id) })
      if (s.cellFilter || s.filter) {
        set({ cellFilter: null, filter: '' })
        return toast('絞り込みを解除しました', 'info')
      }
      // カーソルは残す（Esc を重ねても行を見失わない）
      return
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
      if (!s.cursorRow) return moveCursorRow(1)
      return set({ cursorCol: vm().columns[0] })
    case 'move.end':
      if (!s.cursorRow) return moveCursorRow(1)
      return set({ cursorCol: vm().columns.at(-1)! })
    case 'move.top':
      return setCursorRowAbs('top')
    case 'move.bottom':
      return setCursorRowAbs('bottom')
    case 'move.pageUp':
      return moveCursorRow(-pageRows())
    case 'move.pageDown':
      return moveCursorRow(pageRows())
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
      if (!gs.length) return toast('分類の見出しがありません（並び替え・要確認・要決定のビューでは分類でまとめません）', 'info')
      const cur = items.findIndex((it) => it.key === s.cursorRow)
      const next = id === 'category.next' ? (gs.find((i) => i > cur) ?? gs[0]) : ([...gs].reverse().find((i) => i < cur) ?? gs[gs.length - 1])
      return set({ cursorRow: items[next].key })
    }
    case 'cell.edit':
      if (s.cursorRow?.startsWith('g:')) return runCommand('row.toggleOpen')
      if (!need()) return
      if (r && s.detailIndex > 0) {
        const it = detailItems(r)[s.detailIndex - 1]
        if (it?.kind === 'issue') return issueActionPanel(it.id)
        if (it?.kind === 'quote') return quoteActionPanel(r, it.supplierId)
      }
      if (role === 'pm' && r && pm.pmCaseOf(p, r) !== 'なし') return decisionPanel(r)
      // PM が 7 で決めることの無い行に Enter: 次の手を案内する（「権限なし」で止めない）
      if (role === 'pm' && r && s.view === 7 && rows.canEdit(s.cursorCol)) {
        const ans = p.issues.find((i) => i.rowId === r.id && (i.status === 'answered' || i.status === 'fixed') && i.by.role === 'pm')
        return toast(`${r.id} に要決定はありません${ans ? `（${ans.id} は${ans.status === 'answered' ? '回答済' : '対応済'}。Alt+x で受け入れ、Space で中身を見る）` : '（Space で詳細、F8 で次の要決定へ）'}`, 'info')
      }
      return startEdit()
    case 'cell.clear': {
      if (!need()) return
      const d = colDef(s.cursorCol)
      const before = cellText(r!, s.cursorCol, vm().ctx).text
      if (before === '') return toast('このセルはもう空です', 'info')
      if (rows.setCell(r!.id, s.cursorCol, '', 'セルを空にする')) toast(`${r!.id} ${d?.label} を空にしました（Ctrl+Z で戻す）`, 'info')
      return
    }
    case 'row.insertBelow': {
      if (role !== 'design') return toast('権限なし（行の追加は設計）', 'err')
      if (s.filter || s.cellFilter) set({ filter: '', cellFilter: null })
      if (![1, 2, 4].includes(s.view)) setView(1)
      const nid = rows.insertBelow(r?.id ?? null)
      if (nid) {
        jumpToRow(nid, 'name')
        startEdit('')
      }
      return
    }
    case 'row.duplicate': {
      if (!need()) return
      if (!isActive(r!)) return toast(`${r!.id} は${r!.status === 'cancelled' ? '取消' : '置換'}済の行です。${r!.replacedBy ? `置換先 ${r!.replacedBy} を複製してください` : '複製できません'}`, 'info')
      const nid = rows.duplicateRow(r!.id)
      if (nid) {
        jumpToRow(nid)
        toast(`${r!.id} を複製して ${nid} を作りました（回路記号は空。Ctrl+Z で戻す）`, 'info')
      }
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
      void navigator.clipboard?.writeText(t).catch(() => {})
      set({ clipboard: t })
      return toast(`コピー: ${t || '（空）'}`, 'info')
    }
    case 'cell.paste': {
      if (!need()) return
      e?.preventDefault()
      const v = vm()
      const apply = (t: string) => {
        if (/\t|\n/.test(t.replace(/\n$/, ''))) rows.pasteCells(r!.id, s.cursorCol, v.columns, v.rows.map((x) => x.id), t)
        else if (rows.setCell(r!.id, s.cursorCol, t.replace(/\n$/, ''), '貼り付け')) toast(`貼り付け: ${t.trim() || '（空）'}`, 'info')
      }
      if (!navigator.clipboard?.readText) {
        if (s.clipboard != null) apply(s.clipboard)
        return
      }
      void navigator.clipboard
        .readText()
        .then((text) => apply(text ?? s.clipboard ?? ''))
        .catch(() => {
          if (s.clipboard != null) apply(s.clipboard)
          else toast('クリップボードを読めませんでした（ブラウザの許可を確認）', 'err')
        })
      return
    }
    case 'adopt.best':
      if (!need()) return
      adopt.adoptBest(r!.id)
      return
    case 'adopt.cheapest': {
      if (!need()) return
      if (r!.status === 'quoting') {
        const err = adopt.canAdopt(p, r!, true)
        if (err) return toast(err, 'err')
        const c = scoreRow(p, r!, s.ws.suppliers).sort((a, b) => a.effectivePrice - b.effectivePrice)[0]
        if (!c) return toast('有効な見積がありません', 'err')
        const name = s.ws.suppliers.find((x) => x.id === c.supplierId)?.name
        return prompt(`先行採用（見積中）: 最安の ${name} を仮採用し PM の承認待ちにします。理由（数字か ↑↓）`, { options: [...adopt.ADOPT_REASONS], index: -1, placeholder: '補足（任意）', showText: true, digitsSelect: true }, (ch, t) => void adopt.adoptChoose(r!.id, c.supplierId, `最安（スコア無視）・${ch ?? 'その他'}${t ? ': ' + t : ''}`))
      }
      adopt.adoptCheapest(r!.id)
      return
    }
    case 'adopt.choose': {
      if (!need()) return
      const err = adopt.canAdopt(p, r!, true)
      if (err) return toast(err, 'err')
      if (!scoreRow(p, r!, s.ws.suppliers).length) return toast('有効な見積がありません（未回答・辞退・期限切れのみ）', 'err')
      return openPanel({ kind: 'adopt', rowId: r!.id, index: 0 })
    }
    case 'row.replace': {
      if (!need()) return
      if (role !== 'design') return toast('権限なし（置換は設計）', 'err')
      // 先に置き換え品の型式を聞く（r で始まる単語を打ったときに、黙って行が作られないように）
      const e0 = effective(r!)
      return prompt(`${r!.id} の置き換え品を作る（新しい型式。メーカは「型式 / メーカ」で変えられます）`, { showText: true, requireText: true, placeholder: `例: ${e0.model || 'MY4N-GS DC24'}` }, (_c, t) => {
        const [model, maker] = t.split(/\s+\/\s+/)
        const nid = rows.replaceRow(r!.id, { model: model.trim(), maker: (maker ?? e0.maker).trim() })
        if (!nid) return
        jumpToRow(nid, 'model')
        toast(`${r!.id} の置き換え品 ${nid} を作りました（公開すると ${r!.id} は置換済になります。Ctrl+Z で戻す）`, 'info')
      })
    }
    case 'row.toggleOrdered':
      if (!need()) return
      if (rows.setCell(r!.id, 'ordered', r!.ordered ? '' : '1', r!.ordered ? '発注済を外す' : '発注済')) toast(`${r!.id}: ${r!.ordered ? '発注済を外しました' : '発注済にしました'}`, 'info')
      return
    case 'row.toggleReceived':
      if (!need()) return
      if (rows.setCell(r!.id, 'received', r!.received ? '' : '1', r!.received ? '入荷済を外す' : '入荷済')) toast(`${r!.id}: ${r!.received ? '入荷済を外しました' : '入荷済にしました'}`, 'info')
      return
    case 'row.toggleHidden':
      if (!need()) return
      return rows.toggleHidden(r!.id)
    case 'sort.asc':
    case 'sort.desc': {
      if (!s.cursorRow) return toast('並び替える列にカーソルを置いてください（↓ で表へ）', 'info')
      const dir = id === 'sort.asc' ? 'asc' : 'desc'
      if (s.sort?.col === s.cursorCol && s.sort.dir === dir) {
        set({ sort: null })
        return toast('並び替えを解除しました', 'info')
      }
      set({ sort: { col: s.cursorCol, dir } })
      return toast(`${colDef(s.cursorCol)?.label} で${dir === 'asc' ? '昇順' : '降順'}に並べました（もう一度で解除）`, 'info')
    }
    case 'filter.byCell': {
      if (!need()) return
      if (s.cellFilter?.col === s.cursorCol) {
        set({ cellFilter: null })
        return toast('絞り込みを解除しました', 'info')
      }
      const value = cellText(r!, s.cursorCol, vm().ctx).text
      set({ cellFilter: { col: s.cursorCol, value } })
      return toast(`${colDef(s.cursorCol)?.label} =「${value || '（空）'}」で絞り込みました（f か Esc で解除）`, 'info')
    }
    case 'columns.panel':
      return openPanel({ kind: 'columns', index: 0 })
    case 'issue.next':
      gotoProblem(1)
      return
    case 'issue.prev':
      gotoProblem(-1)
      return
    case 'issue.quickfix':
      return openQuickfix()
    case 'issue.ack':
      return ackCurrent()
    case 'issue.sequence': {
      if (!gotoProblem(1)) return
      set({ sequence: true })
      if (cursorRow()) openQuickfix()
      return
    }
    case 'issue.defer': {
      if (!need()) return
      const prs = checkRow(r!, s.ws.rules, p)
      const pr = prs.find((x) => x.field === s.cursorCol) ?? prs[0]
      if (!pr) return toast('この行に「あとで」にする問題はありません', 'info')
      rows.deferRule(r!.id, pr.ruleId)
      toast(`あとで: ${pr.message}（「あとで」が残っている行は公開できません）`, 'info')
      gotoProblem(1)
      return
    }
    case 'publish':
      return publishFlow()
    case 'issue.raise': {
      if (!need()) return
      if (!isActive(r!)) return toast(`${r!.id} は取消・置換済の行です（指摘は付けられません）`, 'err')
      return openPanel({ kind: 'issue', rowId: r!.id, field: s.cursorCol, step: 'kind', index: 0, text: '', proposal: { model: '', maker: '', supplierId: '', unitPrice: '', leadDays: '' } })
    }
    case 'issue.reply': {
      if (!need()) return
      const list = detailItems(r!).filter((x) => x.kind === 'issue') as Array<{ kind: 'issue'; id: string }>
      const sel = s.detailIndex > 0 ? detailItems(r!)[s.detailIndex - 1] : undefined
      const target = sel?.kind === 'issue' ? sel : list.at(-1)
      if (!target) return toast('この行に指摘はありません', 'info')
      return openPanel({ kind: 'replyIssue', issueId: target.id, text: '' })
    }
    case 'issue.bounce': {
      if (!need()) return
      if (role === 'design') return toast('差戻しは指摘を起票した人（購買）の操作です。設計は Space → 指摘を選んで Enter で回答・返信できます', 'info')
      const all = p.issues.filter((i) => i.rowId === r!.id)
      const sel = s.detailIndex > 0 ? detailItems(r!)[s.detailIndex - 1] : undefined
      const target = (sel?.kind === 'issue' ? all.find((i) => i.id === sel.id) : undefined) ?? all.filter((i) => i.status === 'fixed' || i.status === 'answered' || i.status === 'inProgress').at(-1)
      if (!target || !(target.status === 'fixed' || target.status === 'answered' || target.status === 'inProgress')) return toast('差戻しできる指摘がありません（対応済・回答済・対応中のもの）', 'info')
      return prompt(`差戻し ${target.id}（理由必須。2 回目で PM の要決定に上がります）`, { requireText: true }, (_c, t) => issues.bounceIssue(target.id, t))
    }
    case 'pm.approve': {
      if (!need()) return
      if (role !== 'pm') return toast('権限なし（承認は PM）', 'err')
      const c = pm.pmCaseOf(p, r!)
      if (c === 'なし') return toast(`${r!.id} は要決定ではありません（7 要決定ビューの行で使えます）`, 'info')
      const o = pm.pmOptions(c, r!).find((x) => x.key === 'y')
      if (!o) return toast(`${c} の行では y は使えません（Enter で決定パネル）`, 'info')
      return decideWithReason(r!.id, o.kind)
    }
    case 'pm.reject': {
      if (!need()) return
      if (role !== 'pm') return toast('権限なし（却下は PM）', 'err')
      const c = pm.pmCaseOf(p, r!)
      if (c === 'なし') return toast(`${r!.id} は要決定ではありません`, 'info')
      const o = pm.pmOptions(c, r!).find((x) => x.key === 'Y')
      if (!o) return toast(`${c} の行では Shift+Y は使えません（Enter で決定パネル）`, 'info')
      return decideWithReason(r!.id, o.kind)
    }
    case 'weights.row':
      if (!need()) return
      if (!isActive(r!)) return toast(`${r!.id} は${r!.status === 'cancelled' ? '取消' : '置換'}済の行です（重みは変えられません）`, 'info')
      return openPanel({ kind: 'weights', rowId: r!.id, index: 0 })
    case 'rev.prev':
    case 'rev.next': {
      const revs = p.submissions.map((x) => x.rev)
      if (!revs.length) return toast('まだ提出がありません', 'info')
      if (s.view !== 5) setView(5)
      const cur = s.revView
      const idx = cur == null ? revs.length : revs.indexOf(cur)
      const next = id === 'rev.prev' ? Math.max(0, idx - 1) : Math.min(revs.length, idx + 1)
      set({ revView: next >= revs.length ? null : revs[next] })
      return toast(next >= revs.length ? '未確認の差分すべて' : `Rev.${revs[next]} の差分`, 'info')
    }
    case 'quotes.request': {
      if (role !== 'purchasing') return toast('権限なし（概算見積の依頼は購買）', 'err')
      const tradable = s.ws.suppliers.filter((x) => x.tradable)
      const ids = p.supplierIds.length ? p.supplierIds : p.preferredSupplierIds.length ? p.preferredSupplierIds : tradable.slice(0, 3).map((x) => x.id)
      const def = addDays(todayStr(), p.settings.quoteDays)
      const allLabel = `相見積先すべて（${ids.map((id) => s.ws.suppliers.find((x) => x.id === id)?.name ?? id).join('・')}）`
      return prompt('概算見積を依頼（↑↓ で依頼先、回答期限を入れて Enter）', { options: [allLabel, ...tradable.map((x) => `${x.id} ${x.name}`)], placeholder: `回答期限（空なら ${def}）`, showText: true }, (choice, text) => {
        // 読めない・過去の期限は、選んだ依頼先と入力を残したままダイアログで直す
        const dl = parseDate(text || def, { label: '回答期限' })
        if (!dl.ok) return dl.error.replace(/、未定/, '')
        if (!dl.value) return `回答期限を日付で入れてください（空なら ${def}）`
        if (dl.value < todayStr()) return `回答期限 ${dl.value} が過去の日付です`
        const sids = !choice || choice === allLabel ? ids : [choice.split(' ')[0]]
        void quotes.requestRoughQuotes(sids, dl.value, !choice || choice === allLabel).then((m) => toast(m, m.startsWith('権限') || m.startsWith('依頼する行') ? 'err' : 'ok'))
      })
    }
    case 'quotes.import': {
      if (role !== 'purchasing') return toast('権限なし（取り込みは購買）', 'err')
      // 相見積先と、見積を頼んだ指定先の商社（相見積先に無い商社も）
      const asked = [...new Set(p.quotes.filter((q) => !q.stale).map((q) => q.supplierId))].filter((id) => !p.supplierIds.includes(id))
      const ids = p.supplierIds.length || asked.length ? [...p.supplierIds, ...asked] : s.ws.suppliers.filter((x) => x.tradable).map((x) => x.id)
      if (!ids.length) return toast('商社マスタに商社がありません（Ctrl+K → 商社を追加）', 'err')
      return prompt('どの商社の回答ですか', { options: ids.map((sid) => `${sid} ${s.ws.suppliers.find((x) => x.id === sid)?.name ?? ''}`), showText: false }, (choice) => {
        const sid = (choice ?? `${ids[0]} `).split(' ')[0]
        openPanel({
          kind: 'import',
          title: `見積回答を取り込む（${s.ws.suppliers.find((x) => x.id === sid)?.name}）`,
          text: '',
          onSubmit: (text) => {
            if (!text.trim()) return toast('貼り付けが空です', 'err')
            const res = quotes.importQuoteAnswers(text, sid)
            // 読めない値で飛ばした行も必ず知らせる（黙って捨てない）
            const errs = res.errors.length ? ` / 読めない値 ${res.errors.length} 件（${res.errors.slice(0, 2).join('、')}${res.errors.length > 2 ? ' …' : ''}。その行は取り込んでいません）` : ''
            toast(`取り込み ${res.updated} 行 / 突合不能 ${res.unmatched.length}${res.unmatched.length ? `（${res.unmatched.slice(0, 3).join(', ')}）` : ''} / 型式不一致 ${res.modelMismatch.length} / 代替提案の下書き ${res.proposals}${errs}`, res.errors.length ? 'err' : res.unmatched.length || res.modelMismatch.length ? 'info' : 'ok')
          },
        })
      })
    }
    case 'quotes.formal': {
      if (role !== 'purchasing') return toast('権限なし（正式見積の依頼は購買）', 'err')
      const cand = p.rows.filter((x) => isActive(x) && x.adoptedSupplierId && (x.status === 'selected' || (x.flags.reissue && ['formalRequested', 'formalQuoted'].includes(x.status))))
      const working = cand.filter((x) => hasWork(x) || x.pendingRemoval).length
      const pending = cand.filter((x) => x.flags.pmPending || x.flags.ltbPending).length
      const n = cand.length - cand.filter((x) => (x.working && Object.keys(x.working).length) || x.flags.pmPending || x.flags.ltbPending).length
      const contested = cand.filter((x) => x.flags.contested && !(x.working && Object.keys(x.working).length) && !x.flags.pmPending).length
      if (!n) return toast(`依頼できる行がありません（選定済・再発行対象の行なし${working || pending ? `。作業中 ${working} 行・承認待ち ${pending} 行は除外` : ''}）`, 'err')
      return confirmDanger(`正式見積依頼書（社外）を出します: 対象 ${n} 行${contested ? `（拮抗 ${contested} 行を含む）` : ''}${working || pending ? `。作業中 ${working} 行・承認待ち ${pending} 行は除外` : ''}。商社に送る書類が作られ、状態が「正式依頼中」になります`, '依頼書を作る', () => void quotes.requestFormalQuotes().then((m) => toast(m, m.startsWith('権限') || m.startsWith('依頼する行') ? 'err' : 'ok')))
    }
    case 'export.selection':
      return void import('@/io/excel').then((m) => m.exportSelectionRecord(s.ws, p, (row) => scoreRow(p, row, s.ws.suppliers))).then(() => toast('選定記録（社内）を出力しました', 'ok'))
    case 'adopt.bulkBest':
    case 'adopt.bulkCheapest': {
      if (p.settings.selector !== role) return toast(`権限なし（選定者は${ROLE_LABEL[p.settings.selector]}）`, 'err')
      // 多くの行を一度に変えるので、件数を見せて既定「やめる」で確認する
      const n = p.rows.filter((x) => isActive(x) && x.status === 'quoted' && !x.adoptedSupplierId).length
      if (!n) return toast('一括で採用できる行がありません（見積済で未採用の行なし）', 'info')
      const cheapest = id === 'adopt.bulkCheapest'
      return confirmDanger(`見積済で未採用の ${n} 行を${cheapest ? '最安（スコア無視）' : '推奨（最高スコア）'}でまとめて採用します。1 行だけなら表で a`, `${n} 行を採用する`, () => adopt.bulkAdopt(cheapest ? 'cheapest' : 'best'))
    }
    case 'consolidate': {
      if (p.settings.selector !== role) return toast(`権限なし（選定者は${ROLE_LABEL[p.settings.selector]}）`, 'err')
      const options = adopt.consolidateOptions().map((o) => ({ label: o.label, detail: o.detail, run: () => adopt.applyConsolidation(o.supplierIds) }))
      if (!options.length) return toast('集約できる行がありません（見積済・選定済の行なし）', 'info')
      return openPanel({ kind: 'consolidate', index: 0, options })
    }
    case 'settings':
      return openSettings()
    case 'settings.confirm':
      return pm.confirmSettings()
    case 'ltb.request':
      if (!need()) return
      if (role !== 'purchasing') return toast('権限なし（先行発注の申請は購買）', 'err')
      {
        // PM が判断できるのは有効な見積がある行だけ（§4）。金額の目安は推奨の見積から
        const best = scoreRow(p, r!, s.ws.suppliers)[0]
        if (!best) return toast(`${r!.id} には有効な見積がありません。見積が揃ってから申請します`, 'info')
        const est = Math.round((best.quote.unitPrice ?? 0) * best.roundedQty)
        return prompt(`先行発注を申請 ${r!.id}（理由と金額）`, { requireText: true, placeholder: '理由（例: 長納期のため正式見積を待てない）', extra: { 金額: String(est) } }, (_c, t, ex) => {
          const amt = parseNumber(ex?.['金額'] ?? '', { min: 0, label: '金額' })
          if (!amt.ok || amt.value == null) return amt.ok ? '金額を入れてください' : amt.error
          pm.requestEarlyOrder(r!.id, t, amt.value)
        })
      }
    case 'project.new': {
      const d = s.wizardDraft
      if (d) toast('途中まで入れた内容を戻しました（Esc で中止しても内容は残ります）', 'info')
      return openPanel({ kind: 'wizard', step: d?.step ?? 0, data: d?.data ?? {}, sel: d?.sel ?? 0, picks: d?.picks ?? [] })
    }
    case 'wizard.back':
      return toast('Alt+← は新規BOMガイドの中で 1 つ前の段階に戻るキーです', 'info')
    case 'history':
      return openPanel({ kind: 'history', rowId: r?.id ?? '', index: 0 })
    case 'rule.add': {
      if (!need()) return
      const iss = p.issues.filter((i) => i.rowId === r!.id && i.status !== 'draft')
      const options: PanelOption[] = iss.map((i) => ({
        label: `${i.id} ${i.kind}: ${i.text.slice(0, 30)} → ルール化（全案件）`,
        run: () => {
          const rule = issues.ruleFromIssue(i.id)
          if (rule) toast(`ルールを追加: ${rule.name}`)
        },
      }))
      const col = colDef(s.cursorCol)
      if (col && !col.perSupplier && col.kind === 'text')
        options.push({ label: `${col.label} の前後空白チェック（警告）`, run: () => s.commitWs(`ルールを追加: ${col.label} の前後空白なし`, (ws) => void ws.rules.push({ id: `rule.ws.${Date.now()}`, name: `${col.label} の前後空白なし`, field: s.cursorCol as keyof Row, type: 'noWhitespace', severity: 'warn', message: `${col.label} の前後に空白があります`, owner: s.ws.user.name, scope: 'all', enabled: true })) })
      if (!options.length) return toast('この行・列から作れるルールはありません（指摘のある行で使えます）', 'info')
      return openPanel({ kind: 'rule', rowId: r!.id, field: s.cursorCol, index: 0, options })
    }
    case 'theme.toggle': {
      const cur = document.documentElement.dataset.theme
      const next = cur === 'dark' ? 'light' : 'dark'
      document.documentElement.dataset.theme = next
      try {
        localStorage.setItem('bom-pro.theme', next)
      } catch {
        /* noop */
      }
      return toast(`テーマ: ${next === 'dark' ? 'ダーク' : 'ライト'}`, 'info')
    }
    case 'density.toggle': {
      const cur = document.documentElement.dataset.density
      document.documentElement.dataset.density = cur === 'compact' ? '' : 'compact'
      try {
        localStorage.setItem('bom-pro.density', cur === 'compact' ? '' : 'compact')
      } catch {
        /* noop */
      }
      return toast(cur === 'compact' ? '標準の行の高さ' : 'コンパクト表示', 'info')
    }
    case 'data.reset':
      return confirmDanger('サンプルデータに戻しますか？ いまの全案件の内容は消えます（先に Ctrl+K → JSON を書き出す で退避できます）', 'サンプルに戻す', () => {
        resetWorkspace()
        s.commitWs('', (ws) => {
          const sp = makeSampleProject()
          ws.projects = [sp]
          ws.currentProjectId = sp.id
        })
        s.clearHistory()
        set({ cursorRow: null, filter: '', cellFilter: null, openRows: [], sort: null })
        setView(ROLE_DEFAULT_VIEW[role])
        toast('サンプルデータに戻しました（元に戻す履歴も消えました）', 'ok')
      })
    case 'data.exportJson': {
      const blob = new Blob([JSON.stringify(s.ws, null, 2)], { type: 'application/json' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `bom-workspace-${todayStr()}.json`
      a.click()
      setTimeout(() => URL.revokeObjectURL(a.href), 5000)
      return toast(`JSON を書き出しました（${a.download}）`, 'ok')
    }
    case 'data.importJson':
      return openPanel({
        kind: 'import',
        title: 'JSON を読み込む（「ファイルを選ぶ」か、JSON を書き出す で作ったファイルの中身を貼り付け）。いまの内容は置き換わります',
        text: '',
        accept: '.json,application/json',
        placeholder: 'JSON の中身を貼り付け（Ctrl+V）、または上の「ファイルを選ぶ」。Ctrl+Enter で読み込み',
        onSubmit: (text) => {
          let raw: unknown
          try {
            raw = JSON.parse(text)
          } catch (err) {
            return toast(`JSON として読めません: ${(err as Error).message}`, 'err')
          }
          const res = sanitizeWorkspace(raw)
          if (!res.ws) return toast(`読み込めません: ${res.error}`, 'err')
          const ws = res.ws
          const cur = st().ws
          const done = (backedUp: boolean) => {
            if (!replaceWorkspace(ws)) return toast('保存領域が足りないため読み込みませんでした（いまの内容のまま）。「退避データを消す」で空きを作ってから読み込んでください', 'err')
            toast(`JSON を読み込みました（案件 ${ws.projects.length} 件）${res.warnings?.length ? `。外した項目: ${res.warnings.slice(0, 2).join(' / ')}` : ''}${backedUp ? '。戻すときは Ctrl+K →「読み込み前に戻す」' : '（退避なし）'}`, res.warnings?.length ? 'info' : 'ok')
          }
          confirmDanger(`全案件（いま ${cur.projects.length} 件）を JSON の ${ws.projects.length} 件で置き換えます。置き換える前の内容は退避し、Ctrl+K →「読み込み前に戻す」で戻せます`, '置き換える', () => {
            if (saveBackup(JSON.stringify(cur), 'JSON 読み込みの前')) return done(true)
            // 退避できないまま置き換えない（戻せると言って戻せない状態にしない）
            confirmDanger('保存領域がいっぱいで、いまの内容を退避できませんでした。先に Ctrl+K →「JSON を書き出す」で保存してから読み込むのが安全です', '退避せずに置き換える（戻せません）', () => done(false))
          })
        },
      })
    case 'data.clearBackups': {
      const n = loadBackups().length
      if (!n) return toast('退避したデータはありません', 'info')
      return confirmDanger(`退避したデータ ${n} 件をすべて消して保存領域を空けます（読めなかった保存データの退避も消えます。先に「退避したデータを書き出す」で保存できます）`, `${n} 件を消す`, () => {
        clearBackups()
        toast(`退避したデータ ${n} 件を消しました`, 'ok')
      })
    }
    case 'data.restoreBackup':
    case 'data.exportBackup': {
      const list = loadBackups()
      if (!list.length) return toast('退避したデータはありません', 'info')
      // 同じ分に作った退避も見分けられるよう、番号と秒まで出し、選んだ番号で取り出す
      const labelOf = (b: (typeof list)[number], i: number) => `#${i + 1} ${new Date(b.at).toLocaleString('ja-JP', { hour12: false })}・${b.reason}（${Math.round(b.raw.length / 1024)}KB）`
      const labels = list.map(labelOf)
      const act = (b: (typeof list)[number]) => (id === 'data.exportBackup' ? exportBackup(b) : restoreBackup(b))
      if (list.length === 1) return act(list[0])
      return prompt(id === 'data.exportBackup' ? '書き出す退避データ（数字か ↑↓ で選ぶ）' : '戻す退避データ（数字か ↑↓ で選ぶ）', { options: labels, showText: false }, (c) => {
        const i = labels.indexOf(c ?? '')
        if (i >= 0) act(list[i])
      })
    }
    case 'supplier.add':
      if (role !== 'purchasing') return toast('権限なし（商社マスタは購買）', 'err')
      return prompt('商社を追加（名前）', { requireText: true }, (_c, name) => {
        const n = name.trim()
        if (n.length > 50) return toast('商社名が長すぎます（50 文字まで）', 'err')
        if (s.ws.suppliers.some((x) => x.name === n)) return toast(`「${n}」はもう商社マスタにあります`, 'err')
        s.commitWs(`商社を追加: ${n}（案件設定の「相見積先」に入れると見積を依頼できます）`, (ws) => {
          const max = ws.suppliers.reduce((m, x) => Math.max(m, Number(x.id.slice(1)) || 0), 0)
          ws.suppliers.push(makeSupplier('S' + (max + 1), n, ws.suppliers.length))
        })
      })
    case 'role.switch':
      return prompt('役割を切り替え（ログイン）。数字か ↑↓ で役割、氏名を入れて Enter', { digitsSelect: true, options: ['設計', '購買', 'PM'], index: ['design', 'purchasing', 'pm'].indexOf(role), placeholder: '氏名（空なら案件の担当者名）', showText: true }, (choice, name) => {
        switchRole(choice === '購買' ? 'purchasing' : choice === 'PM' ? 'pm' : 'design', name)
      })
    default:
      if (id.startsWith('view.')) return setView(Number(id.slice(5)) as ViewId)
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

export const STATIC: Array<{ id: string; label: string; section: string; desc?: string; keywords?: string }> = [
  { id: 'publish', label: '公開（提出 / 指摘を発行）', section: '流れ', desc: '自分の未公開の行と下書き指摘', keywords: '提出 送る 送信 submit 出す 発行 購買へ' },
  { id: 'quotes.request', label: '概算見積を依頼', section: '流れ', desc: '購買。商社向け依頼 Excel を出す', keywords: '見積 依頼 相見積 rfq' },
  { id: 'quotes.import', label: '見積回答を取り込む', section: '流れ', desc: '購買。貼り付けで突合', keywords: '回答 取込 インポート import' },
  { id: 'adopt.bulkBest', label: '未採用を推奨で一括採用', section: '流れ', keywords: 'まとめて 全部 一括' },
  { id: 'adopt.bulkCheapest', label: '未採用を最安で一括採用（スコア無視）', section: '流れ', keywords: 'まとめて 安い' },
  { id: 'consolidate', label: '商社を集約', section: '流れ', desc: '1社/2社に集約した総額差を試算', keywords: 'まとめる 集約' },
  { id: 'quotes.formal', label: '正式見積を依頼（社外）', section: '流れ', desc: '購買。選定済の行を商社ごとに', keywords: '正式 依頼書' },
  { id: 'export.selection', label: '選定記録を出力（社内）', section: '流れ', desc: 'スコア内訳つき', keywords: '記録 スコア' },
  { id: 'ltb.request', label: '先行発注を申請', section: '流れ', desc: '購買 → PM の要決定へ', keywords: '長納期 ltb' },
  { id: 'undo', label: '元に戻す', section: '編集', keywords: 'undo 戻る 取り消し もどす' },
  { id: 'redo', label: 'やり直す', section: '編集', keywords: 'redo やりなおし やり直し' },
  { id: 'project.save', label: '保存', section: '編集', desc: '編集は自動で保存されています', keywords: 'save 保存 ほぞん' },
  { id: 'row.delete', label: '行を削除（提出済なら取消）', section: '編集', keywords: '削除 消す delete 取消' },
  { id: 'row.insertBelow', label: '行を追加', section: '編集', keywords: '追加 新しい行 挿入 insert' },
  { id: 'settings', label: '案件設定', section: '案件', desc: 'PM 項目 / 購買項目。納期変更は影響試算つき', keywords: '設定 納期 予算 重み 担当 相見積先' },
  { id: 'settings.confirm', label: '案件設定を確定（PM）', section: '案件' },
  { id: 'project.new', label: '新しいBOM', section: '案件', keywords: '新規 作成 new 作る 案件' },
  { id: 'project.switch', label: '受信箱・案件を切り替える', section: '案件', keywords: '開く 案件 案件を開く 一覧 受信箱 inbox 切り替え' },
  { id: 'rule.add', label: 'ルールを追加', section: 'チェック' },
  { id: 'export.excel', label: 'Excelで出力', section: '出力', keywords: 'エクセル excel xlsx 出力 印刷 ダウンロード 書き出す エクスポート export' },
  { id: 'copy.formatted', label: '表示中の行と列を書式つきでコピー', section: '出力', keywords: 'コピー メール 貼る' },
  { id: 'data.exportJson', label: 'JSON を書き出す', section: 'データ', keywords: 'バックアップ 退避 書き出し jsonエクスポート' },
  { id: 'data.importJson', label: 'JSON を読み込む', section: 'データ', keywords: '復元 読み込み' },
  { id: 'data.restoreBackup', label: '読み込み前に戻す（退避したデータに戻す）', section: 'データ', keywords: '復元 戻す 元に戻す 退避 バックアップ' },
  { id: 'data.clearBackups', label: '退避データを消す（保存領域を空ける）', section: 'データ', keywords: '容量 空き 削除 退避 バックアップ' },
  { id: 'data.exportBackup', label: '退避したデータを書き出す', section: 'データ', keywords: '退避 バックアップ 壊れた 保存データ' },
  { id: 'data.reset', label: 'サンプルデータに戻す', section: 'データ', keywords: '初期化 リセット' },
  { id: 'supplier.add', label: '商社を追加', section: '案件', keywords: '商社 マスタ' },
  { id: 'role.switch', label: '役割を切り替え（ログイン）', section: '案件', keywords: 'ログイン 設計 購買 pm ユーザー' },
  { id: 'history', label: '履歴', section: '案件', keywords: 'ログ 変更履歴 誰が' },
  { id: 'theme.toggle', label: 'ダークモード切替', section: '表示', keywords: 'ダーク 暗い テーマ' },
  { id: 'density.toggle', label: 'コンパクト表示切替', section: '表示', keywords: '行の高さ 小さく 大きく 文字 拡大 縮小 見やすく' },
  { id: 'sort.asc', label: '今の列で並び替え', section: '表示', desc: 's 昇順 / Shift+S 降順。列見出しのクリックでも', keywords: 'ソート sort 並べ替え 順番' },
  { id: 'filter.focus', label: '絞り込み検索', section: '表示', desc: '/ で入力欄へ', keywords: 'フィルタ filter 検索 探す さがす' },
  { id: 'columns.panel', label: '列の表示・非表示', section: '表示', keywords: '列 カラム 隠す 見えない' },
  { id: 'goto', label: '行へジャンプ（ID・回路記号・型式）', section: '表示', keywords: '移動 ジャンプ 探す 行へ' },
  { id: 'row.toggleHidden', label: '行を隠す / 隠した行を戻す', section: '編集', desc: '隠した行は 1 すべてに薄く出ます', keywords: '非表示 隠した 隠す 戻す 表示' },
  { id: 'help', label: 'ショートカット一覧（ヘルプ）', section: '表示', keywords: 'ヘルプ help 使い方 キー 操作 わからない ? alt f8 英字 ショートカット' },
]

/** ショートカット表の操作の言い換え（パレットで探す言葉） */
const KEYMAP_KEYWORDS: Record<string, string> = {
  'issue.quickfix': '直す 修正 直し方 候補',
  'adopt.best': '採用 選定 推奨 決める',
  'adopt.choose': '商社を選ぶ 選定',
  'issue.raise': '指摘 起票 質問',
  'issue.next': '次の問題 エラー 警告',
  'row.replace': '置換 置き換え 代替',
  'issue.sequence': '順番 まとめて直す',
}

const QUIT_WORDS = /^(終了|閉じる|quit|exit|ログアウト|印刷|print)$/i

export function paletteItems(query: string): PaletteItem[] {
  const s = st()
  const p = s.project()
  const q = toHalf(query).trim()
  const ql = q.toLowerCase()
  const items: PaletteItem[] = []
  const wrap = (fn: () => void) => () => {
    closePanel()
    fn()
  }
  const m = q.match(/^(r?\d{1,3}|R\d{3})\s*(.*)$/i)
  if (m) {
    const id = /^r?\d+$/i.test(m[1]) ? 'R' + m[1].replace(/\D/g, '').padStart(3, '0') : m[1].toUpperCase()
    const row = p.rows.find((x) => x.id === id)
    if (row) {
      // パレットの表示どおり「R040 を置換」と打っても当たるように、先頭の「を」は無視する
      // 表示どおりの「R040 を置換」「R040 へジャンプ」「R040 を 因幡電機 で採用」でも当たる
      const rest = m[2].trim().replace(/^[をへ]\s*/, '')
      const e = effective(row)
      if (!adopt.canAdopt(p, row) && (!rest || '採用'.startsWith(rest) || rest.startsWith('採用') || /で採用/.test(rest))) {
        const scores = scoreRow(p, row, s.ws.suppliers)
        const supQ = rest.replace(/^採用\s*/, '').replace(/\s*で採用.*$/, '').replace(/\s*スコア.*$/, '').trim()
        const cands = supQ ? scores.filter((sc) => s.ws.suppliers.find((x) => x.id === sc.supplierId)?.name.includes(supQ)) : scores
        cands.forEach((sc) => {
          const i = scores.indexOf(sc)
          const sup = s.ws.suppliers.find((x) => x.id === sc.supplierId)!
          items.push({
            id: `adopt:${id}:${sc.supplierId}`,
            section: id,
            label: `${id} を ${sup.name} で採用 ¥${sc.quote.unitPrice?.toLocaleString()} スコア${sc.total}${i === 0 ? ' 推奨' : ''}`,
            desc: e.name,
            keys: i === 0 ? ['a'] : ['Shift+A', String(i + 1)],
            run: wrap(() => {
              jumpToRow(id)
              if (i === 0) adopt.adoptBest(id)
              else prompt('1位以外を選ぶ理由（数字か ↑↓ で選んで Enter）', { options: [...adopt.ADOPT_REASONS], index: -1, placeholder: '補足（任意）', showText: true, digitsSelect: true }, (c, t) => void adopt.adoptChoose(id, sc.supplierId, (c ?? 'その他') + (t ? `: ${t}` : '')))
            }),
          })
        })
      }
      const rowCmds: Array<[string, string, string]> = [
        ['置換', 'row.replace', 'r'],
        ['発注', 'row.toggleOrdered', 'o'],
        ['入荷', 'row.toggleReceived', 'i'],
        ['隠す', 'row.toggleHidden', 'h'],
        ['指摘', 'issue.raise', 'Shift+I'],
        ['開く', 'row.toggleOpen', ' '],
      ]
      for (const [label, cmd, key] of rowCmds)
        if (!rest || label.startsWith(rest))
          items.push({
            id: `${cmd}:${id}`,
            section: id,
            label: `${id} を${label}`,
            desc: e.name + ' ' + e.model,
            keys: [key],
            run: wrap(() => {
              jumpToRow(id)
              runCommand(cmd)
            }),
          })
      if (!rest || 'ジャンプ'.startsWith(rest) || rest.startsWith('ジャンプ')) items.push({ id: `goto:${id}`, section: id, label: `${id} へジャンプ`, desc: e.name, keys: ['Ctrl+G'], run: wrap(() => jumpToRow(id)) })
    }
  }
  for (const v of VIEWS) if (!q || `ビュー ${v.label}`.includes(q) || v.label.includes(q)) items.push({ id: `view.${v.id}`, section: 'ビュー', label: `ビュー: ${v.label}`, keys: [String(v.id)], run: wrap(() => runCommand(`view.${v.id}`)) })
  for (const pr of s.ws.projects)
    if (q && (pr.id + pr.name).toLowerCase().includes(ql.replace(/^案件\s*/, '')))
      items.push({
        id: `project:${pr.id}`,
        section: '案件',
        label: `案件: ${pr.id} ${pr.name}`,
        keys: ['Ctrl+P'],
        run: wrap(() => {
          s.commitWs('', (ws) => void (ws.currentProjectId = pr.id))
          set({ cursorRow: null })
        }),
      })
  for (const c of STATIC) if (!q || matchScore(c.label, c.keywords, c.desc, ql) > 0) items.push({ id: c.id, section: c.section, label: c.label, desc: c.desc, keys: bindingsFor(c.id), run: wrap(() => runCommand(c.id)) })
  for (const b of KEYMAP) if (q && matchScore(b.label, KEYMAP_KEYWORDS[b.id], undefined, ql) >= 40 && !items.some((i) => i.id === b.id)) items.push({ id: b.id, section: b.section, label: b.label, keys: b.keys, run: wrap(() => runCommand(b.id)) })
  // 文字の大きさはブラウザの拡大で変える（アプリの設定ではない）
  if (q && /文字.*(大き|小さ)|拡大|縮小|ズーム|zoom/i.test(q)) items.push({ id: 'info.zoom', section: '案内', label: '文字の大きさは Ctrl + ＋ / Ctrl + − で変えられます（行の高さは「コンパクト表示切替」）', run: wrap(() => undefined) })
  if (q && QUIT_WORDS.test(q)) items.push({ id: 'info.quit', section: '案内', label: q.match(/印刷|print/i) ? '印刷は「Excelで出力」から（Ctrl+E）' : '終了はブラウザのタブを閉じるだけです（編集は自動で保存済み）', run: wrap(() => (q.match(/印刷|print/i) ? runCommand('export.excel') : undefined)) })
  // 並び: 打った言葉との一致度 → 最近使った順
  const recent = s.recentCommands
  const score = (it: PaletteItem) => {
    if (!q) return 0
    if (it.section === m?.[1]?.toUpperCase() || /^R\d{3}$/.test(it.section)) return 90
    // 案内（終了・印刷・文字の大きさ）は、その言葉を打ったときだけ出るので先頭に
    if (it.id.startsWith('info.')) return 70
    const st0 = STATIC.find((c) => c.id === it.id)
    return matchScore(it.label, st0?.keywords ?? KEYMAP_KEYWORDS[it.id], it.desc, ql)
  }
  const scored = items.map((it, i) => ({ it, i, sc: score(it), rc: recent.indexOf(it.id) }))
  scored.sort((a, b) => b.sc - a.sc || (a.rc < 0 ? 999 : a.rc) - (b.rc < 0 ? 999 : b.rc) || a.i - b.i)
  return scored.map((x) => x.it)
}

/** パレットの一致度。完全一致 > 前方一致 > 部分一致 > 言い換え（キーワード） */
function matchScore(label: string, keywords: string | undefined, desc: string | undefined, ql0: string): number {
  // 空白の有無は区別しない（「JSONを書き出す」と「JSON を書き出す」）
  const sp = (x: string) => x.replace(/\s+/g, '')
  const ql = sp(ql0)
  if (!ql) return 0
  const l = sp(toHalf(label).toLowerCase())
  const plain = l.replace(/（.*?）/g, '')
  if (l === ql || plain === ql) return 100
  if (l.startsWith(ql) || plain.startsWith(ql)) return 80
  const kws = (keywords ?? '').toLowerCase().split(' ').filter(Boolean)
  // 言い換えに完全一致する操作は、ラベルの途中に含むだけの操作より先（「直す」→ その場で直す、「採用」→ 推奨で採用）
  if (kws.some((k) => k === ql)) return 65
  if (l.includes(ql)) return 60
  if (kws.some((k) => k.startsWith(ql) || (ql.length >= 2 && k.includes(ql)))) return 40
  if ((desc ?? '').toLowerCase().includes(ql)) return 30
  if (kws.some((k) => k.length >= 2 && ql.includes(k) && ql.length <= k.length + 2)) return 20
  return 0
}

/** 列パネルで並べる列 */
export function colsForPanel() {
  return ['id', 'ball', 'ref', 'drawing', 'category', 'name', 'model', 'maker', 'qtyNeeded', 'unit', 'packQty', 'procurement', 'makerLock', 'altPolicy', 'designated', 'needOffset', 'needDateFixed', 'needDate', 'tags', 'orderQty', 'adopted', 'score', 'unitPrice', 'amount', 'formalPrice', 'formalDiff', 'lead', 'status', 'due', 'waiting', 'ordered', 'received', 'promisedDate', 'receivedLot', 'extraCost', 'extraCostKind', 'note']
}

export { handleKeyDown } from './keyboard'
export { issues as issueActions, rows as rowActions, ROLE_LABEL, KEYMAP, eventToKey, lookupBinding, ISSUE_KINDS, VIEWS, cursorRow as visibleCursorRow, moveCursorRow, gotoProblem, problemCells, openQuickfix, prompt, confirmDanger, decisionPanel, saveSettings, createProjectFromWizard, nextProjectId }
export type { IssueKind }
