import { useStore } from '@/model/store'
import type { Row } from '@/model/types'
import { ISSUE_STATUS_LABEL, ROLE_LABEL } from '@/model/types'
import type { ViewModel } from '@/model/selectors'
import { rankedQuotes, scoreRow } from '@/model/score'
import { effective, fmtYen, roundedQty, rowNeedDate } from '@/model/derive'
import { fmtDate, fmtDateTime } from '@/model/dates'
import { commitEdit, runCommand } from '@/commands/registry'

export function Detail({ row, vm }: { row: Row; vm: ViewModel }) {
  const st = useStore()
  const p = vm.ctx.p
  // 設計以外には公開済の値を見せる（作業中の値は設計だけ）
  const e = vm.ctx.role === 'design' ? effective(row) : row
  const scores = scoreRow(p, row, st.ws.suppliers)
  const quotes = rankedQuotes(p, row, st.ws.suppliers)
  const stale = p.quotes.filter((q) => q.rowId === row.id && q.stale)
  // 他の人の下書き（未発行）の指摘は見せない
  const issues = p.issues.filter((i) => i.rowId === row.id && (i.status !== 'draft' || i.by.name === st.ws.user.name))
  const events = p.events.filter((ev) => ev.rowId === row.id).slice(-8).reverse()
  const focused = st.cursorRow === row.id && st.detailIndex > 0
  // 詳細の指摘・見積をクリックで選ぶ（↓ で選ぶのと同じ。続く Enter でアクション）
  const pick = (index: number) => {
    if (useStore.getState().mode === 'edit' && !commitEdit('stay')) return
    useStore.getState().set({ cursorRow: row.id, detailIndex: index })
  }
  const need = rowNeedDate(p, row)
  return (
    <div className="detail" data-testid="detail">
      <div className="detail-grid">
        <div>
          <h4>
            相見積・スコア内訳 <span className="muted">（必要日 {fmtDate(need) || '未定'} / 必要数 {e.qtyNeeded}{e.unit}{row.quotedAt ? ` / 基準日 ${fmtDate(row.quotedAt)}` : ''}）</span>
          </h4>
          <div className="quotes-wrap">
          <table className="quotes">
            <thead>
              <tr>
                <th>商社</th>
                <th>単価</th>
                <th>納期</th>
                <th>MOQ</th>
                <th>在庫</th>
                <th>丸め/余剰</th>
                <th title="スコアの合計（100 点満点）">スコア</th>
                <th title="価格の点">価格点</th>
                <th title="納期の点（必要日に間に合えば 100）">納期点</th>
                <th title="実績の点">実績点</th>
                <th title="条件の点">条件点</th>
                <th>備考</th>
              </tr>
            </thead>
            <tbody>
              {quotes.map((q, qi) => {
                const sup = st.ws.suppliers.find((s) => s.id === q.supplierId)
                const sc = scores.find((x) => x.supplierId === q.supplierId)
                const rank = sc ? scores.indexOf(sc) + 1 : null
                const rq = sc?.roundedQty ?? roundedQty(e.qtyNeeded, q.moq, e.packQty, e.unit)
                const surplus = rq - e.qtyNeeded
                const isFocus = focused && st.detailIndex === issues.length + qi + 1
                return (
                  <tr key={q.supplierId} className={'clickable ' + (rank === 1 ? 'best ' : '') + (row.adoptedSupplierId === q.supplierId ? 'adopted ' : '') + (isFocus ? 'focus' : '')} title="クリックで選択、ダブルクリック（または Enter）で見積のアクション" onClick={() => pick(issues.length + qi + 1)} onDoubleClick={() => (pick(issues.length + qi + 1), runCommand('cell.edit'))}>
                    <td>
                      <span className="supplier-dot" style={{ background: sup?.color }} />
                      {rank ? `${rank}. ` : ''}
                      {sup?.name}
                      {q.reconfirm ? <span className="chip muted" style={{ marginLeft: 4 }}>{q.reconfirm === 'keep' ? '据え置き' : q.reconfirm === 'requote' ? '再見積' : '提案値'}</span> : row.flags.reconfirm ? <span className="chip warn" style={{ marginLeft: 4 }}>要再確認</span> : null}
                    </td>
                    <td className="num">{q.unitPrice == null ? <span className="muted">{q.leadDays === -1 ? '辞退' : '未回答'}</span> : fmtYen(q.unitPrice, p.settings.currency)}</td>
                    <td className="num">{q.leadDays == null ? '' : q.leadDays === -1 ? '—' : q.stock === '在庫' || q.leadDays === 0 ? '即納' : `${q.leadDays}日`}</td>
                    <td className="num">{q.moq ?? ''}</td>
                    <td>{q.stock ?? ''}</td>
                    <td className="num" title={surplus && sc ? `必要数 ${e.qtyNeeded} を MOQ・入数で切り上げ。余り ${surplus} 個ぶん ${fmtYen(sc.surplusAmount, p.settings.currency)}` : undefined}>{q.unitPrice != null ? `${rq}${surplus ? ` (+${surplus}${sc ? ` ${fmtYen(sc.surplusAmount, p.settings.currency)}` : ''})` : ''}` : ''}</td>
                    <td className="num">
                      {sc ? (
                        <>
                          <span className="scorebar" style={{ width: sc.total * 0.6 }} /> {sc.total}
                        </>
                      ) : (
                        ''
                      )}
                    </td>
                    <td className="num">{sc?.price ?? ''}</td>
                    <td className="num">{sc?.lead ?? ''}</td>
                    <td className="num">{sc ? (sc.noRecord ? '50*' : sc.record) : ''}</td>
                    <td className="num">{sc?.terms ?? ''}</td>
                    <td className="muted">{[...(sc?.reasons ?? []), q.source, q.validUntil ? `期限 ${fmtDate(q.validUntil)}` : '', q.formalPrice != null ? `正式 ${fmtYen(q.formalPrice, p.settings.currency)}` : ''].filter(Boolean).join(' / ')}</td>
                  </tr>
                )
              })}
              {stale.length > 0 && (
                <tr>
                  <td colSpan={12} className="muted">
                    旧型式の見積（無効）: {stale.map((q) => `${st.ws.suppliers.find((s) => s.id === q.supplierId)?.name} ${q.staleModel ?? ''} ${q.unitPrice != null ? fmtYen(q.unitPrice) : ''}`).join(' / ')}
                  </td>
                </tr>
              )}
              {quotes.length === 0 && (
                <tr>
                  <td colSpan={12} className="muted">
                    見積はまだありません
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
          {row.adoptedSupplierId && (
            <p className="muted" style={{ margin: '6px 0 0', fontSize: 12 }}>
              採用: {st.ws.suppliers.find((s) => s.id === row.adoptedSupplierId)?.name} {row.scoreSnapshot != null ? `スコア ${row.scoreSnapshot}（固定）` : ''} {row.adoptReason ? `理由: ${row.adoptReason}` : ''}
            </p>
          )}
        </div>
        <div>
          <h4>
            指摘 <span className="muted">（↓ で指摘・見積を選んで Enter でアクション。Shift+R 返信）</span>
            {row.working && Object.keys(row.working).length > 0 && vm.ctx.role !== 'design' && <span className="chip warn" style={{ marginLeft: 6 }}>設計作業中（未公開の変更あり）</span>}
          </h4>
          <ul className="issues" data-testid="issues">
            {issues.map((i, idx) => {
              const isFocus = focused && st.detailIndex === idx + 1
              return (
                <li key={i.id} onClick={() => pick(idx + 1)} onDoubleClick={() => (pick(idx + 1), runCommand('cell.edit'))} title="クリックで選択、ダブルクリック（または Enter）で指摘のアクション" className={'clickable ' + (i.status === 'confirmed' || i.status === 'wontfix' || i.status === 'fixed' ? 'done ' : i.status === 'draft' || i.status === 'answered' ? 'warn ' : '') + (isFocus ? 'focus' : '')} style={isFocus ? { outline: '2px solid var(--accent)' } : undefined}>
                  <div>
                    <b>{i.id}</b> {i.kind} <span className="chip muted">{ISSUE_STATUS_LABEL[i.status]}</span> {i.field ? <span className="muted">[{i.field}]</span> : null} {i.text}
                    {i.proposal && (
                      <span className="muted">
                        {' '}
                        提案: {i.proposal.model} / {i.proposal.maker} {i.proposal.supplierId ? st.ws.suppliers.find((s) => s.id === i.proposal!.supplierId)?.name : ''} {i.proposal.unitPrice != null ? fmtYen(i.proposal.unitPrice) : ''} {i.proposal.leadDays != null ? `${i.proposal.leadDays}日` : ''}
                      </span>
                    )}
                  </div>
                  <div className="meta">
                    {ROLE_LABEL[i.by.role]} {i.by.name} {fmtDateTime(i.at)} {i.rev ? `Rev.${i.rev}` : ''} 期限 {fmtDate(i.dueAt)} {i.bounceCount ? `差戻し ${i.bounceCount} 回` : ''} {i.resolution ? `／ ${i.resolution}` : ''} {i.answer ? `／ 回答(${i.answerKind}): ${i.answer}` : ''} {i.movedTo ? `→ ${i.movedTo}` : ''}
                  </div>
                  {i.replies.map((rp, k) => (
                    <div key={k} className="meta">
                      ↳ {ROLE_LABEL[rp.by.role]} {rp.by.name}: {rp.text}
                    </div>
                  ))}
                </li>
              )
            })}
            {issues.length === 0 && <li className="done">指摘はありません</li>}
          </ul>
          <h4 style={{ marginTop: 10 }}>履歴</h4>
          <ul className="history">
            {events.map((ev) => (
              <li key={ev.id}>
                <span className="who">{ev.by.name}</span> {fmtDateTime(ev.at)} {ev.text}
              </li>
            ))}
            {row.replaces && <li>置換元: {row.replaces}</li>}
            {row.lastChangeCause && <li>最終公開の起因: {row.lastChangeCause}（Rev.{row.publishedRev}）</li>}
          </ul>
        </div>
      </div>
    </div>
  )
}
