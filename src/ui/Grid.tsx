import { memo, useEffect, useLayoutEffect, useRef, type RefObject } from 'react'
import { useStore } from '@/model/store'
import type { ViewModel } from '@/model/selectors'
import { cellSev, cellText } from '@/model/selectors'
import { colDef } from '@/model/columns'
import { Detail } from './Detail'
import type { Row } from '@/model/types'
import type { ViewCtx } from '@/model/views'
import { commitEdit, runCommand, startEdit, updateEditValue } from '@/commands/registry'
import { ROLE_LABEL } from '@/model/types'

export function Grid({ vm }: { vm: ViewModel }) {
  const st = useStore()
  const wrap = useRef<HTMLDivElement>(null)
  const cursorRef = useRef<HTMLTableCellElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // 行の詳細を画面幅に合わせるための幅
  useLayoutEffect(() => {
    const el = wrap.current
    if (!el) return
    const update = () => el.style.setProperty('--gw', `${el.clientWidth}px`)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    cursorRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [st.cursorRow, st.cursorCol, st.view])

  // Space で開いた詳細が画面の外に出ないようにする
  useEffect(() => {
    if (!st.cursorRow || !st.openRows.includes(st.cursorRow)) return
    const el = wrap.current?.querySelector(`tr.detail[data-detail-for="${st.cursorRow}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [st.openRows, st.cursorRow, st.detailIndex])

  useEffect(() => {
    if (st.mode === 'edit') inputRef.current?.focus()
    else if (st.mode === 'nav' && !st.panel && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') wrap.current?.focus({ preventScroll: true })
  }, [st.mode, st.cursorRow, st.cursorCol, st.panel])

  const cols = vm.columns
  const role = st.ws.user.role
  return (
    <div className="gridwrap" ref={wrap} tabIndex={-1} data-testid="grid">
      <table className="grid">
        <thead>
          <tr>
            {cols.map((c) => {
              const d = colDef(c)
              const sid = c.includes('@') ? c.slice(c.indexOf('@') + 1) : null
              const sup = sid && sid !== 'A' ? st.ws.suppliers.find((s) => s.id === sid) : null
              return (
                <th
                  key={c}
                  className={(d?.numeric ? 'num ' : '') + (st.sort?.col === c ? 'sorted ' : '') + 'sortable'}
                  style={{ minWidth: d?.width }}
                  title={`${d?.label ?? c}（クリックで並び替え。キーは s / Shift+S）${d?.editableBy.length ? ` 書ける役割: ${d.editableBy.map((r) => ROLE_LABEL[r]).join('・')}` : ' 自動計算'}`}
                  onClick={() => {
                    const cur = useStore.getState().sort
                    const dir = cur?.col === c && cur.dir === 'asc' ? 'desc' : cur?.col === c && cur.dir === 'desc' ? null : 'asc'
                    st.set({ sort: dir ? { col: c, dir } : null })
                  }}
                >
                  {sup && <span className="supplier-dot" style={{ background: sup.color }} />}
                  {sup ? `${sup.name} ` : ''}
                  {d?.label ?? c}
                  {st.sort?.col === c ? (st.sort.dir === 'asc' ? ' ▲' : ' ▼') : ''}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {vm.items.map((it) => {
            if (it.kind === 'group') {
              const sel = st.cursorRow === it.key
              return (
                <tr key={it.key} className={'group' + (sel ? ' sel' : '')} data-testid="group-row" onClick={() => (st.set({ cursorRow: it.key }), runCommand('row.toggleOpen'))}>
                  <td colSpan={cols.length}>
                    {st.collapsed.includes(it.category) ? '▸' : '▾'} {it.category} <span className="muted">({it.count})</span>
                  </td>
                </tr>
              )
            }
            if (it.kind === 'detail') {
              return (
                <tr key={it.key} className="detail" data-detail-for={it.row.id}>
                  <td colSpan={cols.length}>
                    <div className="detail-inner">
                      <Detail row={it.row} vm={vm} />
                    </div>
                  </td>
                </tr>
              )
            }
            if (it.kind === 'case') {
              const sel = st.cursorRow === it.key
              return (
                <tr key={it.key} className={'group case' + (sel ? ' sel' : '')} data-testid="case-row" onClick={() => st.set({ cursorRow: it.key })} onDoubleClick={() => (st.set({ cursorRow: it.key }), runCommand('cell.edit'))}>
                  <td colSpan={cols.length}>◆ {it.label}</td>
                </tr>
              )
            }
            const r = it.row
            const sel = st.cursorRow === r.id
            return <GridRow key={it.key} row={r} cols={cols} ctx={vm.ctx} sel={sel} cursorCol={sel ? st.cursorCol : ''} editing={sel && st.mode === 'edit'} editValue={sel ? st.editValue : ''} editError={sel ? st.editError : null} candidates={sel ? st.editCandidates : null} cursorRef={cursorRef} inputRef={inputRef} suppliers={st.ws.suppliers} />
          })}
        </tbody>
      </table>
      {vm.items.length === 0 && <EmptyState vm={vm} role={role} />}
    </div>
  )
}

function EmptyState({ vm, role }: { vm: ViewModel; role: string }) {
  const st = useStore()
  if (st.filter || st.cellFilter)
    return (
      <div className="empty-state" data-testid="empty">
        絞り込み「{st.filter || st.cellFilter?.value}」に合う行はありません。<kbd>Esc</kbd> で解除します。
      </div>
    )
  const msg: Record<number, string> = {
    1: 'まだ行がありません。Shift+Enter で行を追加するか、Ctrl+K → 新しいBOM で貼り付けて作れます。',
    2: '提出対象の行はありません。',
    3: '発注・入荷の対象（選定済以降）の行はまだありません。',
    4: role === 'design' ? 'いま直す問題はありません。Ctrl+Enter で公開（提出）できます。1 で「すべて」に戻ります。' : role === 'purchasing' ? '確認待ちの指摘・取込不一致はありません。9 購買作業で見積を進めます。' : '確認する問題はありません。7 要決定を見てください。',
    5: '確認していない変更はありません。',
    6: '見積の対象（提出済以降）の行はまだありません。設計の提出を待っています。',
    7: '決めることはありません。',
    8: '正式見積の対象（選定済以降）の行はまだありません。',
    9: '購買の作業（提出済・見積中・見積済・再見積要）の行はありません。',
  }
  void vm
  return (
    <div className="empty-state" data-testid="empty">
      {msg[st.view] ?? 'この条件に合う行はありません。'}
      <br />
      <span className="muted">
        <kbd>1</kbd> すべて <kbd>?</kbd> ショートカット一覧 <kbd>Ctrl+K</kbd> 操作を名前で探す
      </span>
    </div>
  )
}

interface RowProps {
  row: Row
  cols: string[]
  ctx: ViewCtx
  sel: boolean
  cursorCol: string
  editing: boolean
  editValue: string
  editError: string | null
  candidates: string[] | null
  cursorRef: RefObject<HTMLTableCellElement | null>
  inputRef: RefObject<HTMLInputElement | null>
  suppliers: Array<{ id: string; color: string }>
}

const GridRow = memo(function GridRow({ row: r, cols, ctx, sel, cursorCol, editing, editValue, editError, candidates, cursorRef, inputRef, suppliers }: RowProps) {
  const cls = ['row', sel ? 'sel' : '', r.hidden ? 'hidden-row' : '', r.status === 'cancelled' || r.status === 'replaced' ? 'rejected' : ''].filter(Boolean).join(' ')
  return (
    <tr className={cls} data-testid="row" data-row-id={r.id}>
      {cols.map((c) => {
        const ct = cellText(r, c, ctx)
        const sev = ct.sev ?? cellSev(r, c, ctx)
        const isCursor = sel && cursorCol === c
        const isEditing = isCursor && editing
        const d = colDef(c)
        const tdCls = [ct.cls ?? '', c === 'name' ? 'name' : '', c === 'model' ? 'model' : '', d?.numeric ? 'num' : '', isCursor ? 'cursor' : '', isEditing ? 'editing' : '', sev ?? ''].filter(Boolean).join(' ')
        return (
          <td
            key={c}
            ref={isCursor ? cursorRef : undefined}
            className={tdCls}
            title={ct.title}
            data-col={c}
            onMouseDown={(e) => {
              // 編集中に別のセルを押したら、まず確定する（Excel と同じ）
              if (useStore.getState().mode === 'edit' && !isEditing) {
                e.preventDefault()
                if (commitEdit('stay')) useStore.getState().set({ cursorRow: r.id, cursorCol: c })
              }
            }}
            onClick={() => {
              if (useStore.getState().mode === 'edit') return
              useStore.getState().set({ cursorRow: r.id, cursorCol: c, detailIndex: 0 })
            }}
            onDoubleClick={() => {
              useStore.getState().set({ cursorRow: r.id, cursorCol: c })
              startEdit()
            }}
          >
            {isEditing ? (
              <>
                <input
                  ref={inputRef}
                  className="cell"
                  data-testid="cell-editor"
                  value={editValue}
                  onChange={(e) => updateEditValue(e.target.value)}
                  onBlur={() => {
                    // フォーカスが外れたら確定（パネルが開いた・ウィンドウが切り替わったときは除く）
                    setTimeout(() => {
                      const s = useStore.getState()
                      if (s.mode === 'edit' && !s.panel && document.hasFocus() && document.activeElement?.className !== 'cell') commitEdit('stay')
                    }, 0)
                  }}
                />
                {editError && <div className="edit-error" data-testid="edit-error">{editError}</div>}
                {candidates && candidates.length > 0 && (
                  <div className="candidates" data-testid="candidates">
                    {candidates.map((o, i) => (
                      <div
                        key={o}
                        aria-selected={i === 0}
                        onMouseDown={(e) => {
                          e.preventDefault()
                          updateEditValue(o)
                          useStore.getState().set({ editCandidates: [o] })
                          commitEdit('stay')
                        }}
                      >
                        {o}
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : c === 'status' ? (
              <span className={'status-pill ' + (ct.cls ?? '')}>{ct.text}</span>
            ) : c === 'adopted' && r.adoptedSupplierId ? (
              <>
                <span className="supplier-dot" style={{ background: suppliers.find((s) => s.id === r.adoptedSupplierId)?.color }} />
                {ct.text}
              </>
            ) : (
              ct.text
            )}
          </td>
        )
      })}
    </tr>
  )
})
