import { useStore } from '@/model/store'
import type { ChangeReason, DesignFields, Issue, Project, Removal, Role, Row, Submission } from '@/model/types'
import { DESIGN_FIELDS, ISSUE_KINDS, ROLE_LABEL } from '@/model/types'
import { colDef, supplierOfCol } from '@/model/columns'
import { effective, fixedSupplierId, makerTargets, surplusOf, withdrawFormal, overCap, hasWork, isActive, isFixedProcurement, normalizeModel, orderQty, resolverOfIssue, roundedQty, routeSurplusToPm } from '@/model/derive'
import { normalize, nextRowId, setStatus } from '@/model/lifecycle'
import { emptyQuote, newRow } from '@/model/sample'
import { parseTable } from '@/io/paste'
import { checkRow } from '@/model/rules'
import { addBusinessDays, todayStr } from '@/model/dates'
import { parseDate, parseNumber, toHalf, type Parsed } from '@/model/parse'

function st() {
  return useStore.getState()
}

export function canEdit(colKey: string): string | null {
  const d = colDef(colKey)
  if (!d) return '編集できない列です'
  if (d.kind === 'computed') return colKey === 'needDate' ? 'この列は自動計算です（日付で固定するときは「必要日(固定)」の列、前倒しは「必要日(前倒し)」の列。列は Ctrl+K →「列の表示」）' : 'この列は自動計算です'
  const role = st().user().role
  if (!d.editableBy.includes(role)) return `権限なし（${d.editableBy.map((r) => ROLE_LABEL[r]).join('・')}の列）`
  return null
}

const SELECT_ALIASES: Record<string, Record<string, string>> = {
  unit: { k: '個', ko: '個', pcs: '個', h: '本', hon: '本', s: 'セット', set: 'セット', p: 'パック', pack: 'パック', pk: 'パック', shiki: '式', m: 'm', ｍ: 'm', メートル: 'm' },
  procurement: { a: '相見積', ai: '相見積', sh: '指定商社', k: '客先指定品', kyaku: '客先指定品', shi: '支給品', z: '社内在庫', zaiko: '社内在庫' },
  altPolicy: { k: '可', ka: '可', d: '同等品可', f: '不可', fuka: '不可', no: '不可', ng: '不可', kyaku: '客先承認要' },
  makerLock: { s: '指定', shitei: '指定', r: '推奨', suisho: '推奨', n: '任意', nini: '任意' },
  'q.stock': { z: '在庫', zaiko: '在庫', あり: '在庫', 有: '在庫', 有り: '在庫', 在庫あり: '在庫', 在庫有: '在庫', 即納: '在庫', stock: '在庫', instock: '在庫', t: '取寄', toriyose: '取寄', 取り寄せ: '取寄', 取寄せ: '取寄', j: '受注生産', 受注: '受注生産', bto: '受注生産' },
  extraCostKind: { t: '特急', s: '送料', b: '分納', o: 'その他' },
}

const NUM_RULES: Record<string, { min?: number; max?: number; integer?: boolean; label: string }> = {
  qtyNeeded: { min: 0, max: 1e9, label: '必要数' },
  packQty: { min: 1, max: 1e7, integer: true, label: '入数' },
  orderQty: { min: 0, max: 1e9, label: '発注数' },
  needOffset: { min: -365, max: 365, integer: true, label: '必要日(前倒し日数)' },
  extraCost: { min: 0, max: 1e10, label: '追加費用' },
  'q.unitPrice': { min: 0, max: 1e10, label: '単価' },
  'q.formalPrice': { min: 0, max: 1e10, label: '正式単価' },
  'q.moq': { min: 1, max: 1e9, integer: true, label: 'MOQ' },
  'q.leadDays': { min: 0, max: 3650, integer: true, label: '納期（日）' },
  'q.formalLeadDays': { min: 0, max: 3650, integer: true, label: '正式納期（日）' },
}
const TEXT_MAX: Record<string, number> = { note: 1000, name: 200, model: 200, maker: 100, ref: 100, drawing: 100, designated: 200, tags: 100, category: 50, receivedLot: 100, 'q.formalDiffReason': 200 }

/** 入力値を列の型で解釈する。読めないときは ok:false と理由を返す（黙って捨てない） */
export function parseValue(colKey: string, raw: string): Parsed<unknown> {
  const d = colDef(colKey)!
  const base = colKey.includes('@') ? colKey.slice(0, colKey.indexOf('@')) : colKey
  const s = toHalf(raw).trim()
  switch (d.kind) {
    case 'num': {
      if (base === 'q.leadDays' || base === 'q.formalLeadDays') {
        if (/^(即納|在庫|0日?)$/.test(s)) return { ok: true, value: 0 }
        if (/^(取扱なし|取り扱いなし|辞退|-1|×)$/.test(s)) return { ok: true, value: -1 }
        const dd = /^(\d+)\s*(日|days?|d)$/i.exec(s)
        if (dd) return { ok: true, value: Number(dd[1]) }
        const w = /^(\d+)\s*(週間?|w|weeks?)$/i.exec(s)
        if (w) return { ok: true, value: Number(w[1]) * 7 }
        const bd = /^(\d+)\s*営業日$/.exec(s)
        if (bd) return { ok: true, value: Number(bd[1]) }
        const mo = /^(\d+)\s*(ヶ月|か月|カ月|ヵ月|ケ月|m|months?)$/i.exec(s)
        if (mo) return { ok: true, value: Number(mo[1]) * 30 }
      }
      return parseNumber(raw, NUM_RULES[base] ?? { label: d.label })
    }
    case 'select': {
      const opts = d.options ?? []
      if (s === '') return { ok: false, error: `${d.label}は空にできません（${opts.join(' / ')}）` }
      const lower = s.toLowerCase()
      const hit = opts.find((o) => o === s) ?? SELECT_ALIASES[base]?.[lower] ?? opts.find((o) => o.startsWith(s)) ?? opts.find((o) => o.toLowerCase().startsWith(lower)) ?? opts.find((o) => o.includes(s))
      if (!hit) return { ok: false, error: `${d.label}に「${raw}」はありません（${opts.join(' / ')}）` }
      return { ok: true, value: hit }
    }
    case 'date':
      return parseDate(raw, { label: d.label })
    case 'bool':
      if (/^(1|y|yes|true|済|○|o|✓|v)$/i.test(s)) return { ok: true, value: true }
      if (/^(|0|n|no|false|×|x|-|未)$/i.test(s)) return { ok: true, value: false }
      return { ok: false, error: `${d.label}は ✓（1）か 空（0）です` }
    default: {
      const v = raw.replace(/[\t\r\n]+/g, ' ')
      const max = TEXT_MAX[base] ?? 500
      if (v.length > max) return { ok: false, error: `${d.label}が長すぎます（${v.length} 文字。上限 ${max}）` }
      return { ok: true, value: v }
    }
  }
}

/** セルの値を書く（設計列は公開済み以降なら作業中に積む）。書けなかったら理由をトーストして false */
export function setCell(rowId: string, colKey: string, raw: string, label = 'セル編集', opts: { quiet?: boolean } = {}): boolean {
  const err = canEdit(colKey)
  if (err) {
    if (!opts.quiet) st().toastMsg(err, 'err')
    return false
  }
  const parsed = parseValue(colKey, raw)
  if (!parsed.ok) {
    if (!opts.quiet) st().toastMsg(parsed.error, 'err')
    return false
  }
  const value = parsed.value
  const ok = st().commit(
    label,
    (p, ws) => {
      const r = p.rows.find((x) => x.id === rowId)
      if (!r) return '行がありません'
      const e = applyCellValue(p, r, colKey, value)
      if (e) return e
      normalize(p, ws)
    },
    { rowId },
  )
  // 入れた値は残すが、見落としやすいものは知らせる（止めはしない）
  if (ok && colKey.startsWith('q.')) {
    const p = st().project()
    const r = p.rows.find((x) => x.id === rowId)
    const sid = supplierOfCol(colKey)
    const q = r && sid ? p.quotes.find((x) => x.rowId === r.id && x.supplierId === (sid === 'A' ? r.adoptedSupplierId : sid) && !x.stale) : undefined
    // 概算単価が他社の単価とけた違い（1/5 未満・5 倍超）なら知らせる（数字キーのビュー切替のつもりで「4」が入った など）
    if (r && q && colKey.startsWith('q.unitPrice') && q.unitPrice != null) {
      const others = p.quotes.filter((x) => x.rowId === r.id && !x.stale && x.supplierId !== q.supplierId && x.unitPrice != null).map((x) => x.unitPrice as number).sort((a, b) => a - b)
      const med = others.length ? others[Math.floor(others.length / 2)] : null
      if (med && (q.unitPrice < med / 5 || q.unitPrice > med * 5)) st().toastMsg(`${r.id} の単価 ¥${q.unitPrice.toLocaleString()} は他社（¥${med.toLocaleString()} 前後）とけた違いです。桁・列を確かめてください（Ctrl+Z で戻す）`, 'err')
    }
    if (q && colKey.startsWith('q.validUntil') && q.validUntil && q.validUntil < todayStr()) st().toastMsg(`有効期限 ${q.validUntil} はもう過ぎています（期限切れの見積として扱います）`, 'err')
    if (r && q && colKey.startsWith('q.formalPrice') && q.formalPrice != null) {
      const early = !['formalRequested', 'formalQuoted', 'ordered', 'received'].includes(r.status)
      const pct = q.unitPrice ? Math.round(((q.formalPrice - q.unitPrice) / q.unitPrice) * 100) : null
      if (early || (pct != null && Math.abs(pct) >= 50))
        st().toastMsg(`${r.id} の正式単価 ¥${q.formalPrice.toLocaleString()}${pct != null ? `（概算から ${pct > 0 ? '+' : ''}${pct}%）` : ''}${early ? '。まだ正式見積を依頼していない行です' : ''}。桁・行を確かめてください`, 'err')
    }
  }
  // 発注数が必要数よりけた違いに多い（単価を打つつもりで発注数に入れた など）
  if (ok && colKey === 'orderQty' && typeof value === 'number') {
    const r = st().project().rows.find((x) => x.id === rowId)
    if (r && value > Math.max(r.qtyNeeded * 10, r.qtyNeeded + 100)) st().toastMsg(`${rowId} の発注数 ${value} は必要数 ${r.qtyNeeded} の ${Math.round(value / Math.max(1, r.qtyNeeded))} 倍です。列（発注数）を確かめてください（Ctrl+Z で戻す）`, 'err')
  }
  // 追加費用が PM の決めた特急・分納の上限を超えたら知らせる（止めはしない）
  if (ok && colKey === 'extraCost' && typeof value === 'number') {
    const p = st().project()
    const r = p.rows.find((x) => x.id === rowId)
    const oc = r ? overCap(p, r) : null
    if (oc) st().toastMsg(`追加費用 ¥${value.toLocaleString()} が、PM の決めた特急・分納の上限 ¥${oc.cap.toLocaleString()} を超えています（${oc.decisionId}）。購買の 4・PM の 7 に出します`, 'err')
  }
  return ok
}

/** 1 セルの書き込み（commit の中で使う）。書けなければ理由を返す */
export function applyCellValue(p: Project, r: Row, colKey: string, value: unknown): string | void {
  const d = colDef(colKey)!
  const rowId = r.id
  if (!isActive(r)) return `${r.id} は${r.status === 'cancelled' ? '取消' : '置換'}済の行です（編集できません）`
  // 最小ロットの指摘（直すのは購買）は、発注数を丸め数量以上にしたら対応済（起票者が確認して閉じる）
  // PM が余剰を却下した行（採用商社が同じ）は、発注数を必要数より多くしない
  if (colKey === 'orderQty' && typeof value === 'number' && r.flags.surplusRejected && r.flags.surplusRejected === (r.adoptedSupplierId ?? '-') && value > r.qtyNeeded)
    return `${r.id} は PM が最小ロットの余剰を却下しています（発注数は必要数 ${r.qtyNeeded} まで）。ほかの商社・数量で手配してください。PM にもう一度相談するときは、いまの最小ロットの指摘を見送り（Ctrl+. →「見送り」）にしてから起票し直します`
  // ただし余剰が閾値を超えて PM の判断待ちのあいだは対応済にしない（PM が却下したら戻す）
  if (colKey === 'orderQty' && typeof value === 'number' && !(r.flags.pmPending && r.flags.pmReason === '閾値超'))
    for (const i of p.issues.filter((x) => x.rowId === r.id && x.kind === '最小ロット' && (x.status === 'open' || x.status === 'inProgress')))
      if (value >= surplusOf(p, r).rounded) {
        i.status = 'fixed'
        i.resolution = `発注数を ${value} に（丸め）`
      }
  if (d.perSupplier) {
    // §5: PM 承認待ちの変更セットで足した行は、承認されるまで購買に渡っていない
    if (r.flags.pmPending && r.flags.pmReason === '変更セット' && r.status === 'submitted') return `${r.id} は変更セット（Rev.${r.pendingRev ?? ''}）の PM 承認待ちの追加行です。承認されてから見積を入れます`
    const sid = supplierOfCol(colKey)!
    let q = p.quotes.find((x) => x.rowId === rowId && x.supplierId === sid && !x.stale)
    if (!q) {
      q = emptyQuote(rowId, sid)
      p.quotes.push(q)
    }
    const f = colKey.slice(2, colKey.indexOf('@')) as keyof typeof q
    ;(q as unknown as Record<string, unknown>)[f] = value
    if (f === 'unitPrice' && q.quoteQty == null) q.quoteQty = orderQty(r)
    if (f === 'unitPrice' || f === 'leadDays') q.source = '手入力'
    if (r.status === 'submitted' && value != null) {
      // 依頼書を出さずに回答を入れ始めた（電話・メールで頼んだ）行も、相見積先すべての回答を待つ（1 社の回答だけで見積済にしない。残りの商社には後から依頼できる）
      if (!isFixedProcurement(r)) r.quoteTargets = quoteTargets(p, r)
      setStatus(r, 'quoting')
    }
  } else if (d.design) {
    if (['ordered', 'received'].includes(r.status)) return '発注済以降の行は設計列を変えられません（発注後変更依頼を起票してください）'
    const f = colKey as keyof DesignFields
    if (r.status === 'draft' || r.publishedRev == null) {
      ;(r as unknown as Record<string, unknown>)[f] = value
    } else {
      const w = { ...(r.working ?? {}) } as Record<string, unknown>
      if (JSON.stringify((r as unknown as Record<string, unknown>)[f]) === JSON.stringify(value)) delete w[f]
      else w[f] = value
      r.working = Object.keys(w).length ? (w as Partial<DesignFields>) : undefined
    }
  } else {
    // 追加費用を入れ直したら、前の PM の却下は効かない（同じ額に戻しても、もう一度 PM が決める）
    if (colKey === 'extraCost') r.flags.capRuled = undefined
    // 発注（o）・発注を飛ばした入荷（i）は、同じ条件で止める
    if ((colKey === 'ordered' || colKey === 'received') && value === true && !r.ordered) {
      const block = orderBlock(p, r)
      if (block) return colKey === 'received' ? `入荷にできません（発注前の行）: ${block}` : block
    }
    if (colKey === 'ordered' && value === false && r.received) return '入荷済の行です。先に入荷（i）を外してください'
    // 発注の取り消しは、発注後変更依頼を PM が承認したときだけ（§9.1）。押し間違いは Ctrl+Z で戻す
    if (colKey === 'ordered' && value === false && r.ordered) {
      const req = p.issues.find((i) => i.rowId === r.id && i.kind === '発注後変更依頼' && i.status === 'inProgress' && i.pmRuled)
      if (!r.flags.orderCancelApproved || !req) {
        r.flags.orderCancelApproved = false
        return '発注済を外すには、発注後変更依頼（Alt+Shift+I → h）の PM 承認が要ります（押し間違いは Ctrl+Z で戻せます）'
      }
      // 発注を取り消したら、設計が置き換え品を作る番（設計の 4 に出る。§9.1）
      r.flags.orderCancelApproved = false
      r.flags.countermeasure = '代替品検討'
      req.status = 'confirmed'
      req.resolution = '発注を取り消し、設計が置き換え品を作る（r）'
    }
    ;(r as unknown as Record<string, unknown>)[colKey] = value
    // 入荷記録（発注日・入荷日）を残す。商社の納期遵守率の集計に使う（§8.1）
    if (colKey === 'ordered') r.orderedAt = value === true ? (r.orderedAt ?? todayStr()) : undefined
    if (colKey === 'received') r.receivedAt = value === true ? todayStr() : undefined
    if (colKey === 'received' && value === true) {
      if (!r.ordered) r.orderedAt = r.orderedAt ?? todayStr()
      r.ordered = true
    }
    if (colKey === 'ordered' && value === false && r.status === 'ordered') setStatus(r, r.flags.early ? 'selected' : 'formalQuoted')
    if (colKey === 'received' && value === false && r.status === 'received') setStatus(r, 'ordered')
  }
}

/** 取消・置換を公開値に反映する（公開時、または PM の承認時） */
export function applyRemoval(p: Project, r: Row, rm: Removal, sub?: Submission) {
  // 正式見積を依頼していた行を取消・置換したら、元の商社への正式依頼を取り下げる（購買への知らせ）
  withdrawFormal(p, r, st().ws.suppliers)
  r.removal = undefined
  r.pendingRemoval = undefined
  r.working = undefined
  if (rm.kind === 'cancel') {
    setStatus(r, 'cancelled')
    if (sub) {
      sub.causes[r.id] = '取消'
      sub.summary.cancelled++
    }
  } else {
    // 指摘は置換先へ引き継ぐ
    for (const i of p.issues.filter((x) => x.rowId === r.id && (x.status === 'open' || x.status === 'inProgress' || x.status === 'answered'))) {
      i.status = 'fixed'
      i.resolution = `置換 → ${rm.by}`
      i.movedTo = rm.by
    }
    r.replacedBy = rm.by
    setStatus(r, 'replaced')
    if (sub) sub.causes[r.id] = `置換 → ${rm.by}`
  }
}

/** 発注後変更依頼の承認で発注を外し、設計の置き換えを待っている行か */
export function awaitingReplacement(p: Project, r: Row): boolean {
  return r.flags.countermeasure === '代替品検討' && p.issues.some((i) => i.rowId === r.id && i.kind === '発注後変更依頼' && i.status === 'confirmed')
}
/** PM が発注後変更依頼を承認したが、購買がまだ発注を外していない行か */
export function cancelApprovedNotYet(p: Project, r: Row): boolean {
  return r.ordered && !!r.flags.orderCancelApproved && p.issues.some((i) => i.rowId === r.id && i.kind === '発注後変更依頼' && i.status === 'inProgress' && i.pmRuled)
}
/** 取引先がキャンセルを受けなかった: 置き換えをやめ、もとの発注に戻す（購買。§9.1 の発注後変更依頼の出口） */
export function restoreOrder(rowId: string): string | null {
  const s = st()
  if (s.user().role !== 'purchasing') return '権限なし（発注は購買）'
  const p = s.project()
  const r = p.rows.find((x) => x.id === rowId)
  if (!r || (!awaitingReplacement(p, r) && !cancelApprovedNotYet(p, r))) return `${rowId} は発注後変更依頼の承認で発注を取り消す・取り消した行ではありません`
  if (r.removal || r.pendingRemoval || r.replacedBy) {
    const by = r.replacedBy ?? (r.removal?.kind === 'replace' ? r.removal.by : undefined) ?? (r.pendingRemoval?.kind === 'replace' ? r.pendingRemoval.by : undefined)
    return `${rowId} は設計が置き換えの作業中です。設計に${by ? `置換先の行 ${by} で` : ''} Shift+Delete を押して置換を取りやめてもらってから戻します`
  }
  if (!r.adoptedSupplierId) return `${rowId} は採用商社がありません`
  s.commit('キャンセル不可で発注に戻す', (p2, ws) => {
    const x = p2.rows.find((y) => y.id === rowId)!
    x.flags.countermeasure = undefined
    x.flags.orderCancelApproved = false
    x.ordered = true
    x.orderedAt = x.orderedAt ?? todayStr()
    setStatus(x, 'ordered')
    const req = [...p2.issues].reverse().find((i) => i.rowId === rowId && i.kind === '発注後変更依頼' && (i.status === 'confirmed' || i.status === 'inProgress'))
    if (req) {
      req.status = 'confirmed'
      req.resolution = 'キャンセル不可（取引先が受けず）。もとの発注のまま'
    }
    // 納期NG などを今の発注で見直す（PM の 7 にすぐ出す）
    normalize(p2, ws)
  })
  return null
}

/** 発注できない理由（発注できるなら null）。§4・§9.1: 正式見積済（または先行発注許可）で、PM の決定待ちが無く、採用商社の有効な見積がある行だけ */
export function orderBlock(p: Project, r: Row): string | null {
  if (r.procurement === '支給品' || r.procurement === '社内在庫') return `${r.procurement}の行です（商社に発注しません）`
  if (r.status !== 'formalQuoted' && !r.flags.early) return '正式見積済でないと発注できません（先行発注は PM の許可が要ります。Ctrl+K → 先行発注を申請）'
  if (r.flags.formalDiff) return '正式見積が概算から差分超過です。PM の決定（7 要決定）が出るまで発注できません'
  if (r.flags.pmPending || r.pendingApproval || r.pendingRemoval) return 'PM の承認待ちの行です。承認が出るまで発注できません'
  // 設計が取消・置換の作業中（未公開）の行は、公開されるまで発注しない
  if (r.removal) return '設計が取消・置換の作業中です（設計作業中●）。公開を待ってから発注します'
  if (r.flags.leadNG) return '納期NG の行です。対策（PM の受入・別商社など）が決まるまで発注できません'
  if (awaitingReplacement(p, r)) return '発注を取り消して置き換えを待っている行です（設計が Alt+r で置き換え品を作ります。取引先がキャンセルを受けなかったときは Ctrl+K →「キャンセル不可で発注に戻す」）'
  if (r.flags.requote) return '再見積要の行です（型式・数量の変更で見積が失効）。見積を取り直して採用してから発注します'
  // 正式依頼のあとに数量・型式・必要日が変わった行は、いまの値で正式見積を取り直してから（前の正式単価は前の数量のもの）
  if (r.flags.reissue) return '取下げ・再発行対象の行です（正式依頼のあとに数量・型式・必要日が変更）。Ctrl+K →「正式見積を依頼」で再発行し、回答を受けてから発注します'
  // PM が差分超過などに「設計へ代替依頼」「数量見直し依頼」を出している間は、結論が出るまで発注しない
  const waiting = p.issues.find((i) => i.rowId === r.id && (i.kind === 'コスト超過' || i.kind === '数量見直し依頼' || i.kind === '発注後変更依頼') && ['open', 'inProgress', 'answered'].includes(i.status))
  if (waiting) return `${waiting.id}（${waiting.kind}）の結論が出ていません。対応・確認が済んでから発注します`
  const aq = r.adoptedSupplierId ? p.quotes.find((x) => x.rowId === r.id && x.supplierId === r.adoptedSupplierId && !x.stale && x.unitPrice != null) : undefined
  if (!aq) return '採用商社の有効な見積がありません。採用してから発注します'
  return null
}

export function clearCell(rowId: string, colKey: string) {
  setCell(rowId, colKey, '', 'セルを空にする')
}

export function insertBelow(afterId: string | null): string | null {
  if (st().user().role !== 'design') {
    st().toastMsg('権限なし（行の追加は設計）', 'err')
    return null
  }
  let id: string | null = null
  st().commit('行を追加', (p) => {
    id = nextRowId(p)
    const idx = afterId ? p.rows.findIndex((r) => r.id === afterId) : p.rows.length - 1
    const base = idx >= 0 ? p.rows[idx] : undefined
    p.rows.splice(idx + 1, 0, newRow(id, { category: base ? effective(base).category : '', drawing: base ? effective(base).drawing : '' }))
  })
  return id
}

export function duplicateRow(rowId: string): string | null {
  if (st().user().role !== 'design') {
    st().toastMsg('権限なし（行の複製は設計）', 'err')
    return null
  }
  let id: string | null = null
  st().commit('行を複製', (p) => {
    const idx = p.rows.findIndex((r) => r.id === rowId)
    if (idx < 0) return
    id = nextRowId(p)
    const e = effective(p.rows[idx])
    const copy: Partial<Row> = {}
    for (const f of DESIGN_FIELDS) (copy as Record<string, unknown>)[f] = e[f]
    copy.ref = ''
    p.rows.splice(idx + 1, 0, newRow(id, copy))
  })
  return id
}

export function deleteRow(rowId: string) {
  if (st().user().role !== 'design') return st().toastMsg('権限なし（行の削除は設計）', 'err')
  let msg = ''
  st().commit(
    '行を削除',
    (p, ws) => {
      const idx = p.rows.findIndex((r) => r.id === rowId)
      if (idx < 0) return
      const r = p.rows[idx]
      if (!isActive(r)) return `${r.id} はすでに${r.status === 'cancelled' ? '取消' : '置換'}済です`
      if (r.status === 'draft' && r.publishedRev == null) {
        p.rows.splice(idx, 1)
        p.quotes = p.quotes.filter((q) => q.rowId !== r.id)
        // 置換の作業中に置換先を消したら、置換を取りやめる
        const old = r.replaces ? p.rows.find((x) => x.id === r.replaces) : undefined
        if (old?.removal?.kind === 'replace' && old.removal.by === r.id) old.removal = undefined
        msg = `${rowId} を削除しました${old && !old.removal ? `（${old.id} の置換を取りやめました）` : ''}（Ctrl+Z で戻せます）`
      } else {
        if (['ordered', 'received'].includes(r.status)) return '発注済の行は取り消せません（発注後変更依頼を起票）'
        if (r.pendingRemoval) return `${r.id} の取消・置換は PM の承認待ちです`
        if (r.removal) {
          // もう一度押したら取りやめ
          if (r.removal.kind === 'replace') return `${r.id} は置換の作業中です（置換先 ${r.removal.by} を Shift+Delete で消すと取りやめ）`
          r.removal = undefined
          msg = `${rowId} の取消を取りやめました`
        } else {
          // 提出済の行は、公開するまで設計の作業中（購買には「設計作業中」だけ見える。§5）
          r.removal = { kind: 'cancel' }
          msg = `${rowId} を取消（作業中）にしました。Ctrl+Enter で公開すると購買に伝わります（もう一度 Shift+Delete で取りやめ）`
        }
      }
      normalize(p, ws)
    },
    { rowId },
  )
  if (msg) st().toastMsg(msg, 'info')
}

export function moveRow(rowId: string, dir: -1 | 1) {
  if (st().user().role !== 'design') return st().toastMsg('権限なし（行の並びは設計）', 'err')
  st().commit('行を移動', (p) => {
    const idx = p.rows.findIndex((r) => r.id === rowId)
    const j = idx + dir
    if (idx < 0 || j < 0 || j >= p.rows.length) return
    ;[p.rows[idx], p.rows[j]] = [p.rows[j], p.rows[idx]]
  })
}

export function toggleHidden(rowId: string) {
  let hidden = false
  st().commit('行を隠す/戻す', (p) => {
    const r = p.rows.find((x) => x.id === rowId)
    if (r) {
      r.hidden = !r.hidden
      hidden = r.hidden
    }
  })
  st().toastMsg(hidden ? `${rowId} を隠しました（「1 すべて」で薄く表示。Alt+h でもう一度押すと戻る）` : `${rowId} を表示に戻しました`, 'info')
}

/** 置き換え品を作る。指摘・見積・状態を新行に引き継ぎ「要再確認」 */
export function replaceRow(rowId: string, preset?: { model: string; maker: string }): string | null {
  if (st().user().role !== 'design') {
    st().toastMsg('権限なし（置換は設計）', 'err')
    return null
  }
  let id: string | null = null
  st().commit(
    `置換 ${rowId}`,
    (p, ws) => {
      const idx = p.rows.findIndex((r) => r.id === rowId)
      if (idx < 0) return
      const old = p.rows[idx]
      if (!isActive(old)) return `${old.id} は${old.status === 'cancelled' ? '取消' : '置換'}済の行です（置換できません）`
      if (['ordered', 'received'].includes(old.status)) return '発注済の行は置換できません（発注後変更依頼を起票）'
      if (old.removal || old.pendingRemoval) return `${old.id} は取消・置換の作業中です`
      id = nextRowId(p)
      const e = effective(old)
      const copy: Partial<Row> = {}
      for (const f of DESIGN_FIELDS) (copy as Record<string, unknown>)[f] = e[f]
      if (preset) {
        copy.model = preset.model
        copy.maker = preset.maker
      }
      const nr = newRow(id, { ...copy, replaces: old.id, status: 'draft' })
      if (old.status !== 'draft') nr.flags.reconfirm = true
      p.rows.splice(idx + 1, 0, nr)
      // 見積のコピー
      for (const q of p.quotes.filter((x) => x.rowId === old.id && !x.stale)) p.quotes.push({ ...structuredClone(q), rowId: id!, formalPrice: null, formalLeadDays: null, formalValidUntil: null, formalDiffReason: '', formalRequestNo: undefined })
      if (old.status === 'draft' && old.publishedRev == null) applyRemoval(p, old, { kind: 'replace', by: id! })
      // 提出済の行は、公開するまで設計の作業中（購買には元の行がそのまま見える）
      else old.removal = { kind: 'replace', by: id! }
      normalize(p, ws)
    },
    { rowId },
  )
  return id
}

export interface PublishPlan {
  rows: Row[]
  draftIssues: Issue[]
  blockedErrors: Array<{ rowId: string; message: string }>
  blockedWarnings: Array<{ rowId: string; message: string }>
  deferred: string[]
  /** 指摘対応でない変更がある行（変更セット。提出後の追加・置換・取消も含む） */
  nonIssueChanges: string[]
  /** 取消して、まだ購買に伝えていない行 */
  cancelled: string[]
  /** 指摘対応の行 */
  issueFixes: Array<{ rowId: string; issue: Issue }>
  /** 直前の Rev に追記できるか */
  canAppend: boolean
}

/** 「あとで」にした問題のうち、まだ残っているもの */
export function activeDeferred(r: Row, rules: Parameters<typeof checkRow>[1], p: Project): string[] {
  if (!r.deferredRules.length) return []
  const live = new Set(checkRow(r, rules, p).map((x) => x.ruleId))
  return r.deferredRules.filter((id) => live.has(id))
}

/** 提出（公開）の計画。ゲート判定と変更理由の要否 */
export function planPublish(p: Project, rules: Parameters<typeof checkRow>[1], user: { name: string; role: Role }, rowIds?: string[]): PublishPlan {
  const isDesign = user.role === 'design'
  const targets = isDesign ? p.rows.filter((r) => isActive(r) && (rowIds ? rowIds.includes(r.id) : true) && ((r.status === 'draft' && r.publishedRev == null && (r.name || r.model)) || hasWork(r))) : []
  const cancelled = isDesign ? p.rows.filter((r) => r.status === 'cancelled' && r.publishedRev != null && !p.submissions.some((sb) => sb.causes[r.id] === '取消') && (!rowIds || rowIds.includes(r.id))).map((r) => r.id) : []
  const draftIssues = p.issues.filter((i) => i.status === 'draft' && i.by.name === user.name)
  const last = p.submissions.at(-1)
  const plan: PublishPlan = { rows: targets, draftIssues, blockedErrors: [], blockedWarnings: [], deferred: [], nonIssueChanges: [...cancelled], cancelled, issueFixes: [], canAppend: !!last && last.by.name === user.name && !last.acked.some((a) => !a.includes('@') || a.endsWith('@purchasing')) && !last.revoked && !last.changeSet }
  const afterFirst = p.submissions.length > 0
  for (const r of targets) {
    // 取消・置換は設計変更（提案の適用で作った置換は指摘対応）。消える行のチェック結果は公開を止めない
    if (r.removal) {
      const by = r.removal.kind === 'replace' ? p.rows.find((x) => x.id === (r.removal as { by: string }).by) : undefined
      if (afterFirst && !by?.fromIssue) plan.nonIssueChanges.push(r.id)
      continue
    }
    for (const pr of checkRow(r, rules, p)) {
      if (pr.severity === 'error') plan.blockedErrors.push({ rowId: r.id, message: pr.message })
      else if (!r.ackRules.includes(pr.ruleId) && !r.deferredRules.includes(pr.ruleId)) plan.blockedWarnings.push({ rowId: r.id, message: pr.message })
    }
    if (activeDeferred(r, rules, p).length) plan.deferred.push(r.id)
    // 提出後に足した行・手で置き換えた行は設計変更（提案の適用で作った行は指摘対応）
    if (r.status === 'draft' && r.publishedRev == null && afterFirst && !r.fromIssue) plan.nonIssueChanges.push(r.id)
    if (r.working) {
      const changed = Object.keys(r.working)
      const open = p.issues.filter((i) => i.rowId === r.id && (i.status === 'open' || i.status === 'inProgress') && resolverOfIssue(i) === 'design')
      // 指摘が付いたセルが変わったときだけ対応済
      const fixes = open.filter((i) => (i.field ? changed.includes(i.field as string) : changed.includes('model') || changed.includes('maker')))
      for (const i of fixes) plan.issueFixes.push({ rowId: r.id, issue: i })
      const explained = new Set(fixes.map((i) => i.field as string))
      if (changed.some((f) => !explained.has(f) && !(fixes.length && (f === 'maker' || f === 'model') && fixes.some((i) => i.kind === '廃番' || i.kind === '代替提案')))) plan.nonIssueChanges.push(r.id)
    }
  }
  return plan
}

/** 公開済の行に設計の変更を反映する（公開時、または変更セットの PM 承認時）。見積・状態・フラグも仕様どおりに動かす */
export function applyDesignChange(p: Project, r: Row, values: Partial<DesignFields>, fixedIssueIds: string[], summary?: Submission['summary']) {
  const before = { ...r }
  const changed = (Object.keys(values) as (keyof DesignFields)[]).filter((k) => JSON.stringify(values[k]) !== JSON.stringify(before[k]))
  Object.assign(r, values)
  // 指定系から相見積に変えた（まだ採用していない）行は、相見積先すべてに頼むつもりにする（残りの商社に依頼できる）
  if (changed.includes('procurement') && !isFixedProcurement(r) && isFixedProcurement(before) && ['submitted', 'quoting', 'quoted'].includes(r.status)) r.quoteTargets = quoteTargets(p, r)
  const inFlight = ['quoting', 'quoted', 'selected', 'formalRequested', 'formalQuoted'].includes(r.status)
  const formalStage = ['formalRequested', 'formalQuoted'].includes(r.status)
  if (changed.includes('model') || changed.includes('maker')) {
    if (summary) summary.modelChanged++
    const sameNorm = normalizeModel(before.model) === normalizeModel(r.model) && before.maker === r.maker
    const hasQuotes = p.quotes.some((x) => x.rowId === r.id && !x.stale && x.unitPrice != null)
    if (inFlight) {
      if (sameNorm) r.flags.notation = true
      else if (fixedIssueIds.length && hasQuotes) {
        r.flags.reconfirm = true
        r.flags.pmReason = undefined
      } else {
        r.flags.requote = true
        withdrawFormal(p, r, st().ws.suppliers)
        r.adoptedSupplierId = undefined
        r.scoreSnapshot = undefined
        // 旧型式の見積は履歴に。新しい型式の見積の枠は、購買が頼み直したときに作る（頼む商社は新しいメーカで選び直す）
        for (const q of p.quotes.filter((x) => x.rowId === r.id && !x.stale)) {
          q.stale = true
          q.staleModel = before.model
        }
        r.quoteTargets = undefined
        if (['selected', 'formalRequested', 'formalQuoted'].includes(r.status)) setStatus(r, 'submitted')
        // 採用・先行採用・先行発注・差分超過の判断は旧型式に対するもの。新しい型式で見積から出し直す
        r.flags.early = undefined
        r.flags.formalDiff = undefined
        if (r.flags.pmReason && ['例外選定', '先行採用', '先行発注判断', '差分超過', '閾値超', '再選定提案'].includes(r.flags.pmReason)) {
          r.flags.pmPending = undefined
          r.flags.pmReason = undefined
        }
      }
      if (formalStage && !sameNorm) r.flags.reissue = true
    }
    if (r.altPolicy === '客先承認要' && !sameNorm) r.flags.altPending = true
  }
  if (changed.includes('qtyNeeded')) {
    if (summary && !changed.includes('model')) summary.qtyChanged++
    const q0 = before.qtyNeeded || 1
    const q1 = r.qtyNeeded
    const pct = Math.abs(q1 - q0) / q0
    const crossMoq = p.quotes.some((x) => x.rowId === r.id && !x.stale && x.moq != null && (x.moq > q0) !== (x.moq > q1))
    if (formalStage) {
      r.flags.reissue = true
      r.flags.requote = true
    } else if (inFlight && (pct > p.settings.qtyTolerancePct || crossMoq)) r.flags.requote = true
    else if (inFlight) r.flags.priceCheck = true
    if (r.adoptedSupplierId) {
      const aq = p.quotes.find((x) => x.rowId === r.id && x.supplierId === r.adoptedSupplierId && !x.stale)
      // PM が余剰を却下した商社のままなら、MOQ で丸めない（却下した数に戻さない）
      const rejected = !!r.flags.surplusRejected && r.flags.surplusRejected === r.adoptedSupplierId
      const recalculated = rejected ? q1 : roundedQty(q1, aq?.moq, r.packQty, r.unit)
      const wasManual = r.orderQty != null && r.orderQty !== roundedQty(q0, aq?.moq, before.packQty, before.unit)
      r.orderQty = recalculated
      if (wasManual) r.flags.orderQtyCheck = true
    }
  }
  if ((changed.includes('needOffset') || changed.includes('needDateFixed')) && formalStage) r.flags.reissue = true
  if (summary && !changed.some((c) => c === 'model' || c === 'maker' || c === 'qtyNeeded')) summary.other++
}

export type PublishMode = 'new' | 'append'

/** 公開（Ctrl+Enter）：自分の未公開の行 ＋ 自分の下書き指摘 */
export function publish(rowIds: string[] | undefined, changeSet?: { reason: ChangeReason; changeNo: string }, mode: PublishMode = 'new'): boolean {
  const s = st()
  const user = s.user()
  const plan = planPublish(s.project(), s.ws.rules, user, rowIds)
  if (plan.rows.length === 0 && plan.draftIssues.length === 0 && plan.cancelled.length === 0) {
    s.toastMsg('公開するものがありません（未公開の行・下書き指摘なし）', 'info')
    return false
  }
  if (plan.blockedErrors.length) {
    const b = plan.blockedErrors[0]
    s.toastMsg(`公開できません: エラー ${plan.blockedErrors.length} 件（${b.rowId} ${b.message} … F8 で移動して直す）`, 'err')
    return false
  }
  if (plan.blockedWarnings.length) {
    const b = plan.blockedWarnings[0]
    s.toastMsg(`公開できません: 未確認の警告 ${plan.blockedWarnings.length} 件（${b.rowId} ${b.message} … 直すか Alt+x で確認済みに）`, 'err')
    return false
  }
  if (plan.deferred.length) {
    s.toastMsg(`公開できません: 「あとで」にした問題が ${plan.deferred.length} 行に残っています（${plan.deferred[0]}。直すか、警告なら Alt+x で確認済みに）`, 'err')
    return false
  }
  if (plan.nonIssueChanges.length && !changeSet) return false // UI が理由を聞いてから再呼び出し
  let msg = ''
  s.commit(`公開`, (p, ws) => {
    const now = new Date().toISOString()
    const today = todayStr()
    // 指摘の発行
    let issued = 0
    for (const i of p.issues) if (i.status === 'draft' && i.by.name === user.name) {
      i.status = 'open'
      i.rev = p.submissions.at(-1)?.rev
      i.at = now
      const def = ISSUE_KINDS.find((k) => k.kind === i.kind)!
      i.dueAt = addBusinessDays(today, def.dueDays, p.settings.holidays)
      routeSurplusToPm(p, i)
      issued++
    }
    // 行の公開：指摘対応と変更セットを別 Rev に分ける
    const fixRows = plan.rows.filter((r) => !plan.nonIssueChanges.includes(r.id))
    const csRows = plan.rows.filter((r) => plan.nonIssueChanges.includes(r.id))
    const cancelGroupIsCs = plan.cancelled.length > 0
    const revs: number[] = []
    const needsApproval = !!changeSet && p.settings.changeNeedsPmApproval
    for (const [group, isCs] of [[fixRows, false], [csRows, true]] as Array<[Row[], boolean]>) {
      if (group.length === 0 && !(isCs && cancelGroupIsCs)) continue
      let sub: Submission
      const last = p.submissions.at(-1)
      if (mode === 'append' && !isCs && last && plan.canAppend) sub = last
      else {
        sub = { rev: (last?.rev ?? 0) + 1, at: now, by: user, rowIds: [], summary: { added: 0, modelChanged: 0, qtyChanged: 0, other: 0, cancelled: 0 }, snapshot: {}, causes: {}, acked: [] }
        if (isCs && changeSet) sub.changeSet = { ...changeSet, approved: !needsApproval }
        p.submissions.push(sub)
      }
      revs.push(sub.rev)
      for (const t of group) {
        const r = p.rows.find((x) => x.id === t.id)!
        if (!sub.rowIds.includes(r.id)) sub.rowIds.push(r.id)
        if (r.removal) {
          const rm = r.removal
          if (isCs && needsApproval) {
            // PM の承認まで公開値は変えない
            r.removal = undefined
            r.pendingRemoval = rm
            r.flags.pmPending = true
            r.flags.pmReason = '変更セット'
            r.pendingRev = sub.rev
            sub.causes[r.id] = rm.kind === 'cancel' ? '取消（承認待ち）' : `置換 → ${rm.by}（承認待ち）`
          } else applyRemoval(p, r, rm, sub)
        } else if (r.status === 'draft' && r.publishedRev == null) {
          setStatus(r, 'submitted')
          sub.summary.added++
          sub.causes[r.id] = r.replaces ? `置換 ${r.replaces}` : '追加'
          // 見積の枠は依頼したときに作る（頼んでいない商社の回答を待たない。回答待ちの数は頼んだ商社だけ）
        } else if (r.working) {
          const values = r.working
          r.working = undefined
          const fixed = plan.issueFixes.filter((f) => f.rowId === r.id)
          for (const f of fixed) {
            const i = p.issues.find((x) => x.id === f.issue.id)!
            i.status = 'fixed'
            i.resolution = Object.keys(values).map((c) => `${c}: ${String((r as unknown as Record<string, unknown>)[c] ?? '')} → ${String((values as Record<string, unknown>)[c] ?? '')}`).join(', ')
          }
          // 他セルだけ変わった未対応指摘は「対応中」
          for (const i of p.issues) if (i.rowId === r.id && i.status === 'open' && resolverOfIssue(i) === 'design' && !fixed.some((f) => f.issue.id === i.id)) i.status = 'inProgress'
          sub.causes[r.id] = fixed.length ? fixed.map((f) => f.issue.id).join(',') : `変更セット #${sub.rev}${changeSet?.changeNo ? ' ' + changeSet.changeNo : ''}`
          if (isCs && needsApproval) {
            // PM の承認まで公開値は変えない（購買には「承認待ちの変更あり」だけ見える）
            r.pendingApproval = { ...(r.pendingApproval ?? {}), ...values }
            // 承認待ちの前の変更セットの行をまとめたら、その行がもう残っていない前の Rev は「まとめた」にする（あとの Rev の決定に従う）
            const oldRev = r.pendingRev
            r.pendingRev = sub.rev
            if (oldRev != null && oldRev !== sub.rev) {
              const old = p.submissions.find((x) => x.rev === oldRev)
              if (old?.changeSet) {
                // この行の前の変更は、あとの変更セットで決める（前の Rev の承認では反映しない・「承認」と出さない）
                old.changeSet.merged = { ...(old.changeSet.merged ?? {}), [r.id]: sub.rev }
                if (!p.rows.some((x) => x.pendingRev === oldRev)) old.changeSet.supersededBy = sub.rev
              }
            }
            r.flags.pmPending = true
            r.flags.pmReason = '変更セット'
            sub.summary.other++
          } else {
            // 承認待ちの変更セットと同じ項目を、あとから指摘対応などで公開したら、そちらが新しい値（承認で古い値に戻さない）
            if (r.pendingApproval) {
              const pa = { ...r.pendingApproval } as Record<string, unknown>
              for (const k of Object.keys(values)) delete pa[k]
              r.pendingApproval = Object.keys(pa).length ? (pa as Row['pendingApproval']) : undefined
            }
            applyDesignChange(p, r, values, fixed.map((f) => f.issue.id), sub.summary)
          }
        }
        if (isCs && needsApproval && r.status === 'submitted' && !r.pendingApproval) {
          // 提出後に追加した行も承認まで保留
          r.flags.pmPending = true
          r.flags.pmReason = '変更セット'
          r.pendingRev = sub.rev
        }
        r.publishedRev = sub.rev
        r.lastChangeCause = sub.causes[r.id] ?? r.lastChangeCause
        r.deferredRules = r.deferredRules.filter((id) => activeDeferred(r, ws.rules, p).includes(id))
        // 承認待ちの値は、その変更セットの Rev のスナップショットにだけ入れる（ほかの Rev には公開値。§5）
        sub.snapshot[r.id] = { ...pick(r.pendingApproval && r.pendingRev === sub.rev ? { ...r, ...r.pendingApproval } : r), status: r.status }
        if (r.status === 'submitted') r.dueAt = addBusinessDays(today, 1, p.settings.holidays)
      }
      // 取消行も差分に（変更セットの Rev に入れる）
      if (isCs || !cancelGroupIsCs) for (const r of p.rows) if (r.status === 'cancelled' && r.publishedRev != null && !p.submissions.some((sb) => sb.causes[r.id] === '取消')) {
        sub.rowIds.push(r.id)
        sub.causes[r.id] = '取消'
        sub.summary.cancelled++
        r.publishedRev = sub.rev
      }
      const sm = sub.summary
      p.events.push({ id: (p.events.at(-1)?.id ?? 0) + 1, at: now, by: user, text: `公開 Rev.${sub.rev}（追加${sm.added} / 型式${sm.modelChanged} / 数量${sm.qtyChanged} / その他${sm.other} / 取消${sm.cancelled}）${isCs && needsApproval ? ' PM承認待ち' : ''}` })
    }
    // Rev.1 で案件設定確定を PM の要決定に載せる
    if (revs.includes(1) && !p.settings.pmConfirmed && !p.caseDecisions.some((c) => c.kind === '案件設定確定')) p.caseDecisions.push({ id: 'C1', kind: '案件設定確定', status: 'open', at: now })
    normalize(p, ws)
    msg = [plan.rows.length ? `行 ${plan.rows.length}（Rev.${revs.join('・')}）` : '', issued ? `指摘 ${issued} 件` : ''].filter(Boolean).join(' / ') + ' を公開しました' + (revs.length === 1 && revs[0] === 1 && !changeSet ? '（最初の公開は変更理由を聞きません。2 回目からは理由のダイアログが出ます）' : '')
  }, { kind: plan.rows.length ? 'publish' : 'normal' })
  s.toastMsg(msg, 'ok')
  return true
}

/** 見積を依頼する商社（調達区分に応じて） */
export function quoteTargets(p: Project, r: Row): string[] {
  const e = effective(r)
  if (e.procurement === '支給品' || e.procurement === '社内在庫') return []
  if (isFixedProcurement(e)) {
    const sid = fixedSupplierId(p, { ...r, ...e } as Row, st().ws.suppliers)
    return sid ? [sid] : p.supplierIds.slice(0, 1)
  }
  return makerTargets(p, e.maker, st().ws.suppliers)
}

function pick(e: DesignFields): DesignFields {
  const o = {} as DesignFields
  for (const f of DESIGN_FIELDS) (o as unknown as Record<string, unknown>)[f] = e[f]
  return o
}


export function ackRule(rowId: string, ruleId: string) {
  st().commit('警告を確認済み', (p) => {
    const r = p.rows.find((x) => x.id === rowId)
    if (!r) return
    if (r.ackRules.includes(ruleId)) r.ackRules = r.ackRules.filter((x) => x !== ruleId)
    else {
      r.ackRules.push(ruleId)
      r.deferredRules = r.deferredRules.filter((x) => x !== ruleId)
    }
  })
}

/** 「あとで」の切り替え（もう一度で外す） */
export function deferRule(rowId: string, ruleId: string): boolean {
  let on = false
  st().commit('あとで直す', (p) => {
    const r = p.rows.find((x) => x.id === rowId)
    if (!r) return
    if (r.deferredRules.includes(ruleId)) r.deferredRules = r.deferredRules.filter((x) => x !== ruleId)
    else {
      r.deferredRules.push(ruleId)
      on = true
    }
  })
  return on
}

export function applyFix(rowId: string, patch: Partial<Row>, label: string) {
  for (const [k, v] of Object.entries(patch)) setCell(rowId, k, v == null ? '' : String(v), label)
}

/** Excel 貼り付け（タブ区切り）を複数セルに流し込む。1 回の操作として記録し、読めないセルは理由を出す */
export function pasteCells(startRowId: string, startCol: string, visibleCols: string[], orderedRowIds: string[], text: string) {
  // Excel の改行入りセル（"…" で囲まれる）を 1 セルとして読む
  const lines = parseTable(text, '\t')
  if (lines.length && lines.at(-1)!.every((c) => c === '')) lines.pop()
  const c0 = visibleCols.indexOf(startCol)
  const r0 = orderedRowIds.indexOf(startRowId)
  if (c0 < 0 || r0 < 0) return
  const role = st().user().role
  const cells: Array<{ row: number; col: string; value: unknown }> = []
  const errors: string[] = []
  let skipped = 0
  lines.forEach((line, i) => {
    line.forEach((v, j) => {
      const col = visibleCols[c0 + j]
      if (!col) return
      if (canEdit(col)) {
        skipped++
        return
      }
      const parsed = parseValue(col, v)
      if (!parsed.ok) errors.push(`${i + 1}行目 ${colDef(col)?.label}: ${parsed.error}`)
      else cells.push({ row: i, col, value: parsed.value })
    })
  })
  if (errors.length) {
    st().toastMsg(`貼り付けできません（${errors.length} セル）: ${errors[0]}`, 'err')
    return
  }
  const needNew = Math.max(0, r0 + lines.length - orderedRowIds.length)
  if (needNew && role !== 'design') {
    st().toastMsg('貼り付けが表の最後を超えています（行の追加は設計）', 'err')
    return
  }
  let count = 0
  const ok = st().commit('貼り付け', (p, ws) => {
    const ids = [...orderedRowIds]
    for (let k = 0; k < needNew; k++) {
      const id = nextRowId(p)
      const last = p.rows.findIndex((r) => r.id === ids[ids.length - 1])
      p.rows.splice(last + 1, 0, newRow(id))
      ids.push(id)
    }
    for (const c of cells) {
      const r = p.rows.find((x) => x.id === ids[r0 + c.row])
      if (!r) continue
      const e = applyCellValue(p, r, c.col, c.value)
      if (e) return `${r.id}: ${e}`
      count++
    }
    normalize(p, ws)
  })
  if (ok) st().toastMsg(`${count} セルを貼り付けました${needNew ? `（${needNew} 行追加）` : ''}${skipped ? `。書けない列 ${skipped} セルは飛ばしました` : ''}（Ctrl+Z で一度に戻せます）`, 'ok')
}
