import { create } from 'zustand'
import type { Issue, Project, Quote, Row, User, Workspace } from './types'
import { DESIGN_FIELDS } from './types'
import { makeWorkspace } from './sample'
import { setSupplierMaster } from './rules'
import type { Mode } from '@/keys/keymap'
import { loadIfChangedElsewhere, loadWorkspace, saveWorkspace } from '@/io/persist'

// 保存キーはストアを作る前に定義する（ストアの初期値を読むときに使う。後ろで定義すると初期化前参照で黙って空になる）
const UI_KEY = 'bom-pro.ui'
const HISTORY_KEY = 'bom-pro.history'

export type ViewId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9

export type PanelOption = { label: string; run: () => void; key?: string; hint?: string }

export type Panel =
  | { kind: 'palette'; query: string; index: number }
  | { kind: 'help' }
  | { kind: 'columns'; index: number }
  | { kind: 'issue'; rowId: string; field: string; step: 'kind' | 'text' | 'proposal'; issueKind?: string; index: number; text: string; proposal: { model: string; maker: string; supplierId: string; unitPrice: string; leadDays: string } }
  | { kind: 'adopt'; rowId: string; index: number; reasonFor?: string }
  | { kind: 'prompt'; title: string; options?: string[]; index: number; text: string; placeholder?: string; requireText?: boolean; showText?: boolean; digitsSelect?: boolean; onSubmit: (choice: string | null, text: string, extra?: Record<string, string>) => string | void; extra?: Record<string, string>; danger?: boolean; error?: string }
  | { kind: 'wizard'; step: number; data: Record<string, string>; sel: number; picks: string[]; error?: string }
  | { kind: 'inbox'; index: number; query: string }
  | { kind: 'settings'; index: number; draft: Record<string, string>; editing: boolean; value: string; error?: string; discardArmed?: boolean }
  | { kind: 'quickfix'; title: string; rowId: string; field: string; index: number; options: PanelOption[] }
  | { kind: 'history'; rowId: string; index: number }
  | { kind: 'weights'; rowId: string; index: number }
  | { kind: 'impact'; title: string; lines: string[]; onConfirm: () => void }
  | { kind: 'consolidate'; index: number; options: Array<{ label: string; detail: string; run: () => void }> }
  | { kind: 'export'; index: number; options: PanelOption[] }
  | { kind: 'import'; text: string; title: string; onSubmit: (text: string) => void; accept?: string; placeholder?: string }
  | { kind: 'rule'; rowId: string; field: string; index: number; options: PanelOption[] }
  | { kind: 'replyIssue'; issueId: string; text: string }

type Change<T> = { key: string; before: T | undefined; after: T | undefined }

export interface UndoEntry {
  projectId: string
  by: string
  label: string
  kind: 'normal' | 'publish'
  rows: Change<Row>[]
  quotes: Change<Quote>[]
  issues: Change<Issue>[]
  proj: Change<unknown>[]
  /** 行の並び（行の移動・挿入・複製を戻すとき、元の位置に戻すため） */
  order?: { before: string[]; after: string[] }
}

/** Undo で追う案件レベルの項目（events・version・連番は追わない） */
const PROJECT_KEYS = ['name', 'dueDate', 'settings', 'weights', 'rowWeights', 'submissions', 'decisions', 'supplierIds', 'preferredSupplierIds', 'members', 'caseDecisions', 'requestRevs'] as const

export interface State {
  ws: Workspace
  mode: Mode
  view: ViewId
  cursorRow: string | null
  cursorCol: string
  openRows: string[]
  collapsed: string[]
  sort: { col: string; dir: 'asc' | 'desc' } | null
  filter: string
  cellFilter: { col: string; value: string } | null
  hiddenCols: string[]
  editValue: string
  editCandidates: string[] | null
  editError: string | null
  /** 編集を始めたときの値（別のタブで変わっていないかを確定時に確かめる） */
  editBase: string | null
  /** 6・8 で確定後に自動で始めた入力（空のまま確定したら何も変えない） */
  editAuto?: boolean
  /** Enter で始めた数値・日付の編集は値を全選択して始める（打ち直しが上書きになる。Excel の打ち直しと同じ結果） */
  editSelectAll?: boolean
  panel: Panel | null
  toast: { text: string; kind: 'ok' | 'err' | 'info'; at: number } | null
  revView: number | null
  sequence: boolean
  undo: Record<string, UndoEntry[]>
  /** 取り消せる操作を記録するたびに増える番号（履歴が上限で頭打ちでも、操作が増えたことが分かる） */
  undoSeq: number
  redo: Record<string, UndoEntry[]>
  recentCommands: string[]
  detailIndex: number
  clipboard: string | null
  wizardDraft: { step: number; data: Record<string, string>; sel: number; picks: string[] } | null
  // actions
  set: (p: Partial<State>) => void
  project: () => Project
  user: () => User
  commit: (label: string, fn: (p: Project, ws: Workspace) => void | string, opts?: { rowId?: string; undoable?: boolean; silent?: boolean; kind?: UndoEntry['kind']; quietError?: boolean }) => boolean
  commitWs: (label: string, fn: (ws: Workspace) => void) => boolean
  undoLast: () => void
  redoLast: () => void
  clearHistory: () => void
  toastMsg: (text: string, kind?: 'ok' | 'err' | 'info') => void
}

/** 見積の一意キー（無効化された旧型式の見積は同じ商社に複数あり得るので通し番号を付ける） */
function quoteMap(p: Project): Map<string, Quote> {
  const m = new Map<string, Quote>()
  const seen = new Map<string, number>()
  for (const q of p.quotes) {
    const base = q.rowId + '|' + q.supplierId + (q.stale ? '|stale|' + (q.staleModel ?? '') : '')
    const n = seen.get(base) ?? 0
    seen.set(base, n + 1)
    m.set(q.stale ? base + '|' + n : base, q)
  }
  return m
}

function sameJson(a: unknown, b: unknown) {
  return JSON.stringify(a) === JSON.stringify(b)
}

function diffMaps<T>(before: Map<string, T>, after: Map<string, T>): Change<T>[] {
  const keys = new Set([...before.keys(), ...after.keys()])
  const out: Change<T>[] = []
  for (const k of keys) {
    const b = before.get(k)
    const a = after.get(k)
    if (!sameJson(b, a)) out.push({ key: k, before: b === undefined ? undefined : structuredClone(b), after: a === undefined ? undefined : structuredClone(a) })
  }
  return out
}

function entities(p: Project) {
  return {
    rows: new Map(p.rows.map((r) => [r.id, r])),
    quotes: quoteMap(p),
    issues: new Map(p.issues.map((i) => [i.id, i])),
    proj: new Map<string, unknown>(PROJECT_KEYS.map((k) => [k as string, (p as unknown as Record<string, unknown>)[k]])),
  }
}

export const useStore = create<State>((set, get) => ({
  ws: loadWorkspace() ?? makeWorkspace(),
  mode: 'nav',
  openRows: [],
  collapsed: [],
  ...loadUi(),
  filter: '',
  cellFilter: null,
  hiddenCols: loadUiCols() ?? ['cause', 'drawing', 'tags', 'packQty', 'makerLock', 'needOffset', 'needDateFixed', 'orderQty', 'designated', 'extraCost', 'extraCostKind', 'formalPrice', 'formalDiff'],
  editValue: '',
  editCandidates: null,
  editError: null,
  editBase: null,
  panel: null,
  toast: null,
  revView: null,
  sequence: false,
  undo: loadHistory().undo,
  undoSeq: 0,
  redo: loadHistory().redo,
  recentCommands: loadUiField('recentCommands') ?? [],
  detailIndex: 0,
  clipboard: null,
  wizardDraft: loadUiField('wizardDraft') ?? null,
  set: (p) => set(p),
  project: () => {
    const ws = get().ws
    return ws.projects.find((p) => p.id === ws.currentProjectId) ?? ws.projects[0]
  },
  user: () => get().ws.user,
  commit: (label, fn, opts = {}) => {
    const st = get()
    // 他のタブが保存していれば、その最新を土台にする（後勝ちで消さない）
    const latest = loadIfChangedElsewhere()
    let ws = st.ws
    if (latest) {
      latest.user = st.ws.user
      if (latest.projects.some((x) => x.id === st.ws.currentProjectId)) latest.currentProjectId = st.ws.currentProjectId
      ws = latest
    }
    const p = ws.projects.find((x) => x.id === ws.currentProjectId) ?? ws.projects[0]
    const before = entities(structuredClone(p))
    const next = structuredClone(ws)
    const np = next.projects.find((x) => x.id === p.id)!
    let result: void | string
    try {
      result = fn(np, next)
    } catch (err) {
      console.error(err)
      get().toastMsg(`操作できませんでした: ${(err as Error).message}`, 'err')
      return false
    }
    if (typeof result === 'string') {
      if (latest) set({ ws })
      if (!opts.quietError) get().toastMsg(result, 'err')
      return false
    }
    const after = entities(np)
    const user = ws.user
    const entry: UndoEntry = { projectId: p.id, by: user.name, label, kind: opts.kind ?? 'normal', rows: diffMaps(before.rows, after.rows), quotes: diffMaps(before.quotes, after.quotes), issues: diffMaps(before.issues, after.issues), proj: diffMaps(before.proj, after.proj) }
    const orderBefore = [...before.rows.keys()]
    const orderAfter = np.rows.map((r) => r.id)
    if (orderBefore.join() !== orderAfter.join()) entry.order = { before: orderBefore, after: orderAfter }
    np.version++
    np.updatedAt = new Date().toISOString()
    if (!opts.silent) np.events.push({ id: (np.events.at(-1)?.id ?? 0) + 1, at: np.updatedAt, by: user, rowId: opts.rowId, text: label, undoable: opts.undoable !== false })
    if (np.events.length > 2000) np.events.splice(0, np.events.length - 2000)
    const changed = entry.rows.length + entry.quotes.length + entry.issues.length + entry.proj.length > 0 || !!entry.order
    const uk = userKey(user)
    const undo = changed && opts.undoable !== false ? { ...st.undo, [uk]: [...(st.undo[uk] ?? []), entry].slice(-200) } : st.undo
    set({ ws: next, undo, undoSeq: undo !== st.undo ? st.undoSeq + 1 : st.undoSeq, redo: changed ? { ...st.redo, [uk]: [] } : st.redo })
    persistHistory()
    if (!saveWorkspace(next)) get().toastMsg('保存領域がいっぱいで保存できませんでした。Ctrl+K → JSON を書き出す で退避してください', 'err')
    return true
  },
  commitWs: (label, fn) => {
    const latest = loadIfChangedElsewhere()
    const base = latest ? { ...latest, user: get().ws.user } : get().ws
    const next = structuredClone(base)
    fn(next)
    set({ ws: next })
    // 保存できなかったら黙らない（リロードで消えることを知らせる）
    if (!saveWorkspace(next)) {
      get().toastMsg('保存領域がいっぱいで保存できませんでした。Ctrl+K → JSON を書き出す で退避し、「退避データを消す」で空きを作ってください', 'err')
      return false
    }
    if (label) get().toastMsg(label, 'info')
    return true
  },
  undoLast: () => {
    const st = get()
    const user = userKey(st.ws.user)
    const pid = st.ws.currentProjectId
    const stack = st.undo[user] ?? []
    let idx = -1
    for (let i = stack.length - 1; i >= 0; i--)
      if (stack[i].projectId === pid) {
        idx = i
        break
      }
    if (idx < 0) return st.toastMsg('戻す操作がありません（この案件であなたが行った操作はまだありません）', 'info')
    const entry = stack[idx]
    const rest = [...stack.slice(0, idx), ...stack.slice(idx + 1)]
    if (entry.kind === 'publish') {
      set({ undo: { ...get().undo, [user]: rest } })
      const n = revertPublishAsWorking(entry)
      // 公開した取消・置換は購買に伝わっているので戻さない（必要なら行を追加し直す）
      const removed = entry.rows.filter((c) => c.before && c.after && !['cancelled', 'replaced'].includes(c.before.status) && ['cancelled', 'replaced'].includes(c.after.status)).map((c) => c.key)
      const rm = removed.length ? `取消・置換を公開した ${removed.slice(0, 3).join(', ')} は戻せません（購買に伝わっています。同じ部品が要るときは Shift+Enter で行を追加）。` : ''
      return st.toastMsg(n > 0 ? `${rm}公開済の値を戻しました。Rev は残し、未公開として ${n} 行に積みました（Ctrl+Enter で Rev+1 として公開）` : rm || '公開は取り消せません。追加した行を戻すときは Shift+Delete で取消してください', 'info')
    }
    const conflict = applyEntry(entry, 'undo')
    if (conflict) {
      set({ undo: { ...get().undo, [user]: rest } })
      // 「!」で始まるのは決まりで止めたもの（誰も変えていない）
      if (conflict.startsWith('!')) return st.toastMsg(`戻せません: ${conflict.slice(1)}。この操作は戻さずに飛ばしました（次の Ctrl+Z は 1 つ前の操作）`, 'err')
      return st.toastMsg(`戻せません: ${conflict} は、この操作の後に別の操作（あなたの別の操作・自動の更新・他の人）で変わっています。この操作は戻さずに飛ばしました（次の Ctrl+Z は 1 つ前の操作）。行を開いて履歴を確認してください`, 'err')
    }
    set({ undo: { ...get().undo, [user]: rest }, redo: { ...get().redo, [user]: [...(get().redo[user] ?? []), entry] } })
    persistHistory()
    st.toastMsg(`元に戻す: ${entry.label}`, 'info')
  },
  redoLast: () => {
    const st = get()
    const user = userKey(st.ws.user)
    const pid = st.ws.currentProjectId
    const stack = st.redo[user] ?? []
    let idx = -1
    for (let i = stack.length - 1; i >= 0; i--)
      if (stack[i].projectId === pid) {
        idx = i
        break
      }
    if (idx < 0) return st.toastMsg('やり直す操作がありません', 'info')
    const entry = stack[idx]
    const rest = [...stack.slice(0, idx), ...stack.slice(idx + 1)]
    const conflict = applyEntry(entry, 'redo')
    if (conflict) {
      set({ redo: { ...get().redo, [user]: rest } })
      if (conflict.startsWith('!')) return st.toastMsg(`やり直せません: ${conflict.slice(1)}。この操作は飛ばしました（次の Ctrl+Y は 1 つ前に戻した操作）`, 'err')
      return st.toastMsg(`やり直せません: ${conflict} は、元に戻した後に別の操作（あなたの別の操作・自動の更新・他の人）で変わっています。この操作は飛ばしました（次の Ctrl+Y は 1 つ前に戻した操作）`, 'err')
    }
    set({ redo: { ...get().redo, [user]: rest }, undo: { ...get().undo, [user]: [...(get().undo[user] ?? []), entry] } })
    persistHistory()
    st.toastMsg(`やり直す: ${entry.label}`, 'info')
  },
  clearHistory: () => {
    set({ undo: {}, redo: {} })
    persistHistory()
  },
  toastMsg: (text, kind = 'ok') => set({ toast: { text, kind, at: Date.now() } }),
}))

/** Undo 履歴は「役割:氏名」ごと（同じ氏名でも役割が違えば別） */
export function userKey(u: User): string {
  return `${u.role}:${u.name}`
}

// ---------- 画面の状態（タブごと。リロードしても同じビュー・セル・ガイドの途中から） ----------
type UiSaved = Pick<State, 'view' | 'cursorRow' | 'cursorCol' | 'sort' | 'hiddenCols' | 'recentCommands' | 'wizardDraft'>
function readUi(): Partial<UiSaved> {
  try {
    return JSON.parse(sessionStorage.getItem(UI_KEY) ?? '{}') ?? {}
  } catch {
    return {}
  }
}
function loadUi(): Pick<State, 'view' | 'cursorRow' | 'cursorCol' | 'sort'> {
  const u = readUi()
  return { view: (typeof u.view === 'number' && u.view >= 1 && u.view <= 9 ? u.view : 1) as ViewId, cursorRow: typeof u.cursorRow === 'string' ? u.cursorRow : null, cursorCol: typeof u.cursorCol === 'string' ? u.cursorCol : 'name', sort: u.sort && typeof u.sort.col === 'string' ? u.sort : null }
}
function loadUiCols(): string[] | null {
  const c = readUi().hiddenCols
  return Array.isArray(c) && c.every((x) => typeof x === 'string') ? c : null
}
function loadUiField<K extends 'recentCommands' | 'wizardDraft'>(k: K): UiSaved[K] | undefined {
  return readUi()[k] as UiSaved[K] | undefined
}
let uiTimer: number | undefined
// 指定先のチェックに使う商社マスタ
setSupplierMaster(useStore.getState().ws.suppliers)
useStore.subscribe((s, prev) => {
  if (s.ws.suppliers !== prev.ws.suppliers) setSupplierMaster(s.ws.suppliers)
})
useStore.subscribe((s, prev) => {
  if (s.view === prev.view && s.cursorRow === prev.cursorRow && s.cursorCol === prev.cursorCol && s.sort === prev.sort && s.hiddenCols === prev.hiddenCols && s.recentCommands === prev.recentCommands && s.wizardDraft === prev.wizardDraft && s.panel === prev.panel) return
  window.clearTimeout(uiTimer)
  uiTimer = window.setTimeout(writeUi, 200)
})
function writeUi() {
  window.clearTimeout(uiTimer)
  {
    const st = useStore.getState()
    // ガイドを開いている間は、入れている途中の内容も下書きとして残す
    const wizardDraft = st.panel?.kind === 'wizard' ? { step: st.panel.step, data: st.panel.data, sel: st.panel.sel, picks: st.panel.picks } : st.wizardDraft
    const saved: UiSaved = { view: st.view, cursorRow: st.cursorRow, cursorCol: st.cursorCol, sort: st.sort, hiddenCols: st.hiddenCols, recentCommands: st.recentCommands, wizardDraft }
    try {
      sessionStorage.setItem(UI_KEY, JSON.stringify(saved))
    } catch {
      /* 保存できなくても動作は続ける */
    }
  }
}

/** Undo 履歴はタブごとに保存し、リロードしても残す */
function loadHistory(): { undo: Record<string, UndoEntry[]>; redo: Record<string, UndoEntry[]> } {
  try {
    const raw = sessionStorage.getItem(HISTORY_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    /* noop */
  }
  return { undo: {}, redo: {} }
}
let histTimer: number | undefined
function persistHistory() {
  window.clearTimeout(histTimer)
  histTimer = window.setTimeout(writeHistory, 300)
}
function writeHistory() {
  window.clearTimeout(histTimer)
  {
    const { undo, redo } = useStore.getState()
    const trim = (m: Record<string, UndoEntry[]>) => Object.fromEntries(Object.entries(m).map(([k, v]) => [k, v.slice(-50)]))
    try {
      sessionStorage.setItem(HISTORY_KEY, JSON.stringify({ undo: trim(undo), redo: trim(redo) }))
    } catch {
      try {
        sessionStorage.setItem(HISTORY_KEY, JSON.stringify({ undo: Object.fromEntries(Object.entries(undo).map(([k, v]) => [k, v.slice(-10)])), redo: {} }))
      } catch {
        /* 入りきらなければ保存しない */
      }
    }
  }
}
// リロード・タブを閉じる直前に、まだ書いていない履歴と画面の状態を書く（操作の直後に閉じても Undo を失わない）
if (typeof window !== 'undefined')
  window.addEventListener('pagehide', () => {
    writeHistory()
    writeUi()
  })

function labelOf(kind: string, key: string): string {
  if (kind === 'quote') return `${key.split('|')[0]} の見積`
  if (kind === 'proj') return `案件の${{ settings: '設定', decisions: '決定', submissions: '提出', dueDate: '納期', weights: '重み' }[key] ?? key}`
  return key
}

/** 現在が after と一致するときだけ before に戻す。一つでも食い違えば何も変えず、食い違った箇所を返す */
/** 衝突の知らせに出す項目名 */
const FIELD_LABEL_JA: Record<string, string> = { ref: '回路記号', drawing: '図面番号', category: '分類', name: '部品名', model: '型式', maker: 'メーカ', qtyNeeded: '必要数', unit: '単位', packQty: '入数', procurement: '調達区分', makerLock: 'メーカ指定', altPolicy: '代替可否', designated: '指定先', needOffset: '必要日(前倒し)', needDateFixed: '必要日(固定)', tags: '規格', note: '備考', status: '状態', orderQty: '発注数', adoptedSupplierId: '採用', ordered: '発注', received: '入荷', promisedDate: '入荷予定', receivedLot: 'ロット', extraCost: '追加費用', hidden: '非表示' }

/** now（いまの値）に from→to の変更を項目ごとに当てる。from から変わっている項目に触れるなら、その項目名を返す */
function mergeFields(now: Row | undefined, from: Row | undefined, to: Row | undefined): { value: Row | undefined } | string {
  if (!from || !to) return sameJson(now, from) ? { value: to } : '行の追加・削除'
  if (!now) return '行（後から削除された）'
  const out = structuredClone(now) as unknown as Record<string, unknown>
  const f = from as unknown as Record<string, unknown>
  const t = to as unknown as Record<string, unknown>
  const n = now as unknown as Record<string, unknown>
  for (const k of new Set([...Object.keys(f), ...Object.keys(t)])) {
    if (sameJson(f[k], t[k])) continue
    // フラグ・作業中の値・承認待ちの値は、中の項目ごとに突き合わせる（別の列の作業中の変更とはぶつからない）
    if (k === 'flags' || k === 'working' || k === 'pendingApproval') {
      const ff = (f[k] ?? {}) as Record<string, unknown>
      const tf = (t[k] ?? {}) as Record<string, unknown>
      const nf = (n[k] ?? {}) as Record<string, unknown>
      const of = { ...nf }
      for (const fk of new Set([...Object.keys(ff), ...Object.keys(tf)])) {
        if (sameJson(ff[fk], tf[fk])) continue
        if (!sameJson(nf[fk], ff[fk])) return k === 'flags' ? `状態（${fk}）` : `「${FIELD_LABEL_JA[fk] ?? fk}」`
        if (tf[fk] === undefined) delete of[fk]
        else of[fk] = structuredClone(tf[fk])
      }
      out[k] = k === 'flags' || Object.keys(of).length ? of : undefined
      continue
    }
    if (!sameJson(n[k], f[k])) return `「${FIELD_LABEL_JA[k] ?? k}」`
    if (t[k] === undefined) delete out[k]
    else out[k] = structuredClone(t[k])
  }
  return { value: out as unknown as Row }
}

/**
 * この操作で位置が変わった行だけを、target の並びでの直前の行の後ろへ戻す。
 * 他の人・他のタブが後から動かした行はそのまま（全体を昔の並びに戻さない）
 */
function moveBack(rows: Row[], from: string[], target: string[]): Row[] {
  const prevIn = (list: string[], id: string) => list[list.indexOf(id) - 1] ?? null
  // 動いた行 = 2 つの並びの最長共通部分列に入らない行（入れ替えなら片方の行だけ）
  const common = new Set(lcs(from.filter((id) => target.includes(id)), target.filter((id) => from.includes(id))))
  const moved = target.filter((id) => !common.has(id))
  let out = [...rows]
  for (const id of moved) {
    const row = out.find((r) => r.id === id)
    if (!row) continue
    out = out.filter((r) => r.id !== id)
    const prev = prevIn(target, id)
    const at = prev ? out.findIndex((r) => r.id === prev) + 1 : 0
    out.splice(at < 0 ? out.length : at, 0, row)
  }
  return out
}

/** 最長共通部分列。行の並びは同じ ID の並べ替えなので、位置の最長増加部分列で O(n log n) に求める（行数の上限なし） */
function lcs(a: string[], b: string[]): string[] {
  const pos = new Map(b.map((id, i) => [id, i]))
  const seq = a.filter((id) => pos.has(id))
  const tails: number[] = []
  const tailIdx: number[] = []
  const prev: number[] = new Array(seq.length).fill(-1)
  seq.forEach((id, i) => {
    const v = pos.get(id)!
    let lo = 0
    let hi = tails.length
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (tails[mid] < v) lo = mid + 1
      else hi = mid
    }
    tails[lo] = v
    tailIdx[lo] = i
    prev[i] = lo > 0 ? tailIdx[lo - 1] : -1
  })
  const out: string[] = []
  for (let i = tailIdx[tails.length - 1] ?? -1; i >= 0; i = prev[i]) out.unshift(seq[i])
  return out
}

function applyEntry(entry: UndoEntry, dir: 'undo' | 'redo'): string | null {
  const st = useStore.getState()
  const latest = loadIfChangedElsewhere()
  const base = latest ? { ...latest, user: st.ws.user, currentProjectId: st.ws.currentProjectId } : st.ws
  const next = structuredClone(base)
  const p = next.projects.find((x) => x.id === entry.projectId)
  if (!p) return '案件'
  const cur = entities(p)
  // 行は項目ごと（flags はフラグごと）に突き合わせる。自分が変えた項目を後から誰かが変えたときだけ衝突にし、
  // 同じ行の別の項目（自動更新のフラグ・他の人が変えた列）はそのまま残す
  const rowValues = new Map<string, Row | undefined>()
  for (const c of entry.rows) {
    const from = (dir === 'undo' ? c.after : c.before) as Row | undefined
    const to = (dir === 'undo' ? c.before : c.after) as Row | undefined
    const now = cur.rows.get(c.key) as Row | undefined
    // 発注後変更依頼（PM の判断）がある行の発注は、Ctrl+Z で外さない（PM の却下を迂回しない。§9.1）
    if (entry.label !== 'キャンセル不可で発注に戻す' && now?.ordered && from?.ordered && to && !to.ordered && p.issues.some((i) => i.rowId === c.key && i.kind === '発注後変更依頼')) return `!${c.key} の発注は、発注後変更依頼で PM が判断しているので Ctrl+Z・Ctrl+Y では外しません（外すのは PM の承認のあと、購買の o）`
    const m = mergeFields(now, from, to)
    if (typeof m === 'string') return `${c.key} の${m}`
    rowValues.set(c.key, m.value)
  }
  const groups: Array<[string, Change<unknown>[], Map<string, unknown>]> = [
    ['quote', entry.quotes, cur.quotes],
    ['issue', entry.issues, cur.issues],
    ['proj', entry.proj, cur.proj],
  ]
  for (const [kind, changes, map] of groups)
    for (const c of changes) {
      const expected = dir === 'undo' ? c.after : c.before
      if (!sameJson(map.get(c.key), expected)) return labelOf(kind, c.key)
    }
  const put = <T,>(list: T[], keyOf: (x: T) => string, key: string, value: T | undefined) => {
    const idx = list.findIndex((x) => keyOf(x) === key)
    if (value === undefined) {
      if (idx >= 0) list.splice(idx, 1)
    } else if (idx >= 0) list[idx] = structuredClone(value)
    else list.push(structuredClone(value))
  }
  for (const c of entry.rows) put(p.rows, (r) => r.id, c.key, rowValues.get(c.key))
  for (const c of entry.issues) put(p.issues, (i) => i.id, c.key, dir === 'undo' ? c.before : c.after)
  if (entry.quotes.length) {
    const qm = quoteMap(p)
    for (const c of entry.quotes) {
      const v = dir === 'undo' ? c.before : c.after
      if (v === undefined) qm.delete(c.key)
      else qm.set(c.key, structuredClone(v))
    }
    p.quotes = [...qm.values()]
  }
  for (const c of entry.proj) (p as unknown as Record<string, unknown>)[c.key] = structuredClone(dir === 'undo' ? c.before : c.after)
  if (entry.order) p.rows = moveBack(p.rows, dir === 'undo' ? entry.order.after : entry.order.before, dir === 'undo' ? entry.order.before : entry.order.after)
  p.version++
  p.updatedAt = new Date().toISOString()
  p.events.push({ id: (p.events.at(-1)?.id ?? 0) + 1, at: p.updatedAt, by: st.ws.user, text: `${dir === 'undo' ? '元に戻す' : 'やり直す'}: ${entry.label}` })
  useStore.setState({ ws: next })
  saveWorkspace(next)
  return null
}

/** 公開の Ctrl+Z: Rev は消さず、公開前の設計列を作業中として積む（flow-design §1） */
function revertPublishAsWorking(entry: UndoEntry): number {
  let n = 0
  useStore.getState().commit(
    '公開を戻す（未公開として積む）',
    (p) => {
      for (const c of entry.rows) {
        const before = c.before
        const r = p.rows.find((x) => x.id === c.key)
        if (!before || !r || before.publishedRev == null || before.status === 'draft') continue
        const w: Record<string, unknown> = { ...(r.working ?? {}) }
        for (const f of DESIGN_FIELDS) {
          const bv = (before as unknown as Record<string, unknown>)[f]
          const cv = (r as unknown as Record<string, unknown>)[f]
          if (!sameJson(bv, cv)) w[f] = bv
          else delete w[f]
        }
        r.working = Object.keys(w).length ? (w as Row['working']) : undefined
        if (r.working) n++
      }
    },
    { undoable: true },
  )
  return n
}

export function currentProject(): Project {
  return useStore.getState().project()
}
