import { Component, useEffect, useMemo, type ReactNode } from 'react'
import { useStore } from '@/model/store'
import { buildViewModel } from '@/model/selectors'
import { Header } from '@/ui/Header'
import { Side } from '@/ui/Side'
import { Grid } from '@/ui/Grid'
import { StatusBar } from '@/ui/StatusBar'
import { Panels } from '@/ui/Panels'
import { commitEdit, handleKeyDown } from '@/commands/registry'
import { STORAGE_KEY, loadProblem, loadUser, parseWorkspace, resetWorkspace, startSync } from '@/io/persist'
import { colDef } from '@/model/columns'
import { fmtDate } from '@/model/dates'

/** 画面が壊れても白画面にしない。データを退避・復旧できるようにする */
class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  componentDidCatch(error: Error) {
    console.error(error)
  }
  render() {
    if (!this.state.error) return this.props.children
    const save = () => {
      const raw = localStorage.getItem(STORAGE_KEY) ?? '{}'
      const a = document.createElement('a')
      a.href = URL.createObjectURL(new Blob([raw], { type: 'application/json' }))
      a.download = 'bom-workspace-backup.json'
      a.click()
    }
    return (
      <div className="crash" data-testid="crash">
        <h2>画面を表示できませんでした</h2>
        <p>データは保存されています。次のどれかを選んでください。</p>
        <pre>{String(this.state.error.message)}</pre>
        <button className="btn" onClick={() => location.reload()}>
          再読み込み
        </button>
        <button className="btn" onClick={save}>
          データを JSON で退避
        </button>
        <button
          className="btn"
          onClick={() => {
            if (confirm('サンプルデータに戻します。いまのデータは消えます（先に退避してください）。よろしいですか？')) {
              resetWorkspace()
              location.reload()
            }
          }}
        >
          サンプルに戻す
        </button>
      </div>
    )
  }
}

function Main() {
  const st = useStore()
  const vm = useMemo(() => buildViewModel(st), [st.ws, st.view, st.sort, st.filter, st.cellFilter, st.hiddenCols, st.collapsed, st.openRows, st.revView])
  useEffect(() => {
    const h = (e: KeyboardEvent) => handleKeyDown(e)
    window.addEventListener('keydown', h)
    // 編集中にリロード・タブを閉じたら、入れていた値を確定する。読めない値なら確認を出す
    const unload = (e: BeforeUnloadEvent) => {
      if (useStore.getState().mode !== 'edit') return
      if (!commitEdit('stay')) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', unload)
    // 保存データを読めなかった・一部を外したときは、黙ってサンプルにしない
    if (loadProblem) useStore.getState().toastMsg(loadProblem, 'err')
    return () => {
      window.removeEventListener('keydown', h)
      window.removeEventListener('beforeunload', unload)
    }
  }, [])
  useEffect(() => {
    try {
      const theme = localStorage.getItem('bom-pro.theme')
      if (theme) document.documentElement.dataset.theme = theme
      const density = localStorage.getItem('bom-pro.density')
      if (density) document.documentElement.dataset.density = density
    } catch {
      /* noop */
    }
    // 別のタブ・ウィンドウでの変更を取り込む（同じブラウザ）
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY || !e.newValue) return
      const ws = parseWorkspace(e.newValue)
      if (!ws) return
      const s = useStore.getState()
      ws.user = loadUser() ?? s.ws.user
      if (ws.projects.some((p) => p.id === s.ws.currentProjectId)) ws.currentProjectId = s.ws.currentProjectId
      useStore.setState({ ws })
    }
    window.addEventListener('storage', onStorage)
    const stop = startSync((ws) => {
      const s = useStore.getState()
      ws.user = s.ws.user
      if (ws.projects.some((p) => p.id === s.ws.currentProjectId)) ws.currentProjectId = s.ws.currentProjectId
      useStore.setState({ ws })
    })
    return () => {
      window.removeEventListener('storage', onStorage)
      stop()
    }
  }, [])
  const p = vm.ctx.p
  const rev = st.revView
  return (
    <div className="app">
      <Header vm={vm} />
      <Side vm={vm} />
      <main className="main">
        <div className="toolbar">
          <input className="filter" placeholder="絞り込み（/ でここへ。Enter で表に戻る、Esc で解除）" value={st.filter} onChange={(e) => st.set({ filter: e.target.value })} data-testid="filter" />
          {st.filter && <span className="muted" style={{ fontSize: 12 }}>{vm.rows.length} 行</span>}
          {st.cellFilter && (
            <span className="chip" style={{ cursor: 'pointer' }} onClick={() => st.set({ cellFilter: null })} title="クリックか f / Esc で解除">
              {colDef(st.cellFilter.col)?.label} = {st.cellFilter.value || '（空）'} ✕
            </span>
          )}
          {st.sort && (
            <span className="chip muted" style={{ cursor: 'pointer' }} onClick={() => st.set({ sort: null })} title="クリックで解除">
              並び替え {colDef(st.sort.col)?.label} {st.sort.dir === 'asc' ? '▲' : '▼'} ✕
            </span>
          )}
          {st.view === 5 && (
            <span className="chip muted" data-testid="rev-filter">
              {rev == null ? '未確認の差分すべて' : `Rev.${rev}`} <kbd>&lt;</kbd>
              <kbd>&gt;</kbd>
            </span>
          )}
          {st.view === 9 && <span className="chip warn">未発行の指摘 {p.issues.filter((i) => i.status === 'draft' && i.by.name === st.ws.user.name).length} 件</span>}
          {st.view === 8 && <span className="chip warn">再発行対象 {p.rows.filter((r) => r.flags.reissue).length} 行</span>}
          {p.submissions.length > 0 && (
            <span className="muted" style={{ marginLeft: 'auto', fontSize: 12, whiteSpace: 'nowrap' }} data-testid="rev-info">
              提出 Rev.{p.submissions.at(-1)!.rev}（{p.submissions.at(-1)!.by.name} {fmtDate(p.submissions.at(-1)!.at.slice(0, 10))}
              {(() => {
                const sm = p.submissions.at(-1)!.summary
                return `, 追加${sm.added} / 型式${sm.modelChanged} / 数量${sm.qtyChanged}`
              })()}
              ）
            </span>
          )}
          {!p.settings.pmConfirmed && p.caseDecisions.some((c) => c.status === 'open') && <span className="chip err">案件設定 未確定（PM）</span>}
        </div>
        <Grid vm={vm} />
      </main>
      <StatusBar vm={vm} />
      <Panels />
    </div>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <Main />
    </ErrorBoundary>
  )
}
