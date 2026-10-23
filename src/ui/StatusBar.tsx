import { useEffect, useState } from 'react'
import { useStore } from '@/model/store'
import type { ViewModel } from '@/model/selectors'
import { ROLE_LABEL } from '@/model/types'
import { unpublishedCount, openIssues, isActive, designatedDeclined, fixedSupplierId, overCap, quoteResponses } from '@/model/derive'
import { formatKey, keyToEventInit } from '@/keys/keymap'
import { colDef } from '@/model/columns'
import { pmCaseOf } from '@/actions/pm'
import { canAdopt } from '@/actions/adopt'
import { nextAckTarget } from '@/commands/registry'
import { onCommandCell } from '@/commands/keyboard'
import { canEdit } from '@/actions/rows'

export function StatusBar({ vm }: { vm: ViewModel }) {
  const st = useStore()
  const p = vm.ctx.p
  const user = st.ws.user
  const [, tick] = useState(0)
  const toastMs = st.toast?.kind === 'err' ? 9000 : 6000
  useEffect(() => {
    if (!st.toast) return
    const id = setTimeout(() => tick((x) => x + 1), toastMs)
    return () => clearTimeout(id)
  }, [st.toast, toastMs])
  const row = st.cursorRow && !st.cursorRow.startsWith('g:') ? vm.rows.find((r) => r.id === st.cursorRow) : undefined
  const up = unpublishedCount(p, user.name)
  const hints: Array<[string, string]> = []
  // Excel と同じく、打ち始めた入力は「入力」（矢印で確定して移動）、Enter・F2 で始めた編集は「編集」（矢印は文字の中）。F2 で切り替え
  const modeLabel = st.mode === 'nav' ? 'ナビ' : st.mode === 'edit' ? (st.editTyped ? '入力' : '編集') : st.mode === 'palette' ? 'パレット' : 'パネル'
  if (st.mode === 'nav' && row && isActive(row)) {
    const pmCase = pmCaseOf(p, row)
    if (user.role === 'pm' && pmCase !== 'なし') hints.push(['y', '承認'], ['Shift+Y', '却下'], ['Enter', '決定パネル'])
    else if (!canEdit(st.cursorCol)) hints.push(['Enter', '編集'])
    if (!canAdopt(p, row)) hints.push(['a', '推奨採用'])
    if (user.role === 'purchasing') hints.push(['Shift+I', '指摘'])
    // Space は 1 つだけ出す（指摘があれば「開いて指摘を見る」）
    hints.push(['Space', st.openRows.includes(row.id) ? '閉じる' : user.role !== 'purchasing' && openIssues(p, row.id).length ? '開いて指摘を見る' : '開く'])
    if (vm.counts[4]) hints.push(['F8', '次の問題'])
    if (user.role === 'design' && row.procurement === '指定商社' && designatedDeclined(p, row)) hints.push(['Ctrl+.', '指定先を変える'])
    if (user.role === 'purchasing' && row.procurement === '客先指定品' && !row.adoptedSupplierId && row.status === 'quoting' && p.quotes.some((q) => q.rowId === row.id && !q.stale) && p.quotes.filter((q) => q.rowId === row.id && !q.stale).every((q) => q.leadDays === -1) ) hints.push(fixedSupplierId(p, row, st.ws.suppliers) ? ['Ctrl+.', '次の商社に依頼'] : ['Alt+Shift+I', '取引できる商社がすべて辞退: 設計に代替を相談（指摘）'])
    // 相見積で取引できる商社の回答がすべて辞退（または取引停止の商社だけが回答）: 見積済にならないので次の手を案内
    if (user.role === 'purchasing' && row.procurement === '相見積' && row.status === 'quoting') {
      const { answered, total } = quoteResponses(p, row)
      if (total > 0 && answered === total) hints.push(['Alt+Shift+I', '取引できる商社に有効な見積が無い: 相見積先を足して依頼するか、設計に代替を相談（指摘）'])
    }
    const ack = nextAckTarget(p, row, user.role)
    if (ack) hints.push(['x', ack])
    if (user.role === 'design' && up.rows) hints.push(['Ctrl+Enter', `公開 ${up.rows} 行`])
    if (user.role === 'purchasing' && up.issues) hints.push(['Ctrl+Enter', `指摘 ${up.issues} 件を発行`])
  } else if (st.mode === 'nav' && !row) hints.push(['ArrowDown', '表へ'], ['n', '次の問題'])
  else if (st.mode === 'edit') hints.push(['Enter', '確定して下へ'], ['Tab', '確定して右へ'], ['Escape', '取り消し'], ['F2', st.editTyped ? '編集モードへ（矢印で文字の中）' : '入力モードへ（矢印で確定）'])
  hints.push(['?', 'ヘルプ'])
  // 幅が足りないときに切れないよう、公開・ヘルプ・次の問題を先頭に
  for (const k of ['F8', '?', 'Ctrl+Enter']) {
    const i = hints.findIndex((h) => h[0] === k)
    if (i > 0) hints.unshift(...hints.splice(i, 1))
  }
  // ID・状態・チェックの列以外では英字は入力になるので、英字の操作は Alt を付けて案内する（n は F8）
  if (st.mode === 'nav' && !onCommandCell('a')) for (const h of hints) if (/^(Shift\+)?[A-Za-z]$/.test(h[0])) h[0] = h[0] === 'n' ? 'F8' : `Alt+${h[0]}`
  if (!row) for (const h of hints) if (h[0] === 'n') h[0] = 'F8'
  // 文字を打てるセルでは ? も値になるので、ヘルプは F1 で案内する
  if (st.mode !== 'nav' || !onCommandCell('?')) for (const h of hints) if (h[0] === '?') h[0] = 'F1'
  const problemHint = (() => {
    if (!row) return ''
    const iss = openIssues(p, row.id).filter((i) => i.status === 'open' || i.status === 'inProgress')
    if (!iss.length) {
      // 追加費用の上限超過（PM の判断待ち・却下）
      const oc = overCap(p, row)
      if (oc) return `上限超過 ¥${(row.extraCost ?? 0).toLocaleString()} > ¥${oc.cap.toLocaleString()}${row.flags.capRuled === row.extraCost ? '（PM 却下: 上限内で手配し直す）' : '（PM 判断待ち）'}`
      if (row.flags.formalWithdrawn) return `正式依頼を取り下げ: ${row.flags.formalWithdrawn}（元の商社に取り下げを伝えたら x）`
      return ''
    }
    const kind = iss[0].kind
    const all = p.rows.flatMap((r) => openIssues(p, r.id).filter((i) => (i.status === 'open' || i.status === 'inProgress') && i.kind === kind))
    const idx = all.findIndex((i) => i.rowId === row.id)
    return `${kind} ${idx + 1}/${all.length}`
  })()
  const toastVisible = st.toast && Date.now() - st.toast.at < toastMs
  return (
    <>
      <footer className="status" data-testid="status">
        <span className={'mode ' + st.mode} data-testid="mode">
          {modeLabel}
        </span>
        <span className="cell" data-testid="cursor">
          {row ? `${row.id} ${colDef(st.cursorCol)?.label ?? st.cursorCol}` : st.cursorRow?.startsWith('g:') ? `分類 ${st.cursorRow.split(':')[1]}` : '—'}
        </span>
        {problemHint && <span className="muted">{problemHint}</span>}
        <span className="muted" data-testid="role-status">
          {ROLE_LABEL[user.role]} {user.name}: {user.role === 'purchasing' ? `未発行 ${up.issues} 件` : user.role === 'design' ? `未公開 ${up.rows} 行 / 指摘 ${up.issues}` : `要決定 ${vm.counts[7]}`}
        </span>
        {toastVisible && (
          <span className={'toast ' + st.toast!.kind} data-testid="toast">
            {st.toast!.text}
          </span>
        )}
        <span className="hints">
          {hints.map(([k, l]) => (
            <span key={k + l} className="clickable" title={`${formatKey(k)} を押すのと同じ`} onMouseDown={(e) => e.preventDefault()} onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', keyToEventInit(k)))}>
              <b>{formatKey(k)}</b>
              {l}
            </span>
          ))}
        </span>
      </footer>
      {toastVisible && (
        <div className={'toast-float ' + st.toast!.kind} role={st.toast!.kind === 'err' ? 'alert' : 'status'} data-testid="toast-float">
          {st.toast!.text}
        </div>
      )}
    </>
  )
}
