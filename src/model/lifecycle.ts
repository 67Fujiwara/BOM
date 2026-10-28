import type { Project, Row, Workspace } from './types'
import { addDays, todayStr } from './dates'
import { addWithdrawn, fixedSupplierId, isActive, makerTargets, isFixedProcurement, isQuotable, quoteComplete, roundedQty, rowNeedDate, tradableIn, clearAdoptionMeasures } from './derive'

/** 変更後に状態・フラグを整合させる（commit の最後に必ず呼ぶ） */
export function normalize(p: Project, ws: Workspace, today = todayStr()) {
  const now = new Date().toISOString()
  for (const r of p.rows) {
    if (!isActive(r)) continue
    // 取引停止で外した採用の知らせは、選び直したら外す
    if (r.flags.droppedStopped && r.adoptedSupplierId) r.flags.droppedStopped = undefined
    // 発注済の行の再発行の印は使えない（発注後の変更は発注後変更依頼で扱う）。前の版で残った印を外す
    if (r.flags.reissue && ['ordered', 'received'].includes(r.status)) r.flags.reissue = false
    // 見積対象外は選定をスキップして「選定済（固定）」
    // 見積対象外（支給品・社内在庫）の行に、見積の印（再見積要・要再確認）は要らない
    if (!isQuotable(r) && (r.flags.requote || r.flags.reconfirm)) {
      r.flags.requote = false
      r.flags.reconfirm = false
    }
    if (!isQuotable(r) && ['submitted', 'quoting', 'quoted'].includes(r.status)) {
      r.status = 'selected'
      r.statusChangedAt = now
    }
    // 採用した商社があとから「取扱なし」（辞退）になったら採用を外す（§3.2・§8.1: 辞退は選定の対象外）。
    // 相見積は選び直し（見積済）、指定系は次の商社・指定先の変更へ（見積中）。発注済は発注後変更依頼で扱う
    if (r.adoptedSupplierId && ['selected', 'formalRequested', 'formalQuoted'].includes(r.status)) {
      const aq = p.quotes.find((x) => x.rowId === r.id && x.supplierId === r.adoptedSupplierId && !x.stale)
      if (aq && aq.leadDays === -1) {
        // この商社の納期・価格について出した依頼（納期NG・コスト超過）は取り下げ（選び直しで判定し直す）
        for (const i of p.issues)
          if (i.rowId === r.id && (i.kind === '納期NG' || i.kind === 'コスト超過' || i.kind === '数量見直し依頼') && ['open', 'inProgress', 'answered'].includes(i.status)) {
            i.status = 'confirmed'
            i.resolution = '採用商社の辞退で取り下げ（選び直し）'
          }
        // 特急・分納の手配もこの商社とのもの
        if (!r.ordered) {
          r.extraCost = null
          r.extraCostKind = ''
        }
        r.adoptedSupplierId = undefined
        r.adoptReason = undefined
        r.scoreSnapshot = undefined
        r.flags.contested = false
        aq.formalPrice = null
        aq.formalLeadDays = null
        // 納期NG・期限は辞退した商社の見積に対するもの。選び直しのあとで判定し直す
        r.flags.leadNG = false
        r.flags.countermeasure = undefined
        r.dueAt = undefined
        const others = p.quotes.some((x) => x.rowId === r.id && !x.stale && x.supplierId !== aq.supplierId && x.unitPrice != null && x.leadDays !== -1)
        r.status = isFixedProcurement(r) || !others || !quoteComplete(p, r, today) ? 'quoting' : 'quoted'
        r.statusChangedAt = now
      }
    }
    // 調達区分を変えた行: 指定先（固定）の採用は相見積では使わない（ほかの商社にも頼み直す）。
    // 相見積の採用は、指定系に変えたら指定先でなければ外す。発注済は発注後変更依頼で扱う
    if (r.adoptedSupplierId && !['ordered', 'received'].includes(r.status)) {
      const fixed = isFixedProcurement(r)
      const want = fixed ? fixedSupplierId(p, { ...r, adoptedSupplierId: undefined }, ws.suppliers) : null
      // 指定商社は指定先を変えたら（設計が直して公開）その商社に。客先指定品は採用した依頼先のまま（スコアで選んだ採用だけ外す）
      // 支給品・社内在庫に変えたら、商社の採用・正式依頼は使わない（§3.4: 見積なし）
      const mismatch = !isQuotable(r) || !ws.suppliers.some((s) => s.id === r.adoptedSupplierId) || ws.suppliers.find((s) => s.id === r.adoptedSupplierId)?.tradable === false || (fixed ? (r.procurement === '指定商社' ? want !== r.adoptedSupplierId : r.adoptReason !== '指定先（固定）' && want !== r.adoptedSupplierId) : r.adoptReason === '指定先（固定）')
      if (mismatch) {
        const stoppedSup = ws.suppliers.find((s) => s.id === r.adoptedSupplierId && s.tradable === false)
        if (stoppedSup) r.flags.droppedStopped = stoppedSup.name
        else if (!ws.suppliers.some((s) => s.id === r.adoptedSupplierId)) r.flags.droppedStopped = `${r.adoptedSupplierId}（商社マスタから削除）`
        // 前の商社への対策（特急・分納の追加費用・対策区分・納期NG）も、この採用ごと取り下げる
        clearAdoptionMeasures(p, r, '調達区分・指定先の変更で取り下げ（選び直し）')
        // 前の採用商社の正式回答・差分超過も取り下げる（選び直して依頼したら新しい回答を待つ）。正式依頼中・正式見積済なら取り下げを購買に知らせる
        const oldQ = p.quotes.find((x) => x.rowId === r.id && x.supplierId === r.adoptedSupplierId && !x.stale)
        if (oldQ) {
          if (oldQ.formalRequestNo && ['formalRequested', 'formalQuoted'].includes(r.status)) r.flags.formalWithdrawn = addWithdrawn(r.flags.formalWithdrawn, `${ws.suppliers.find((x) => x.id === oldQ.supplierId)?.name ?? oldQ.supplierId} ${oldQ.formalRequestNo}`)
          oldQ.formalPrice = null
          oldQ.formalLeadDays = null
          oldQ.formalValidUntil = null
          oldQ.formalDiffReason = ''
          oldQ.formalRequestNo = undefined
        }
        r.flags.reissue = false
        r.adoptedSupplierId = undefined
        r.adoptReason = undefined
        r.scoreSnapshot = undefined
        r.flags.contested = false
        // 相見積に戻した行は、相見積先すべての回答で見積済を判定する（回答済みの商社に頼み直さない）
        r.quoteTargets = !isQuotable(r) ? [] : fixed ? undefined : makerTargets(p, r.maker, ws.suppliers)
        r.status = !isQuotable(r) ? 'selected' : fixed || p.quotes.some((x) => x.rowId === r.id && !x.stale) ? 'quoting' : 'submitted'
        r.statusChangedAt = now
        r.dueAt = undefined
      }
    }
    // 支給品・社内在庫から相見積に戻した行（選定済で採用なし）は、見積から出し直す（残っている見積で見積済、無ければ見積中・提出済）
    if (r.procurement === '相見積' && r.status === 'selected' && !r.adoptedSupplierId) {
      const live = p.quotes.some((x) => x.rowId === r.id && !x.stale)
      if (!r.quoteTargets?.length) r.quoteTargets = makerTargets(p, r.maker, ws.suppliers)
      r.status = !live ? 'submitted' : quoteComplete(p, r, today) ? 'quoted' : 'quoting'
      r.statusChangedAt = now
    }
    // 見積済の相見積の行で、取引できる商社の有効な見積が無くなった（取引停止にした）ら、選べないので見積中に戻す（購買が次の商社に頼む）
    if (!isFixedProcurement(r) && isQuotable(r) && !r.adoptedSupplierId && r.status === 'quoted' && !p.quotes.some((x) => x.rowId === r.id && !x.stale && x.unitPrice != null && x.leadDays !== -1 && tradableIn(ws.suppliers, x.supplierId))) {
      r.status = 'quoting'
      r.statusChangedAt = now
    }
    // 指定系に変えた見積済の行で、指定先の有効な見積がまだ無ければ見積中に戻す（指定先に頼む）
    if (isFixedProcurement(r) && !r.adoptedSupplierId && r.status === 'quoted') {
      const sid = fixedSupplierId(p, r, ws.suppliers)
      if (!p.quotes.some((x) => x.rowId === r.id && !x.stale && x.supplierId === sid && x.unitPrice != null && x.leadDays !== -1)) {
        r.status = 'quoting'
        r.statusChangedAt = now
      }
    }
    // 指定商社・客先指定品: 指定先の有効な見積が来たら、スコアなしで指定先を採用して選定済（§3.4）
    if (isFixedProcurement(r) && !r.adoptedSupplierId && ['submitted', 'quoting', 'quoted', 'selected'].includes(r.status)) {
      const sid0 = fixedSupplierId(p, r, ws.suppliers)
      // 取引停止の指定先は採用しない（採用を外したあとに採用し直さない。設計が指定先を変える）
      const sid = sid0 && tradableIn(ws.suppliers, sid0) ? sid0 : null
      const q = sid ? p.quotes.find((x) => x.rowId === r.id && x.supplierId === sid && !x.stale && x.unitPrice != null && x.leadDays !== -1) : undefined
      if (q && sid && r.publishedRev != null) {
        r.adoptedSupplierId = sid
        r.adoptReason = '指定先（固定）'
        r.orderQty = roundedQty(r.qtyNeeded, q.moq, r.packQty, r.unit)
        if (r.status !== 'selected') {
          if (!r.quotedAt) r.quotedAt = today
          r.status = 'selected'
          r.statusChangedAt = now
        }
      } else if (r.status === 'selected') {
        // 指定先の見積がまだ無いのに選定済で止まっている行は、見積の依頼に戻す
        r.status = 'submitted'
        r.statusChangedAt = now
      }
    }
    // 見積中 → 見積済（指定系の行は、指定先の有効な見積が来たとき。辞退だけなら購買が次の商社に頼むまで見積中のまま）
    // 指定系の行は指定先（いまの依頼先）の有効な見積だけを見る（ほかの商社の見積があっても見積済にしない）
    const fixedSid = isFixedProcurement(r) ? fixedSupplierId(p, r, ws.suppliers) : null
    const fixedWaiting = isFixedProcurement(r) && !p.quotes.some((x) => x.rowId === r.id && !x.stale && x.supplierId === fixedSid && x.unitPrice != null && x.leadDays !== -1)
    if (r.status === 'quoting' && !fixedWaiting && quoteComplete(p, r, today)) {
      r.status = 'quoted'
      r.statusChangedAt = now
      r.quotedAt = today
      // 期限到達で未回答の商社は辞退扱い
      for (const q of p.quotes) if (q.rowId === r.id && !q.stale && q.unitPrice == null && q.leadDays == null && p.settings.quoteDeadline && p.settings.quoteDeadline < today) q.leadDays = -1
    }
    // 正式見積の回答 → 正式見積済
    if (r.status === 'formalRequested' && r.adoptedSupplierId) {
      const q = p.quotes.find((x) => x.rowId === r.id && x.supplierId === r.adoptedSupplierId && !x.stale)
      if (q?.formalPrice != null) {
        r.status = 'formalQuoted'
        r.statusChangedAt = now
      }
    }

    // 納期NG（採用済みの商社納期が必要日を超える）。対策区分が付いていれば外す
    const need = rowNeedDate(p, r)
    if (need && r.adoptedSupplierId && ['selected', 'formalRequested', 'formalQuoted'].includes(r.status)) {
      const q = p.quotes.find((x) => x.rowId === r.id && x.supplierId === r.adoptedSupplierId && !x.stale)
      // 正式納期があればそれ（概算で「在庫」と答えていても、正式の回答が優先）
      const ld = q?.formalLeadDays ?? (q?.stock === '在庫' ? 0 : q?.leadDays)
      if (ld != null && ld >= 0) {
        const arrive = addDays(today, ld)
        r.flags.leadNG = arrive > need && !leadAccepted(r)
      }
    } else if (r.status === 'ordered' && r.promisedDate && need) {
      r.flags.leadNG = r.promisedDate > need && !leadAccepted(r)
    }
    if (r.status === 'received') r.flags.leadNG = false
    // 発注・入荷のチェックと状態
    if (r.received && r.status !== 'received') {
      r.status = 'received'
      r.statusChangedAt = now
    } else if (r.ordered && !r.received && !['ordered', 'received'].includes(r.status)) {
      r.status = 'ordered'
      r.statusChangedAt = now
    }
  }
}

/** 納期NG に手を打った（受入・代替品検討）なら NG として出さない */
function leadAccepted(r: Row): boolean {
  const cm = r.flags.countermeasure
  return cm === '受入' || cm === '代替品検討'
}

export function nextRowId(p: Project): string {
  const max = p.rows.reduce((m, r) => Math.max(m, Number(r.id.slice(1)) || 0), 0)
  return 'R' + String(max + 1).padStart(3, '0')
}

export function setStatus(r: Row, s: Row['status']) {
  if (r.status !== s) {
    r.status = s
    r.statusChangedAt = new Date().toISOString()
    r.dueAt = undefined
  }
}
