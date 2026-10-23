import { memo, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
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

  // ---------- 表示している範囲の行だけを描く（行数が多くても、ビュー切替・移動のたびに全セルを測り直さない） ----------
  const [view, setViewport] = useState({ top: 0, h: 900 })
  const rowH = useRef(30)
  const headH = useRef(30)
  const detailH = useRef(new Map<string, number>())
  const [, bump] = useState(0)
  const items = vm.items
  const heightOf = (it: (typeof items)[number]) => (it.kind === 'detail' ? (detailH.current.get(it.key) ?? 320) : rowH.current)
  const offsets = new Array<number>(items.length + 1)
  offsets[0] = 0
  for (let i = 0; i < items.length; i++) offsets[i + 1] = offsets[i] + heightOf(items[i])
  const OVERSCAN = 120
  let start = 0
  while (start < items.length && offsets[start + 1] < view.top - headH.current - OVERSCAN) start++
  let end = start
  while (end < items.length && offsets[end] < view.top + view.h + OVERSCAN) end++

  useLayoutEffect(() => {
    const el = wrap.current
    if (!el) return
    let raf = 0
    const read = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => setViewport((v) => (v.top === el.scrollTop && v.h === el.clientHeight ? v : { top: el.scrollTop, h: el.clientHeight })))
    }
    setViewport({ top: el.scrollTop, h: el.clientHeight })
    el.addEventListener('scroll', read, { passive: true })
    const ro = new ResizeObserver(read)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', read)
      ro.disconnect()
      cancelAnimationFrame(raf)
    }
  }, [])

  // 描いた行の高さを測って、見積もりと違えば描き直す（コンパクト表示・詳細の高さ）
  useLayoutEffect(() => {
    const el = wrap.current
    if (!el) return
    let changed = false
    const th = el.querySelector<HTMLElement>('table.grid > thead')
    if (th && th.offsetHeight && th.offsetHeight !== headH.current) {
      headH.current = th.offsetHeight
      changed = true
    }
    const r = el.querySelector<HTMLElement>('table.grid > tbody > tr.row')
    if (r && r.offsetHeight && r.offsetHeight !== rowH.current) {
      rowH.current = r.offsetHeight
      changed = true
    }
    for (const d of el.querySelectorAll<HTMLElement>('table.grid > tbody > tr.detail')) {
      const k = 'd:' + d.dataset.detailFor
      if (d.offsetHeight && detailH.current.get(k) !== d.offsetHeight) {
        detailH.current.set(k, d.offsetHeight)
        changed = true
      }
    }
    if (changed) bump((x) => x + 1)
  })

  /** items[i] が見える位置までスクロールする（描いていない行にも使える） */
  const ensureVisible = (i: number, bottomPad = 64) => {
    const el = wrap.current
    if (!el || i < 0) return
    const top = offsets[i]
    const h = offsets[i + 1] - offsets[i]
    const before = el.scrollTop
    if (top < el.scrollTop) el.scrollTop = top
    else if (headH.current + top + h > el.scrollTop + el.clientHeight - bottomPad) el.scrollTop = Math.min(top, headH.current + top + h - el.clientHeight + bottomPad)
    // 描く範囲もすぐ合わせる（スクロールの通知を待つと 1 フレーム空白になる）
    if (el.scrollTop !== before) setViewport({ top: el.scrollTop, h: el.clientHeight })
  }

  useLayoutEffect(() => {
    // 分類の見出し・案件の要決定の行にカーソルがあるときも、その行が見えるようにする
    ensureVisible(items.findIndex((it) => it.key === st.cursorRow && it.kind !== 'detail'))
    // 横方向は描いているセルで合わせる
    const el = wrap.current
    const cell = cursorRef.current
    if (el && cell) {
      const left = cell.offsetLeft
      const right = left + cell.offsetWidth
      if (left < el.scrollLeft) el.scrollLeft = left
      else if (right > el.scrollLeft + el.clientWidth) el.scrollLeft = right - el.clientWidth
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [st.cursorRow, st.cursorCol, st.view, st.sort, st.filter, st.cellFilter, st.mode])

  // Space で開いた詳細が画面の外に出ないようにする
  useLayoutEffect(() => {
    if (!st.cursorRow || !st.openRows.includes(st.cursorRow)) return
    ensureVisible(items.findIndex((it) => it.kind === 'detail' && it.row.id === st.cursorRow), 8)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [st.openRows, st.cursorRow, st.detailIndex])

  // 編集を始めた行が描く範囲の外だった（マウスでスクロールした・並び替えた）ときも、描いたあとで入力欄にフォーカスする
  useEffect(() => {
    if (st.mode === 'edit' && inputRef.current && document.activeElement !== inputRef.current && !st.panel) inputRef.current.focus()
  })
  useEffect(() => {
    if (st.mode === 'edit') {
      inputRef.current?.focus()
      if (useStore.getState().editSelectAll) inputRef.current?.select()
    } else if (st.mode === 'nav' && !st.panel && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') wrap.current?.focus({ preventScroll: true })
  }, [st.mode, st.cursorRow, st.cursorCol, st.panel])

  const cols = vm.columns
  const role = st.ws.user.role
  // 列幅は定義から固定する（自動幅だと、ビュー切替・カーソル移動のたびに全セルを測り直して遅い）
  const widths = cols.map((c) => colWidth(c, st.ws.suppliers))
  const tableWidth = widths.reduce((a, b) => a + b, 0)
  return (
    <div className="gridwrap" ref={wrap} tabIndex={-1} data-testid="grid">
      <table className="grid" style={{ width: tableWidth }}>
        <colgroup>
          {cols.map((c, i) => (
            <col key={c} style={{ width: widths[i] }} />
          ))}
        </colgroup>
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
          {start > 0 && (
            <tr className="spacer" aria-hidden>
              <td colSpan={cols.length} style={{ height: offsets[start] }} />
            </tr>
          )}
          {items.slice(start, end).map((it) => {
            if (it.kind === 'group') {
              const sel = st.cursorRow === it.key
              return (
                <tr key={it.key} className={'group' + (sel ? ' sel' : '')} data-testid="group-row" onMouseDown={commitBeforeClick} onClick={() => useStore.getState().mode !== 'edit' && (st.set({ cursorRow: it.key }), runCommand('row.toggleOpen'))}>
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
                <tr key={it.key} className={'group case' + (sel ? ' sel' : '')} data-testid="case-row" onMouseDown={commitBeforeClick} onClick={() => st.set({ cursorRow: it.key })} onDoubleClick={() => (st.set({ cursorRow: it.key }), runCommand('cell.edit'))}>
                  <td colSpan={cols.length}>◆ {it.label}</td>
                </tr>
              )
            }
            const r = it.row
            const sel = st.cursorRow === r.id
            return <GridRow key={it.key} row={r} cols={cols} ctx={vm.ctx} sel={sel} cursorCol={sel ? st.cursorCol : ''} editing={sel && st.mode === 'edit'} editValue={sel ? st.editValue : ''} editError={sel ? st.editError : null} candidates={sel ? st.editCandidates : null} cursorRef={cursorRef} inputRef={inputRef} suppliers={st.ws.suppliers} />
          })}
          {end < items.length && (
            <tr className="spacer" aria-hidden>
              <td colSpan={cols.length} style={{ height: offsets[items.length] - offsets[end] }} />
            </tr>
          )}
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
  const cls = ['row', sel ? 'sel' : '', r.hidden ? 'hidden-row' : '', r.status === 'cancelled' || r.status === 'replaced' || (ctx.role === 'design' && (r.removal || r.pendingRemoval)) ? 'rejected' : ''].filter(Boolean).join(' ')
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

/** 列幅: 定義の幅＋余白と、見出しの文字が収まる幅の大きい方 */
function colWidth(c: string, suppliers: Array<{ id: string; name: string }>): number {
  const d = colDef(c)
  const sid = c.includes('@') ? c.slice(c.indexOf('@') + 1) : null
  const sup = sid && sid !== 'A' ? suppliers.find((s) => s.id === sid) : null
  const label = (sup ? sup.name + ' ' : '') + (d?.label ?? c)
  const textW = [...label].reduce((w, ch) => w + (ch.charCodeAt(0) > 0xff ? 12 : 7), 0) + (sup ? 12 : 0) + 30
  return Math.max((d?.width ?? 100) + 16, Math.min(textW, 220))
}

/** 編集中に見出しなどの行を押したら、先に確定する（読めない値なら押した操作をしない） */
function commitBeforeClick(e: React.MouseEvent) {
  if (useStore.getState().mode !== 'edit') return
  e.preventDefault()
  commitEdit('stay')
}
