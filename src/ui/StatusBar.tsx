import { useEffect, useState } from 'react'
import { useStore } from '@/model/store'
import type { ViewModel } from '@/model/selectors'
import { ROLE_LABEL } from '@/model/types'
import { unpublishedCount, openIssues } from '@/model/derive'
import { KEYMAP, formatKey } from '@/keys/keymap'
import { colDef } from '@/model/columns'
import { pmCaseOf } from '@/actions/pm'
import { nextAckTarget } from '@/commands/registry'

export function StatusBar({ vm }: { vm: ViewModel }) {
  const st = useStore()
  const p = vm.ctx.p
  const user = st.ws.user
  const [, tick] = useState(0)
  useEffect(() => {
    if (!st.toast) return
    const id = setTimeout(() => tick((x) => x + 1), 4000)
    return () => clearTimeout(id)
  }, [st.toast])
  const row = st.cursorRow ? p.rows.find((r) => r.id === st.cursorRow) : undefined
  const up = unpublishedCount(p, user.name)
  const hints: Array<[string, string]> = []
  const modeLabel = st.mode === 'nav' ? 'ナビ' : st.mode === 'edit' ? '編集' : st.mode === 'palette' ? 'パレット' : 'パネル'
  if (st.mode === 'nav' && row) {
    if (user.role === 'pm' && pmCaseOf(p, row) !== 'なし') hints.push(['y', '承認'], ['Shift+Y', '却下'], ['Enter', '決定パネル'])
    else hints.push(['Enter', '編集'], ['a', '推奨採用'], ['Shift+I', '指摘'], ['Space', '開く'])
    const ack = nextAckTarget(p, row, user.role)
    if (ack) hints.push(['x', ack])
    if (user.role === 'design') hints.push(['Ctrl+Enter', '公開'])
    if (user.role === 'purchasing') hints.push(['Ctrl+Enter', '指摘を発行'])
  } else if (st.mode === 'edit') hints.push(['Enter', '確定して下へ'], ['Tab', '確定して右へ'], ['Esc', '取り消し'])
  hints.push(['?', 'ヘルプ'])
  const problemHint = (() => {
    if (!row) return ''
    const iss = openIssues(p, row.id).filter((i) => i.status === 'open' || i.status === 'inProgress')
    if (!iss.length) return ''
    const kind = iss[0].kind
    const all = p.rows.flatMap((r) => openIssues(p, r.id).filter((i) => (i.status === 'open' || i.status === 'inProgress') && i.kind === kind))
    const idx = all.findIndex((i) => i.rowId === row.id)
    return `${kind} ${idx + 1}/${all.length}`
  })()
  const toastVisible = st.toast && Date.now() - st.toast.at < 4000
  return (
    <footer className="status" data-testid="status">
      <span className={'mode ' + st.mode} data-testid="mode">{modeLabel}</span>
      <span className="cell" data-testid="cursor">
        {row ? `${row.id} ${colDef(st.cursorCol)?.label ?? st.cursorCol}` : st.cursorRow ?? '—'}
      </span>
      {problemHint && <span className="muted">{problemHint}</span>}
      <span className="muted">
        {ROLE_LABEL[user.role]}: {user.role === 'purchasing' ? `未発行 ${up.issues} 件` : user.role === 'design' ? `未公開 ${up.rows} 行 / 指摘 ${up.issues}` : `要決定 ${vm.counts[7]}`}
      </span>
      {toastVisible && (
        <span className={'toast ' + st.toast!.kind} data-testid="toast">
          {st.toast!.text}
        </span>
      )}
      <span className="hints">
        {hints.map(([k, l]) => (
          <span key={k + l}>
            <b>{formatKey(k)}</b>
            {l}
          </span>
        ))}
      </span>
      <span className="sr-only">{KEYMAP.length} bindings</span>
    </footer>
  )
}
