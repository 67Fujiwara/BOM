import { useStore } from '@/model/store'
import { ROLE_LABEL, ROLES } from '@/model/types'
import { ballCounts, daysLeft, designBreakdown, isOverdue, isQuotable, totals, fmtYen } from '@/model/derive'
import type { ViewModel } from '@/model/selectors'
import { syncEnabled } from '@/io/persist'
import { runCommand, switchRole } from '@/commands/registry'

/** ボタンを押してもフォーカスを表に残す（Space / Enter が表の操作として効くように） */
const keepFocus = (e: React.MouseEvent) => e.preventDefault()

export function Header({ vm }: { vm: ViewModel }) {
  const st = useStore()
  const p = vm.ctx.p
  const user = st.ws.user
  const bc = ballCounts(p)
  const t = totals(p)
  const dl = daysLeft(p)
  const all = [...vm.problems.values()].flat()
  const errs = all.filter((x) => x.severity === 'error').length
  const warns = all.filter((x) => x.severity === 'warn').length
  const overdue = p.rows.filter((r) => isOverdue(p, r)).length
  const db = designBreakdown(p)
  // 見積の進み具合（§3.4 の分母: 支給品・社内在庫を除き、指定系を含む）
  const quotable = p.rows.filter((r) => isQuotable(r) && r.status !== 'draft')
  const quotedN = quotable.filter((r) => ['quoted', 'selected', 'formalRequested', 'formalQuoted', 'ordered', 'received'].includes(r.status)).length
  const pct = t.budget && Number.isFinite(t.budget) && t.budget > 0 ? ((t.formal - t.budget) / t.budget) * 100 : null
  const adoptedN = p.rows.filter((r) => r.adoptedSupplierId && r.status !== 'cancelled' && r.status !== 'replaced').length
  return (
    <header className="header" data-testid="header">
      <div className="hdr-left">
        <span className="pid">{p.id}</span>
        <span className="pname" title={p.name}>
          {p.name}
        </span>
        <span className={'due' + (dl.need != null && dl.need < 7 ? ' urgent' : '')} data-testid="due" title="必要日 = 納期 − 社内工程日数">
          {p.dueDate ? `納期 ${dayText(dl.due)}（必要日 ${dayText(dl.need)}）` : '納期 未定'}
          {!p.settings.pmConfirmed && <span className="chip warn" style={{ marginLeft: 6 }} title="納期・工程日数・予算・重みは PM の確定前（仮）">仮</span>}
        </span>
        <span className="muted mono hdr-money" data-testid="money" title={`採用 ${adoptedN} 行の合計。重み：${p.settings.pmConfirmed ? '確定' : '既定（未確定）'}`}>
          概算 {fmtYen(t.rough, p.settings.currency)} / 正式 {fmtYen(t.formal, p.settings.currency)}
          {t.budget != null && pct != null && (
            <>
              {' '}
              / 予算 {fmtYen(t.budget, p.settings.currency)} <span className={pct > 0 ? 'warn-text' : ''}>({pct >= 0 ? '+' : ''}{pct.toFixed(1)}%)</span>
            </>
          )}
        </span>
      </div>
      <span className="lamps" data-testid="lamps">
        <span className={'lamp ' + (user.role === 'design' ? 'accent keep' : '')} title={`設計待ちの内訳: 指摘の対応 ${db.issues}・選定待ち ${db.selecting}・その他 ${db.other}`}>
          設計待ち {bc.design}
          {user.role === 'design' && (db.issues || db.selecting) ? (
            <span className="lamp-sub">
              （指摘 {db.issues}・選定待ち {db.selecting}
              {db.other ? `・その他 ${db.other}` : ''}）
            </span>
          ) : null}
        </span>
        <span className={'lamp ' + (user.role === 'purchasing' ? 'accent keep' : '')}>購買待ち {bc.purchasing}</span>
        <span className={'lamp ' + (user.role === 'pm' ? 'accent keep' : '')}>PM待ち {bc.pm}</span>
        {user.role !== 'design' && quotable.length > 0 && (
          <span className="lamp keep" title="見積済以降の行 / 見積の対象（提出済の相見積・指定系）" data-testid="quote-progress">
            見積済 {quotedN}/{quotable.length}
          </span>
        )}
        <span className={'lamp keep keep-narrow ' + (errs ? 'err' : '')}>エラー {errs}</span>
        <span className={'lamp keep ' + (warns ? 'warn' : '')}>警告 {warns}</span>
        {overdue > 0 && <span className="lamp err keep keep-narrow">期限超過 {overdue}</span>}
      </span>
      <span className="hdr-right">
        <span className="role" title="役割（ログイン）。Ctrl+K → 役割を切り替え でも変えられます">
          {ROLES.map((r) => (
            <button key={r} tabIndex={-1} aria-pressed={user.role === r} onMouseDown={keepFocus} onClick={() => user.role !== r && switchRole(r)} data-testid={`role-${r}`}>
              {ROLE_LABEL[r]}
            </button>
          ))}
        </span>
        <span className="muted hdr-user" title={syncEnabled() ? '共有ストアに接続中' : 'このブラウザに保存'}>
          {user.name}
          {syncEnabled() ? ' · 共有' : ''}
        </span>
        <button className="btn" tabIndex={-1} onMouseDown={keepFocus} onClick={() => runCommand('palette.open')} data-testid="open-palette">
          <kbd>Ctrl+K</kbd> <span className="hdr-cmd-label">コマンド</span>
        </button>
        <button className="btn icon" tabIndex={-1} onMouseDown={keepFocus} onClick={() => runCommand('help')} title="ショートカット一覧（?）" data-testid="open-help">
          ?
        </button>
      </span>
    </header>
  )
}

function dayText(n: number | null | undefined): string {
  if (n == null) return '—'
  return n < 0 ? `${-n}日超過` : `あと${n}日`
}
