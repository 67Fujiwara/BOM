import { useStore, type ViewId } from '@/model/store'
import { VIEWS } from '@/model/views'
import type { ViewModel } from '@/model/selectors'

export function Side({ vm }: { vm: ViewModel }) {
  const st = useStore()
  return (
    <nav className="side" data-testid="side">
      <h3>ビュー</h3>
      {VIEWS.map((v) => {
        const n = vm.counts[v.id]
        const cls = v.id === 4 && n ? 'n err' : v.id === 7 && n ? 'n warn' : 'n'
        return (
          <div key={v.id} className="view" aria-current={st.view === v.id} onClick={() => st.set({ view: v.id as ViewId, cursorRow: null })} data-testid={`view-${v.id}`}>
            <span className="k">{v.id}</span>
            <span>{v.label}</span>
            <span className={cls}>{n}</span>
          </div>
        )
      })}
      <h3 style={{ marginTop: 16 }}>案件</h3>
      {st.ws.projects.map((p) => (
        <div key={p.id} className="view" aria-current={p.id === st.ws.currentProjectId} onClick={() => st.commitWs('', (ws) => { ws.currentProjectId = p.id })}>
          <span style={{ fontSize: 12 }}>{p.name}</span>
        </div>
      ))}
      <h3 style={{ marginTop: 16 }}>ヒント</h3>
      <div className="muted" style={{ fontSize: 11, padding: '0 8px', lineHeight: 1.7 }}>
        <kbd>?</kbd> ショートカット一覧<br />
        <kbd>Ctrl+K</kbd> すべての操作<br />
        <kbd>Ctrl+P</kbd> 受信箱・案件
      </div>
    </nav>
  )
}
