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
  qtyNeeded: /^(数量|員数|個数|台数|必要数|使用数|所要数|qty|q'ty|q\.ty|quantity|数)/i,
  unit: /^(単位|unit)/i,
  ref: /^(回路記号|記号|部品記号|デバイス|refdes|ref|reference|designator|シンボル)/i,
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

// 見出しの版の印（旧・現行・変更前・old ／ 新・変更後・改・new）。区切り（空白・_・括弧・／）で区切られた語、または見出しの頭
const VER_SEP = '[\\s_\\-【】\\[\\]［］（）()／/・:：]'
// 「修正前／後」「改定前／後」「改正前／後」「訂正前／後」「差替前／後」「現状／変更案」も
const CHANGE_STEM = '(?:変更|改訂|改定|改正|修正|訂正|差替|差し替え)'
const OLD_WORDS = `${CHANGE_STEM}前|前回|旧品|旧版|旧|現行|現状|現|前|old|before|prev(?:ious)?|as-?is`
const NEW_WORDS = `${CHANGE_STEM}後|変更案|新品|新版|新|変更|改|後|new|after|to-?be`
// 見出しの頭に付く印（新型式・旧品番・現数量・修正前型式）。「新品番」「旧品名」の「品」は項目の一部なので、頭の印は 1 字の新・旧を先に
const OLD_PREFIX = `${CHANGE_STEM}前|前回|旧|現行|現状|現|old|prev`
const NEW_PREFIX = `${CHANGE_STEM}後|変更案|新|変更|改|new`
const verToken = (w: string) => new RegExp(`(^|${VER_SEP})(${w})(?=${VER_SEP}|$)`, 'i')
const verPrefix = (w: string) => new RegExp(`^(${w})(?=[^\\s_\\-（(])`, 'i')
/** 見出しが前の版（old）・新しい版（new）の列か。「型式（旧型式併記）」のような注記の中の語は見ない */
export function headerVersion(h: string): 'old' | 'new' | null {
  const s = toHalf(h).trim()
  if (verToken(OLD_WORDS).test(s) || verPrefix(OLD_PREFIX).test(s)) return 'old'
  if (verToken(NEW_WORDS).test(s) || verPrefix(NEW_PREFIX).test(s)) return 'new'
  return null
}
/** 見出しの Rev（Rev.A・Rev.2）。同じ項目の列が複数あれば、新しい Rev の列を使う */
export function headerRev(h: string): number | null {
  const m = /rev\.?\s*([a-z]|\d+)\b/i.exec(toHalf(h))
  if (!m) return null
  return /\d/.test(m[1]) ? Number(m[1]) : m[1].toUpperCase().charCodeAt(0) - 64
}
/**
 * 見出しのセルとして見るときの項目（見出しを探すとき用）。値の入ったセル（「名称未定」「型式未定」「品名：制御盤」「数量：1台」）は見出しにしない
 */
export function headerField(c: string): BomField | null {
  const t = toHalf(c).trim()
  if (!t || t.length > 24) return null
  if (/未定|tbd|予定|検討中|調整中|確認中|不明/i.test(t)) return null
  if (/[:：]\s*\S/.test(t)) return null
  if (/\d{2,}/.test(t)) return null
  return detectField(t)
}
export function detectField(h: string): BomField | null {
  // 版の印を外してから項目を見る（「現数量」「型式（旧）」「新型式」も数量・型式。どちらを使うかは列を選ぶときに決める）
  let s = toHalf(h).trim()
  s = s.replace(/rev\.?\s*([a-z]|\d+)\b/gi, ' ').replace(verToken(OLD_WORDS), ' ').replace(verToken(NEW_WORDS), ' ').replace(verPrefix(OLD_PREFIX), '').replace(verPrefix(NEW_PREFIX), '').replace(/[（(]\s*[）)]|【\s*】|\[\s*\]/g, '').trim()
  // 字の間の空白（品 名・メ ー カ・数　量）を詰める
  s = s.replace(/[\s　]+/g, '')
  if (!s) return null
  // 「Manufacturer Part Number」「メーカ型番」のように、部品番号を表す語を含む見出しは型式
  if (/part\s*(no|number|#)|p\/n|\bmpn\b|型番|品番|形番|型式|形式/i.test(s)) return 'model'
  // 数量は語の途中でも（使用個数・手配数量・必要個数・員数合計）
  if (/数量|員数|個数|要数|必要数|使用数|所要数|手配数|所要量|使用量|必要量|q'?ty|q\.ty|quantity/i.test(s) && !/単価|金額|価格/.test(s)) return 'qtyNeeded'
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
  // 見出しは、上から 30 行のうち見出しの言葉が最も多い行（表題欄の「品名 / 図番」より、本当の見出しの方が多い）
  const counts = lines.slice(0, 30).map((l) => new Set(l.map(headerField).filter(Boolean)).size)
  const best = Math.max(0, ...counts)
  // 同じ数なら下の行（表題欄の下に本当の見出しがあるのが普通）。ただしページごとに同じ見出しを繰り返した表は最初の見出し
  const tops = counts.map((n, i) => (n === best ? i : -1)).filter((i) => i >= 0)
  // 繰り返しかどうかは見出しの言葉の組み合わせで見る（2 ページ目の「品名（続き）」・空の No・「P.1」・員数／数量でも同じ見出し）。
  // いちばん見出しらしい行と、見出しの言葉が 6 割以上重なる行を「同じ見出し」とみなし、その最初の行を見出しにする
  const fieldSet = (l: string[]) => new Set(l.map(headerField).filter(Boolean))
  const bestSet = best >= 2 ? fieldSet(lines[tops[tops.length - 1]]) : new Set()
  const sameHeader = (l: string[]) => {
    const f = fieldSet(l)
    if (f.size < 2) return false
    let both = 0
    for (const x of f) if (bestSet.has(x)) both++
    return both >= Math.ceil(Math.max(f.size, bestSet.size) * 0.6)
  }
  const firstSame = lines.slice(0, 30).findIndex(sameHeader)
  const headerAt = best >= 2 ? (firstSame >= 0 ? firstSame : tops[tops.length - 1]) : -1
  // 2 段の見出しで、上の段がまとめの名前（部品情報｜数量）、下の段が項目と「旧／新」のとき: 下の段の「旧」「新」に上の段の名前を付ける
  if (headerAt > 0) {
    const up = lines[headerAt - 1]
    const h = lines[headerAt]
    const markOnly = (c: string) => c.trim() !== '' && headerVersion(c) !== null && detectField(c) === null
    if (h.some(markOnly)) {
      let carry = ''
      const merged = h.map((c, j) => {
        if ((up[j] ?? '').trim()) carry = up[j].trim()
        return markOnly(c) && carry ? `${carry}（${c.trim()}）` : c
      })
      if (merged.some((c, j) => c !== h[j])) lines[headerAt] = merged
    }
  }
  // 1 列だけの貼り付けは、1 行目が「部品名」などの見出しそのものなら見出し
  const singleHeader = headerAt < 0 && lines[0].length === 1 && !!detectField(lines[0][0]) && lines[0][0].trim().length <= 8
  if (headerAt > 0) {
    warnings.push(`見出しより上の ${headerAt} 行（表題など）は取り込みません`)
    lines = lines.slice(headerAt)
  }
  if (headerAt >= 0) {
    // ページごとに繰り返した同じ見出しの行は外す（部品にしない）。2 ページ目以降の見出しで列の並びが違えば、
    // そのページの行を最初の見出しの並びに並べ直す（No の列が増えた・数量と単位が入れ替わった など）
    const baseFields = lines[0].map(headerField)
    const out: string[][] = [lines[0]]
    let perm: number[] | null = null
    let removed = 0
    let reordered = 0
    for (const l of lines.slice(1)) {
      if (sameHeader(l)) {
        removed++
        const f = l.map(headerField)
        const pm = baseFields.map((bf, j) => (bf ? f.indexOf(bf) : j))
        perm = pm.every((k, j) => k === j) ? null : pm
        continue
      }
      if (perm) reordered++
      out.push(perm ? perm.map((k, j) => (k >= 0 ? (l[k] ?? '') : baseFields[j] ? '' : (l[j] ?? ''))) : l)
    }
    lines = out
    if (removed) warnings.push(`繰り返しの見出し ${removed} 行は取り込みません${reordered ? `（列の並びが違うページの ${reordered} 行は、最初の見出しの並びに直しました）` : ''}`)
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
  // 2 段の見出し（上の段に「型式」「数量」を結合、下の段に「旧／新」「変更前／変更後」）は 1 段にまとめる
  if (headerAt >= 0 && lines.length > 1) {
    const sub2 = lines[1]
    const marks = sub2.filter((c) => c.trim() !== '' && headerVersion(c) !== null && detectField(c) === null).length
    const others = sub2.filter((c) => c.trim() !== '' && !(headerVersion(c) !== null && detectField(c) === null)).length
    if (marks >= 2 && others === 0) {
      let carry = ''
      const merged = lines[0].map((c, j) => {
        if (c.trim()) carry = c.trim()
        const base = c.trim() || (sub2[j]?.trim() ? carry : '')
        return sub2[j]?.trim() ? `${base}（${sub2[j].trim()}）` : c
      })
      lines = [merged, ...lines.slice(2)]
      warnings.push('2 段の見出しを 1 段にまとめて読みました')
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
    if (numericCol === 0 && width >= 2) {
      // 数量が先頭の列（「4 リレー MY4N」）
      mapping = (['qtyNeeded', 'name', 'model', 'maker', 'unit', 'ref'] as BomField[]).slice(0, width)
    } else if (numericCol != null && numericCol >= 1 && numericCol <= 4) {
      const before = ([['name'], ['name', 'model'], ['name', 'model', 'maker'], ['category', 'name', 'model', 'maker']] as BomField[][])[numericCol - 1]
      const after = (['unit', 'ref', 'note'] as BomField[]).slice(0, Math.max(0, width - numericCol - 1))
      mapping = [...before, 'qtyNeeded', ...after]
    } else mapping = width <= 3 ? (['name', 'model', 'maker'] as BomField[]).slice(0, width) : DEFAULT_ORDER.slice(0, width)
    warnings.push(`見出しが無いので、列を「${mapping.map((f) => (f ? FIELD_LABEL[f] : '（使わない）')).join('・')}」と判断しました。違うときは 1 行目に見出し（部品名・型式・メーカ・数量 など）を付けて貼り付けてください`)
  }

  if (hasHeader && !mapping.includes('name') && !mapping.includes('model')) warnings.push('見出しに「部品名」「型式」に当たる列がありません')
  // 数量の列が無いと全部 1 になる。黙らない
  if (hasHeader && !mapping.includes('qtyNeeded')) warnings.push('見出しに「数量」に当たる列が見つからないので、数量は全部 1 にしました（見出しを「数量」にして貼り直すか、作成後に直してください）')
  // 小計・合計の行は部品ではない
  // 部品名・型式に部品らしい値がある行は、備考などが「以上」「計」でも合計の行にしない
  const partCols = mapping.map((f, j) => (f === 'name' || f === 'model' ? j : -1)).filter((j) => j >= 0)
  const looksPart = (l: string[]) => partCols.some((j) => (l[j] ?? '').trim() !== '' && !isTotalCell(l[j] ?? ''))
  const isTotal = (l: string[]) => (l.some(isTotalCell) && !looksPart(l)) || isSectionLine(l, Math.max(l.length, mapping.length))
  const totals = lines.slice(hasHeader ? 1 : 0).filter(isTotal).length
  if (totals) warnings.push(`小計・合計・区切りの ${totals} 行は取り込みません`)
  // 使う列がすべて空の行（使わない列にだけあるページ番号・表題など）は部品にしない
  const mappedEmpty = (l: string[]) => mapping.every((f, j) => !f || (l[j] ?? '').trim() === '')
  const blanks = lines.slice(hasHeader ? 1 : 0).filter((l) => !isTotal(l) && mappedEmpty(l)).length
  if (blanks) warnings.push(`部品の列がすべて空の ${blanks} 行（ページ番号・表題など）は取り込みません`)
  const body = (hasHeader ? lines.slice(1) : lines).filter((l) => !isTotal(l) && !mappedEmpty(l))
  // 見出しが「Item」「No」でも中身が番号だけの列は部品名にしない（行番号の列）
  mapping = mapping.map((f, j) => (f === 'name' && body.length > 0 && body.every((l) => /^\s*\d+\s*$/.test(l[j] ?? '')) ? null : f))
  // 同じ項目に当たる列が 2 つあれば、左の列を使う（番号だけの列を外したあとで判定する）
  // 見出しに「新」「変更後」「new」とある列があればそれを（現型式／新型式）、無ければ左の列を使う
  // 項目ごとに（型式も数量も）。新しい版の印の列 → 印の無い列 → 前の版の列 の順で、同じなら左
  const used = mapping.filter(Boolean)
  for (const dup of [...new Set(used.filter((f, i) => used.indexOf(f) !== i))] as BomField[]) {
    const cols = mapping.map((f, j) => (f === dup ? j : -1)).filter((j) => j >= 0)
    const rank = (j: number) => {
      const v = hasHeader ? headerVersion(first[j] ?? '') : null
      return v === 'new' ? 0 : v === null ? 1 : 2
    }
    // Rev が書いてあれば新しい Rev を先に
    const rev = (j: number) => (hasHeader ? (headerRev(first[j] ?? '') ?? -1) : -1)
    const keep = [...cols].sort((a, b) => rev(b) - rev(a) || rank(a) - rank(b) || a - b)[0]
    mapping = mapping.map((f, j) => (f === dup && j !== keep ? null : f))
    warnings.push(`「${FIELD_LABEL[dup]}」に当たる列が ${cols.length} つあります。「${(hasHeader ? first[keep] : '') || '左の列'}」の列を使います`)
  }
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
        } else {
          r.qtyNeeded = n.value
          // 単位の列が無いときは、数量に付いた単位（20 m・5 本）を単位にする
          const suffix = /([^\d\s.,]+)\s*$/.exec(toHalf(v))?.[1]
          const u = suffix ? UNIT_ALIAS[suffix.toLowerCase()] : undefined
          if (u && !mapping.includes('unit')) r.unit = u
        }
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
  const noResult = body.reduce((n, l) => n + split(l).filter((c) => c.trim() === '#数式の結果なし').length, 0)
  if (noResult) warnings.push(`数式の計算結果が入っていないセルが ${noResult} 個あります（Excel で開いて保存し直してから読むと値が入ります）`)
  return { rows, mapping, header: hasHeader ? first : null, delimiter, warnings }
}

/** xlsx ファイルの最初のシートをタブ区切りテキストにする */
export async function xlsxToTsv(buf: ArrayBuffer): Promise<string> {
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buf)
  // シートが複数あるときは、見出し（部品名・型式・数量 など）のあるシートを読む（表紙・改訂履歴を部品にしない）
  // 非表示のシート（旧版を隠したもの）は読まない。すべて非表示なら全部から選ぶ
  const visible = wb.worksheets.filter((ws) => ws.state === undefined || ws.state === 'visible')
  const sheets = (visible.length ? visible : wb.worksheets).map((ws) => {
    const lines: string[] = []
    // 非表示の列（Excel で隠した旧型式の列など）も取り込まない
    const hiddenCols = new Set<number>()
    for (let c = 1; c <= ws.columnCount; c++) if (ws.getColumn(c).hidden) hiddenCols.add(c)
    // 隠した列でも、その項目（数量・型式など）の列がほかに無ければ読む（隠しただけで数量が全部 1 にならない）
    const unhidden: string[] = []
    if (hiddenCols.size) {
      // 見出しの行（上から 30 行で見出しの言葉が最も多い行）の列だけを見る（表題の「台数 2台」などを見出しにしない）
      let fieldOf = new Map<number, BomField>()
      let headerCells = new Map<number, string>()
      let n = 0
      ws.eachRow({ includeEmpty: false }, (row) => {
        if (n++ >= 30) return
        const raw = row.values as unknown[]
        const m = new Map<number, BomField>()
        const texts = new Map<number, string>()
        for (let c = 1; c < raw.length; c++) {
          texts.set(c, cellToText(raw[c]))
          const f = detectField(cellToText(raw[c]))
          if (f) m.set(c, f)
        }
        if (new Set(m.values()).size > new Set(fieldOf.values()).size) {
          fieldOf = m
          headerCells = texts
        }
      })
      const visibleFields = new Set([...fieldOf].filter(([c]) => !hiddenCols.has(c)).map(([, f]) => f))
      for (const c of [...hiddenCols]) {
        const f = fieldOf.get(c)
        // 前の版の列（旧型式など）は、隠してあれば読まない
        if (f && !visibleFields.has(f) && headerVersion(headerCells.get(c) ?? '') !== 'old') {
          hiddenCols.delete(c)
          visibleFields.add(f)
          unhidden.push(FIELD_LABEL[f])
        }
      }
    }
    let hiddenRows = 0
    ws.eachRow({ includeEmpty: false }, (row) => {
      // 非表示の行（Excel で隠した行・フィルタで隠れた行）は取り込まない（数は知らせる）
      if (row.hidden) {
        hiddenRows++
        return
      }
      // row.values は空のセルが穴（疎な配列）なので、列の数だけ詰めずに並べてから隠した列を外す（filter は穴を飛ばして列がずれる）
      const raw = row.values as unknown[]
      const vals: string[] = []
      for (let c = 1; c < raw.length; c++) {
        if (hiddenCols.has(c)) continue
        // 結合したセルは左上のセルにだけ値を置く（ExcelJS は結合した全部のセルに同じ値を返す。2 段の見出しの形を崩さない）
        const cell = row.getCell(c)
        const slave = cell.isMerged && cell.master && cell.master.address !== cell.address
        vals.push(slave ? '' : cellToText(raw[c]).replace(/[\t\n\r]/g, ' '))
      }
      lines.push(vals.join('\t'))
    })
    // 見出しは上から 30 行まで探す（貼り付けの見出し探しと同じ。表題欄が長いシート）
    const score = lines.slice(0, 30).reduce((m, l) => Math.max(m, l.split('\t').map(detectField).filter(Boolean).length), 0)
    return { name: ws.name, text: lines.join('\n'), score, rows: lines.length, hiddenRows, hiddenCols: hiddenCols.size, unhidden }
  })
  if (!sheets.length) return ''
  // 見出しの言葉が同じだけあるシートが複数なら、名前が「旧版・old・コピー」などでないシート → 左（先）のシート
  const stale = (n: string) => /旧|old|bak|backup|履歴|コピー|copy|削除|廃止|参考/i.test(n)
  const rank = (x: (typeof sheets)[number]) => x.score * 2 - (stale(x.name) ? 1 : 0)
  const best = sheets.reduce((a, b) => (rank(b) > rank(a) ? b : a))
  lastSheetName = sheets.length > 1 ? best.name : null
  hiddenNote = [
    best.hiddenCols || best.hiddenRows ? `Excel で隠した${best.hiddenCols ? `列 ${best.hiddenCols} 列` : ''}${best.hiddenCols && best.hiddenRows ? '・' : ''}${best.hiddenRows ? `行 ${best.hiddenRows} 行` : ''}は読んでいません（要るときは Excel で再表示してから読んでください）` : '',
    best.unhidden.length ? `隠れていた「${best.unhidden.join('」「')}」の列は、ほかに同じ項目の列が無いので読みました` : '',
  ]
    .filter(Boolean)
    .join('。')
  // 見出しのある別のシートがあれば、名前を知らせる（違うシートを読んだと気づけるように）
  otherSheets = sheets.filter((x) => x !== best && x.score > 0 && x.score >= best.score - 1).map((x) => x.name)
  return best.text
}
/** 隠した列・行を読まなかったことの案内（空なら無し） */
export let hiddenNote = ''
/** 見出しがあって読まなかったシートの名前（案内用） */
export let otherSheets: string[] = []
/** 複数シートの xlsx で読んだシートの名前（案内用） */
export let lastSheetName: string | null = null

/** Excel のセルの値を文字にする（リッチテキスト・数式・ハイパーリンク・エラー・日付） */
function cellToText(v: unknown): string {
  if (v == null) return ''
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>
    if (Array.isArray(o.richText)) return (o.richText as Array<{ text?: unknown }>).map((t) => String(t.text ?? '')).join('')
    // エラーのセル（#REF! など）は空にせず、そのまま見せる（数量なら「読めない」として知らせる）
    if ('error' in o) return String(o.error ?? '#エラー')
    if ('result' in o && o.result !== undefined) return cellToText(o.result)
    // 計算結果を持たない数式（Excel 以外のツールが書いたファイル）は空にせず印を残す（数量なら「読めない」として知らせる）
    if ('formula' in o || 'sharedFormula' in o) return '#数式の結果なし'
    if ('text' in o) return cellToText(o.text)
    if ('hyperlink' in o) return String(o.hyperlink)
    return ''
  }
  return String(v)
}

/** 小計・合計の行のラベル（「合計」「合計金額」「Grand Total:」など。どの列にあっても） */
export function isTotalCell(c0: string): boolean {
  // 全角の数字・記号は半角にしてから見る（「計 ６」）
  const c = toHalf(c0)
  // 空白と飾り（【】＜＞＊-＝ など）を外してから見る（「【合計】」「＊合計＊」「-- 以下余白 --」）
  const t = c.replace(/[\s　【】［］\[\]<>＜＞〈〉《》＊*※\-－ー—―=＝~～・_＿]/g, '')
  // 飾りだけのセル（「＝＝＝＝」「----」）は区切り
  if (!t && c.trim().length >= 3) return true
  if (/^(以下余白|以下空白|以上)(です|でございます)?$/.test(t)) return true
  // 「以上、2点」「（合計）」
  if (/^以上[、,]?[\d,.]*(点|個|行|件)?$/.test(t)) return true
  if (/^[（(](小計|合計|総計|計)[）)]$/.test(t)) return true
  // 「計：6個」「合計 6点」「合計数量 6」「合計金額 ¥12,000」「部品点数 3」のように、同じセルに数・単位が続くものも
  // 「合計 6台分」「合計：6個 / ¥12,000」（数・単位・金額がいくつ続いても）
  return /^(員数|数量|部品|金額)?(小計|合計|総計|総合計|総数量|総数|計|部品点数|点数|total|subtotal|grandtotal)(金額|額|数|数量|点数|amount|qty)?[:：]?([/／,、]?[¥￥$]?[\d,.]+(個|点|台|本|枚|式|円|pcs)?分?)*([（(][^）)]*[）)])?$/i.test(t)
}
/**
 * 区切り・分類の見出しの行（「■ 制御部」「【電源】」「<端子部>」「1. 制御部」だけが入った行）。部品ではない。
 * width は表の列の数（xlsx は行の右の空のセルが無いので、セルの数では見ない）。1 列だけの表では使わない
 */
const PAGE_TITLE = /^(部品表|部品リスト|部品一覧|parts\s*list|bill\s*of\s*materials|BOM)\s*([(（]?\s*\d+\s*[/／]\s*\d+\s*[)）]?|\d+\s*(ページ|頁)|p\.?\s*\d+)?$/i
const PAGE_NO = /^([(（]?\s*\d+\s*[/／]\s*\d+\s*[)）]?|p\.?\s*\d+(\s*[/／]\s*\d+)?|\d+\s*(ページ|頁)|page\s*\d+(\s*(of|\/)\s*\d+)?)$/i
export function isSectionLine(cells: string[], width = cells.length): boolean {
  // 全角の数字・記号は半角にしてから見る（「－２－」）
  const filled = cells.map((c) => toHalf(c).trim()).filter(Boolean)
  // ページの表題とページ番号だけの行（「部品表 (2/3)」と「P.2」）
  if (width > 1 && filled.length === 2 && filled.every((c) => PAGE_TITLE.test(c) || PAGE_NO.test(c))) return true
  return (
    width > 1 &&
    filled.length === 1 &&
    (/^[■□◆◇●○▼▽▲△★☆【［]/.test(filled[0]) ||
      /^([<＜〈《][^>＞〉》]+[>＞〉》]|\d+[.．、]\s*[^\d\s].*)$/.test(filled[0]) ||
      // ページごとの表題・ページ番号（部品表 (2/3)・P.2・2 / 3 ページ）
      PAGE_TITLE.test(filled[0]) ||
      PAGE_NO.test(filled[0]) ||
      // 「- 1 -」「Page 1 of 2」「（次頁へ続く）」「※ 注記」
      /^[-－—]\s*\d+\s*[-－—]$/.test(filled[0]) ||
      /^page\s*\d+\s*(of|\/)\s*\d+$/i.test(filled[0]) ||
      /(次頁|次ページ|前頁|前ページ|次葉).*(続|へ|つづ)|以下次頁|^[（(]?\s*(続く|つづく|続き)\s*[）)]?$/.test(filled[0]) ||
      /^[※＊*]\s*\S/.test(filled[0]))
  )
}
