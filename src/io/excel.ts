import ExcelJS from 'exceljs'
import type { Project, Row, Supplier, Workspace } from '@/model/types'
import { STATUS_LABEL, ROLE_LABEL } from '@/model/types'
import { pendingAdd, adoptedQuote, decisionExtra, fixedSupplierId, isFixedProcurement, lineAmount, orderQty, rowNeedDate, isActive, ball, valuesFor } from '@/model/derive'
import { checkProject } from '@/model/rules'

const FILL = (argb: string): ExcelJS.Fill => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } })
const HEAD_FILL = FILL('FFE7E7E4')
const ERR_FILL = FILL('FFFBE8EA')
const WARN_FILL = FILL('FFFDF3DC')
const CHG_FILL = FILL('FFFDF3DC')

function download(buf: ArrayBuffer, name: string) {
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 5000)
}

function headerRow(ws: ExcelJS.Worksheet, cols: Array<{ header: string; key: string; width?: number }>) {
  ws.columns = cols
  const h = ws.getRow(1)
  h.font = { bold: true }
  h.fill = HEAD_FILL
  ws.views = [{ state: 'frozen', ySplit: 1 }]
}

export type ExportTarget = 'internal' | 'supplier' | 'archive'

/** Excel 出力（BOM・変更点・チェック結果の 3 シート） */
export async function exportBomExcel(ws: Workspace, p: Project, target: ExportTarget, supplierId?: string) {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'BOM Pro'
  const sheet = wb.addWorksheet('BOM')
  const cols: Array<{ header: string; key: string; width?: number }> = [
    { header: 'ID', key: 'id', width: 7 },
    { header: '回路記号', key: 'ref', width: 9 },
    { header: '図面番号', key: 'drawing', width: 14 },
    { header: '分類', key: 'category', width: 8 },
    { header: '部品名', key: 'name', width: 24 },
    { header: '型式', key: 'model', width: 26 },
    { header: 'メーカ', key: 'maker', width: 14 },
    { header: '必要数', key: 'qtyNeeded', width: 7 },
    { header: '単位', key: 'unit', width: 6 },
    { header: '入数', key: 'packQty', width: 6 },
    { header: '調達区分', key: 'procurement', width: 10 },
    { header: 'メーカ指定', key: 'makerLock', width: 9 },
    { header: '代替可否', key: 'altPolicy', width: 10 },
    { header: '必要日', key: 'needDate', width: 11 },
    { header: '備考', key: 'note', width: 24 },
  ]
  if (target !== 'supplier') {
    cols.push({ header: '発注数', key: 'orderQty', width: 7 }, { header: '採用', key: 'adopted', width: 14 }, { header: '単価', key: 'unitPrice', width: 10 }, { header: '金額', key: 'amount', width: 12 }, { header: '正式単価', key: 'formalPrice', width: 10 }, { header: '納期(日)', key: 'lead', width: 8 }, { header: '状態', key: 'status', width: 10 }, { header: 'ボール', key: 'ball', width: 7 })
  }
  if (target === 'archive') {
    for (const sid of p.supplierIds) {
      const sup = ws.suppliers.find((x) => x.id === sid)
      cols.push({ header: `${sup?.name} 単価`, key: `q.${sid}.price`, width: 10 }, { header: `${sup?.name} 納期`, key: `q.${sid}.lead`, width: 8 }, { header: `${sup?.name} MOQ`, key: `q.${sid}.moq`, width: 7 })
    }
    cols.push({ header: '追加費用', key: 'extraCost', width: 10 }, { header: 'スコア', key: 'score', width: 7 })
  }
  headerRow(sheet, cols)
  for (const r of p.rows) {
    if (!isActive(r) && target === 'supplier') continue
    // PM 承認待ちの変更セットで足した行は、商社向けには出さない。社内・保管用も購買には出さない（§5。承認する PM には出す）
    if (pendingAdd(r) && (target === 'supplier' || ws.user.role === 'purchasing')) continue
    // 商社向け: 未提出の下書きは出さない。商社を選んだときは、その商社に見積を頼む行だけ
    if (target === 'supplier' && (r.publishedRev == null || r.status === 'draft')) continue
    if (target === 'supplier' && supplierId) {
      // 指定商社・客先指定品は指定先の商社のファイルにだけ出す
      if (isFixedProcurement(r) ? fixedSupplierId(p, r, ws.suppliers) !== supplierId : !p.quotes.some((q) => q.rowId === r.id && q.supplierId === supplierId && !q.stale) && r.adoptedSupplierId !== supplierId) continue
    }
    // 隠した行は社内・商社向けでは出さない。保管用は全行
    if (r.hidden && target !== 'archive') continue
    // 設計の作業中（未公開）の値は、設計が社内用に出すときだけ。商社向け・保管用・購買や PM の出力は公開値
    const e = target === 'internal' ? valuesFor(r, ws.user.role) : r
    const q = adoptedQuote(p, r)
    const amt = lineAmount(p, r)
    const rec: Record<string, unknown> = { ...e, needDate: rowNeedDate(p, r) ?? '', id: r.id, orderQty: orderQty(r), adopted: ws.suppliers.find((s) => s.id === r.adoptedSupplierId)?.name ?? '', unitPrice: q?.unitPrice ?? '', amount: amt.rough ?? '', formalPrice: q?.formalPrice ?? '', lead: q?.leadDays ?? '', status: STATUS_LABEL[r.status], ball: (() => { const b = ball(p, r); return b ? ROLE_LABEL[b] : '' })(), extraCost: r.extraCost ?? '', score: r.scoreSnapshot ?? '' }
    if (target === 'archive') for (const sid of p.supplierIds) {
      const qq = p.quotes.find((x) => x.rowId === r.id && x.supplierId === sid && !x.stale)
      rec[`q.${sid}.price`] = qq?.unitPrice ?? ''
      rec[`q.${sid}.lead`] = qq?.leadDays ?? ''
      rec[`q.${sid}.moq`] = qq?.moq ?? ''
    }
    const row = sheet.addRow(rec)
    if (!isActive(r)) row.font = { strike: true, color: { argb: 'FF888888' } }
    const sup = ws.suppliers.find((s) => s.id === r.adoptedSupplierId)
    if (sup && target !== 'supplier') row.getCell('adopted').fill = FILL('FF' + sup.color.slice(1) + '')
  }
  if (target !== 'supplier') addInternalSheets(wb, ws, p)
  const buf = await wb.xlsx.writeBuffer()
  const suffix = target === 'supplier' ? `_${ws.suppliers.find((s) => s.id === supplierId)?.name ?? '商社向け'}` : target === 'archive' ? '_保管用' : ''
  download(buf as ArrayBuffer, safeName(`${p.id}_${p.name}${suffix}.xlsx`))
}

/** 社内だけのシート（変更点・チェック結果）。商社向けには付けない */
function addInternalSheets(wb: ExcelJS.Workbook, ws: Workspace, p: Project) {
  const purchasing = ws.user.role === 'purchasing'
  const hide = (id: string) => purchasing && pendingAdd(p.rows.find((x) => x.id === id) ?? ({ flags: {} } as Row))
  // 変更点
  const chg = wb.addWorksheet('変更点')
  headerRow(chg, [{ header: 'Rev', key: 'rev', width: 6 }, { header: '日時', key: 'at', width: 16 }, { header: '公開者', key: 'by', width: 10 }, { header: 'ID', key: 'id', width: 7 }, { header: '起因', key: 'cause', width: 18 }, { header: '変更理由', key: 'reason', width: 12 }, { header: '変更番号', key: 'no', width: 12 }, { header: '内容', key: 'detail', width: 50 }, { header: '承認', key: 'approval', width: 24 }])
  for (const sub of p.submissions) {
    // 承認待ち・却下の変更セットの中身は購買には出さない（§5「承認待ちの変更あり」だけ）
    if (purchasing && sub.changeSet && (!sub.changeSet.approved || sub.changeSet.rejected || sub.revoked)) continue
    const prev = p.submissions.filter((x) => x.rev < sub.rev && !(purchasing && x.changeSet && (!x.changeSet.approved || x.changeSet.rejected || x.revoked)))
    for (const id of sub.rowIds) {
      if (hide(id)) continue
      const now = sub.snapshot[id]
      const before = [...prev].reverse().map((x) => x.snapshot[id]).find(Boolean)
      let detail = sub.causes[id] === '追加' ? `追加: ${now?.name ?? ''} ${now?.model ?? ''}` : sub.causes[id] === '取消' ? '取消' : ''
      if (before && now) detail = (['model', 'maker', 'qtyNeeded', 'name', 'needOffset', 'altPolicy'] as const).filter((k) => JSON.stringify(before[k]) !== JSON.stringify(now[k])).map((k) => `${k}: ${before[k] ?? ''} → ${now[k] ?? ''}`).join(' / ')
      const dec = p.decisions.find((d) => d.id === sub.changeSet?.decisionId)
      const row = chg.addRow({ rev: sub.rev, at: sub.at.slice(0, 16).replace('T', ' '), by: sub.by.name, id, cause: sub.causes[id] ?? '', reason: sub.changeSet?.reason ?? (sub.causes[id]?.startsWith('I-') ? '指摘対応' : ''), no: sub.changeSet?.changeNo ?? '', detail, approval: dec ? `${dec.by.name} ${dec.at.slice(0, 10)}${dec.external ? ' / ' + dec.external.approver + ' ' + dec.external.ref : ''}` : sub.revoked ? '却下' : '' })
      row.fill = CHG_FILL
    }
  }
  for (const d of p.decisions) if (d.rowId) chg.addRow({ rev: '', at: d.at.slice(0, 16).replace('T', ' '), by: d.by.name, id: d.rowId, cause: '決定', reason: d.kind, no: '', detail: [d.reason, decisionExtra(d)].filter(Boolean).join(' / '), approval: d.external ? `${d.external.approver} ${d.external.date} ${d.external.ref}` : '' })
  // チェック結果
  const chk = wb.addWorksheet('チェック結果')
  headerRow(chk, [{ header: 'ID', key: 'id', width: 7 }, { header: '列', key: 'field', width: 10 }, { header: '重大度', key: 'sev', width: 8 }, { header: '内容', key: 'msg', width: 40 }, { header: '種別', key: 'kind', width: 12 }, { header: '状態', key: 'status', width: 8 }])
  for (const pr of checkProject(p, ws.rules).filter((x) => !hide(x.rowId))) {
    const row = chk.addRow({ id: pr.rowId, field: pr.field, sev: pr.severity === 'error' ? 'エラー' : '警告', msg: pr.message, kind: 'チェック', status: '' })
    row.fill = pr.severity === 'error' ? ERR_FILL : WARN_FILL
  }
  for (const i of p.issues) if (i.status !== 'draft') chk.addRow({ id: i.rowId, field: i.field ?? '', sev: '指摘', msg: i.text, kind: i.kind, status: i.status })
}

/** ファイル名に使えない文字を置き換える */
function safeName(s: string): string {
  return s.replace(/[\\/:*?"<>|]/g, '_')
}

/** 商社向けの見積依頼書（概算 / 正式） */
export async function exportRequestExcel(p: Project, sup: Supplier, rows: Row[], kind: 'rough' | 'formal', deadline: string, rev: number, prevNeed?: Map<string, string | null>) {
  const wb = new ExcelJS.Workbook()
  const sh = wb.addWorksheet(kind === 'rough' ? '概算見積依頼' : '正式見積依頼')
  const reqNo = `${p.id}-${sup.id}-${kind === 'formal' ? 'F' : ''}${rev}`
  sh.addRow([`${kind === 'rough' ? '概算' : '正式'}見積依頼書`]).font = { bold: true, size: 14 }
  sh.addRow(['依頼No', reqNo, '宛先', sup.name])
  sh.addRow(['案件', `${p.id} ${p.name}`, '発行日', new Date().toISOString().slice(0, 10)])
  sh.addRow(['回答期限', deadline, '必要納期', p.dueDate ?? '未定'])
  sh.addRow(['通貨', p.settings.currency, '数量', '必要数（見積数量の基準）'])
  if (rev > 1) sh.addRow(['Rev', `${rev}（前回からの差分は「差分」シート）`])
  sh.addRow([])
  const head = kind === 'rough' ? ['行ID', '部品名', '型式', 'メーカ', 'メーカ指定', '代替可否', '必要数', '単位', '必要日', '備考', '単価', '納期', 'MOQ', '在庫区分', '見積数量', '代替型式', '代替メーカ', '代替単価', '代替納期', '有効期限'] : ['行ID', '部品名', '型式', 'メーカ', '発注数', '単位', '必要日', '概算単価', '正式単価', '正式納期', '有効期限', '差分理由', '支払条件']
  const hr = sh.addRow(head)
  hr.font = { bold: true }
  hr.fill = HEAD_FILL
  for (const r of rows) {
    const e = r
    const q = p.quotes.find((x) => x.rowId === r.id && x.supplierId === sup.id && !x.stale)
    if (kind === 'rough') sh.addRow([r.id, e.name, e.model, e.maker, e.makerLock, e.altPolicy, e.qtyNeeded, e.unit, rowNeedDate(p, r) ?? '', e.note, '', '', '', '', '', '', '', '', '', ''])
    else sh.addRow([r.id, e.name, e.model, e.maker, orderQty(r), e.unit, rowNeedDate(p, r) ?? '', q?.unitPrice ?? '', '', '', '', '', ''])
  }
  sh.columns.forEach((c, i) => (c.width = [7, 22, 24, 12, 9, 9, 7, 6, 11, 20, 10, 8, 7, 9, 9, 18, 12, 10, 8, 11][i] ?? 10))
  if (rev > 1) {
    const diff = wb.addWorksheet('差分')
    const dh = diff.addRow(['行ID', '項目', '旧', '新'])
    dh.font = { bold: true }
    for (const r of rows) {
      const subs = p.submissions.filter((s) => s.rowIds.includes(r.id))
      const now = subs.at(-1)?.snapshot[r.id]
      const before = subs.at(-2)?.snapshot[r.id]
      if (now && before) for (const k of ['model', 'maker', 'qtyNeeded', 'needOffset'] as const) if (JSON.stringify(now[k]) !== JSON.stringify(before[k])) diff.addRow([r.id, k, String(before[k] ?? ''), String(now[k] ?? '')])
      // 前回の依頼で送った必要納期と今回の値（案件納期の変更・前倒し日数の変更など）
      const now2 = rowNeedDate(p, r) ?? ''
      const prev = prevNeed?.get(r.id)
      if (prev !== undefined && (prev ?? '') !== now2) diff.addRow([r.id, '必要納期', prev ?? '', now2])
    }
  }
  const buf = await wb.xlsx.writeBuffer()
  download(buf as ArrayBuffer, safeName(`${reqNo}_${sup.name}.xlsx`))
}

/** 選定記録（社内）: スコア内訳つき */
export async function exportSelectionRecord(ws: Workspace, p: Project, scoresOf: (r: Row) => Array<{ supplierId: string; total: number; price: number; lead: number; record: number; terms: number }>) {
  const wb = new ExcelJS.Workbook()
  const sh = wb.addWorksheet('選定記録')
  headerRow(sh, [{ header: 'ID', key: 'id', width: 7 }, { header: '部品名', key: 'name', width: 22 }, { header: '型式', key: 'model', width: 24 }, { header: '採用', key: 'adopted', width: 14 }, { header: '理由', key: 'reason', width: 16 }, { header: 'スコア', key: 'score', width: 7 }, { header: '内訳（商社: 合計 / 価格 / 納期 / 実績 / 条件）', key: 'detail', width: 70 }, { header: '決定', key: 'decision', width: 30 }])
  for (const r of p.rows) {
    if (!r.adoptedSupplierId) continue
    const e = r
    const sc = scoresOf(r)
    const dec = p.decisions.filter((d) => d.rowId === r.id).map((d) => `${d.kind} ${d.by.name} ${d.at.slice(0, 10)}`).join('; ')
    sh.addRow({ id: r.id, name: e.name, model: e.model, adopted: ws.suppliers.find((s) => s.id === r.adoptedSupplierId)?.name ?? '', reason: r.adoptReason ?? '推奨', score: r.scoreSnapshot ?? '', detail: sc.map((x) => `${ws.suppliers.find((s) => s.id === x.supplierId)?.name}: ${x.total} / ${x.price} / ${x.lead} / ${x.record} / ${x.terms}`).join('　'), decision: dec })
  }
  const buf = await wb.xlsx.writeBuffer()
  download(buf as ArrayBuffer, `${p.id}_選定記録.xlsx`)
}

/** 書式つきコピー（HTML + TSV） */
export async function copyFormatted(headers: string[], rows: string[][]) {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')
  const html = `<table border="1" style="border-collapse:collapse;font-family:'BIZ UDPGothic',sans-serif;font-size:10pt"><tr>${headers.map((h) => `<th style="background:#e7e7e4">${esc(h)}</th>`).join('')}</tr>${rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</table>`
  const tsv = [headers.join('\t'), ...rows.map((r) => r.join('\t'))].join('\n')
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }), 'text/plain': new Blob([tsv], { type: 'text/plain' }) })])
  } catch {
    await navigator.clipboard.writeText(tsv)
  }
}
