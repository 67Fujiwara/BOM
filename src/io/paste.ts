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
  const lines = table.filter((r) => r.some((c) => c.trim() !== ''))
  if (!lines.length) return { rows: [], mapping: [], header: null, delimiter: 'none', warnings: ['貼り付けが空です'] }
  const split = (l: string[]) => l
  const first = split(lines[0])
  const detected = first.map(detectField)
  const hasHeader = detected.filter(Boolean).length >= 2 || (detected.filter(Boolean).length >= 1 && first.length === 1)
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
      const before = (['category', 'name', 'model', 'maker'] as BomField[]).slice(4 - numericCol)
      const after = (['unit', 'ref', 'note'] as BomField[]).slice(0, Math.max(0, width - numericCol - 1))
      mapping = [...before, 'qtyNeeded', ...after]
    } else mapping = DEFAULT_ORDER.slice(0, width)
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
  const ws = wb.worksheets[0]
  if (!ws) return ''
  const lines: string[] = []
  ws.eachRow({ includeEmpty: false }, (row) => {
    const vals = (row.values as unknown[]).slice(1).map((v) => {
      if (v == null) return ''
      if (typeof v === 'object' && v && 'text' in (v as object)) return String((v as { text: unknown }).text)
      if (typeof v === 'object' && v && 'result' in (v as object)) return String((v as { result: unknown }).result)
      if (v instanceof Date) return v.toISOString().slice(0, 10)
      return String(v).replace(/[\t\n]/g, ' ')
    })
    lines.push(vals.join('\t'))
  })
  return lines.join('\n')
}
