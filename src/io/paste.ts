import type { Row, Unit } from '@/model/types'
import { UNITS } from '@/model/types'
import { parseNumber, toHalf } from '@/model/parse'

export type BomField = 'category' | 'name' | 'model' | 'maker' | 'qtyNeeded' | 'unit' | 'ref' | 'drawing' | 'note' | 'packQty'

export const FIELD_LABEL: Record<BomField, string> = { category: '分類', name: '部品名', model: '型式', maker: 'メーカ', qtyNeeded: '数量', unit: '単位', ref: '回路記号', drawing: '図面番号', note: '備考', packQty: '入数' }

/** 見出しの言い換え（Excel でよく使われる表記） */
const HEADER_SYNONYMS: Record<BomField, RegExp> = {
  category: /^(分類|区分|カテゴリ|種別|ユニット)/,
  name: /^(部品名|品名|名称|品目|部品|名前|item|description|part(\s*name)?$|name$)/i,
  model: /^(型式|形式|型番|品番|形名|型名|部品番号|part\s*no|p\/n|mpn|model)/i,
  maker: /^(メーカ|メーカー|製造元|製造者|maker|mfr|manufacturer|vendor)/i,
  qtyNeeded: /^(数量|員数|個数|台数|必要数|qty|quantity|数)/i,
  unit: /^(単位|unit)/i,
  ref: /^(回路記号|記号|部品記号|デバイス|refdes|ref|reference|シンボル)/i,
  drawing: /^(図面|図番|図面番号|drawing|dwg)/i,
  note: /^(備考|摘要|メモ|note|remarks?|comment)/i,
  packQty: /^(入数|入り数|pack)/i,
}

const DEFAULT_ORDER: BomField[] = ['category', 'name', 'model', 'maker', 'qtyNeeded', 'unit', 'ref']

export interface PasteResult {
  rows: Array<Partial<Row>>
  mapping: Array<BomField | null>
  header: string[] | null
  delimiter: 'tab' | 'comma' | 'none'
  warnings: string[]
}

/**
 * タブ区切り・CSV を表に分ける。Excel は改行を含むセルを "…" で囲んで出すので、引用符の中の改行・区切りはセルの一部として扱う。
 * セルの中の改行は空白にする（BOM の項目は 1 行）
 */
export function parseTable(text: string, delim: '\t' | ','): string[][] {
  const out: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  let fresh = true // セルの先頭か（引用符はセルの先頭にあるときだけ囲みとみなす）
  const src = text.replace(/\r\n?/g, '\n')
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"'
        i++
      } else if (ch === '"') quoted = false
      else cell += ch === '\n' ? ' ' : ch
      continue
    }
    if (ch === '"' && fresh) {
      quoted = true
      fresh = false
      continue
    }
    if (ch === delim) {
      row.push(cell)
      cell = ''
      fresh = true
      continue
    }
    if (ch === '\n') {
      row.push(cell)
      out.push(row)
      row = []
      cell = ''
      fresh = true
      continue
    }
    cell += ch
    fresh = false
  }
  if (cell !== '' || row.length) {
    row.push(cell)
    out.push(row)
  }
  return out
}

export function detectField(h: string): BomField | null {
  const s = toHalf(h).trim()
  for (const [f, re] of Object.entries(HEADER_SYNONYMS) as Array<[BomField, RegExp]>) if (re.test(s)) return f
  return null
}

const UNIT_ALIAS: Record<string, Unit> = { 個: '個', pcs: '個', pc: '個', ケ: '個', ヶ: '個', 本: '本', m: 'm', ｍ: 'm', メートル: 'm', セット: 'セット', set: 'セット', パック: 'パック', pack: 'パック', 袋: 'パック', 箱: 'パック', 式: '式', 台: '個', 枚: '個' }

/** Excel からの貼り付け（タブ区切り / CSV）を BOM 行に変換する */
export function parseBomPaste(text: string): PasteResult {
  const raw = text.replace(/\r\n?/g, '\n')
  const warnings: string[] = []
  const delimiter: PasteResult['delimiter'] = raw.includes('\t') ? 'tab' : raw.includes(',') ? 'comma' : 'none'
  const table = delimiter === 'none' ? raw.split('\n').map((l) => [l]) : parseTable(raw, delimiter === 'tab' ? '\t' : ',')
  let lines = table.filter((r) => r.some((c) => c.trim() !== ''))
  if (!lines.length) return { rows: [], mapping: [], header: null, delimiter: 'none', warnings: ['貼り付けが空です'] }
  const split = (l: string[]) => l
  // 見出しの行を上から探す（表題・依頼No などの行が先にあってもよい）
  const filled = (l: string[]) => l.filter((c) => c.trim() !== '').length
  const headerAt = lines.slice(0, 10).findIndex((l) => l.map(detectField).filter(Boolean).length >= 2)
  // 1 列だけの貼り付けは、1 行目が「部品名」などの見出しそのものなら見出し
  const singleHeader = headerAt < 0 && lines[0].length === 1 && !!detectField(lines[0][0]) && lines[0][0].trim().length <= 8
  if (headerAt > 0) {
    warnings.push(`見出しより上の ${headerAt} 行（表題など）は取り込みません`)
    lines = lines.slice(headerAt)
  } else if (headerAt < 0 && !singleHeader) {
    // 見出しが無い表で、先頭の 1 セルだけの行（表題）は飛ばす
    const width = Math.max(...lines.map((l) => filled(l)))
    let skip = 0
    while (width >= 3 && skip < lines.length - 1 && filled(lines[skip]) === 1) skip++
    if (skip) {
      warnings.push(`表題らしい先頭の ${skip} 行は取り込みません`)
      lines = lines.slice(skip)
    }
  }
  const first = split(lines[0])
  const detected = first.map(detectField)
  const hasHeader = headerAt >= 0 || singleHeader
  let mapping: Array<BomField | null>
  if (hasHeader) mapping = detected
  else if (delimiter === 'none') {
    mapping = ['name']
    warnings.push('タブ区切り・カンマ区切りではないので、1 行を 1 部品の「部品名」として取り込みます（Excel の表をそのままコピーするとタブ区切りになります）')
  } else {
    const width = Math.max(...lines.map((l) => split(l).length))
    // 見出しが無いときは、数字ばかりの列を数量とみなし、その左に 部品名・型式・メーカ（列が多ければ分類も）を当てる
    const numericCol = Array.from({ length: width }, (_, i) => i).find((i) => {
      const vals = lines.map((l) => split(l)[i] ?? '').filter((v) => v.trim() !== '')
      return vals.length > 0 && vals.every((v) => { const r = parseNumber(v); return r.ok && r.value != null })
    })
    if (numericCol != null && numericCol >= 1 && numericCol <= 4) {
      const before = ([['name'], ['name', 'model'], ['name', 'model', 'maker'], ['category', 'name', 'model', 'maker']] as BomField[][])[numericCol - 1]
      const after = (['unit', 'ref', 'note'] as BomField[]).slice(0, Math.max(0, width - numericCol - 1))
      mapping = [...before, 'qtyNeeded', ...after]
    } else mapping = width <= 3 ? (['name', 'model', 'maker'] as BomField[]).slice(0, width) : DEFAULT_ORDER.slice(0, width)
    warnings.push(`見出しが無いので、列を「${mapping.map((f) => (f ? FIELD_LABEL[f] : '（使わない）')).join('・')}」と判断しました。違うときは 1 行目に見出し（部品名・型式・メーカ・数量 など）を付けて貼り付けてください`)
  }
  const used = mapping.filter(Boolean)
  const dup = used.find((f, i) => used.indexOf(f) !== i)
  if (dup) warnings.push(`「${FIELD_LABEL[dup]}」に当たる列が 2 つあります。左の列を使います`)
  if (hasHeader && !mapping.includes('name') && !mapping.includes('model')) warnings.push('見出しに「部品名」「型式」に当たる列がありません')
  const body = hasHeader ? lines.slice(1) : lines
  let badQty = 0
  let badUnit = 0
  const rows = body.map((line, i) => {
    const cells = split(line)
    const r: Partial<Row> = { qtyNeeded: 1, unit: '個' }
    const seen = new Set<BomField>()
    mapping.forEach((f, j) => {
      if (!f || seen.has(f)) return
      seen.add(f)
      const v = (cells[j] ?? '').trim()
      if (f === 'qtyNeeded') {
        const n = parseNumber(v, { min: 0, max: 1e9 })
        if (!n.ok || n.value == null) {
          if (v !== '' || !n.ok) badQty++
          r.qtyNeeded = 0
          if (v !== '') r.note = `${r.note ? r.note + ' ' : ''}数量「${v}」を読めません`
        } else r.qtyNeeded = n.value
      } else if (f === 'packQty') {
        const n = parseNumber(v, { min: 1, integer: true })
        r.packQty = n.ok ? n.value : null
      } else if (f === 'unit') {
        const u = UNIT_ALIAS[toHalf(v).toLowerCase()] ?? (UNITS as string[]).find((x) => x === v)
        if (v && !u) badUnit++
        r.unit = (u ?? '個') as Unit
      } else (r as Record<string, unknown>)[f] = v
    })
    void i
    return r
  })
  if (badQty) warnings.push(`数量を読めない行が ${badQty} 行あります（0 にしてエラー表示します。4 要確認で直してください）`)
  if (badUnit) warnings.push(`単位を読めない行が ${badUnit} 行あります（「個」にしました）`)
  return { rows, mapping, header: hasHeader ? first : null, delimiter, warnings }
}

/** xlsx ファイルの最初のシートをタブ区切りテキストにする */
export async function xlsxToTsv(buf: ArrayBuffer): Promise<string> {
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buf)
  // シートが複数あるときは、見出し（部品名・型式・数量 など）のあるシートを読む（表紙・改訂履歴を部品にしない）
  const sheets = wb.worksheets.map((ws) => {
    const lines: string[] = []
    ws.eachRow({ includeEmpty: false }, (row) => {
      const vals = (row.values as unknown[]).slice(1).map((v) => cellToText(v).replace(/[\t\n\r]/g, ' '))
      lines.push(vals.join('\t'))
    })
    const score = lines.slice(0, 10).reduce((m, l) => Math.max(m, l.split('\t').map(detectField).filter(Boolean).length), 0)
    return { name: ws.name, text: lines.join('\n'), score, rows: lines.length }
  })
  if (!sheets.length) return ''
  const best = [...sheets].sort((a, b) => b.score - a.score || b.rows - a.rows)[0]
  lastSheetName = sheets.length > 1 ? best.name : null
  return best.text
}
/** 複数シートの xlsx で読んだシートの名前（案内用） */
export let lastSheetName: string | null = null

/** Excel のセルの値を文字にする（リッチテキスト・数式・ハイパーリンク・エラー・日付） */
function cellToText(v: unknown): string {
  if (v == null) return ''
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>
    if (Array.isArray(o.richText)) return (o.richText as Array<{ text?: unknown }>).map((t) => String(t.text ?? '')).join('')
    if ('error' in o) return ''
    if ('result' in o) return cellToText(o.result)
    if ('text' in o) return cellToText(o.text)
    if ('hyperlink' in o) return String(o.hyperlink)
    return ''
  }
  return String(v)
}
