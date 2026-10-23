import { isSectionLine, isTotalCell } from '@/io/paste'
import { useStore } from '@/model/store'
import type { Project, Quote, Row } from '@/model/types'
import { fixedSupplierId, handlesMaker, hasWork, isActive, isFixedProcurement, isQuotable, normalizeModel, orderQty, rowNeedDate } from '@/model/derive'
import { normalize, setStatus } from '@/model/lifecycle'
import { emptyQuote } from '@/model/sample'
import { parseValue, quoteTargets } from './rows'
import { addBusinessDays, addDays, todayStr } from '@/model/dates'
import { parseDate, parseNumber } from '@/model/parse'

function st() {
  return useStore.getState()
}

/** 概算見積を依頼（購買）: 提出済の行 × 商社 → 依頼 Excel、状態を見積中に */
export async function requestRoughQuotes(supplierIds: string[], deadline: string, all = false): Promise<string> {
  const s = st()
  if (s.user().role !== 'purchasing') return '権限なし（概算見積の依頼は購買）'
  const p = s.project()
  // 要再確認で「再見積」を選んだ商社（まだ回答なし）も依頼の対象
  const awaitingRequote = (r: Row) => p.quotes.filter((q) => q.rowId === r.id && !q.stale && q.reconfirm === 'requote' && q.unitPrice == null).map((q) => q.supplierId)
  // 指定系の行で、指定先が辞退して次の商社にまだ頼んでいないもの
  const needsNextFixed = (r: Row) => {
    if (!isFixedProcurement(r) || r.adoptedSupplierId || !['quoting', 'quoted'].includes(r.status)) return []
    const sid = fixedSupplierId(p, r, s.ws.suppliers)
    return sid && !p.quotes.some((q) => q.rowId === r.id && q.supplierId === sid && !q.stale) ? [sid] : []
  }
  // 相見積の行で、まだ頼んでいない商社（前に一部の商社だけに頼んだ）。あとから頼める
  // 頼むつもりで、まだ頼んでいない商社（最初の依頼を一部の商社だけにした・回答を手で入れ始めた行）。あとで案件に足した商社は入れない
  const tradable = (sid: string) => p.supplierIds.includes(sid) && s.ws.suppliers.find((x) => x.id === sid)?.tradable !== false
  const unasked = (r: Row) => (isFixedProcurement(r) || r.adoptedSupplierId || !['quoting', 'quoted'].includes(r.status) ? [] : (r.quoteTargets ?? []).filter((sid) => tradable(sid) && !p.quotes.some((q) => q.rowId === r.id && q.supplierId === sid && !q.stale)))
  const rows = p.rows.filter((r) => isActive(r) && isQuotable(r) && (r.status === 'submitted' || r.flags.requote || awaitingRequote(r).length > 0 || needsNextFixed(r).length > 0 || unasked(r).some((sid) => all || supplierIds.includes(sid))) && !hasWork(r) && !r.pendingRemoval && !r.flags.pmPending)
  if (!rows.length) return '依頼する行がありません（提出済・再見積要の行なし）'
  const excluded = p.rows.filter((r) => isActive(r) && r.status === 'submitted' && r.working && Object.keys(r.working).length).length
  const perSupplier = new Map<string, Row[]>()
  // 再見積の商社だけを頼み直す行は、その商社だけに送る
  const targetsOf = (r: Row) => (r.status === 'submitted' || r.flags.requote ? quoteTargets(p, r) : [...awaitingRequote(r), ...needsNextFixed(r), ...unasked(r)])
  // 「相見積先すべて」のときは、指定先が案件の相見積先に無い指定系の行も、その指定先に頼む
  const wanted = (sid: string) => all || supplierIds.includes(sid)
  // すでに回答をもらっている商社には、その行の依頼書を出し直さない
  const answeredBy = (r: Row, sid: string) => p.quotes.some((q) => q.rowId === r.id && q.supplierId === sid && !q.stale && (q.unitPrice != null || q.leadDays != null))
  for (const r of rows) for (const sid of targetsOf(r)) if (wanted(sid) && !(answeredBy(r, sid) && !r.flags.requote && !awaitingRequote(r).includes(sid))) perSupplier.set(sid, [...(perSupplier.get(sid) ?? []), r])
  // 今回どの商社にも頼まない行（指定先が別の商社）は、見積中にしない（回答の来ない見積中で止めない）
  const sent = new Set([...perSupplier.values()].flat().map((r) => r.id))
  if (!sent.size) return '依頼する行がありません（選んだ商社に頼む行なし。指定商社・客先指定品は指定先の商社を選んでください）'
  s.commit(`概算見積を依頼（${[...perSupplier.keys()].map((id) => s.ws.suppliers.find((x) => x.id === id)?.name).join('・')}）`, (p2, ws) => {
    p2.settings.quoteDeadline = deadline
    // 相見積の行を頼んだ商社だけを案件の相見積先に足す（指定系の行のためだけに選んだ商社は足さない。足すと全行の相見積先が増える）
    for (const sid of supplierIds) if (!p2.supplierIds.includes(sid) && (perSupplier.get(sid) ?? []).some((r) => !isFixedProcurement(r))) p2.supplierIds.push(sid)
    for (const r0 of rows) {
      if (!sent.has(r0.id)) continue
      const r = p2.rows.find((x) => x.id === r0.id)!
      // 最初の依頼で、頼むつもりの商社（相見積先）を覚える
      if (!isFixedProcurement(r0) && (r0.status === 'submitted' || r0.flags.requote)) r.quoteTargets = quoteTargets(p, r0)
      for (const sid of targetsOf(r0)) {
        if (!wanted(sid)) continue
        if (!p2.quotes.some((q) => q.rowId === r.id && q.supplierId === sid && !q.stale)) p2.quotes.push(emptyQuote(r.id, sid))
        // 再見積を頼んだので、要再確認の「再見積」の印は外す
        for (const q of p2.quotes) if (q.rowId === r.id && q.supplierId === sid && !q.stale && q.reconfirm === 'requote') q.reconfirm = undefined
      }
      r.flags.requote = false
      if (r.status === 'submitted' || (r.status === 'quoted' && (needsNextFixed(r0).length || unasked(r0).length))) setStatus(r, 'quoting')
      else if (['quoted', 'selected', 'formalRequested', 'formalQuoted'].includes(r.status) && r0.flags.requote) {
        // 概算を取り直す行は、前の採用・正式見積の依頼を外して選び直す（正式依頼中のまま見積済に戻さない）
        if (r.adoptedSupplierId) {
          r.adoptedSupplierId = undefined
          r.scoreSnapshot = undefined
          r.flags.contested = false
          r.flags.formalDiff = false
          r.flags.reissue = false
          for (const q of p2.quotes.filter((x) => x.rowId === r.id && !x.stale)) {
            q.formalPrice = null
            q.formalLeadDays = null
            q.formalValidUntil = null
            q.formalRequestNo = undefined
          }
        }
        setStatus(r, 'quoting')
      }
    }
    for (const sid of perSupplier.keys()) p2.requestRevs[sid] = (p2.requestRevs[sid] ?? 0) + 1
    normalize(p2, ws)
  })
  const p2 = st().project()
  for (const [sid, rs] of perSupplier) {
    const sup = s.ws.suppliers.find((x) => x.id === sid)!
    await (await import('@/io/excel')).exportRequestExcel(p2, sup, rs.map((r) => p2.rows.find((x) => x.id === r.id)!), 'rough', deadline, p2.requestRevs[sid] ?? 1)
  }
  // §7 のメーカでの絞り込みを知らせる（どの行をどの商社に頼まなかったか・扱う商社が無くて全社に頼んだか）
  const asked = [...perSupplier.keys()]
  const narrowed = rows.filter((r) => sent.has(r.id) && r.status === 'submitted' && !isFixedProcurement(r) && asked.some((sid) => !targetsOf(r).includes(sid)))
  const listedAny = p.supplierIds.some((id) => (s.ws.suppliers.find((x) => x.id === id)?.handledMakers.length ?? 0) > 0)
  const unknownMaker = listedAny ? rows.filter((r) => sent.has(r.id) && r.status === 'submitted' && !isFixedProcurement(r) && r.maker && !p.supplierIds.some((id) => handlesMaker(s.ws.suppliers.find((x) => x.id === id)?.handledMakers ?? [], r.maker))) : []
  const name = (id: string) => s.ws.suppliers.find((x) => x.id === id)?.name ?? id
  const notes = [
    narrowed.length ? `メーカを扱わない商社には頼まない行 ${narrowed.length} 行（例: ${narrowed[0].id}「${narrowed[0].maker}」→ ${targetsOf(narrowed[0]).filter((x) => asked.includes(x)).map(name).join('・')}）` : '',
    unknownMaker.length ? `メーカを扱う商社がマスタに無い行 ${unknownMaker.length} 行は、選んだ商社すべてに依頼（例: ${unknownMaker[0].id}「${unknownMaker[0].maker}」。商社マスタの取扱メーカに足すと絞れます）` : '',
  ].filter(Boolean)
  // 実際に見積済から見積中に戻った行だけを数える
  const after = st().project()
  const reopened = rows.filter((r) => sent.has(r.id) && r.status === 'quoted' && after.rows.find((x) => x.id === r.id)?.status === 'quoting').length
  // 指定先が取引不可の商社になっている行（指定は設計の判断なので頼むが、知らせる）
  const blocked = [...perSupplier].flatMap(([sid, rs]) => (s.ws.suppliers.find((x) => x.id === sid)?.tradable === false ? rs.filter((r) => isFixedProcurement(r)).map((r) => `${r.id}→${name(sid)}`) : []))
  if (blocked.length) notes.push(`取引不可の商社が指定先の行 ${blocked.length} 行（${blocked.slice(0, 3).join('・')}）にも依頼しました。指定先を設計と確かめてください`)
  if (reopened) notes.push(`見積済だった ${reopened} 行は、新しく頼んだ商社の回答を待つため見積中に戻しました`)
  return `${sent.size} 行 × ${perSupplier.size} 社に依頼（回答期限 ${deadline}）${excluded ? `。作業中 ${excluded} 行を除外` : ''}${notes.length ? `。${notes.join('。')}` : ''}`
}

export interface ImportResult {
  updated: number
  unmatched: string[]
  modelMismatch: string[]
  proposals: number
  errors: string[]
}

/** 見積回答の取り込み（タブ区切り。依頼 Excel と同じ列順） */
export function importQuoteAnswers(text: string, supplierId: string): ImportResult {
  const s = st()
  const res: ImportResult = { updated: 0, unmatched: [], modelMismatch: [], proposals: 0, errors: [] }
  const lines = text.replace(/\r/g, '').split('\n').filter((l) => l.trim())
  if (!lines.length) return res
  // 依頼書のシートを丸ごと貼ったとき（表題・依頼No の行が先にある）も、見出しの行を探す
  // 見出しの「単価（円）」「納期(日)」のような単位の注記・空白は外して見る
  const headCell = (h: string) => h.replace(/[（(][^）)]*[）)]/g, '').replace(/[\s　]/g, '')
  const isHeader = (l: string) => {
    const hs = l.split('\t').map(headCell)
    return (hs.includes('行ID') || hs.includes('ID')) && hs.includes('単価')
  }
  const headerAt = lines.slice(0, 20).findIndex(isHeader)
  const header = (headerAt >= 0 ? lines[headerAt] : lines[0]).split('\t').map(headCell)
  const idx = (...names: string[]) => header.findIndex((h) => names.includes(h))
  const col = { id: idx('行ID', 'ID'), model: idx('型式'), price: idx('単価'), lead: idx('納期'), moq: idx('MOQ'), stock: idx('在庫区分', '在庫'), qty: idx('見積数量'), valid: idx('有効期限'), altModel: idx('代替型式'), altMaker: idx('代替メーカ', '代替メーカー'), altPrice: idx('代替単価'), altLead: idx('代替納期') }
  const hasHeader = col.id >= 0 && col.price >= 0
  const body = hasHeader ? lines.slice(headerAt + 1) : lines
  const get = (cells: string[], i: number) => (i >= 0 && i < cells.length ? cells[i].trim() : '')
  const parse = (field: string, v: string, label: string, rowId: string): number | null | undefined => {
    if (v === '') return null
    const r = parseValue(`${field}@${supplierId}`, v)
    if (!r.ok) {
      res.errors.push(`${rowId} ${label}: ${r.error}`)
      return undefined
    }
    return r.value as number | null
  }
  s.commit(`見積回答を取り込む（${s.ws.suppliers.find((x) => x.id === supplierId)?.name}）`, (p, ws) => {
    for (const line of body) {
      const cells = line.split('\t')
      // 小計・合計の行は回答ではない
      const id = (hasHeader ? get(cells, col.id) : get(cells, 0)).toUpperCase()
      // 小計・合計・区切りの行は回答ではない（行 ID が合う行は、備考が「---」などでも回答として読む）
      if ((cells.some(isTotalCell) || isSectionLine(cells)) && !p.rows.some((x) => x.id === id)) continue
      const r = p.rows.find((x) => x.id === id)
      if (!r || !isActive(r)) {
        res.unmatched.push(id || line.replace(/\t+/g, ' ').trim().slice(0, 20))
        continue
      }
      if (r.flags.pmPending && r.flags.pmReason === '変更セット' && r.status === 'submitted') {
        res.errors.push(`${r.id}: 変更セットの PM 承認待ちの追加行です（承認されてから取り込みます）`)
        continue
      }
      if (r.status === 'ordered' || r.status === 'received') {
        res.errors.push(`${r.id}: 発注済の行には取り込みません（変えるときは発注後変更依頼）`)
        continue
      }
      const model = hasHeader ? get(cells, col.model) : get(cells, 1)
      if (model && normalizeModel(model) !== normalizeModel(r.model)) {
        // 型式が違う回答は取り込まず、購買の 4 要確認に出す
        res.modelMismatch.push(r.id)
        r.flags.importMismatch = `${s.ws.suppliers.find((x) => x.id === supplierId)?.name ?? supplierId}: 回答の型式「${model}」（BOM は「${r.model}」）`
        continue
      }
      const price = parse('q.unitPrice', hasHeader ? get(cells, col.price) : get(cells, 2), '単価', r.id)
      const lead = parse('q.leadDays', hasHeader ? get(cells, col.lead) : get(cells, 3), '納期', r.id)
      const moq = parse('q.moq', hasHeader ? get(cells, col.moq) : get(cells, 4), 'MOQ', r.id)
      const validRaw = hasHeader ? get(cells, col.valid) : ''
      const valid = validRaw ? parseDate(validRaw, { label: '有効期限' }) : null
      if (price === undefined || lead === undefined || moq === undefined || (valid && !valid.ok)) {
        if (valid && !valid.ok) res.errors.push(`${r.id} ${valid.error}`)
        continue
      }
      let q = p.quotes.find((x) => x.rowId === r.id && x.supplierId === supplierId && !x.stale)
      if (!q) {
        q = emptyQuote(r.id, supplierId)
        p.quotes.push(q)
      }
      q.unitPrice = price
      q.leadDays = lead
      q.moq = moq
      const stock = hasHeader ? get(cells, col.stock) : get(cells, 5)
      q.stock = stock === '在庫' || stock === '取寄' || stock === '受注生産' ? stock : q.stock
      const qty = hasHeader ? get(cells, col.qty) : ''
      const qn = qty ? parseNumber(qty, { min: 0 }) : null
      q.quoteQty = qn && qn.ok && qn.value != null ? qn.value : orderQty(r)
      q.validUntil = valid && valid.ok && valid.value ? valid.value : addDays(todayStr(), 30)
      q.source = '取込'
      r.flags.importMismatch = undefined
      res.updated++
      // 代替提案 → 指摘の下書き（代替不可・客先指定品は対象外。ただしメーカ指定＝任意ならメーカ提案として出す）
      const altModel = hasHeader ? get(cells, col.altModel) : ''
      if (altModel) {
        const blocked = r.procurement === '客先指定品' || (r.altPolicy === '不可' && r.makerLock !== '任意')
        if (blocked) {
          p.events.push({ id: (p.events.at(-1)?.id ?? 0) + 1, at: new Date().toISOString(), by: s.user(), rowId: r.id, text: `商社提案（対象外）: ${altModel}` })
        } else {
          const ap = parseNumber(get(cells, col.altPrice), { min: 0 })
          const al = parseNumber(get(cells, col.altLead), { min: 0, integer: true })
          p.issues.push({ id: 'I-' + String(p.nextIssueNo++).padStart(3, '0'), rowId: r.id, field: 'model', kind: '代替提案', text: `商社提案: ${altModel}`, proposal: { model: altModel, maker: get(cells, col.altMaker) || r.maker, supplierId, unitPrice: ap.ok ? ap.value : null, leadDays: al.ok ? al.value : null }, by: s.user(), at: new Date().toISOString(), status: 'draft', replies: [], bounceCount: 0, dueAt: addBusinessDays(todayStr(), 3, p.settings.holidays) })
          res.proposals++
        }
      }
      if (r.status === 'submitted') {
        // 依頼書なしで回答を取り込んだ行も、相見積先すべての回答を待つ（1 社の回答だけで見積済にしない。残りの商社には後から依頼できる）
        if (!isFixedProcurement(r)) r.quoteTargets = quoteTargets(p, r)
        setStatus(r, 'quoting')
      }
    }
    normalize(p, ws)
  })
  return res
}

/** 正式見積を依頼（社外）: 選定済の行を商社ごとに */
export async function requestFormalQuotes(): Promise<string> {
  const s = st()
  if (s.user().role !== 'purchasing') return '権限なし（正式見積の依頼は購買）'
  const p = s.project()
  const target = p.rows.filter((r) => isActive(r) && r.adoptedSupplierId && (r.status === 'selected' || (r.flags.reissue && ['formalRequested', 'formalQuoted'].includes(r.status))))
  const working = target.filter((r) => hasWork(r) || r.pendingRemoval)
  const pending = target.filter((r) => r.flags.pmPending || r.flags.ltbPending)
  // 再見積要の行は概算が失効している。概算を取り直して採用し直してから正式見積へ
  const requote = target.filter((r) => r.flags.requote)
  const rows = target.filter((r) => !working.includes(r) && !pending.includes(r) && !requote.includes(r))
  if (!rows.length) return '依頼する行がありません（選定済・再発行対象なし）'
  const per = new Map<string, Row[]>()
  for (const r of rows) per.set(r.adoptedSupplierId!, [...(per.get(r.adoptedSupplierId!) ?? []), r])
  const prevNeed = new Map<string, string | null>()
  s.commit('正式見積を依頼（社外）', (p2, ws) => {
    for (const sid of per.keys()) p2.requestRevs['F' + sid] = (p2.requestRevs['F' + sid] ?? 0) + 1
    for (const r0 of rows) {
      const r = p2.rows.find((x) => x.id === r0.id)!
      const q = p2.quotes.find((x) => x.rowId === r.id && x.supplierId === r.adoptedSupplierId && !x.stale)
      if (q) {
        q.formalRequestNo = `${p2.id}-${r.adoptedSupplierId}-F${p2.requestRevs['F' + r.adoptedSupplierId!]}`
        // 前回送った必要納期を差分シートのために残してから、今回の値を記録
        if (q.formalNeedDate !== undefined) prevNeed.set(r.id, q.formalNeedDate)
        q.formalNeedDate = rowNeedDate(p2, r)
      }
      // 再発行（数量・型式の変更のあと）は前の正式回答を消して、新しい回答を待つ（正式見積済のまま古い単価で止まらない）
      if ((r.flags.reissue || r.status === 'selected') && q) {
        q.prevFormalPrice = q.formalPrice ?? q.prevFormalPrice
        q.formalPrice = null
        q.formalLeadDays = null
        q.formalValidUntil = null
        if (r.status === 'formalQuoted') setStatus(r, 'formalRequested')
      }
      r.flags.reissue = false
      r.flags.formalWithdrawn = undefined
      if (r.status === 'selected') setStatus(r, 'formalRequested')
      r.dueAt = addBusinessDays(todayStr(), p2.settings.formalDays, p2.settings.holidays)
    }
    normalize(p2, ws)
  })
  const p2 = st().project()
  for (const [sid, rs] of per) {
    const sup = s.ws.suppliers.find((x) => x.id === sid)!
    await (await import('@/io/excel')).exportRequestExcel(p2, sup, rs.map((r) => p2.rows.find((x) => x.id === r.id)!), 'formal', addBusinessDays(todayStr(), p2.settings.formalDays, p2.settings.holidays), p2.requestRevs['F' + sid] ?? 1, prevNeed)
  }
  return `${rows.length} 行 × ${per.size} 社に正式見積を依頼${working.length || pending.length || requote.length ? `。除外: 作業中 ${working.length} 行 / 承認待ち ${pending.length} 行 / 再見積要 ${requote.length} 行` : ''}`
}

export function quoteFor(p: Project, rowId: string, supplierId: string): Quote | undefined {
  return p.quotes.find((q) => q.rowId === rowId && q.supplierId === supplierId && !q.stale)
}

export function needDateOf(p: Project, r: Row) {
  return rowNeedDate(p, r)
}
