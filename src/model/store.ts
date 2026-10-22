import { create } from 'zustand'
import type { Issue, Project, Quote, Row, User, Workspace } from './types'
import { makeWorkspace } from './sample'
import type { Mode } from '@/keys/keymap'
import { loadWorkspace, saveWorkspace } from '@/io/persist'

export type ViewId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9

export type Panel =
  | { kind: 'palette'; query: string; index: number }
  | { kind: 'help' }
  | { kind: 'columns'; index: number }
  | { kind: 'issue'; rowId: string; field: string; step: 'kind' | 'text' | 'proposal'; issueKind?: string; text: string; proposal: { model: string; maker: string; supplierId: string; unitPrice: string; leadDays: string } }
  | { kind: 'adopt'; rowId: string; index: number; reasonFor?: string }
  | { kind: 'prompt'; title: string; options?: string[]; index: number; text: string; placeholder?: string; requireText?: boolean; onSubmit: (choice: string | null, text: string) => void; extra?: Record<string, string> }
  | { kind: 'wizard'; step: number; data: Record<string, string>; sel: number; picks: string[] }
  | { kind: 'inbox'; index: number; query: string }
  | { kind: 'settings'; index: number; draft: Record<string, string>; editing: boolean; value: string }
  | { kind: 'quickfix'; rowId: string; field: string; index: number; options: Array<{ label: string; run: () => void }> }
  | { kind: 'history'; rowId: string; index: number }
  | { kind: 'weights'; rowId: string; index: number }
  | { kind: 'impact'; title: string; lines: string[]; onConfirm: () => void }
  | { kind: 'consolidate'; index: number; options: Array<{ label: string; detail: string; run: () => void }> }
  | { kind: 'export'; index: number; options: Array<{ label: string; run: () => void }> }
  | { kind: 'import'; text: string; title: string; onSubmit: (text: string) => void }
  | { kind: 'rule'; rowId: string; field: string; index: number; options: Array<{ label: string; run: () => void }> }
  | { kind: 'replyIssue'; issueId: string; text: string }

export interface UndoEntry {
  by: string
  label: string
  rows: Row[]
  quotes: Quote[]
  issues: Issue[]
  rowIds: string[]
  quoteKeys: string[]
  issueIds: string[]
  project: Pick<Project, 'dueDate' | 'settings' | 'weights' | 'rowWeights' | 'submissions' | 'decisions' | 'supplierIds' | 'name'>
}

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
  panel: Panel | null
  toast: { text: string; kind: 'ok' | 'err' | 'info'; at: number } | null
  revView: number | null
  sequence: boolean
  undo: Record<string, UndoEntry[]>
  redo: Record<string, UndoEntry[]>
  recentCommands: string[]
  detailIndex: number
  clipboard: string | null
  // actions
  set: (p: Partial<State>) => void
  project: () => Project
  user: () => User
  commit: (label: string, fn: (p: Project, ws: Workspace) => void | string, opts?: { rowId?: string; undoable?: boolean; silent?: boolean }) => void
  commitWs: (label: string, fn: (ws: Workspace) => void) => void
  undoLast: () => void
  redoLast: () => void
  toastMsg: (text: string, kind?: 'ok' | 'err' | 'info') => void
}

function quoteKey(q: Quote) {
  return q.rowId + '|' + q.supplierId
}

function snapshotEntities(p: Project): { rows: Map<string, Row>; quotes: Map<string, Quote>; issues: Map<string, Issue> } {
  return { rows: new Map(p.rows.map((r) => [r.id, structuredClone(r)])), quotes: new Map(p.quotes.map((q) => [quoteKey(q), structuredClone(q)])), issues: new Map(p.issues.map((i) => [i.id, structuredClone(i)])) }
}

function sameJson(a: unknown, b: unknown) {
  return JSON.stringify(a) === JSON.stringify(b)
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
  panel: null,
  toast: null,
  revView: null,
  sequence: false,
  undo: {},
  redo: {},
  recentCommands: [],
  detailIndex: 0,
  clipboard: null,
  set: (p) => set(p),
  project: () => {
    const ws = get().ws
    return ws.projects.find((p) => p.id === ws.currentProjectId) ?? ws.projects[0]
  },
  user: () => get().ws.user,
  commit: (label, fn, opts = {}) => {
    const st = get()
    const ws = st.ws
    const p = st.project()
    const before = snapshotEntities(p)
    const beforeProj = structuredClone({ dueDate: p.dueDate, settings: p.settings, weights: p.weights, rowWeights: p.rowWeights, submissions: p.submissions, decisions: p.decisions, supplierIds: p.supplierIds, name: p.name })
    const next = structuredClone(ws)
    const np = next.projects.find((x) => x.id === p.id)!
    const result = fn(np, next)
    if (typeof result === 'string') {
      get().toastMsg(result, 'err')
      return
    }
    // 差分を undo エントリに
    const after = snapshotEntities(np)
    const rowIds = new Set<string>([...before.rows.keys(), ...after.rows.keys()])
    const changedRows = [...rowIds].filter((id) => !sameJson(before.rows.get(id), after.rows.get(id)))
    const qKeys = new Set<string>([...before.quotes.keys(), ...after.quotes.keys()])
    const changedQuotes = [...qKeys].filter((k) => !sameJson(before.quotes.get(k), after.quotes.get(k)))
    const iIds = new Set<string>([...before.issues.keys(), ...after.issues.keys()])
    const changedIssues = [...iIds].filter((id) => !sameJson(before.issues.get(id), after.issues.get(id)))
    const user = ws.user
    const entry: UndoEntry = {
      by: user.name,
      label,
      rows: changedRows.map((id) => before.rows.get(id)).filter(Boolean) as Row[],
      quotes: changedQuotes.map((k) => before.quotes.get(k)).filter(Boolean) as Quote[],
      issues: changedIssues.map((id) => before.issues.get(id)).filter(Boolean) as Issue[],
      rowIds: changedRows,
      quoteKeys: changedQuotes,
      issueIds: changedIssues,
      project: beforeProj,
    }
    np.version++
    np.updatedAt = new Date().toISOString()
    if (!opts.silent) np.events.push({ id: (np.events.at(-1)?.id ?? 0) + 1, at: np.updatedAt, by: user, rowId: opts.rowId, text: label, undoable: opts.undoable !== false })
    if (np.events.length > 2000) np.events.splice(0, np.events.length - 2000)
    const undo = { ...st.undo, [user.name]: [...(st.undo[user.name] ?? []), entry].slice(-200) }
    set({ ws: next, undo, redo: { ...st.redo, [user.name]: [] } })
    saveWorkspace(next)
  },
  commitWs: (label, fn) => {
    const next = structuredClone(get().ws)
    fn(next)
    set({ ws: next })
    saveWorkspace(next)
    if (label) get().toastMsg(label, 'info')
  },
  undoLast: () => {
    const st = get()
    const user = st.ws.user.name
    const stack = st.undo[user] ?? []
    const entry = stack.at(-1)
    if (!entry) return st.toastMsg('戻す操作がありません', 'info')
    const redoEntry = applyEntry(st, entry)
    set({ undo: { ...st.undo, [user]: stack.slice(0, -1) }, redo: { ...st.redo, [user]: [...(st.redo[user] ?? []), redoEntry] } })
    st.toastMsg(`元に戻す: ${entry.label}`, 'info')
  },
  redoLast: () => {
    const st = get()
    const user = st.ws.user.name
    const stack = st.redo[user] ?? []
    const entry = stack.at(-1)
    if (!entry) return st.toastMsg('やり直す操作がありません', 'info')
    const undoEntry = applyEntry(st, entry)
    set({ redo: { ...st.redo, [user]: stack.slice(0, -1) }, undo: { ...st.undo, [user]: [...(st.undo[user] ?? []), undoEntry] } })
    st.toastMsg(`やり直す: ${entry.label}`, 'info')
  },
  toastMsg: (text, kind = 'ok') => set({ toast: { text, kind, at: Date.now() } }),
}))

/** エントリを適用し、逆向きのエントリを返す（エンティティ単位。他人の変更は触らない） */
function applyEntry(st: State, entry: UndoEntry): UndoEntry {
  const next = structuredClone(st.ws)
  const p = next.projects.find((x) => x.id === next.currentProjectId)!
  const cur = snapshotEntities(p)
  const inverse: UndoEntry = { ...entry, rows: [], quotes: [], issues: [], project: structuredClone({ dueDate: p.dueDate, settings: p.settings, weights: p.weights, rowWeights: p.rowWeights, submissions: p.submissions, decisions: p.decisions, supplierIds: p.supplierIds, name: p.name }) }
  for (const id of entry.rowIds) {
    const c = cur.rows.get(id)
    if (c) inverse.rows.push(c)
    const b = entry.rows.find((r) => r.id === id)
    const idx = p.rows.findIndex((r) => r.id === id)
    if (b) {
      if (idx >= 0) p.rows[idx] = structuredClone(b)
      else p.rows.push(structuredClone(b))
    } else if (idx >= 0) p.rows.splice(idx, 1)
  }
  for (const k of entry.quoteKeys) {
    const c = cur.quotes.get(k)
    if (c) inverse.quotes.push(c)
    const b = entry.quotes.find((q) => quoteKey(q) === k)
    const idx = p.quotes.findIndex((q) => quoteKey(q) === k)
    if (b) {
      if (idx >= 0) p.quotes[idx] = structuredClone(b)
      else p.quotes.push(structuredClone(b))
    } else if (idx >= 0) p.quotes.splice(idx, 1)
  }
  for (const id of entry.issueIds) {
    const c = cur.issues.get(id)
    if (c) inverse.issues.push(c)
    const b = entry.issues.find((i) => i.id === id)
    const idx = p.issues.findIndex((i) => i.id === id)
    if (b) {
      if (idx >= 0) p.issues[idx] = structuredClone(b)
      else p.issues.push(structuredClone(b))
    } else if (idx >= 0) p.issues.splice(idx, 1)
  }
  Object.assign(p, structuredClone(entry.project))
  p.version++
  useStore.setState({ ws: next })
  saveWorkspace(next)
  return inverse
}

export function currentProject(): Project {
  return useStore.getState().project()
}
