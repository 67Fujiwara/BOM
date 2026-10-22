import { memo, useEffect, useRef, type RefObject } from 'react'
import { useStore } from '@/model/store'
import type { ViewModel } from '@/model/selectors'
import { cellSev, cellText } from '@/model/selectors'
import { colDef } from '@/model/columns'
import { Detail } from './Detail'
import type { Row } from '@/model/types'
import type { ViewCtx } from '@/model/views'

export function Grid({ vm }: { vm: ViewModel }) {
  const st = useStore()
  const wrap = useRef<HTMLDivElement>(null)
  const cursorRef = useRef<HTMLTableCellElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    cursorRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [st.cursorRow, st.cursorCol, st.view])

  useEffect(() => {
    if (st.mode === 'edit') inputRef.current?.focus()
  }, [st.mode, st.cursorRow, st.cursorCol])

  const cols = vm.columns
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
                <th key={c} className={(d?.numeric ? 'num ' : '') + (st.sort?.col === c ? 'sorted' : '')} style={{ minWidth: d?.width }} title={c}>
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
                <tr key={it.key} className={'group' + (sel ? ' sel' : '')} data-testid="group-row" onClick={() => st.set({ cursorRow: it.key })}>
                  <td colSpan={cols.length}>
                    {st.collapsed.includes(it.category) ? '▸' : '▾'} {it.category} <span className="muted">({it.count})</span>
                  </td>
                </tr>
              )
            }
            if (it.kind === 'detail') {
              return (
                <tr key={it.key} className="detail">
                  <td colSpan={cols.length}>
                    <Detail row={it.row} vm={vm} />
                  </td>
                </tr>
              )
            }
            const r = it.row
            const sel = st.cursorRow === r.id
            return <GridRow key={it.key} row={r} cols={cols} ctx={vm.ctx} sel={sel} cursorCol={sel ? st.cursorCol : ''} editing={sel && st.mode === 'edit'} editValue={sel ? st.editValue : ''} candidates={sel ? st.editCandidates : null} cursorRef={cursorRef} inputRef={inputRef} suppliers={st.ws.suppliers} />
          })}
          {vm.items.length === 0 && (
            <tr>
              <td colSpan={cols.length} className="muted" style={{ padding: 20 }}>
                この条件に合う行はありません
              </td>
            </tr>
          )}
        </tbody>
      </table>
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
  candidates: string[] | null
  cursorRef: RefObject<HTMLTableCellElement | null>
  inputRef: RefObject<HTMLInputElement | null>
  suppliers: Array<{ id: string; color: string }>
}

const GridRow = memo(function GridRow({ row: r, cols, ctx, sel, cursorCol, editing, editValue, candidates, cursorRef, inputRef, suppliers }: RowProps) {
  const st = useStore.getState()
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
            onClick={() => {
              if (useStore.getState().mode === 'edit') return
              st.set({ cursorRow: r.id, cursorCol: c })
            }}
            onDoubleClick={() => st.set({ cursorRow: r.id, cursorCol: c, mode: 'edit', editValue: String(ct.raw ?? '') })}
          >
            {isEditing ? (
              <>
                <input ref={inputRef} className="cell" data-testid="cell-editor" value={editValue} onChange={(e) => st.set({ editValue: e.target.value })} />
                {candidates && candidates.length > 0 && (
                  <div className="candidates" data-testid="candidates">
                    {candidates.map((o, i) => (
                      <div key={o} aria-selected={i === 0}>
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
