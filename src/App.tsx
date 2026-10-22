import { useEffect, useMemo } from 'react'
import { useStore } from '@/model/store'
import { buildViewModel } from '@/model/selectors'
import { Header } from '@/ui/Header'
import { Side } from '@/ui/Side'
import { Grid } from '@/ui/Grid'
import { StatusBar } from '@/ui/StatusBar'
import { Panels } from '@/ui/Panels'
import { handleKeyDown, updateEditValue } from '@/commands/registry'
import { startSync } from '@/io/persist'
import { colDef } from '@/model/columns'
import { fmtDate } from '@/model/dates'

export default function App() {
  const st = useStore()
  const vm = useMemo(() => buildViewModel(st), [st.ws, st.view, st.sort, st.filter, st.cellFilter, st.hiddenCols, st.collapsed, st.openRows, st.revView])
  useEffect(() => {
    const h = (e: KeyboardEvent) => handleKeyDown(e)
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])
  useEffect(() => {
    const theme = localStorage.getItem('bom-pro.theme')
    if (theme) document.documentElement.dataset.theme = theme
    return startSync((ws) => useStore.setState({ ws }))
  }, [])
  // 編集中の入力値を store に反映（AutoInput ではなく Grid の input）
  useEffect(() => {
    const h = (e: Event) => {
      const t = e.target as HTMLInputElement
      if (t?.classList?.contains('cell')) updateEditValue(t.value)
    }
    window.addEventListener('input', h)
    return () => window.removeEventListener('input', h)
  }, [])
  const p = vm.ctx.p
  const rev = st.revView
  return (
    <div className="app">
      <Header vm={vm} />
      <Side vm={vm} />
      <main className="main">
        <div className="toolbar">
          <input className="filter" placeholder="絞り込み（/ でフォーカス、Enter で戻る）" value={st.filter} onChange={(e) => st.set({ filter: e.target.value })} data-testid="filter" />
          {st.cellFilter && (
            <span className="chip">
              {colDef(st.cellFilter.col)?.label} = {st.cellFilter.value || '（空）'} <kbd>f</kbd>
            </span>
          )}
          {st.sort && (
            <span className="chip muted">
              並び替え {colDef(st.sort.col)?.label} {st.sort.dir === 'asc' ? '▲' : '▼'} <kbd>s</kbd>
            </span>
          )}
          {st.view === 5 && (
            <span className="chip muted" data-testid="rev-filter">
              {rev == null ? '未確認の差分すべて' : `Rev.${rev}`} <kbd>&lt;</kbd>
              <kbd>&gt;</kbd>
            </span>
          )}
          {st.view === 9 && <span className="chip warn">未発行の指摘 {p.issues.filter((i) => i.status === 'draft').length} 件</span>}
          {st.view === 8 && <span className="chip warn">再発行対象 {p.rows.filter((r) => r.flags.reissue).length} 行</span>}
          {p.submissions.length > 0 && (
            <span className="muted" style={{ marginLeft: 'auto', fontSize: 12 }} data-testid="rev-info">
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
