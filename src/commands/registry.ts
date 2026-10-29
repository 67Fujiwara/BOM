import { useStore, type Panel, type PanelOption, type ViewId, type State } from '@/model/store'
import { KEYMAP, bindingsFor, eventToKey, lookupBinding } from '@/keys/keymap'
import { buildViewModel, cellText } from '@/model/selectors'
import { colDef, supplierOfCol } from '@/model/columns'
import type { ChangeReason, IssueKind, Project, Role, Row, Workspace } from '@/model/types'
import { CHANGE_REASONS, ISSUE_KINDS, ROLE_LABEL } from '@/model/types'
import { VIEWS, isAcked } from '@/model/views'
import { valuesFor, designatedDeclined, effective, fixedSupplierId, handlesMaker, hasWork, isActive, noUsableQuote, openIssues, tradableIn } from '@/model/derive'
import { checkRow, setSupplierMaster, type Problem } from '@/model/rules'
import * as rows from '@/actions/rows'
import * as issues from '@/actions/issues'
import * as adopt from '@/actions/adopt'
import { applySettings, simulateSettings } from '@/actions/settings'
import * as quotes from '@/actions/quotes'
import { rankedQuotes, scoreRow } from '@/model/score'
import { makeSampleProject, makeSupplier } from '@/model/sample'
import { normalize, setStatus } from '@/model/lifecycle'
import { backupsSnapshot, clearBackups, loadBackups, restoreBackupsSnapshot, resetWorkspace, saveBackup, type Backup } from '@/io/persist'
import { addDays, fmtDateTime, todayStr } from '@/model/dates'
import { parseDate, parseNumber, toHalf } from '@/model/parse'
import { sanitizeWorkspace } from '@/model/validate'

const st = () => useStore.getState()
const set = (p: Partial<State>) => useStore.setState(p)
const toast = (t: string, k: 'ok' | 'err' | 'info' = 'ok') => st().toastMsg(t, k)
export const vm = () => buildViewModel(st())

export const ROLE_DEFAULT_VIEW: Record<Role, ViewId> = { design: 4, purchasing: 9 }

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
    // 選択を外したところ（直してビューから外れた・別のタブの変更）があれば、その位置の行から（先頭へ飛ばない）
    const resume = resumeRow && items.some((i) => i.key === resumeRow) ? resumeRow : null
    resumeRow = null
    if (resume) {
      set({ cursorRow: resume, detailIndex: 0 })
      ensureCol()
      return
    }
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
/** 行の選択を外したときの、続きの行（↓ で戻る先） */
let resumeRow: string | null = null
function moveCol(delta: number) {
  const cols = vm().columns
  // 行を選んでいないときの → ← Tab は行を選ばない（先頭の行の別のセルに続けて打ち込まない）
  if (!st().cursorRow) return toast('行を選んでいません（↓ で表へ）', 'info')
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
/**
 * カーソルの行がこのビューから消えたら（自分や別のタブが隠した・状態が変わった）、同じ位置の行（無ければ上の行）へ移す。
 * 行を選んでいない状態にしない（英字が効かなくなる）。before は変わる前に見えていた行の ID
 */
export function keepCursorVisible(before: string[], external = false) {
  const s = st()
  const cur = s.cursorRow
  if (!cur || cur.startsWith('g:')) return
  const after = vm().rows.map((x) => x.id)
  if (after.includes(cur)) return
  const at = before.indexOf(cur)
  if (at < 0) return
  // 別のタブの変更で行が消えたときは、黙って隣の行へ移さない（続けて押したキーが別の行に効かないように）。行の選択を外して知らせる
  if (external) {
    resumeRow = before.slice(at + 1).find((id) => after.includes(id)) ?? before.slice(0, at).reverse().find((id) => after.includes(id)) ?? null
    if (s.mode === 'edit') {
      const v = s.editValue
      cancelEdit()
      toast(`編集中の ${cur} が別のタブの変更でこのビューから外れたので、入力「${v}」は保存していません（Ctrl+G ${cur} で行へ）`, 'err')
    } else toast(`${cur} が別のタブの変更でこのビューから外れました。行の選択を外しました（↓ で表へ、Ctrl+G ${cur} でその行へ）`, 'info')
    set({ cursorRow: null })
    return
  }
  if (s.mode === 'edit') return
  const next = before.slice(at + 1).find((id) => after.includes(id)) ?? before.slice(0, at).reverse().find((id) => after.includes(id))
  if (next) set({ cursorRow: next })
  else ensureCursor()
}
export function jumpToRow(id: string, col?: string, keepProblem = false): boolean {
  // Ctrl+G・パレットなどで別の行へ飛んだら、F8 は飛んだ先から数え直す（直し方の候補から同じ問題のセルへ移るときは続ける）
  if (!keepProblem) lastProblem = null
  const s = st()
  const p = s.project()
  const r = p.rows.find((x) => x.id === id)
  if (!r) return false
  if (!vm().rows.some((x) => x.id === id)) set({ view: 1, filter: '', cellFilter: null })
  const cat = effective(r).category || '（分類なし）'
  if (st().collapsed.includes(cat)) set({ collapsed: st().collapsed.filter((c) => c !== cat) })
  set({ cursorRow: id, cursorCol: col && vm().columns.includes(col) ? col : s.cursorCol, detailIndex: 0 })
  ensureCol()
  // 飛んだときの見えている位置を覚える（確認済みにして 4 の並びの後ろへ動いても、F8 はもとの位置の次から）
  lastAnchor = { rowId: id, pos: vm().rows.findIndex((x) => x.id === id), view: st().view }
  return true
}
let lastAnchor: { rowId: string; pos: number; view: number } | null = null
export function setView(v: ViewId) {
  // 編集中にビューを切り替えたら、先に今のセルへ確定する（別の行に書き込まない）
  if (!commitEdit('stay')) return
  set({ view: v, detailIndex: 0, revView: null })
  // 6 商社別・8 正式見積は相見積先の列で入れる。相見積先が無ければ理由を知らせる
  if ((v === 6 || v === 8) && !st().project().supplierIds.length) toast('相見積先がまだありません（案件設定 Ctrl+K →「案件設定」→ 相見積先、または概算見積の依頼で商社を選ぶ）', 'info')
  if (!vm().rows.some((r) => r.id === st().cursorRow)) set({ cursorRow: null })
  ensureCursor()
  // 書けない列にいるなら、このビューで自分が書ける最初の列へ（購買が 6・8 を開くと単価、9 なら発注数）。ID・状態の列にいるときはそのまま
  const c = st().cursorCol
  if (c !== 'id' && c !== 'status' && rows.canEdit(c)) {
    // 単価（6 は概算、8 は正式）を先に。無ければ書ける最初の列（9 なら発注数）
    const cols = vm().columns.filter((k) => !rows.canEdit(k) && colDef(k)?.kind !== 'bool')
    const mine = cols.find((k) => k.startsWith(v === 8 ? 'q.formalPrice' : 'q.unitPrice')) ?? cols.find((k) => k.startsWith('q.')) ?? cols[0]
    if (mine) set({ cursorCol: mine })
  }
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
  if (d.design && (r.status === 'ordered' || r.status === 'received')) return toast(`${r.id} は発注済以降の行です。設計列は変えられません（${s.ws.user.role === 'design' ? '変えたいときは購買に伝えてください。購買が Alt+Shift+I → h で発注後変更依頼を起票し、PM が決めます' : 'Alt+Shift+I → h 発注後変更依頼'}）`, 'err')
  if (d.kind === 'bool') return toggleBool(r, s.cursorCol)
  const cur = cellText(r, s.cursorCol, vm().ctx)
  const value = initial ?? String(cur.raw ?? '')
  editProject = projectIdentity()
  set({ mode: 'edit', editValue: value, editError: null, editAuto: false, editTyped: initial !== undefined, editFromTyping: initial !== undefined && initial !== '', editSelectAll: initial === undefined && value !== '' && (d.kind === 'num' || d.kind === 'date' || d.kind === 'select'), editBase: String(cur.raw ?? ''), editCandidates: d.kind === 'select' ? startCandidates(d.options ?? [], initial, value) : null })
}
function toggleBool(r: Row, col: string) {
  const v = (r as unknown as Record<string, unknown>)[col] === true
  if (col === 'ordered') return runCommand('row.toggleOrdered')
  if (col === 'received') return runCommand('row.toggleReceived')
  rows.setCell(r.id, col, v ? '' : '1')
}
/** Enter で始めた選択の列の編集は、いまの値を先頭に（↑↓ はいまの値から数える） */
function startCandidates(options: string[], initial: string | undefined, value: string): string[] {
  if (initial !== undefined) return candidates(options, initial)
  const i = options.indexOf(value)
  return i > 0 ? [...options.slice(i), ...options.slice(0, i)] : options
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
export function commitEdit(dir: 'down' | 'up' | 'right' | 'left' | 'stay' = 'down'): boolean {
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
    const v = s.editValue
    cancelEdit()
    toast(`編集中の行が別のタブで削除されたので、入力「${v}」は保存していません`, 'err')
    return false
  }
  const d = colDef(s.cursorCol)!
  let value = s.editValue
  // 選択の列: 打った値がそのまま読める（言い換え「sh」→ 指定商社 など）ならそれを使い、読めないときだけ候補の先頭
  if (d.kind === 'select' && s.editCandidates?.length && value.trim() !== '' && !(d.options ?? []).includes(value) && !rows.parseValue(s.cursorCol, value).ok) {
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
    const beforeIds = vm().rows.map((x) => x.id)
    set({ mode: 'nav', editCandidates: null, editError: null })
    if (!rows.setCell(r.id, col, value)) return false
    // 直したことで行がこのビューから外れた（4 要確認で問題が消えた など）ときは、先頭へ飛ばず、その位置の次の行へ（それが「下へ」）
    if (!vm().rows.some((x) => x.id === r.id)) {
      tabAnchor = null
      // Enter（下へ）なら同じ位置の次の行へ。Tab・Ctrl+. などでは、隣の行の別のセルに続けて書いたり操作したりしないよう、行の選択を外して止める
      if (dir === 'down') {
        keepCursorVisible(beforeIds)
        return true
      }
      const i = beforeIds.indexOf(r.id)
      const now = vm().rows.map((x) => x.id)
      resumeRow = beforeIds.slice(i + 1).find((id) => now.includes(id)) ?? beforeIds.slice(0, i).reverse().find((id) => now.includes(id)) ?? null
      set({ cursorRow: null })
      toast(`${r.id} を直したので、このビューから外れました（↓ で続きの行へ、F8 で次の問題へ）`, 'info')
      return false
    }
  } else set({ mode: 'nav', editCandidates: null, editError: null })
  // Enter の連続入力は次のデータ行へ（分類の見出しで止まらない）。
  // Tab で右へ入れてきた後の Enter は、Excel と同じく Tab を始めた列に戻る（単価 Tab 納期 Tab MOQ Enter → 次の行の単価）
  if (dir === 'down') {
    const anchor = tabAnchor && tabAnchor.row === r.id ? tabAnchor.col : null
    tabAnchor = null
    moveCursorToRow(1)
    // 最後の行（下に行が無い）では列を戻さない（同じ行の最初の値を上書きしない）
    if (st().cursorRow === r.id) {
      if (st().user().role === 'design') toast('最後の行です。下に行を足すときは Shift+Enter', 'info')
      return true
    }
    if (anchor && vm().columns.includes(anchor)) set({ cursorCol: anchor })
  } else if (dir === 'up') {
    tabAnchor = null
    // 分類の見出しで止まらず、上のデータ行へ
    moveCursorToRow(-1)
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
  if (row.flags.formalWithdrawn && role === 'purchasing') return '正式依頼の取下げを元の商社に伝えた'
  if (row.flags.leadNG && !row.flags.countermeasure && role === 'purchasing') return '納期NGを承知で進める'
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
  if (r.flags.formalWithdrawn && role === 'purchasing') return issues.ackFlag(r.id, 'formalWithdrawn')
  if (r.flags.leadNG && !r.flags.countermeasure && role === 'purchasing') return issues.ackFlag(r.id, 'leadNG')
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
    // 取消・置換した行の正式依頼の取下げも、購買の F8 で回る
    if (!isActive(r)) {
      if (role === 'purchasing' && r.flags.formalWithdrawn) out.push({ rowId: r.id, field: 'status', order: 30 })
      continue
    }
    const changed = Object.keys(r.working ?? {})
    for (const i of openIssues(p, r.id)) {
      const b = i.status === 'open' || i.status === 'inProgress' ? issues.issueBallRole(i) : i.by.role
      // 設計が直して公開を待っている指摘（指摘のセルが作業中で変わった）は、もう直す問題として回らない
      if (role === 'design' && b === 'design' && (i.field ? changed.includes(i.field as string) : changed.includes('model') || changed.includes('maker'))) continue
      if (b === role) out.push({ rowId: r.id, field: (i.field as string) ?? 'model', order: kinds.indexOf(i.kind) })
    }
    if (role === 'design') for (const pr of checkRow(r, s.ws.rules, p)) out.push({ rowId: r.id, field: pr.field, order: 20 + (pr.severity === 'error' ? 0 : 1) })
    if (role === 'purchasing' && (r.flags.reconfirm || r.flags.requote || r.flags.notation || r.flags.orderQtyCheck || r.flags.formalWithdrawn)) out.push({ rowId: r.id, field: r.flags.formalWithdrawn && !(r.flags.reconfirm || r.flags.requote || r.flags.notation || r.flags.orderQtyCheck) ? 'status' : 'model', order: 30 })
  }
  const sorted = out.sort((a, b) => a.order - b.order || a.rowId.localeCompare(b.rowId))
  const seen = new Set<string>()
  const uniq = sorted.filter((x) => {
    const k = x.rowId + x.field
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
  // F8 は見えている並び（4 は種別の順に並んでいる）で上から下へ進む。同じ行は列の順。このビューに無い行は最後（一覧の順）
  const v = vm()
  // このビューに無い行は、BOM の並び（1 すべての順）で後ろに
  const pos = new Map<string, number>([...p.rows.map((x, i) => [x.id, 1e6 + i] as const), ...v.rows.map((x, i) => [x.id, i] as const)])
  const colPos = (f: string) => {
    const i = v.columns.indexOf(f)
    return i < 0 ? 999 : i
  }
  return uniq
    .map((x, i) => ({ x, i }))
    .sort((a, b) => (pos.get(a.x.rowId) ?? 1e9) - (pos.get(b.x.rowId) ?? 1e9) || colPos(a.x.field) - colPos(b.x.field) || a.i - b.i)
    .map((y) => y.x)
}
function gotoProblem(delta: 1 | -1): boolean {
  const all = problemCells()
  // いまのビュー・絞り込みに見えている問題があれば、その中だけを回る（黙ってビューや絞り込みを変えない）
  const shown = new Set(vm().rows.map((x) => x.id))
  const visible = all.filter((x) => shown.has(x.rowId))
  const list = visible.length ? visible : all
  if (!visible.length && all.length) lastProblem = null
  if (!visible.length && all.length && (st().filter || st().cellFilter || st().view !== 1)) toast('このビュー・絞り込みには問題がありません。1 すべてに切り替えて次の問題へ移ります', 'info')
  if (!list.length) {
    toast(`${ROLE_LABEL[st().user().role]}がいま直す問題はありません${st().user().role === 'design' ? '（Ctrl+Enter で公開できます）' : ''}`, 'info')
    return false
  }
  const s = st()
  // ID・状態の列で使っているときは列を変えずに行だけ移る（x → n → x … を ID の列で続けられる）
  // いまのビューに出ていない列の問題（4 要確認の備考の【削除？】など）は、列を見ずに行だけで数える
  const shownCols = new Set<string>(vm().columns)
  const stay = s.cursorCol === 'id' || s.cursorCol === 'status' || list.some((x) => x.rowId === s.cursorRow && !shownCols.has(x.field as string))
  const idx = stay ? list.findIndex((x) => x.rowId === s.cursorRow) : list.findIndex((x) => x.rowId === s.cursorRow && x.field === s.cursorCol)
  let next = idx < 0 ? (delta > 0 ? 0 : list.length - 1) : (idx + delta + list.length) % list.length
  // カーソルが行にあるときは、その行から下（Shift+F8 は上）でいちばん近い問題（↓・PageDown で動いたあとも、カーソルから数える）。
  // 行を選んでいない（直してビューから外れた など）ときだけ、前に飛んだ位置から続ける
  // カーソルが前に飛んだ行のままで、その行の問題が無くなった（確認済みにした・直した。4 では並びの後ろへ動く）ときも、前に飛んだ位置の次から
  const stillLast = !!lastProblem && s.cursorRow === lastProblem.rowId && !list.some((x) => x.rowId === s.cursorRow)
  if (idx < 0 && lastProblem && (!s.cursorRow || stillLast)) {
    const lp = lastProblem
    const j = list.findIndex((x) => x.rowId === lp.rowId && x.field === lp.field)
    if (j >= 0) next = (j + delta + list.length) % list.length
    else {
      const at = Math.min(lp.idx, list.length) // 消えた問題の次は同じ番号に詰まっている
      next = delta > 0 ? at % list.length : (at - 1 + list.length) % list.length
    }
  }
  else if (idx < 0 && s.cursorRow) {
    // 見えている並びで、カーソルの行（その行の別の列の問題も含む）から下（Shift+F8 は上）でいちばん近い問題。
    // 分類の見出しにいるときは、その見出しの下の最初の行から
    const pos = new Map(vm().rows.map((x, i) => [x.id, i] as const))
    let curId = s.cursorRow
    if (curId.startsWith('g:')) {
      const items = navItems()
      const at = items.findIndex((i) => i.key === curId)
      curId = (delta > 0 ? items.slice(at + 1).find((i) => i.kind === 'row') : [...items.slice(0, at)].reverse().find((i) => i.kind === 'row'))?.key ?? curId
    }
    const cur = pos.get(curId)
    if (cur != null) {
      let best = -1
      list.forEach((x, i) => {
        const q = pos.get(x.rowId)
        if (q == null) return
        if (delta > 0 ? q >= cur && (best < 0 || q < pos.get(list[best].rowId)!) : q <= cur && (best < 0 || q > pos.get(list[best].rowId)!)) best = i
      })
      if (best >= 0) next = best
    }
    // カーソルの行に問題が無く（直した・確認済みにして、4 の並びの後ろへ動いた など）、見えている並びでその下に問題が無いときや、
    // 行がビューから外れたときは、先頭へ戻らずに BOM の並びでその行より下（上）のいちばん近い問題
    // 4 は問題のある行を先に並べるので、問題の無い行からは F8 も Shift+F8 も BOM の並びで数える
    const anchor = lastAnchor && lastAnchor.rowId === curId && lastAnchor.view === s.view && lastAnchor.pos >= 0 && !list.some((x) => x.rowId === curId) ? lastAnchor.pos : null
    if (anchor != null) {
      // 飛んだときの位置から数える（その行が後ろへ動いた分、後ろの行は 1 つ前に詰まっている）
      let best = -1
      list.forEach((x, i) => {
        const q = pos.get(x.rowId)
        if (q == null || x.rowId === curId) return
        if (delta > 0 ? q >= anchor && (best < 0 || q < pos.get(list[best].rowId)!) : q < anchor && (best < 0 || q > pos.get(list[best].rowId)!)) best = i
      })
      if (best >= 0) next = best
    } else if (cur == null || (!list.some((x) => x.rowId === curId) && (s.view === 4 || !list.some((x) => { const q = pos.get(x.rowId); return q != null && (delta > 0 ? q > cur : q < cur) })))) {
      const bom = new Map(st().project().rows.map((x, i) => [x.id, i] as const))
      const at = bom.get(curId)
      if (at != null) {
        let best = -1
        list.forEach((x, i) => {
          const q = bom.get(x.rowId)
          if (q == null || x.rowId === curId) return
          if (delta > 0 ? q > at && (best < 0 || q < bom.get(list[best].rowId)!) : q < at && (best < 0 || q > bom.get(list[best].rowId)!)) best = i
        })
        if (best >= 0) next = best
      }
    }
  }
  // 列を変えないときは、同じ行の別の問題を飛ばして次の行へ
  if (stay && idx >= 0) while (list[next].rowId === s.cursorRow && next !== idx) next = (next + delta + list.length) % list.length
  if (stay) jumpToRow(list[next].rowId)
  else jumpToRow(list[next].rowId, list[next].field)
  // jumpToRow は「前に飛んだ位置」を消すので、そのあとで覚える
  lastProblem = { rowId: list[next].rowId, field: list[next].field, idx: next }
  return true
}
/** 最後に F8 / n で飛んだ問題（行と一覧の中の番号） */
let lastProblem: { rowId: string; field: string; idx: number } | null = null

// ---------- Ctrl+. 候補 ----------
export function quickfixOptions(r: Row, field: string): PanelOption[] {
  const s = st()
  const p = s.project()
  const role = s.user().role
  const opts: PanelOption[] = []
  const iss = p.issues.filter((i) => i.rowId === r.id)
  for (const i of iss) if (i.proposal && (i.status === 'open' || i.status === 'inProgress') && role === 'design') opts.push({ label: `購買の提案 ${i.proposal.model} を適用して置換（${i.id}）`, run: () => void issues.applyProposal(i.id) })
  // 指定商社の指定先が「取扱なし」: 設計が指定先を変える（§3.4）
  if (role === 'design' && r.procurement === '指定商社' && designatedDeclined(p, r)) {
    const cur = s.ws.suppliers.find((x) => x.id === r.designated || x.name === r.designated)
    const declined = new Set(p.quotes.filter((q) => q.rowId === r.id && !q.stale && q.leadDays === -1).map((q) => q.supplierId))
    // メーカを扱う商社を先に。扱わない（取扱メーカに無い）商社はそうと分かるように
    // 取引停止の商社は候補にしない
    const cands = s.ws.suppliers.filter((x) => !declined.has(x.id) && x.tradable !== false)
    const carries = (x: (typeof cands)[number]) => !x.handledMakers.length || handlesMaker(x.handledMakers, r.maker)
    const labelOf = new Map(cands.map((x) => [carries(x) ? x.name : `${x.name}（${r.maker || 'メーカ'} は取扱メーカに無い）`, x] as const))
    const names = [...cands.filter(carries), ...cands.filter((x) => !carries(x))].map((x) => [...labelOf].find(([, v]) => v === x)![0])
    opts.push({
      label: `指定先を変える（${cur?.name ?? r.designated} が${cur?.tradable === false ? '取引停止（商社マスタ）' : '取扱なしと回答'}）`,
      run: () =>
        prompt(`${r.id} の新しい指定先（公開すると購買が新しい指定先に依頼します）`, { options: names }, (c) => {
          const sp = c ? labelOf.get(c) : undefined
          if (sp && rows.setCell(r.id, 'designated', sp.id, '指定先を変える')) toast(`${r.id} の指定先を ${sp.name} にしました（Ctrl+Enter で公開）`, 'ok')
        }),
    })
  }
  // 相見積で取引できる商社の有効な見積が無い（全社辞退）: ほかの商社に頼むか、設計に代替を相談
  if (role === 'purchasing' && r.procurement === '相見積' && noUsableQuote(p, r))
    opts.push(
      { label: 'ほかの商社に依頼する（概算見積を依頼。まだこの行に頼んでいない商社を選ぶ。案件の相見積先に無ければ Ctrl+K →「案件設定」で足す）', run: () => runCommand('quotes.request') },
      { label: '設計に代替を相談する（指摘を起票）', run: () => void issues.raiseIssue(r.id, 'model', '代替提案', '取引できる商社がすべて辞退しました。代替品を検討してください', undefined, true) },
    )
  // 客先指定品の依頼先が辞退: 購買が次の商社（メーカを扱う商社）に頼み直す
  if (role === 'purchasing' && r.procurement === '客先指定品' && !r.adoptedSupplierId && r.status === 'quoting') {
    const qs = p.quotes.filter((q) => q.rowId === r.id && !q.stale)
    const next = fixedSupplierId(p, r, s.ws.suppliers)
    const nx = next ? s.ws.suppliers.find((x) => x.id === next) : undefined
    const note = nx && nx.handledMakers.length && !handlesMaker(nx.handledMakers, r.maker) ? `。${r.maker} は取扱メーカに無い商社です` : ''
    if (qs.length && qs.every((q) => q.leadDays === -1) && next) opts.push({ label: `次の商社 ${nx?.name ?? next} に依頼する（概算見積を依頼。依頼先で「${next} ${nx?.name ?? ''}」か「相見積先すべて」を選ぶ）${note}`, run: () => runCommand('quotes.request') })
  }
  if (role === 'design') {
    const prs: Problem[] = checkRow(r, s.ws.rules, p)
    for (const pr of prs.filter((x) => x.field === field).concat(prs.filter((x) => x.field !== field))) {
      for (const f of pr.fixes) opts.push({ label: `${pr.message}: ${f.label}`, run: () => rows.applyFix(r.id, f.apply(r), f.label) })
      if (!pr.fixes.length)
        opts.push({
          label: `${pr.message}: 編集する`,
          run: () => {
            jumpToRow(r.id, pr.field, true)
            startEdit()
          },
        })
      if (pr.severity === 'warn') opts.push({ label: `${pr.message}: 確認済みにする（x）`, run: () => rows.ackRule(r.id, pr.ruleId) })
      opts.push({ label: `${pr.message}: あとで（いまは飛ばす。公開までに直すか確認済みに。表では Shift+→）`, run: () => rows.deferRule(r.id, pr.ruleId) })
    }
  }
  if (role === 'purchasing') {
    if (r.flags.reconfirm)
      for (const q of p.quotes.filter((x) => x.rowId === r.id && !x.stale && !x.reconfirm)) {
        const name = s.ws.suppliers.find((x) => x.id === q.supplierId)?.name ?? q.supplierId
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
              // 商社ごとにいちばん新しい旧見積を、有効な見積として戻す（見積の枠が無ければ作る）
              const latest = new Map<string, (typeof p2.quotes)[number]>()
              for (const q of p2.quotes.filter((x) => x.rowId === r.id && x.stale)) latest.set(q.supplierId, q)
              for (const [sid, q] of latest) {
                let live = p2.quotes.find((x) => x.rowId === r.id && x.supplierId === sid && !x.stale)
                if (!live) {
                  // 正式見積の値は旧型式・旧数量に対するもの。概算だけを戻す（正式見積は依頼し直す）
                  live = { ...q, stale: false, staleModel: undefined, formalPrice: null, formalLeadDays: null, formalValidUntil: null, formalRequestNo: undefined }
                  p2.quotes.push(live)
                } else if (live.unitPrice == null && live.leadDays == null) Object.assign(live, { unitPrice: q.unitPrice, leadDays: q.leadDays, moq: q.moq, stock: q.stock, validUntil: q.validUntil })
              }
              // 頼むつもりの商社も旧見積の商社に戻す
              rr.quoteTargets = [...latest.keys()]
              // 旧見積が戻ったので、提出済に戻っていた行は見積中へ（揃っていれば見積済。選定者が選び直す）
              if (rr.status === 'submitted' || rr.status === 'quoted') setStatus(rr, 'quoting')
              normalize(p2, ws)
              // 採用を残した行（数量の変更など）と、採用を外した行（型式の変更など）で知らせを分ける
              const msg = rr.adoptedSupplierId
                ? `${r.id} の旧見積を戻しました（概算。採用はそのまま${rr.flags.reissue ? '。再発行対象: Ctrl+K →「正式見積を依頼」で再発行し、回答を受けてから発注します' : ''}）`
                : `${r.id} の旧見積を戻しました（概算。選定は選び直し、正式見積は依頼し直します）`
              queueMicrotask(() => toast(msg, 'info'))
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
  for (const i of iss) if (i.by.name === s.ws.user.name && (i.status === 'open' || i.status === 'inProgress' || i.status === 'answered')) opts.push({ label: `${i.id} を見送りにする（理由）`, run: () => prompt(`見送り ${i.id}`, { requireText: true }, (_c, t) => issues.wontfixIssue(i.id, t)) })
  return opts
}
function openQuickfix() {
  const s = st()
  const r = cursorRow()
  if (!r) return toast('行を選んでください（↓ で先頭の行へ）', 'info')
  const options = quickfixOptions(r, s.cursorCol)
  // 順番に直すモードでは、どの問題でも「飛ばして次へ」を選べる（候補の無い問題・提案つきの指摘で止まらない）
  if (s.sequence)
    options.push({
      label: '飛ばして次の問題へ（この問題はそのまま。Esc で順番に直すモードを終わる）',
      // 進むのは選んだあとの順番に直すモードの処理（ここで進めると 2 つ進む）
      run: () => undefined,
    })
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
  }
  if (i.by.name === s.ws.user.name) {
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
        else {
          const was = r.adoptedSupplierId ?? null
          prompt('1位以外を選ぶ理由（数字か ↑↓ で選んで Enter）', { options: [...adopt.ADOPT_REASONS], index: -1, placeholder: '補足（任意）', showText: true, digitsSelect: true }, (c, t) => void adopt.adoptChoose(r.id, supplierId, (c ?? 'その他') + (t ? `: ${t}` : ''), was))
        }
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
    const blank = user.role === 'design' ? s.project().rows.filter((r) => r.status === 'draft' && r.publishedRev == null && !r.name && !r.model).length : 0
    return toast(user.role === 'design' ? `公開するもの（下書き・未公開の変更）はありません${errs ? `。エラーのある行が ${errs} 行あります（F8 で移動）` : ''}${blank ? `。部品名も型式も無い下書きの行 ${blank} 行は公開しません（入れてから Ctrl+Enter）` : ''}` : user.role === 'purchasing' ? '発行する下書きの指摘はありません（Alt+Shift+I で起票）' : '公開するものはありません（PM は y / Shift+Y で決定）', 'info')
  }
  // 先にゲートを確かめる（理由を聞いてから拒否しない）
  const gate = plan.blockedErrors[0] ?? plan.blockedWarnings[0]
  if (plan.blockedErrors.length) return toast(`公開できません: エラー ${plan.blockedErrors.length} 件（${gate.rowId} ${gate.message} … F8 で移動して直す）`, 'err')
  if (plan.blockedWarnings.length) return toast(`公開できません: 未確認の警告 ${plan.blockedWarnings.length} 件（${gate.rowId} ${gate.message} … 直すか Alt+x で確認済みに）`, 'err')
  if (plan.deferred.length) return toast(`公開できません: 「あとで」にした問題が ${plan.deferred.length} 行に残っています（${plan.deferred[0]}）`, 'err')
  // ダイアログを開いたときの行だけを公開する（開いているあいだに別のタブで変わった・足した行を、同じ理由で一緒に出さない）
  const ids = rowIds ?? [...plan.rows.map((r) => r.id), ...plan.cancelled]
  // 開いたあとに別のタブでその行の中身（取消・値）が変わったら、確定の前に止めて確かめ直させる
  const sig = () => {
    const p2 = st().project()
    return JSON.stringify(ids.map((id) => { const r = p2.rows.find((x) => x.id === id); return r && [r.status, r.working ?? null, r.removal ?? null, r.hidden ?? false] }))
  }
  const before = sig()
  const changed = () => {
    if (sig() === before) return false
    toast('ダイアログを開いたあとに、公開する行が別のタブで変わりました（取消・値の変更）。公開していません。もう一度 Ctrl+Enter で中身を確かめてから公開してください', 'err')
    return true
  }
  if (plan.nonIssueChanges.length && user.role === 'design') {
    prompt(`変更セット（${plan.nonIssueChanges.length} 行: ${plan.nonIssueChanges.slice(0, 5).join(', ')}${plan.nonIssueChanges.length > 5 ? ' …' : ''}）の理由。数字か ↑↓ で選び、変更番号（任意）を入れて Enter`, { options: [...CHANGE_REASONS], index: -1, placeholder: '変更番号（任意。例: ECN-2026-012）', showText: true, digitsSelect: true }, (choice, text) => {
      if (changed()) return
      rows.publish(ids, { reason: (choice as ChangeReason) ?? 'その他', changeNo: text })
    })
    return
  }
  if (plan.canAppend && plan.rows.length) {
    prompt('公開の Rev（購買がまだ確認していない直前の Rev があります）', { options: ['新しい Rev', '直前の Rev に追記'], showText: false }, (choice) => void (!changed() && rows.publish(ids, undefined, choice === '直前の Rev に追記' ? 'append' : 'new')))
    return
  }
  rows.publish(rowIds)
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
      if (ms.length !== 2) return '担当者は「設計,購買」の 2 人をカンマ区切りで入れてください'
      if (ms.some((x) => !x)) return '担当者の名前を 2 人とも入れてください（未定なら「未定」など）'
      // 役割ごとに別の人として記録する（同じ名前だと Undo・「自分の」指摘の記録が混ざる）
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
        const [d, pu] = toHalf(v).split(/[,、]/).map((x) => x.trim())
        extraCommits.push(() => s.commit('担当者を変更', (p2) => void (p2.members = { design: d ?? '', purchasing: pu ?? '' })))
        break
      }
      case 'supplierIds': {
        const ids = v.split(/[,、\s]+/).filter(Boolean).map((id) => s.ws.suppliers.find((x) => x.id === id || x.name === id)!.id)
        // 相見積先が変わったら、待つ商社・見積済の判定も見直す
        extraCommits.push(() => s.commit('相見積先を設定', (p2, ws2) => {
          p2.supplierIds = [...new Set(ids)]
          normalize(p2, ws2)
        }))
        break
      }
      case 'selector':
        patch[k] = /^(purchasing|購買)$/.test(v) ? 'purchasing' : 'design'
        break
      case 'quoteCompleteRule':
        patch[k] = /^(all|全社)$/.test(v) ? 'all' : /^(min2|2社以上)$/.test(v) ? 'min2' : 'deadline'
        break
      case 'holidays':
        patch.holidays = v.split(/[,、\s]+/).filter(Boolean).map((h) => (parseDate(h) as { value: string }).value)
        break
      case 'qtyTolerancePct':
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
  if (!Object.keys(patch).length) {
    extraCommits.forEach((f) => f())
    closePanel()
    return toast(extraCommits.length ? '案件設定を保存しました' : '変更はありません', 'info')
  }
  const needImpact = 'dueDate' in patch || 'processDays' in patch || 'weights' in patch
  const finish = (opts?: { fixedNeed?: 'shift' | 'keep' }) => {
    extraCommits.forEach((f) => f())
    applySettings(patch as Parameters<typeof applySettings>[0], opts)
    closePanel()
    toast('案件設定を保存しました', 'ok')
  }
  if (needImpact) {
    const im = simulateSettings(p, { dueDate: patch.dueDate as string | null | undefined, processDays: patch.processDays as number | undefined, weights: patch.weights as Project['weights'] | undefined })
    const lines = [
      `納期NG になる行: ${im.leadNG.length}（${Object.entries(im.leadNG.reduce((m, x) => ({ ...m, [x.status]: (m[x.status] ?? 0) + 1 }), {} as Record<string, number>)).map(([k, n]) => `${k} ${n}`).join(' / ') || 'なし'}）`,
      `推奨が変わる行: ${im.recommendChanged.length}（${im.recommendChanged.slice(0, 8).join(', ')}）`,
      `行必要日が固定の行: ${im.fixedNeed.length}（${im.fixedNeed.join(', ')}）`,
      `正式依頼中で必要納期が変わる行（再発行対象）: ${im.reissue.length}`,
      `総額差（推奨で選び直した場合）: ${im.totalDelta >= 0 ? '+' : ''}¥${Math.round(im.totalDelta).toLocaleString()}`,
    ]
    openPanel({
      kind: 'impact',
      title: '影響試算（確定前）',
      lines,
      onConfirm: () => {
        if (im.fixedNeed.length) prompt('固定必要日の行の扱い', { options: ['同じ日数だけ前倒し', '据え置き'], showText: false }, (choice) => finish({ fixedNeed: choice?.includes('据え置き') ? 'keep' : 'shift' }))
        else finish()
      },
    })
    return
  }
  finish()
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
    const before = backupsSnapshot()
    const go = (backedUp: boolean) => {
      if (!replaceWorkspace(ws)) {
        restoreBackupsSnapshot(before)
        return toast('保存領域が足りないため戻せませんでした（いまの内容のまま。退避も前のまま）', 'err')
      }
      toast(`退避したデータに戻しました（案件 ${ws.projects.length} 件）${backedUp ? '' : '。いまの内容は退避していません'}`, backedUp ? 'ok' : 'info')
    }
    if (saveBackup(JSON.stringify(cur), '退避からの復元の前')) return go(true)
    // 退避できないまま戻さない（JSON の読み込みと同じく、もう一度確かめる）
    confirmDanger('保存領域がいっぱいで、いまの内容を退避できませんでした。戻すといまの内容は失われます。先に Ctrl+K →「JSON を書き出す」で保存するのが安全です', '退避せずに戻す（いまの内容は戻せません）', () => go(false))
  })
}
function exportBackup(b: Backup) {
  const blob = new Blob([b.raw], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  const d = new Date(b.at)
  const pad = (n: number) => String(n).padStart(2, '0')
  a.download = `bom-workspace-backup-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}.json`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 5000)
  toast(`退避したデータを書き出しました（${a.download}・${b.reason}）`, 'ok')
}

/** ワークスペースを丸ごと置き換える（JSON 読み込み・退避からの復元）。Undo 履歴は別の内容のものなので消す */
function replaceWorkspace(ws: Workspace): boolean {
  const prev = st().ws
  const ok = st().commitWs('', (w) => {
    w.projects = ws.projects
    w.stock = ws.stock
    w.purchases = ws.purchases
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
  ensureCursor()
  return true
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
  switch (id) {
    case 'palette.open':
      return openPanel({ kind: 'palette', query: '', index: 0 })
    case 'project.switch':
      return set({ screen: 'active', panel: null, mode: 'nav' })
    case 'project.save':
      if (!s.commitWs('', () => {})) return
      return toast('保存しました（編集は自動で保存されています）', 'ok')
    case 'undo':
    case 'redo': {
      // 戻した・やり直した結果、カーソルの行が消えた（置換で作った行など）ときは近くの行へ
      const before = vm().rows.map((x) => x.id)
      if (id === 'undo') s.undoLast()
      else s.redoLast()
      keepCursorVisible(before)
      return
    }
    case 'export.excel': {
      const done = (label: string, sid?: string) => (m: typeof import('@/io/excel')) =>
        m
          .exportBomExcel(s.ws, p, label === 'internal' ? 'internal' : label === 'supplier' ? 'supplier' : 'archive', sid)
          .then(() => toast(`Excel を出力しました（${label === 'internal' ? '社内、BOM・変更点・チェック結果の 3 シート' : label === 'supplier' ? `商社向け${sid ? `・${s.ws.suppliers.find((x) => x.id === sid)?.name}` : ''}、BOM シートのみ・価格なし` : '保管用、全列'}）`, 'ok'))
          .catch((err: Error) => toast(`Excel を出力できませんでした: ${err.message}`, 'err'))
      // 取引停止の商社には商社向けを出さない
      const sups = p.supplierIds.map((id) => s.ws.suppliers.find((x) => x.id === id)).filter((x): x is NonNullable<typeof x> => !!x && x.tradable !== false)
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
      if (!s.cursorRow) return toast('行を選んでいません（↓ で表へ）', 'info')
      return set({ cursorCol: vm().columns[0] })
    case 'move.end':
      if (!s.cursorRow) return toast('行を選んでいません（↓ で表へ）', 'info')
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
      // 行を選んでいないときは足す位置が分からないので足さない（表の最後に足すなら Ctrl+↓ で最後の行へ）
      if (!r && s.project().rows.length) return toast('行を選んでから Shift+Enter（その下に足します。最後に足すときは Ctrl+↓ で最後の行へ）', 'info')
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
        const was = r!.adoptedSupplierId ?? null
        return prompt(`先行採用（見積中）: 最安の ${name} を採用します。理由（数字か ↑↓）`, { options: [...adopt.ADOPT_REASONS], index: -1, placeholder: '補足（任意）', showText: true, digitsSelect: true }, (ch, t) => void adopt.adoptChoose(r!.id, c.supplierId, `最安（スコア無視）・${ch ?? 'その他'}${t ? ': ' + t : ''}`, was))
      }
      adopt.adoptCheapest(r!.id)
      return
    }
    case 'adopt.choose': {
      if (!need()) return
      const err = adopt.canAdopt(p, r!, true)
      if (err) return toast(err, 'err')
      if (!scoreRow(p, r!, s.ws.suppliers).length) return toast('有効な見積がありません（未回答・辞退・期限切れのみ）', 'err')
      return openPanel({ kind: 'adopt', rowId: r!.id, index: 0, was: r!.adoptedSupplierId ?? null })
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
    case 'row.toggleHidden': {
      if (!need()) return
      const before = vm().rows.map((x) => x.id)
      rows.toggleHidden(r!.id)
      keepCursorVisible(before)
      return
    }
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
      return toast(`${colDef(s.cursorCol)?.label} =「${value || '（空）'}」で絞り込みました（Esc か Alt+f で解除）`, 'info')
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
      // カーソルが問題のセルにいればそこから、いなければ次の問題から。前の回で回った問題は数え直す
      resetSequence()
      const here = problemCells().some((x) => x.rowId === s.cursorRow && x.field === s.cursorCol)
      if (!here && !gotoProblem(1)) return
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
      return prompt(`差戻し ${target.id}（理由必須）`, { requireText: true }, (_c, t) => issues.bounceIssue(target.id, t))
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
      const ids = (p.supplierIds.length ? p.supplierIds : p.preferredSupplierIds.length ? p.preferredSupplierIds : tradable.slice(0, 3).map((x) => x.id)).filter((id) => tradableIn(s.ws.suppliers, id))
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
      const working = cand.filter((x) => hasWork(x)).length
      const requote = cand.filter((x) => x.flags.requote && !(x.working && Object.keys(x.working).length)).length
      const n = cand.length - cand.filter((x) => (x.working && Object.keys(x.working).length) || x.flags.requote || s.ws.suppliers.find((y) => y.id === x.adoptedSupplierId)?.tradable === false || x.procurement === '支給品' || x.procurement === '社内在庫').length
      const contested = cand.filter((x) => x.flags.contested && !(x.working && Object.keys(x.working).length)).length
      if (!n) return toast(`依頼できる行がありません（選定済・再発行対象の行なし${working || requote ? `。作業中 ${working} 行・再見積要 ${requote} 行は除外` : ''}）`, 'err')
      return confirmDanger(`正式見積依頼書（社外）を出します: 対象 ${n} 行${contested ? `（拮抗 ${contested} 行を含む）` : ''}${working ? `。作業中 ${working} 行は除外` : ''}。商社に送る書類が作られ、状態が「正式依頼中」になります`, '依頼書を作る', () => void quotes.requestFormalQuotes().then((m) => toast(m, m.startsWith('権限') || m.startsWith('依頼する行') ? 'err' : 'ok')))
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
      const options = adopt.consolidateOptions().map((o) => ({ label: o.label, detail: o.detail, run: () => confirmDanger(`「${o.label}」に集約します。見積済・選定済の行の採用を付け替えます（採用していなかった行も採用します。戻すときは Ctrl+Z）`, '集約する', () => adopt.applyConsolidation(o.supplierIds)) }))
      if (!options.length) return toast('集約できる行がありません（見積済・選定済の行なし）', 'info')
      return openPanel({ kind: 'consolidate', index: 0, options })
    }
    case 'settings':
      return openSettings()
    case 'project.new':
      return set({ screen: 'new', panel: null, mode: 'nav' })
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
          // Excel のファイル（中身が PK で始まる zip）は JSON ではない。部品表はガイドから読む
          // 表（タブ区切り・CSV）を貼った・選んだときも、部品表はガイドから
          if (!/^\s*[{[]/.test(text) && (text.includes('\t') || /^[^\n]*,[^\n]*\n/.test(text))) return toast('これは表（タブ区切り・CSV）です。部品表は Ctrl+K →「新しいBOM」→「1 貼り付け」か「2 ファイル」から読み込みます（JSON を読み込む は、JSON を書き出す で作ったファイル用）', 'err')
          if (text.startsWith('PK')) return toast('これは Excel のファイル（.xlsx）です。部品表は Ctrl+K →「新しいBOM」→「2 ファイル」から読み込みます（JSON を読み込む は、JSON を書き出す で作ったファイル用）', 'err')
          try {
            raw = JSON.parse(text)
          } catch (err) {
            return toast(`JSON として読めません（JSON を書き出す で作ったファイルを選んでください。詳細: ${(err as Error).message}）`, 'err')
          }
          const res = sanitizeWorkspace(raw)
          if (!res.ws) return toast(`読み込めません: ${res.error}`, 'err')
          const ws = res.ws
          const cur = st().ws
          const before = backupsSnapshot()
          // 読み込んだ内容を今の規則で整える（取引停止にした商社の採用・見積済の判定など。読み込んだ直後の依頼に古い状態を使わない）
          setSupplierMaster(ws.suppliers)
          try {
            for (const pj of ws.projects) normalize(pj, ws)
          } catch (e) {
            setSupplierMaster(st().ws.suppliers)
            return toast(`読み込んだデータを整えられないので読み込みませんでした（${(e as Error).message}）。いまの内容のままです`, 'err')
          }
          setSupplierMaster(st().ws.suppliers)
          const done = (backedUp: boolean) => {
            if (!replaceWorkspace(ws)) {
              // 読み込みをやめたので、今とった退避も取り消す（前の「読み込み前」の退避を押し出したままにしない）
              restoreBackupsSnapshot(before)
              return toast('保存領域が足りないため読み込みませんでした（いまの内容のまま。退避も前のまま）。「退避データを消す」で空きを作ってから読み込んでください', 'err')
            }
            toast(`JSON を読み込みました（案件 ${ws.projects.length} 件）${res.warnings?.length ? `。外した・直した項目 ${res.warnings.length} 件: ${res.warnings.slice(0, 3).join(' / ')}${res.warnings.length > 3 ? ' ほか' : ''}` : ''}${backedUp ? '。戻すときは Ctrl+K →「読み込み前に戻す」' : '（退避なし）'}`, res.warnings?.length ? 'info' : 'ok')
          }
          confirmDanger(`全案件（いま ${cur.projects.length} 件）を JSON の ${ws.projects.length} 件で置き換えます。置き換える前の内容は退避し、Ctrl+K →「読み込み前に戻す」で戻せます`, '置き換える', () => {
            if (saveBackup(JSON.stringify(cur), 'JSON 読み込みの前')) return done(true)
            // 退避できないまま置き換えない（戻せると言って戻せない状態にしない）
            confirmDanger('保存領域がいっぱいで、いまの内容を退避できませんでした。先に Ctrl+K →「JSON を書き出す」で保存してから読み込むのが安全です', '退避せずに置き換える（戻せません）', () => done(false))
          })
        },
      })
    case 'order.restore': {
      if (!need()) return
      const r0 = r!
      if (s.user().role !== 'purchasing') return toast('権限なし（発注は購買）', 'err')
      const notYet = rows.cancelApprovedNotYet(s.project(), r0)
      if (!rows.awaitingReplacement(s.project(), r0) && !notYet) return toast(`${r0.id} は発注後変更依頼の承認で発注を取り消す・取り消した行ではありません`, 'info')
      return confirmDanger(`${r0.id} を${notYet ? '発注済のまま残します' : '発注済に戻します'}。取引先がキャンセルを受けなかったときだけ使います（置き換えはやめ、発注後変更依頼は「キャンセル不可」で閉じます）`, notYet ? '発注済のまま残す' : '発注済に戻す', () => {
        const e = rows.restoreOrder(r0.id)
        toast(e ?? `${r0.id} を${notYet ? '発注済のまま残しました' : '発注済に戻しました'}（キャンセル不可）`, e ? 'err' : 'ok')
      })
    }
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
      return prompt('役割を切り替え（ログイン）。数字か ↑↓ で役割、氏名を入れて Enter', { digitsSelect: true, options: ['設計', '購買'], index: ['design', 'purchasing'].indexOf(role), placeholder: '氏名（空なら案件の担当者名）', showText: true }, (choice, name) => {
        // 数字だけの氏名は、選び直すつもりの数字が入ったことが多い（履歴に残る名前になる）
        if (/^[\d\s０-９]+$/.test(name.trim())) return `氏名が「${name.trim()}」です。数字だけの氏名にはできません（数字で役割を選ぶときは Shift+Tab で選択肢へ）`
        switchRole(choice === '購買' ? 'purchasing' : 'design', name)
      })
    default:
      if (id.startsWith('view.')) {
        // 行を選んでいないときに素の数字で切り替えたら、行は選ばないまま（続けて打った文字が先頭の行のセルに入らない。↓ で表へ）
        const noRow = !st().cursorRow
        setView(Number(id.slice(5)) as ViewId)
        if (noRow && e && (/^(Digit|Numpad)\d$/.test(e.code) || /^\d$/.test(e.key))) set({ cursorRow: null })
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

export const STATIC: Array<{ id: string; label: string; section: string; desc?: string; keywords?: string }> = [
  { id: 'publish', label: '公開（提出 / 指摘を発行）', section: '流れ', desc: '自分の未公開の行と下書き指摘', keywords: '提出 送る 送信 submit 出す 発行 購買へ' },
  { id: 'quotes.request', label: '概算見積を依頼', section: '流れ', desc: '購買。商社向け依頼 Excel を出す', keywords: '見積 依頼 相見積 rfq' },
  { id: 'quotes.import', label: '見積回答を取り込む', section: '流れ', desc: '購買。貼り付けで突合', keywords: '回答 取込 取り込み インポート import ファイル 見積書' },
  { id: 'adopt.bulkBest', label: '未採用を推奨で一括採用', section: '流れ', keywords: 'まとめて 全部 一括' },
  { id: 'adopt.bulkCheapest', label: '未採用を最安で一括採用（スコア無視）', section: '流れ', keywords: 'まとめて 安い' },
  { id: 'consolidate', label: '商社を集約', section: '流れ', desc: '1社/2社に集約した総額差を試算', keywords: 'まとめる 集約' },
  { id: 'quotes.formal', label: '正式見積を依頼（社外）', section: '流れ', desc: '購買。選定済の行を商社ごとに', keywords: '正式 依頼書' },
  { id: 'export.selection', label: '選定記録を出力（社内）', section: '流れ', desc: 'スコア内訳つき', keywords: '記録 スコア' },
  { id: 'undo', label: '元に戻す', section: '編集', keywords: 'undo 戻る 取り消し もどす' },
  { id: 'redo', label: 'やり直す', section: '編集', keywords: 'redo やりなおし やり直し' },
  { id: 'project.save', label: '保存', section: '編集', desc: '編集は自動で保存されています', keywords: 'save 保存 ほぞん' },
  { id: 'row.delete', label: '行を削除（提出済なら取消）', section: '編集', keywords: '削除 消す delete 取消 取り消し キャンセル cancel やめる' },
  { id: 'row.insertBelow', label: '行を追加', section: '編集', keywords: '追加 新しい行 挿入 insert' },
  { id: 'settings', label: '案件設定', section: '案件', desc: 'PM 項目 / 購買項目。納期変更は影響試算つき', keywords: '設定 納期 期限 回答期限 予算 重み 担当 相見積先 選定者 閾値 理由' },
  { id: 'project.new', label: '新規作成（案件を登録）', section: '案件', keywords: '新規 作成 new 作る 案件 取り込み 取込 インポート csv excel xlsx ファイル 貼り付け 読み込む 読み込み excel読み込み エクセル エクセル読み込み bomを読み込む bom読み込み 部品表を読み込む 部品表読み込み' },
  { id: 'project.switch', label: '作成中の案件一覧へ', section: '案件', keywords: '開く 案件 案件を開く 一覧 受信箱 inbox 切り替え' },
  { id: 'rule.add', label: 'ルールを追加', section: 'チェック' },
  { id: 'export.excel', label: 'Excelで出力', section: '出力', keywords: 'エクセル excel xlsx 出力 印刷 ダウンロード 書き出す エクスポート export' },
  { id: 'copy.formatted', label: '表示中の行と列を書式つきでコピー', section: '出力', keywords: 'コピー メール 貼る' },
  { id: 'data.exportJson', label: 'JSON を書き出す', section: 'データ', keywords: 'バックアップ 退避 書き出し jsonエクスポート' },
  { id: 'data.importJson', label: 'JSON を読み込む', section: 'データ', keywords: '復元 読み込み' },
  { id: 'data.restoreBackup', label: '読み込み前に戻す（退避したデータに戻す）', section: 'データ', keywords: '復元 戻す 元に戻す 退避 バックアップ' },
  { id: 'order.restore', label: 'キャンセル不可で発注に戻す（発注後変更依頼のあと）', section: '購買', keywords: 'キャンセル 取り消し 断られた 戻す 発注 発注後変更' },
  { id: 'data.clearBackups', label: '退避データを消す（保存領域を空ける）', section: 'データ', keywords: '容量 空き 削除 退避 バックアップ' },
  { id: 'data.exportBackup', label: '退避したデータを書き出す', section: 'データ', keywords: '退避 バックアップ 壊れた 保存データ' },
  { id: 'data.reset', label: 'サンプルデータに戻す', section: 'データ', keywords: '初期化 リセット' },
  { id: 'supplier.add', label: '商社を追加', section: '案件', keywords: '商社 マスタ' },
  { id: 'role.switch', label: '役割を切り替え（ログイン）', section: '案件', keywords: 'ログイン 設計 購買 pm ユーザー 切り替え 購買に切り替え 設計に切り替え pmに切り替え 担当' },
  { id: 'history', label: '履歴', section: '案件', keywords: 'ログ 変更履歴 誰が' },
  { id: 'theme.toggle', label: 'ダークモード切替', section: '表示', keywords: 'ダーク 暗い 暗く 明るく ライト テーマ 色' },
  { id: 'density.toggle', label: 'コンパクト表示切替', section: '表示', keywords: '行の高さ 小さく 大きく 文字 拡大 縮小 見やすく' },
  { id: 'sort.asc', label: '今の列で並び替え', section: '表示', desc: 'ID の列で s 昇順 / Shift+S 降順（ほかの列では Alt+s / Alt+Shift+S）。列見出しのクリックでも', keywords: 'ソート sort 並べ替え 順番' },
  { id: 'filter.focus', label: '絞り込み検索', section: '表示', desc: 'Ctrl+F で入力欄へ', keywords: 'フィルタ filter 検索 探す さがす' },
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
    const row0 = p.rows.find((x) => x.id === id)
    // 購買には、PM 承認待ちの変更セットで足した行は出さない（名前も操作も）
    const row = row0
    if (row) {
      // パレットの表示どおり「R040 を置換」と打っても当たるように、先頭の「を」は無視する
      // 表示どおりの「R040 を置換」「R040 へジャンプ」「R040 を 因幡電機 で採用」でも当たる
      const rest = m[2].trim().replace(/^[をへ]\s*/, '')
      // 役割に見せる値（設計の作業中・承認待ちの値は設計にだけ）
      const e = valuesFor(row, s.user().role)
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
              if (!jumpToRow(id)) return
              if (i === 0) adopt.adoptBest(id)
              else {
                const was = st().project().rows.find((x) => x.id === id)?.adoptedSupplierId ?? null
                prompt('1位以外を選ぶ理由（数字か ↑↓ で選んで Enter）', { options: [...adopt.ADOPT_REASONS], index: -1, placeholder: '補足（任意）', showText: true, digitsSelect: true }, (c, t) => void adopt.adoptChoose(id, sc.supplierId, (c ?? 'その他') + (t ? `: ${t}` : ''), was))
              }
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
              // 行へ移れなかったら、いまのカーソルの行に操作しない
              if (jumpToRow(id)) runCommand(cmd)
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
  return ['id', 'ball', 'ref', 'drawing', 'category', 'name', 'model', 'maker', 'qtyNeeded', 'unit', 'packQty', 'procurement', 'makerLock', 'altPolicy', 'designated', 'needOffset', 'needDateFixed', 'needDate', 'tags', 'orderQty', 'adopted', 'score', 'unitPrice', 'amount', 'formalPrice', 'formalDiff', 'lead', 'status', 'due', 'waiting', 'ordered', 'received', 'extraCost', 'extraCostKind', 'note']
}

export { handleKeyDown } from './keyboard'
import { resetSequence } from './keyboard'
export { issues as issueActions, rows as rowActions, ROLE_LABEL, KEYMAP, eventToKey, lookupBinding, ISSUE_KINDS, VIEWS, cursorRow as visibleCursorRow, moveCursorRow, gotoProblem, problemCells, openQuickfix, prompt, confirmDanger, saveSettings }
export type { IssueKind }
