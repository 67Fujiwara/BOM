import { useStore, type ViewId } from '@/model/store'
import { setView, runCommand, commitEdit } from '@/commands/registry'
import { VIEWS } from '@/model/views'
import type { ViewModel } from '@/model/selectors'
import { onCommandCell } from '@/commands/keyboard'

export function Side({ vm }: { vm: ViewModel }) {
  const st = useStore()
  return (
    <nav className="side" data-testid="side">
      <h3>ビュー</h3>
      {VIEWS.map((v) => {
        const n = vm.counts[v.id]
        const cls = 'n'
        return (
          <div key={v.id} className="view" aria-current={st.view === v.id} onClick={() => setView(v.id as ViewId)} data-testid={`view-${v.id}`}>
            <span className="k" title={st.mode === 'nav' && !onCommandCell(String(v.id)) ? '文字を打てるセルでは数字は値になるので、Alt を押しながら' : undefined}>{st.mode === 'nav' && !onCommandCell(String(v.id)) ? `Alt+${v.id}` : v.id}</span>
            <span>{v.label}</span>
            <span className={cls}>{n}</span>
          </div>
        )
      })}
      <h3 style={{ marginTop: 16 }}>案件</h3>
      {st.ws.projects.filter((p) => !p.completed || p.id === st.ws.currentProjectId).map((p) => (
        <div key={p.id} className="view" aria-current={p.id === st.ws.currentProjectId} onClick={() => { if (!commitEdit('stay')) return; st.commitWs('', (ws) => { ws.currentProjectId = p.id }); st.set({ cursorRow: null, filter: '', cellFilter: null, openRows: [] }) }}>
          <span style={{ fontSize: 12 }} title={`${p.customer} ${p.name}`.trim()}>{p.id} {p.name}</span>
        </div>
      ))}
      <h3 style={{ marginTop: 16 }}>ヒント</h3>
      <div className="muted" style={{ fontSize: 11, padding: '0 8px', lineHeight: 1.7 }}>
        <span className="clickable" onClick={() => runCommand('help')}><kbd>F1</kbd> ショートカット一覧</span><br />
        <span className="clickable" onClick={() => runCommand('palette.open')}><kbd>Ctrl+K</kbd> すべての操作</span><br />
        <span className="clickable" onClick={() => runCommand('project.switch')}><kbd>Ctrl+P</kbd> 作成中の案件一覧</span><br />
        <span className="clickable" onClick={() => runCommand('project.new')}>＋ 新規作成（案件を登録）</span>
      </div>
    </nav>
  )
}
