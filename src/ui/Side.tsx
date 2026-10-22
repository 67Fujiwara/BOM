import { useStore, type ViewId } from '@/model/store'
import { setView, runCommand } from '@/commands/registry'
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
          <div key={v.id} className="view" aria-current={st.view === v.id} onClick={() => setView(v.id as ViewId)} data-testid={`view-${v.id}`}>
            <span className="k">{v.id}</span>
            <span>{v.label}</span>
            <span className={cls}>{n}</span>
          </div>
        )
      })}
      <h3 style={{ marginTop: 16 }}>案件</h3>
      {st.ws.projects.map((p) => (
        <div key={p.id} className="view" aria-current={p.id === st.ws.currentProjectId} onClick={() => { st.commitWs('', (ws) => { ws.currentProjectId = p.id }); st.set({ cursorRow: null, filter: '', cellFilter: null, openRows: [] }) }}>
          <span style={{ fontSize: 12 }}>{p.name}</span>
        </div>
      ))}
      <h3 style={{ marginTop: 16 }}>ヒント</h3>
      <div className="muted" style={{ fontSize: 11, padding: '0 8px', lineHeight: 1.7 }}>
        <span className="clickable" onClick={() => runCommand('help')}><kbd>?</kbd> ショートカット一覧</span><br />
        <span className="clickable" onClick={() => runCommand('palette.open')}><kbd>Ctrl+K</kbd> すべての操作</span><br />
        <span className="clickable" onClick={() => runCommand('project.switch')}><kbd>Ctrl+P</kbd> 受信箱・案件</span><br />
        <span className="clickable" onClick={() => runCommand('project.new')}>＋ 新しいBOM</span>
      </div>
    </nav>
  )
}
