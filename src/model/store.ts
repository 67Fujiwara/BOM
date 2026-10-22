import { create } from 'zustand'
import type { Issue, Project, Quote, Row, User, Workspace } from './types'
import { DESIGN_FIELDS } from './types'
import { makeWorkspace } from './sample'
import type { Mode } from '@/keys/keymap'
import { loadIfChangedElsewhere, loadWorkspace, saveWorkspace } from '@/io/persist'

export type ViewId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9

export type PanelOption = { label: string; run: () => void; key?: string; hint?: string }

export type Panel =
  | { kind: 'palette'; query: string; index: number }
  | { kind: 'help' }
  | { kind: 'columns'; index: number }
  | { kind: 'issue'; rowId: string; field: string; step: 'kind' | 'text' | 'proposal'; issueKind?: string; index: number; text: string; proposal: { model: string; maker: string; supplierId: string; unitPrice: string; leadDays: string } }
  | { kind: 'adopt'; rowId: string; index: number; reasonFor?: string }
  | { kind: 'prompt'; title: string; options?: string[]; index: number; text: string; placeholder?: string; requireText?: boolean; showText?: boolean; onSubmit: (choice: string | null, text: string) => void; extra?: Record<string, string>; danger?: boolean }
  | { kind: 'wizard'; step: number; data: Record<string, string>; sel: number; picks: string[]; error?: string }
  | { kind: 'inbox'; index: number; query: string }
  | { kind: 'settings'; index: number; draft: Record<string, string>; editing: boolean; value: string; error?: string }
  | { kind: 'quickfix'; title: string; rowId: string; field: string; index: number; options: PanelOption[] }
  | { kind: 'history'; rowId: string; index: number }
  | { kind: 'weights'; rowId: string; index: number }
  | { kind: 'impact'; title: string; lines: string[]; onConfirm: () => void }
  | { kind: 'consolidate'; index: number; options: Array<{ label: string; detail: string; run: () => void }> }
  | { kind: 'export'; index: number; options: PanelOption[] }
  | { kind: 'import'; text: string; title: string; onSubmit: (text: string) => void }
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
  panel: Panel | null
  toast: { text: string; kind: 'ok' | 'err' | 'info'; at: number } | null
  revView: number | null
  sequence: boolean
  undo: Record<string, UndoEntry[]>
  redo: Record<string, UndoEntry[]>
  recentCommands: string[]
  detailIndex: number
  clipboard: string | null
  wizardDraft: { step: number; data: Record<string, string>; sel: number; picks: string[] } | null
  // actions
  set: (p: Partial<State>) => void
  project: () => Project
  user: () => User
  commit: (label: string, fn: (p: Project, ws: Workspace) => void | string, opts?: { rowId?: string; undoable?: boolean; silent?: boolean; kind?: UndoEntry['kind'] }) => boolean
  commitWs: (label: string, fn: (ws: Workspace) => void) => void
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
  view: 1,
  cursorRow: null,
  cursorCol: 'name',
  openRows: [],
  collapsed: [],
  sort: null,
  filter: '',
  cellFilter: null,
  hiddenCols: ['drawing', 'tags', 'packQty', 'makerLock', 'needOffset', 'needDateFixed', 'orderQty', 'designated', 'extraCost', 'extraCostKind', 'formalPrice', 'formalDiff'],
  editValue: '',
  editCandidates: null,
  editError: null,
  panel: null,
  toast: null,
  revView: null,
  sequence: false,
  undo: {},
  redo: {},
  recentCommands: [],
  detailIndex: 0,
  clipboard: null,
  wizardDraft: null,
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
      get().toastMsg(result, 'err')
      return false
    }
    const after = entities(np)
    const user = ws.user
    const entry: UndoEntry = { projectId: p.id, by: user.name, label, kind: opts.kind ?? 'normal', rows: diffMaps(before.rows, after.rows), quotes: diffMaps(before.quotes, after.quotes), issues: diffMaps(before.issues, after.issues), proj: diffMaps(before.proj, after.proj) }
    np.version++
    np.updatedAt = new Date().toISOString()
    if (!opts.silent) np.events.push({ id: (np.events.at(-1)?.id ?? 0) + 1, at: np.updatedAt, by: user, rowId: opts.rowId, text: label, undoable: opts.undoable !== false })
    if (np.events.length > 2000) np.events.splice(0, np.events.length - 2000)
    const changed = entry.rows.length + entry.quotes.length + entry.issues.length + entry.proj.length > 0
    const undo = changed && opts.undoable !== false ? { ...st.undo, [user.name]: [...(st.undo[user.name] ?? []), entry].slice(-200) } : st.undo
    set({ ws: next, undo, redo: changed ? { ...st.redo, [user.name]: [] } : st.redo })
    if (!saveWorkspace(next)) get().toastMsg('保存領域がいっぱいで保存できませんでした。Ctrl+K → JSON を書き出す で退避してください', 'err')
    return true
  },
  commitWs: (label, fn) => {
    const latest = loadIfChangedElsewhere()
    const base = latest ? { ...latest, user: get().ws.user } : get().ws
    const next = structuredClone(base)
    fn(next)
    set({ ws: next })
    saveWorkspace(next)
    if (label) get().toastMsg(label, 'info')
  },
  undoLast: () => {
    const st = get()
    const user = st.ws.user.name
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
      return st.toastMsg(n > 0 ? `公開済の値を戻しました。Rev は残し、未公開として ${n} 行に積みました（Ctrl+Enter で Rev+1 として公開）` : '公開は取り消せません。追加した行を戻すときは Shift+Delete で取消してください', 'info')
    }
    const conflict = applyEntry(entry, 'undo')
    if (conflict) {
      set({ undo: { ...get().undo, [user]: rest } })
      return st.toastMsg(`戻せません: ${conflict} を後から別の操作（他の人を含む）が変更しています。行を開いて履歴を確認してください`, 'err')
    }
    set({ undo: { ...get().undo, [user]: rest }, redo: { ...get().redo, [user]: [...(get().redo[user] ?? []), entry] } })
    st.toastMsg(`元に戻す: ${entry.label}`, 'info')
  },
  redoLast: () => {
    const st = get()
    const user = st.ws.user.name
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
      return st.toastMsg(`やり直せません: ${conflict} を後から別の操作が変更しています`, 'err')
    }
    set({ redo: { ...get().redo, [user]: rest }, undo: { ...get().undo, [user]: [...(get().undo[user] ?? []), entry] } })
    st.toastMsg(`やり直す: ${entry.label}`, 'info')
  },
  clearHistory: () => set({ undo: {}, redo: {} }),
  toastMsg: (text, kind = 'ok') => set({ toast: { text, kind, at: Date.now() } }),
}))

function labelOf(kind: string, key: string): string {
  if (kind === 'quote') return `${key.split('|')[0]} の見積`
  if (kind === 'proj') return `案件の${{ settings: '設定', decisions: '決定', submissions: '提出', dueDate: '納期', weights: '重み' }[key] ?? key}`
  return key
}

/** 現在が after と一致するときだけ before に戻す。一つでも食い違えば何も変えず、食い違った箇所を返す */
function applyEntry(entry: UndoEntry, dir: 'undo' | 'redo'): string | null {
  const st = useStore.getState()
  const latest = loadIfChangedElsewhere()
  const base = latest ? { ...latest, user: st.ws.user, currentProjectId: st.ws.currentProjectId } : st.ws
  const next = structuredClone(base)
  const p = next.projects.find((x) => x.id === entry.projectId)
  if (!p) return '案件'
  const cur = entities(p)
  const groups: Array<[string, Change<unknown>[], Map<string, unknown>]> = [
    ['row', entry.rows, cur.rows],
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
  for (const c of entry.rows) put(p.rows, (r) => r.id, c.key, dir === 'undo' ? c.before : c.after)
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
