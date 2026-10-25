// ラウンド20 中堅: 変更セットの不変条件など、n シリーズの共通
import { check, log } from './lib.mjs'

/** 状態の不変条件。違反した文言の配列 */
export function inv(p) {
  const out = []
  const pend = (rev) => { const s = p.submissions.find((x) => x.rev === rev); return !!s?.changeSet && !s.changeSet.approved && !s.changeSet.rejected && s.changeSet.supersededBy == null }
  for (const r of p.rows) {
    if (r.pendingRev != null && !pend(r.pendingRev)) out.push(`${r.id} pendingRev=${r.pendingRev} だが Rev は承認待ちではない`)
    if (r.pendingApproval && r.pendingRev == null) out.push(`${r.id} pendingApproval があるのに pendingRev なし`)
    if (r.pendingRemoval && r.pendingRev == null) out.push(`${r.id} pendingRemoval があるのに pendingRev なし`)
    if (r.flags.pmPending && r.flags.pmReason === '変更セット' && r.pendingRev == null) out.push(`${r.id} 変更セットの承認待ちなのに pendingRev なし`)
    if (r.pendingRev != null && !(r.flags.pmPending && r.flags.pmReason === '変更セット')) out.push(`${r.id} pendingRev=${r.pendingRev} なのに承認待ちの印なし`)
    if (r.status === 'cancelled' && (r.pendingRemoval || r.removal)) out.push(`${r.id} 取消済なのに removal が残る`)
    if (r.status === 'replaced' && !r.replacedBy) out.push(`${r.id} 置換済なのに replacedBy なし`)
    if (r.status === 'draft' && r.pendingRev != null) out.push(`${r.id} 下書きなのに pendingRev`)
    if (r.status === 'draft' && r.publishedRev != null) out.push(`${r.id} 下書きなのに publishedRev=${r.publishedRev}`)
  }
  for (const s of p.submissions) if (s.changeSet && pend(s.rev) && !p.rows.some((r) => r.pendingRev === s.rev)) out.push(`Rev.${s.rev} は承認待ちなのに行が残っていない`)
  for (const s of p.submissions) if (s.changeSet?.merged) for (const [id, to] of Object.entries(s.changeSet.merged)) {
    const tos = p.submissions.find((x) => x.rev === to)
    if (!tos) out.push(`Rev.${s.rev} の ${id} は Rev.${to} にまとめたが Rev.${to} がない`)
  }
  return out
}
export function checkInv(name, p) { const v = inv(p); return check(name + ' 不変条件', !v.length, v.join(' | ')) }
export const rowOf = (p, id) => p.rows.find((r) => r.id === id)
/** 変更点の行から指定 Rev のものを探す */
export const revRow = (rows, rev) => rows.find((x) => String(x[0]) === String(rev))
