import { useStore } from '@/model/store'
import { ROLE_LABEL, ROLES } from '@/model/types'
import { ballCounts, daysLeft, isOverdue, openIssues, totals, fmtYen } from '@/model/derive'
import type { ViewModel } from '@/model/selectors'
import { syncEnabled } from '@/io/persist'

export function Header({ vm }: { vm: ViewModel }) {
  const st = useStore()
  const p = vm.ctx.p
  const user = st.ws.user
  const bc = ballCounts(p)
  const t = totals(p)
  const dl = daysLeft(p)
  const errs = [...vm.problems.values()].flat().filter((x) => x.severity === 'error').length
  const warns = [...vm.problems.values()].flat().filter((x) => x.severity === 'warn').length
  const overdue = p.rows.filter((r) => isOverdue(p, r)).length
  const myIssues = p.rows.filter((r) => openIssues(p, r.id).some((i) => i.status === 'open' || i.status === 'inProgress')).length
  const selecting = p.rows.filter((r) => r.status === 'quoted' && !r.adoptedSupplierId).length
  const pct = t.budget ? ((t.formal - t.budget) / t.budget) * 100 : null
  const adoptedN = p.rows.filter((r) => r.adoptedSupplierId && r.status !== 'cancelled' && r.status !== 'replaced').length
  return (
    <header className="header" data-testid="header">
      <span className="pid">{p.id}</span>
      <span className="pname">{p.name}</span>
      <span className={'due' + (dl.need != null && dl.need < 7 ? ' urgent' : '')} data-testid="due">
        {p.dueDate ? `納期 あと${dl.due}日（必要日 あと${dl.need}日）` : '納期 未定'}
        {!p.settings.pmConfirmed && <span className="chip warn" style={{ marginLeft: 6 }}>仮</span>}
      </span>
      <span className="muted mono" data-testid="money">
        概算 {fmtYen(t.rough, p.settings.currency)} / 正式 {fmtYen(t.formal, p.settings.currency)}（採用 {adoptedN} 行）
        {t.budget != null && (
          <>
            {' '}
            / 予算 {fmtYen(t.budget, p.settings.currency)} <span className={pct! > 0 ? 'warn-text' : ''}>({pct! >= 0 ? '+' : ''}{pct!.toFixed(1)}%)</span>
          </>
        )}
      </span>
      <span className="muted">{p.settings.pmConfirmed ? '重み：確定' : '重み：既定（未確定）'}</span>
      <span className="spacer" />
      <span className="lamps" data-testid="lamps">
        <span className={'lamp ' + (user.role === 'design' ? 'accent' : '')} title={`指摘 ${myIssues}・選定待ち ${selecting}`}>
          設計待ち {bc.design}
        </span>
        <span className={'lamp ' + (user.role === 'purchasing' ? 'accent' : '')}>購買待ち {bc.purchasing}</span>
        <span className={'lamp ' + (user.role === 'pm' ? 'accent' : '')}>PM待ち {bc.pm}</span>
        <span className={'lamp ' + (errs ? 'err' : '')}>エラー {errs}</span>
        <span className={'lamp ' + (warns ? 'warn' : '')}>警告 {warns}</span>
        {overdue > 0 && <span className="lamp err">期限超過 {overdue}</span>}
      </span>
      <span className="role" title="役割（ログイン）。Ctrl+K → 役割を切り替え">
        {ROLES.map((r) => (
          <button key={r} aria-pressed={user.role === r} onClick={() => st.commitWs(`役割: ${ROLE_LABEL[r]}`, (ws) => { ws.user = { ...ws.user, role: r, name: ws.projects.find((x) => x.id === ws.currentProjectId)?.members[r] || ws.user.name } })}>
            {ROLE_LABEL[r]}
          </button>
        ))}
      </span>
      <span className="muted">{user.name}{syncEnabled() ? ' · 共有' : ''}</span>
      <button className="btn" onClick={() => st.set({ panel: { kind: 'palette', query: '', index: 0 }, mode: 'palette' })}>
        <kbd>Ctrl+K</kbd> コマンド
      </button>
    </header>
  )
}
