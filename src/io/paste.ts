import type { Row, Unit } from '@/model/types'
import { UNITS } from '@/model/types'
import { parseNumber, toHalf } from '@/model/parse'

export type BomField = 'category' | 'name' | 'model' | 'maker' | 'qtyNeeded' | 'unit' | 'ref' | 'drawing' | 'note' | 'packQty'

export const FIELD_LABEL: Record<BomField, string> = { category: '分類', name: '部品名', model: '型式', maker: 'メーカ', qtyNeeded: '数量', unit: '単位', ref: '回路記号', drawing: '図面番号', note: '備考', packQty: '入数' }

/** 見出しの言い換え（Excel でよく使われる表記） */
const HEADER_SYNONYMS: Record<BomField, RegExp> = {
  category: /^(分類|区分|カテゴリ|種別|ユニット)/,
  name: /^(部品名|品名|名称|品目|部品|名前|item|description|part(\s*name)?$|name$|value$|comment$)/i,
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
function closesProperly(src: string, start: number, delim: string, width = 0): boolean {
  for (let j = start + 1; j < src.length; j++) {
    const c = src[j]
    if (c === '"') {
      if (src[j + 1] === '"') {
        j++
        continue
      }
      const nx = src[j + 1]
      if (!(nx === undefined || nx === delim || nx === '\n' || nx === '\r')) return false
      // 改行をまたぐ囲みは、Excel の複数行のセル（中に区切りが無く、改行の前後に文字がある）だけ
      const inner = src.slice(start + 1, j)
      // （中に 1 行分の区切りがある＝次の行までつながった「"」は囲みでない。CSV の「盤内上段, 左側⏎(要確認)」は囲み）
      const delims = inner.split(delim).length - 1
      if (inner.includes('\n') && (!inner.trim() || (delim === '\t' ? delims > 0 : width > 0 && delims >= width))) return false
      return true
    }
    if (delim === '\t' && c === '\t') return false
  }
  return false
}
export function parseTable(text: string, delim: '\t' | ','): string[][] {
  const out: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  let fresh = true // セルの先頭か（引用符はセルの先頭にあるときだけ囲みとみなす）
  const src = text.replace(/\r\n?/g, '\n')
  // 1 行目の区切りの数（見出しの列の数 − 1）。囲みの中にこれだけの区切りがあれば、行をまたいだ誤った囲み
  const width = (src.split('\n')[0] ?? '').split(delim).length - 1
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
    // 引用符で囲んだセルは、閉じる引用符のすぐ後ろが区切り・改行・終わりのときだけ。
    // 閉じない「"」だけのセル（〃の代わり）や、タブ区切りで中にタブを含むもの（別のセルの「"」までつながる）は、ただの文字
    if (ch === '"' && fresh && closesProperly(src, i, delim, width)) {
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
// 「変更後の型式」「Prev. P/N」の「の」「.」も区切り
const VER_SEP = '[\\s_\\-【】\\[\\]［］（）()／/・:：の.]'
// 「修正前／後」「改定前／後」「改正前／後」「訂正前／後」「差替前／後」「現状／変更案」も
const CHANGE_STEM = '(?:変更|改訂|改定|改正|修正|訂正|差替|差し替え)'
const OLD_WORDS = `${CHANGE_STEM}前|前回|旧品|旧版|旧|現在|現行|現状|現|今|前|old|before|prev(?:ious)?|as-?is|was|current`
// 「変更」だけの語は印にしない（「変更記号」「変更備考」「型式の変更」は変更の内容の列）。「変更型式」は下の頭の印で
const NEW_WORDS = `${CHANGE_STEM}後|変更案|新しい|新品|新版|新|改|修正|後|new|after|to-?be|is|proposed|revised`
// 見出しの頭に付く印（新型式・旧品番・現数量・修正前型式）。「新品番」「旧品名」の「品」は項目の一部なので、頭の印は 1 字の新・旧を先に
const OLD_PREFIX = `${CHANGE_STEM}前|前回|旧|現在|現行|現状|現|old|prev`
const NEW_PREFIX = `${CHANGE_STEM}後|変更案|新しい|新|変更(?=型式|形式|型番|品番|数量|員数|品名|部品名|名称|メーカ)|改|new`
const verToken = (w: string) => new RegExp(`(^|${VER_SEP})(${w})(?=${VER_SEP}|$)`, 'i')
// 頭の印は、すぐ後ろが項目の語のときだけ（「Newark P/N」「新光品番」は商社の名前で版の印ではない）
const FIELD_HEAD = '型式|形式|型番|品番|形番|形名|型名|品名|部品|名称|数量|員数|個数|台数|要数|必要|使用|手配|所要|メーカ|製造|図番|図面|記号|回路|備考|単位|入数|part|p\\/?n|mpn|qty|q\'ty|quantity|model|mfr|maker|manufacturer|desc|item|name|ref|dwg|drawing|note|unit'
const verPrefix = (w: string) => new RegExp(`^(${w})(?=${FIELD_HEAD})`, 'i')
/** 見出しが前の版（old）・新しい版（new）の列か。「型式（旧型式併記）」のような注記の中の語は見ない */
export function headerVersion(h: string): 'old' | 'new' | null {
  const s = toHalf(h).trim()
  if (verToken(OLD_WORDS).test(s) || verPrefix(OLD_PREFIX).test(s)) return 'old'
  if (verToken(NEW_WORDS).test(s) || verPrefix(NEW_PREFIX).test(s)) return 'new'
  // 「変更」だけのセル（2 段目の「現行｜変更」）・括弧の「（変更）」は新しい版。「変更記号」「型式の変更」は印にしない
  if (/^[（(【\[]?\s*変更\s*[）)】\]]?$/.test(s) || /[（(【\[]\s*変更\s*[）)】\]]/.test(s) || /^変更[\s_・]+\S/.test(s)) return 'new'
  return null
}
/** 2 段目の小見出し（号機ごと・1 台当り・台数・合計） */
const MACHINE_SUB = /^(#\s*\d+|no\.?\s*\d+|\d+\s*号機?|号機?\s*\d+|[a-z]\s*号機?|\d+\s*台目|1?\s*台当た?り|1台あたり|台数|予備|合計|計|小計|総数|total|sum)$/i
/** 数量の列のうち合計の数（号機ごと・1 台当りより優先） */
const TOTALISH = /合計|総数|総計|必要数|手配数|発注数|所要数|total|sum|[（(]\s*計\s*[）)]$|^計$/i
/** 見出しの Rev（Rev.A・Rev.2）。同じ項目の列が複数あれば、新しい Rev の列を使う */
export function headerRev(h: string): number | null {
  const m = /(?<![a-z])rev\.?\s*([a-z]|\d+)\b/i.exec(toHalf(h))
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
  // 「品番なし」「メーカ不問」「メーカー支給」「型番別紙」「同等品」は値（部品の行）で、見出しではない
  if (/なし|無し|不問|支給|別紙|同等|相当/.test(t)) return null
  if (/[:：]\s*\S/.test(t)) return null
  if (/\d{2,}/.test(t)) return null
  return detectField(t)
}
/** 見出しの読み（古い基幹システムの半角カナの見出し「ﾋﾝﾒｲ」「ｶﾀｼｷ」「ｽｳﾘｮｳ」） */
const KANA_HEADER: Record<string, string> = { ヒンメイ: '品名', ブヒンメイ: '部品名', メイショウ: '名称', カタシキ: '型式', ケイシキ: '形式', カタバン: '型番', ヒンバン: '品番', スウリョウ: '数量', コスウ: '個数', インズウ: '員数', ヒツヨウスウ: '必要数', タンイ: '単位', ビコウ: '備考', ブンルイ: '分類', ズバン: '図番', キゴウ: '記号', イリスウ: '入数' }
export function detectField(h: string): BomField | null {
  // 版の印を外してから項目を見る（「現数量」「型式（旧）」「新型式」も数量・型式。どちらを使うかは列を選ぶときに決める）
  let s = toHalf(h).trim()
  s = s.replace(/[ァ-ヶー]{2,}/g, (w) => KANA_HEADER[w] ?? w)
  s = s.replace(/(?<![a-z])rev\.?\s*([a-z]|\d+)\b/gi, ' ').replace(verToken(OLD_WORDS), ' ').replace(verToken(NEW_WORDS), ' ').replace(verPrefix(OLD_PREFIX), '').replace(verPrefix(NEW_PREFIX), '').replace(/[（(]\s*[）)]|【\s*】|\[\s*\]/g, '').trim()
  // 字の間の空白（品 名・メ ー カ・数　量）を詰める。印を外したあとに残る「の」「.」（変更後の型式・Prev. P/N）も
  s = s.replace(/^変更[\s_・]+(?=\S)/, '').replace(/[\s　]+/g, '').replace(/^[の.]+/, '')
  if (!s) return null
  // 「Manufacturer Part Number」「メーカ型番」のように、部品番号を表す語を含む見出しは型式
  if (/part\s*(no|number|#)|p\/n|\bmpn\b|型番|品番|形番|型式|形式/i.test(s)) return 'model'
  // 数量は語の途中でも（使用個数・手配数量・必要個数・員数合計）
  if (/数量|員数|個数|要数|必要数|使用数|所要数|手配数|所要量|使用量|必要量|q'?ty|q\.ty|quantity|^(製作|製造|生産)台?数$/i.test(s) && !/単価|金額|価格/.test(s)) return 'qtyNeeded'
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
  // 表題欄（「品名 | 制御盤A | 数量 | 1台」のようにラベルと値が別のセル）は、見出しの言葉が多くても見出しにしない:
  // 数（単位つきも）だけのセルがある行、見出しの言葉のすぐ右がいつも値になっている行
  // 値のセル: 見出しの言葉（項目・単価・金額・規格 など）でない。「数量 | 1台」の「1台」は値
  const HEADER_WORD = /^(no\.?|番号|規格|仕様|単価|金額|価格|納期|購入先|仕入先|手配|区分|摘要|小計|合計|計|頁|ページ|サイズ|材質|重量|用途|号機|\d+\s*号機|寸法|定格|定格電圧|定格電流|耐圧|容量|電圧|電流|公差|外形|色|材料|仕上げ|表面処理|発注先|担当|担当者|保管場所|ロット|作成日|作成者|price|unitprice|amount|spec|specification|cost|leadtime|vendor|supplier|value|footprint|package|dnp|tolerance|voltage|rating|color|colour|material|size|lot)$/i
  const valueCell = (c: string) => c.trim() !== '' && !detectField(c) && !HEADER_WORD.test(toHalf(c).replace(/[\s　]+/g, ''))
  const alternating = (l: string[]) => {
    const idx = l.map((_, j) => j).filter((j) => headerField(l[j]))
    return idx.length >= 2 && idx.every((j) => valueCell(l[j + 1] ?? ''))
  }
  // 表題欄とみなすのは、ほかに見出しらしい行（見出しの語が 2 つ以上で、語と値が交互でない行）があるときだけ。
  // 「部品名・寸法・型式・定格・数量」「Description・Value・MPN・Footprint」のように項目の右に属性の列が並ぶ見出しは、それ自体が見出し
  const raw30 = lines.slice(0, 30).map((l) => new Set(l.map(headerField).filter(Boolean)).size)
  const alt30 = lines.slice(0, 30).map(alternating)
  const otherHeader = raw30.some((n, i) => n >= 2 && !alt30[i])
  const titleLike = (l: string[]) => otherHeader && alternating(l)
  const counts = raw30.map((n, i) => (otherHeader && alt30[i] ? 0 : n))
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
  // 繰り返しの見出しを探すときも、表題欄・値のセルの割合がいちばん見出しらしい行より目立って多い行は見出しにしない
  const ratio = (l: string[]) => {
    const f = l.filter((c) => c.trim() !== '')
    return f.length ? f.filter((c) => headerField(c)).length / f.length : 0
  }
  const bestRatio = best >= 2 ? Math.min(...tops.map((i) => ratio(lines[i]))) : 0
  // 繰り返しの見出しは、いちばん見出しらしい行と同じくらいの項目がある行だけ（「品名｜数量」の縦の表題欄を見出しにしない）
  const enough = (l: string[]) => fieldSet(l).size >= (best >= 4 ? best - 1 : best)
  const firstSame = lines.slice(0, 30).findIndex((l, i) => sameHeader(l) && enough(l) && (tops.includes(i) || (!titleLike(l) && ratio(l) >= bestRatio - 0.15)))
  const headerAt = best >= 2 ? (firstSame >= 0 ? firstSame : tops[tops.length - 1]) : -1
  // 設計変更の様式の上の段（変更前｜変更後）。ページごとに繰り返していたら外す
  let upperRow: string[] | null = null
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
    } else if (up.some(markOnly)) {
      upperRow = up
      void upperRow
      // 設計変更の様式: 上の段に「変更前」「変更後」（旧／新）を結合し、下の段に項目を繰り返す → 下の段の繰り返した項目に上の段の印を付ける。
      // 上の段にだけある項目（縦に結合した「部品名」）は見出しにする
      const fs = h.map((c) => detectField(c))
      const dup = new Set(fs.filter((f, i) => f && fs.indexOf(f) !== i))
      if (dup.size) {
        let carry = ''
        const merged = Array.from({ length: Math.max(h.length, up.length) }, (_, j) => {
          const c = h[j] ?? ''
          const u = (up[j] ?? '').trim()
          if (u) carry = markOnly(u) ? u : ''
          if (!c.trim() && u && !markOnly(u) && detectField(u)) return u
          const f = detectField(c)
          return f && dup.has(f) && carry ? `${c.trim()}（${carry}）` : c
        })
        if (merged.some((c, j) => c !== (h[j] ?? ''))) lines[headerAt] = merged
      }
    }
  }
  // 1 列だけの貼り付けは、1 行目が「部品名」などの見出しそのものなら見出し
  const singleHeader = headerAt < 0 && lines[0].length === 1 && !!detectField(lines[0][0]) && lines[0][0].trim().length <= 8
  let titleRows: string[][] = []
  if (headerAt > 0) {
    warnings.push(`見出しより上の ${headerAt} 行（表題など）は取り込みません`)
    titleRows = lines.slice(0, headerAt)
    lines = lines.slice(headerAt)
  }
  // 2 段の見出し（上の段に「型式」「数量」を結合、下の段に「旧／新」「変更前／変更後」）は 1 段にまとめる。
  // 下の段で上の段と同じ文字のセル（縦に結合した「部品名」の繰り返し）は数えない
  const twoStage = (top: string[], sub: string[] | undefined): string[] | null => {
    if (!sub) return null
    const same = (j: number) => (sub[j] ?? '').trim() !== '' && (sub[j] ?? '').trim() === (top[j] ?? '').trim()
    // 下の段の小見出し: 版の印・Rev、号機ごとの数量（1号機・2号機・合計）
    // 上の段の項目（左へ結合の範囲をたどる）
    const topOf = (j: number) => {
      for (let k = j; k >= 0; k--) if ((top[k] ?? '').trim()) return top[k]
      return ''
    }
    // 数量（号機別数量）の下の「1｜2｜3」は号機
    const machNum = (c: string, j: number) => /^\d{1,2}$/.test(toHalf(c).trim()) && detectField(topOf(j)) === 'qtyNeeded'
    const mark0 = (c: string) => c.trim() !== '' && (MACHINE_SUB.test(toHalf(c).trim()) || (detectField(c) === null && (headerVersion(c) !== null || headerRev(c) !== null)))
    const mark = (c: string, j = -1) => mark0(c) || (j >= 0 && machNum(c, j))
    // 単位の注記（「(個)」「(円)」）は印でも部品でもない（まとめるときは無視する）
    const unitNote = (c: string) => /^[（(][^）)]{1,6}[）)]$/.test(c.trim())
    const marks = sub.filter((c, j) => !same(j) && mark(c, j)).length
    const others = sub.filter((c, j) => c.trim() !== '' && !same(j) && !mark(c, j) && !unitNote(c)).length
    // 印が 1 つだけでも、上の段の項目（結合の範囲）の下にあればまとめる
    const underField = sub.some((c, j) => mark(c, j) && !!detectField(topOf(j)))
    if (others > 0 || marks === 0 || (marks === 1 && !underField)) return null
    let carry = ''
    return Array.from({ length: Math.max(top.length, sub.length) }, (_, j) => {
      const c = top[j] ?? ''
      if (c.trim()) carry = c.trim()
      const sc0 = same(j) || unitNote(sub[j] ?? '') ? '' : (sub[j] ?? '').trim()
      const sc = sc0 && machNum(sc0, j) ? `${toHalf(sc0).trim()}号機` : sc0
      const base = c.trim() || (sc ? carry : '')
      return sc ? `${base}（${sc}）` : c
    })
  }
  if (headerAt >= 0 && lines.length > 1) {
    const m = twoStage(lines[0], lines[1])
    if (m) {
      lines = [m, ...lines.slice(2)]
      warnings.push('2 段の見出しを 1 段にまとめて読みました')
    }
  }
  if (headerAt >= 0) {
    // ページごとに繰り返した同じ見出しの行は外す（部品にしない）。2 ページ目以降の見出しで列の並びが違えば、
    // そのページの行を最初の見出しの並びに並べ直す（No の列が増えた・数量と単位が入れ替わった など）
    const baseFields = lines[0].map(headerField)
    const norm = (c: string) => toHalf(c).replace(/[\s　]+/g, '').toLowerCase()
    const baseText = lines[0].map(norm)
    // 数量の列に数のある行は部品の行（見出しの繰り返しではない）
    // 最初の見出しと同じ文字のセルが 1 つも無い行（「型式表示板 / 部品名札 / メーカ銘板」のような部品）も見出しの繰り返しにしない
    // 見出しの言い方を変えたページ（品名・形式・員数）も、どのセルも見出しの語そのものなら繰り返し
    const PLAIN = /^(no\.?|番号|部品名|部品名称|品名|品目名|名称|品目|部品|必要数量|使用数量|手配数量|手配数|所要数|所要量|型式|形式|型番|品番|形番|形名|型名|型式名|部品番号|メーカ|メーカー|メーカ名|メーカー名|製造元|製造者|数量|員数|個数|台数|必要数|使用数|単位|備考|摘要|回路記号|記号|図番|description|part(no|number|name)?|p\/n|mpn|manufacturer|mfr|qty|quantity|unit|remarks?|notes?|ref(des)?)$/i
    const plain = (c: string) => PLAIN.test(norm(c).replace(/[（(][^）)]*[）)]/g, ''))
    const isRepeat = (l: string[]) => sameHeader(l) && (l.some((c) => norm(c) !== '' && baseText.includes(norm(c))) || l.filter((c) => c.trim()).every(plain)) && !l.some((c, j) => baseFields[j] === 'qtyNeeded' && /^\s*\d[\d.,]*\s*$/.test(toHalf(c)))
    // ページの見出しの列を、最初の見出しの列に対応させる。同じ文字の見出し → 同じ項目の何番目か の順。
    // 同じ項目の列が複数あれば、版の印（旧／新）の合う列を先に（最初の見出しに印が無ければ新 → 印なし → 旧）。
    // ページの見出しに無い項目の列は空にする（メーカの無いページ・回路記号が 1 ページ目だけ）
    const verRank = (b: 'old' | 'new' | null, h: 'old' | 'new' | null) => (b === h ? 0 : b === null ? (h === 'new' ? 1 : 2) : h === null ? 1 : 3)
    const permOf = (h: string[]): number[] | null => {
      const f = h.map(headerField)
      const ht = h.map(norm)
      const used = new Set<number>()
      const pm = baseText.map((t) => {
        if (!t) return -2
        const k = ht.findIndex((x, kk) => x === t && !used.has(kk))
        if (k < 0) return -2
        used.add(k)
        return k
      })
      for (let j = 0; j < pm.length; j++) {
        if (pm[j] !== -2) continue
        const bf = baseFields[j]
        if (!bf) {
          pm[j] = -3
          continue
        }
        const bv = headerVersion(lines[0][j] ?? '')
        const cand = f.map((x, kk) => (x === bf && !used.has(kk) ? kk : -1)).filter((kk) => kk >= 0).sort((a, b) => verRank(bv, headerVersion(h[a] ?? '')) - verRank(bv, headerVersion(h[b] ?? '')) || a - b)
        if (!cand.length) {
          pm[j] = -1
          continue
        }
        used.add(cand[0])
        pm[j] = cand[0]
      }
      return pm.every((k, j) => k === j || k === -3) ? null : pm
    }
    const out: string[][] = [lines[0]]
    let perm: number[] | null = null
    let removed = 0
    let reordered = 0
    // 設計変更の様式の上の段（変更前｜変更後・旧｜新・部品名・ページ番号だけの行で、次の行が見出しの繰り返し）は外し、
    // 上の段にだけある項目（部品名）は下の段に入れて対応させる
    const mark0 = (c: string) => c.trim() !== '' && headerVersion(c) !== null && detectField(c) === null
    const upperLike = (l: string[]) => !!upperRow && l.some(mark0) && l.filter((c) => c.trim()).every((c) => mark0(c) || PAGE_NO.test(toHalf(c).trim()) || plain(c))
    let pendingUp: string[] | null = null
    for (let i = 1; i < lines.length; i++) {
      let l = lines[i]
      if (upperLike(l) && i + 1 < lines.length && isRepeat(lines[i + 1])) {
        removed++
        pendingUp = l
        continue
      }
      if (pendingUp) {
        const up = pendingUp
        l = l.map((c, j) => (!c.trim() && plain(up[j] ?? '') && !mark0(up[j] ?? '') ? up[j] : c))
        pendingUp = null
      }
      if (isRepeat(l)) {
        removed++
        // ページごとの 2 段の見出しは、下の段も見出しとして外す
        const m = twoStage(l, lines[i + 1])
        if (m) {
          removed++
          i++
        }
        perm = permOf(m ?? l)
        continue
      }
      if (perm) reordered++
      out.push(perm ? perm.map((k, j) => (k >= 0 ? (l[k] ?? '') : k === -3 ? (l[j] ?? '') : '')) : l)
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

  // 数量の列が無く、号機ごとの列（1号機・A号機・#1・予備）と合計の列だけある 1 段の見出しは、それらを数量の列にする
  if (hasHeader && !mapping.includes('qtyNeeded')) {
    const mach = (c: string) => /^(旧|新|現|現行|変更前|変更後)?\s*(#\s*\d+|no\.\s*\d+|\d+\s*号機?用?|[a-z]\s*号機?用?|号機\s*\d+|\d+\s*台目|予備)(\s*[（(](旧|新|現|現行|変更前|変更後)[）)])?$/i.test(toHalf(c).trim())
    if (first.filter(mach).length >= 1) mapping = mapping.map((f, j) => (!f && (mach(first[j] ?? '') || /^(合計|計|総数|小計)$/.test(toHalf(first[j] ?? '').trim())) ? 'qtyNeeded' : f))
  }
  if (hasHeader && !mapping.includes('name') && !mapping.includes('model')) warnings.push('見出しに「部品名」「型式」に当たる列がありません')
  // 数量の列が無いと全部 1 になる。黙らない
  if (hasHeader && !mapping.includes('qtyNeeded')) warnings.push('見出しに「数量」に当たる列が見つからないので、数量は全部 1 にしました（見出しを「数量」にして貼り直すか、作成後に直してください）')
  // 小計・合計の行は部品ではない
  // 部品名・型式に部品らしい値がある行は、備考などが「以上」「計」でも合計の行にしない
  const partCols = mapping.map((f, j) => (f === 'name' || f === 'model' ? j : -1)).filter((j) => j >= 0)
  const looksPart = (l: string[]) => partCols.some((j) => (l[j] ?? '').trim() !== '' && !isTotalCell(l[j] ?? ''))
  const isTotal = (l: string[]) => (l.some(isTotalCell) && !looksPart(l)) || isSectionLine(l, Math.max(l.length, mapping.length))
  const totalLines = lines.slice(hasHeader ? 1 : 0).filter(isTotal)
  const totals = totalLines.length
  // 外した行の中身も例に出す（「＊予備ヒューズ」のような部品を外していないか確かめられるように）
  const ex = totalLines.slice(0, 2).map((l) => l.map((c) => c.trim()).filter(Boolean).join(' ').slice(0, 20))
  if (totals) warnings.push(`小計・合計・区切りの ${totals} 行は取り込みません（例: 「${ex.join('」「')}」${totals > 2 ? ' ほか' : ''}）`)
  // 使う列がすべて空の行（使わない列にだけあるページ番号・表題など）は部品にしない
  const mappedEmpty = (l: string[]) => mapping.every((f, j) => !f || (l[j] ?? '').trim() === '')
  const blanks = lines.slice(hasHeader ? 1 : 0).filter((l) => !isTotal(l) && mappedEmpty(l)).length
  if (blanks) warnings.push(`部品の列がすべて空の ${blanks} 行（ページ番号・表題など）は取り込みません`)
  let body = (hasHeader ? lines.slice(1) : lines).filter((l) => !isTotal(l) && !mappedEmpty(l))
  // EDA の BOM の実装しない部品（DNP・Not Fitted・未実装）は取り込まない（列の値、またはそう書いたセル）
  const dnpCol = hasHeader ? first.findIndex((c) => /^(dnp|do\s*not\s*(place|populate|fit)|fitted|populated?|実装|未実装|非実装|実装有無)$/i.test(toHalf(c).trim())) : -1
  const dnpHeader = dnpCol >= 0 && /dnp|do\s*not|未実装|非実装/i.test(toHalf(first[dnpCol]))
  const dnpRow = (l: string[]) =>
    (dnpCol >= 0 && (dnpHeader ? /^(x|1|yes|y|true|dnp|○|●|✓|未実装|しない)$/i : /^(no|n|0|false|not\s*fitted|nf|dnp|未実装|なし|無し?|しない|非|×|不要|未)$/i).test(toHalf(l[dnpCol] ?? '').trim())) ||
    // そう書いたセル（メーカの列の「DNP」＝大日本印刷 は除く）
    l.some((c, j) => mapping[j] !== 'maker' && (/^(not\s*fitted|do\s*not\s*(place|fit|populate)|未実装|非実装|実装しない|実装無し|実装なし|実装せず|実装不要)/i.test(toHalf(c).trim()) || (/^dnp([\s（(【\[].*)?$/i.test(toHalf(c).trim()) && j !== dnpCol)))
  const dnp = body.filter(dnpRow).length
  if (dnp) {
    body = body.filter((l) => !dnpRow(l))
    warnings.push(`実装しない部品（DNP・Not Fitted・未実装）の ${dnp} 行は取り込みません`)
  }
  // 変更区分の列（追加・変更・削除）: 「削除」の行は取り込まない。「区分」の見出しでも中身がそれだけなら分類にしない
  const KIND_DEL = /^(削除|廃止|撤去|取消|取り消し|欠番|del|delete)$/i
  const kindVal = (v: string) => toHalf(v).replace(/[\s（）()【】\[\]]/g, '')
  const kindCol = !hasHeader
    ? -1
    : first.findIndex((c, j) => {
        const h = toHalf(c).replace(/[\s　]+/g, '')
        if (/^(変更区分|変更種別|変更種類|区分\(変更\)|変更)$/.test(h) && !mapping[j]) return true
        if (!/^(区分|種別|処置|処置区分)$/.test(h)) return false
        const vals = body.map((l) => kindVal(l[j] ?? '')).filter(Boolean)
        return vals.length > 0 && vals.every((v) => /^(追加|変更|削除|新規|廃止|流用|撤去|取消|継続|同上|〃|-|－)$/.test(v)) && vals.some((v) => /^(追加|変更|削除|廃止|新規)$/.test(v))
      })
  if (kindCol >= 0) {
    mapping[kindCol] = null
    const gone = body.filter((l) => KIND_DEL.test(kindVal(l[kindCol] ?? '')))
    if (gone.length) {
      body = body.filter((l) => !gone.includes(l))
      warnings.unshift(`「${first[kindCol]}」が削除の ${gone.length} 行（例: ${gone[0].map((c) => c.trim()).filter(Boolean).slice(0, 3).join(' ')}）は、削除された部品として取り込みません`)
    }
  }
  // 見出しが「Item」「No」でも中身が番号だけの列は部品名にしない（行番号の列）
  mapping = mapping.map((f, j) => (f === 'name' && body.length > 0 && body.every((l) => /^\s*\d+\s*$/.test(l[j] ?? '')) ? null : f))
  // 同じ項目に当たる列が 2 つあれば、左の列を使う（番号だけの列を外したあとで判定する）
  // 見出しに「新」「変更後」「new」とある列があればそれを（現型式／新型式）、無ければ左の列を使う
  // 項目ごとに（型式も数量も）。新しい版の印の列 → 印の無い列 → 前の版の列 の順で、同じなら左
  const used = mapping.filter(Boolean)
  // 新しい版の列が空の行は、ほかの版の列の値を使う（変えた行だけ「変更後」を書く BOM）
  const fallback = new Map<BomField, { keep: number; others: number[] }>()
  // 製作台数の語と数（表題欄・見出しの行の右）
  const UNITS_LABEL = /^(製作台数|製造台数|生産台数|台数|製作数|製作数量|製造数量|生産数量)[:：]?$/
  const unitsVal = (c: string) => {
    const m = /^(\d+)\s*台?\s*([（(].*)?$/.exec(toHalf(c ?? '').trim())
    return m ? Number(m[1]) : null
  }
  // 見出しの行の右の「製作台数｜3」（中身の無い列）は見出しでなく製作台数
  let headerUnits: number | null = null
  if (hasHeader)
    first.forEach((c, j) => {
      if (headerUnits != null || !UNITS_LABEL.test(toHalf(c).trim()) || unitsVal(first[j + 1] ?? '') == null) return
      if (!body.every((l) => !(l[j] ?? '').trim() && !(l[j + 1] ?? '').trim())) return
      headerUnits = unitsVal(first[j + 1])
      mapping[j] = null
      mapping[j + 1] = null
    })
  // 数量の列の組み合わせ: 足す・掛ける・合計（空なら号機を足す）・表題欄の製作台数を掛ける
  let qtyCombine: { mode: 'sum' | 'product' | 'totalOrSum' | 'scale'; cols: number[]; total?: number; factor?: number } | null = null
  for (const dup of [...new Set(used.filter((f, i) => used.indexOf(f) !== i))] as BomField[]) {
    const cols = mapping.map((f, j) => (f === dup ? j : -1)).filter((j) => j >= 0)
    const rank = (j: number) => {
      const v = hasHeader ? headerVersion(first[j] ?? '') : null
      return v === 'new' ? 0 : v === null ? 1 : 2
    }
    // Rev が書いてあれば新しい Rev を先に
    const rev = (j: number) => (hasHeader ? (headerRev(first[j] ?? '') ?? -1) : -1)
    // 号機ごとの数量と「合計」の列があれば合計を（必要数・手配数・発注数・所要数も合計の数）
    const total = (j: number) => (hasHeader && TOTALISH.test(toHalf(first[j] ?? '')) ? 0 : 1)
    const machineHead0 = (j: number) => /(#\s*\d+|^no\.\s*\d+$|\d+\s*号機?|号機\s*\d+|\d+\s*台目|予備)/i.test(toHalf(first[j] ?? ''))
    // 部品名は Description・品名を Value・Comment より先に（Altium の Comment は値）
    const vc = (j: number) => (dup === 'name' && hasHeader && /^(value|comment)$/i.test((first[j] ?? '').trim()) ? 1 : 0)
    const order = [...cols].sort((a, b) => rev(b) - rev(a) || rank(a) - rank(b) || total(a) - total(b) || vc(a) - vc(b) || a - b)
    const keep = order[0]
    if ((rank(keep) === 0 || rev(keep) >= 0) && !(dup === 'qtyNeeded' && hasHeader && cols.every(machineHead0))) fallback.set(dup, { keep, others: order.slice(1) })
    // 数量の列が複数（版の印なし）: 合計の列 → 「n 台分」のいちばん多い列 → 号機ごと（予備も）なら足す → 1 台当り×台数 なら掛ける
    let pick = keep
    // （旧／新の印が付いていても、号機ごとの列だけなら新の号機を足す）
    const machineHead = (j: number) => /(#\s*\d+|^no\.\s*\d+$|\d+\s*号機?|号機\s*\d+|\d+\s*台目|予備)/i.test(toHalf(first[j] ?? ''))
    if (dup === 'qtyNeeded' && hasHeader && cols.every((j) => rev(j) < 0) && (cols.every((j) => rank(j) === 1) || cols.every(machineHead))) {
      const h = (j: number) => toHalf(first[j] ?? '')
      const nUnits = (j: number) => Number(/(\d+)\s*台分/.exec(h(j))?.[1] ?? 0)
      const machine = (j: number) => !TOTALISH.test(h(j)) && /(#\s*\d+|^no\.\s*\d+$|\d+\s*号機?|号機\s*\d+|(^|[^a-z])[a-z]\s*号機?|\d+\s*台目|予備)/i.test(h(j))
      const perUnit = (j: number) => /台当|台あたり|\/\s*台|1\s*台分|員数|per\s*unit/i.test(h(j))
      const units = (j: number) => /台数|製作数/.test(h(j)) && !perUnit(j)
      // 台数の列があるときは、ただの「数量」「員数」も 1 台分
      const perUnit2 = (j: number) => perUnit(j) || (cols.some(units) && /^(数量|員数|個数)$/.test(h(j).trim()))
      // 必要数・合計を、手配数・発注数（丸めた数）より先に
      const ordering = (j: number) => /手配数|発注数/.test(h(j))
      const totals0 = cols.filter((j) => TOTALISH.test(h(j)))
      const totals = totals0.some((j) => !ordering(j)) ? totals0.filter((j) => !ordering(j)) : totals0
      // 旧／新 × 号機 は新の号機だけを足す
      const verOf = (j: number) => (/^(新|変更後|new)/i.test(h(j).trim()) ? 'new' : /^(旧|現|現行|変更前|old)/i.test(h(j).trim()) ? 'old' : headerVersion(h(j)))
      const machines0 = cols.filter(machine)
      const machines = machines0.some((j) => verOf(j) === 'new') ? machines0.filter((j) => verOf(j) === 'new') : machines0
      if (totals.length) {
        pick = totals[totals.length - 1]
        // 合計のセルが空の行は号機を足す
        if (machines.length >= 1) qtyCombine = { mode: 'totalOrSum', cols: machines, total: pick }
      }
      else if (cols.some((j) => nUnits(j) > 1)) pick = [...cols].sort((a, b) => nUnits(b) - nUnits(a))[0]
      else if (machines.length >= 2) qtyCombine = { mode: 'sum', cols: machines }
      else if (cols.some(perUnit2) && cols.some(units)) qtyCombine = { mode: 'product', cols: [cols.find(perUnit2)!, cols.find(units)!] }
    }
    const keep2 = pick
    mapping = mapping.map((f, j) => (f === dup && j !== keep2 ? null : f))
    // 部品名に使わなかった Comment の列は備考に（備考の列が無ければ）
    if (dup === 'name' && hasHeader && !mapping.includes('note')) {
      const c = cols.find((j) => j !== keep2 && /^comments?$/i.test((first[j] ?? '').trim()))
      if (c != null) mapping[c] = 'note'
    }
    // 部品名の列が空の行は、使わなかった Value・Comment の値を部品名に（Altium で Description が空の行）
    if (dup === 'name' && hasHeader) {
      const alt = cols.find((j) => j !== keep2 && /^(value|comments?)$/i.test((first[j] ?? '').trim()))
      if (alt != null)
        body = body.map((l) => {
          if ((l[keep2] ?? '').trim() || !(l[alt] ?? '').trim()) return l
          const c2 = [...l]
          c2[keep2] = l[alt]
          if (mapping[alt] === 'note') c2[alt] = ''
          return c2
        })
    }
    if (dup === 'qtyNeeded' && qtyCombine && qtyCombine.mode !== 'totalOrSum') warnings.unshift(`数量の列 ${cols.length} つ（${cols.map((j) => `「${first[j]}」`).join('')}）を${qtyCombine.mode === 'sum' ? '足して' : '掛けて'}数量にしました`)
    else if (dup === 'qtyNeeded' && qtyCombine) warnings.push(`数量は「${first[keep2]}」の列を使います（空の行は号機の数を足します）`)
    else warnings.push(`「${FIELD_LABEL[dup]}」に当たる列が ${cols.length} つあります。「${(hasHeader ? first[keep2] : '') || '左の列'}」の列を使います`)
  }
  // 表題欄の「製作台数 3台」と、1 台当りの数量の列（1台当り数量・1台当数量・員数/台・員数）だけの表は、台数を掛ける
  {
    const qc = mapping.indexOf('qtyNeeded')
    if (hasHeader && qc >= 0 && !qtyCombine && /台当|台あたり|\/\s*台|1\s*台分|員数/.test(toHalf(first[qc] ?? ''))) {
      let units: number | null = headerUnits
      titleRows.forEach((l, k) =>
        l.forEach((c, j) => {
          const t = toHalf(c).trim()
          // 右のセル、または下の行の同じ列（縦の表題欄「盤名｜製作台数 / 制御盤A｜3」）
          if (units == null && UNITS_LABEL.test(t)) units = unitsVal(l[j + 1] ?? '') ?? unitsVal(titleRows[k + 1]?.[j] ?? '')
          const m = /^(製作台数|製造台数|生産台数|台数|製作数|製作数量|製造数量|生産数量)[:：]?\s*(\d+)\s*台?\s*([（(].*)?$/.exec(t)
          if (units == null && m) units = Number(m[2])
        }),
      )
      if (units && units > 1) {
        qtyCombine = { mode: 'scale', cols: [qc], factor: units }
        warnings.unshift(`数量の列「${first[qc]}」は 1 台分なので、${headerUnits ? '見出しの右' : '表題'}の製作台数 ${units} 台を掛けました`)
      }
    }
  }
  // 変更図で、新しい版の列がどれも空で前の版の列だけに値がある行は「削除」の部品。
  // 備考に「削除・廃止」とある行と、追加の行（前の版が空で新しい版に値）がある表のそういう行は取り込まない
  const noteCol = mapping.indexOf('note')
  // 「〃」「同上」は、その列の上の行の値にする（旧の列・号機ごとの数量の列も。新しい版の列は下で「上の行と同じ変更」として扱う）
  const DITTO0 = /^(〃+|″+|”+|＂+|"+|''|同上|々|上に同じ|上と同じ|上記に同じ|上記と同じ|仝|ditto)$/i
  const keepCols = new Set([...fallback.values()].map((fb) => fb.keep))
  let colDitto = 0
  body = body.map((l) => [...l])
  // 新しい版の列の〃: 上の行が削除の印なら削除、上の行が書き写し（新＝旧）ならこの行も旧を書き写す
  const oldOf = new Map([...fallback.values()].map((fb) => [fb.keep, fb.others] as const))
  for (let i = 1; i < body.length; i++)
    for (const [j, others] of oldOf) {
      if (!DITTO0.test((body[i][j] ?? '').replace(/[\s　。.]/g, ''))) continue
      const up = (body[i - 1][j] ?? '').trim()
      const upOld = others.map((k) => (body[i - 1][k] ?? '').trim()).find(Boolean)
      if (/^(削除|廃止|撤去|取外し|欠番|取止め|中止|del|delete[d]?|remove[d]?|0+)$/i.test(toHalf(up).replace(/[\s（）()]/g, ''))) {
        body[i][j] = up
        colDitto++
      } else if (up && upOld && up === upOld) {
        body[i][j] = others.map((k) => (body[i][k] ?? '').trim()).find(Boolean) ?? up
        colDitto++
      }
    }
  for (let i = 1; i < body.length; i++)
    for (let j = 0; j < body[i].length; j++) {
      if (keepCols.has(j) || !DITTO0.test((body[i][j] ?? '').replace(/[\s　。.]/g, ''))) continue
      const above = (body[i - 1][j] ?? '').trim()
      if (above) {
        body[i][j] = above
        colDitto++
      }
    }
  // 新しい版の列の「－」「同左」「変更なし」は「変えていない」（空と同じ）。「〃」「同上」は上の行と同じ（下で上の行の値にする）
  const SAME = /^(－|-|ー|―|同左|変更なし|変更無し|同じ|同)$/
  // 削除の印（新の列）: 削除・廃止・撤去・取外し・不要・不使用・なし・×（括弧・記号つきも）。新の数量の 0 も
  const DEL0 = /^(削除|削除済み?|削除品|廃止|廃止品|撤去|取外し|取り外し|不要|不使用|なし|無し|欠番|取止め|取り止め|取りやめ|中止|×|✕|del|delete[d]?|remove[d]?)$/i
  const DEL = { test: (v: string) => DEL0.test(v.replace(/[\s　（）()【】\[\]ー－\-―※*＊.]/g, '')) || delWord(v, true) }
  const fbe = [...fallback.entries()]
  const cell = (l: string[], j: number) => (l[j] ?? '').trim()
  const empty = (l: string[], j: number) => cell(l, j) === ''
  const blank = (l: string[], j: number) => empty(l, j) || SAME.test(cell(l, j))
  const isDel = (l: string[], f: BomField, j: number) => DEL.test(cell(l, j)) || (f === 'qtyNeeded' && /^0+(\.0+)?\s*(個|台|本|枚|pcs|コ)?$/i.test(toHalf(cell(l, j))))
  const hasOld = (l: string[]) => fbe.some(([, fb]) => fb.others.some((k) => !blank(l, k)))
  // 新の列に削除の印がある行（ほかの新の列は空・変えていない印・削除の印だけ。新の型式があって新のメーカが「なし」の行は消さない）
  // （新の数量の 0 で、新の型式が旧と同じ・空の行も削除）
  const delRow = (l: string[]) => fbe.some(([f, fb]) => isDel(l, f, fb.keep)) && fbe.every(([f, fb]) => blank(l, fb.keep) || isDel(l, f, fb.keep) || fb.others.some((k) => cell(l, k) === cell(l, fb.keep)))
  // 新の列がどれも空・変えていない印
  const newBlank = (l: string[]) => fbe.every(([, fb]) => blank(l, fb.keep))
  const newEmpty = (l: string[]) => fbe.every(([, fb]) => empty(l, fb.keep))
  // 変えていない行も新の列に書き写す表か: 書き写した行（新と旧がどの項目も同じ）が 2 行以上で、新の列が空の行より多いか同じ
  const copyRow = (l: string[]) => fbe.every(([, fb]) => !blank(l, fb.keep) && fb.others.some((k) => cell(l, k) === cell(l, fb.keep)))
  const copies = body.filter((l) => hasOld(l) && copyRow(l)).length
  const empties = body.filter((l) => hasOld(l) && newEmpty(l)).length
  // 新旧のある項目が 1 つだけ（型式だけ）の表は、数量だけ変えた行にも新の型式を書くことがあるので、書き写した行がはっきり多いときだけ
  const complete = fbe.length > 0 && (fbe.length >= 2 ? copies >= 2 && copies > empties : copies >= 3 && copies >= empties * 2)
  // 書き写す表では、新の列が空か「－」だけの行も削除（変えていない行は書き写してあるので）
  const dashOnly = (l: string[]) => fbe.every(([, fb]) => empty(l, fb.keep) || /^[－\-ー―]+$/.test(cell(l, fb.keep)))
  // 備考の削除の印: 備考の頭が削除・廃止・撤去・取外し（「削除（Rev.1）」「削除のこと」「削除→不要」も）。
  // 「撤去後に再取付」「削除しない」「削除予定なし」、英語の「Remove film …」は除く
  // 「削除します」「要削除」「Rev.1 削除」「不要」「撤去済」は削除。「削除不要」「削除取消」「廃止取りやめ」「削除無」「廃止品から変更済」は残す
  const noteDel = (v0: string) => delWord(v0)
  const isDeleted = (l: string[]) => fbe.length > 0 && hasOld(l) && (delRow(l) || (noteCol >= 0 && noteDel(cell(l, noteCol)) && (newBlank(l) || copyRow(l))) || (complete && dashOnly(l)))
  const deletedSet = new Set(body.filter(isDeleted))
  // 書き写した行と新の列が空の行が同じ数の表は、書き写す表か変えた行だけ書く表か分からない。
  // 新の列が空の行は残して備考に【削除？】と付け、設計に決めてもらう（エラーで公開を止める）
  const unsure = new Set(fbe.length >= 2 && !complete && copies >= 2 && copies === empties ? body.filter((l) => hasOld(l) && newEmpty(l) && !deletedSet.has(l)) : [])
  if (unsure.size) warnings.unshift(`新の列が空の ${unsure.size} 行（例: ${[...unsure][0].map((c) => c.trim()).filter(Boolean).slice(0, 3).join(' ')}）は、変えていない部品か削除した部品か分かりません。備考に【削除？】と付けて取り込みました（削除なら行を消し、要るなら【削除？】を消してください）`)
  if (deletedSet.size) {
    const ex = [...deletedSet][0].map((c) => c.trim()).filter(Boolean).slice(0, 3).join(' ')
    warnings.unshift(`削除の印がある・新しい版の列が空の ${deletedSet.size} 行（例: ${ex}）は、削除された部品として取り込みません（要るときは新しい版の列に値を入れて貼り直してください）`)
  }
  let badQty = 0
  let summed = 0
  let badUnit = 0
  const fellBack = new Map<BomField, number>()
  // 「〃」「同上」は上の行の値、「同左」は左のセルの値にする
  const DITTO = /^(〃+|″+|”+|＂+|"+|''|同上|同左|同|々|上に同じ|上と同じ|上記に同じ|上記と同じ|左に同じ|左と同じ|仝|ditto)$/i
  const dittoOf = (v: string) => DITTO.test(v.replace(/[\s　。.]/g, ''))
  const prevVal = new Map<BomField, string>()
  const prevNew = new Map<BomField, string>()
  let ditto = 0
  const arrows: string[] = []
  const rows = body.map((line) => {
    const cells = split(line)
    const r: Partial<Row> = { qtyNeeded: 1, unit: '個' }
    const seen = new Set<BomField>()
    mapping.forEach((f, j) => {
      if (!f || seen.has(f)) return
      seen.add(f)
      let v = (cells[j] ?? '').trim()
      const fb = fallback.get(f)
      if (fb && (SAME.test(v) || DEL.test(v) || (f === 'qtyNeeded' && j === fb.keep && /^0+(\.0+)?$/.test(v) && deletedSet.has(line)))) v = ''
      if (f === 'qtyNeeded' && qtyCombine) {
        const nums = qtyCombine.cols.map((k) => qtyOf((cells[k] ?? '').trim())).flatMap((n) => (n != null ? [n] : []))
        const tot = qtyCombine.total != null ? qtyOf((cells[qtyCombine.total] ?? '').trim()) : null
        if (qtyCombine.mode === 'totalOrSum') {
          if (tot != null) v = String(tot)
          else if (nums.length) v = String(nums.reduce((a, b) => a + b, 0))
        } else if (qtyCombine.mode === 'scale') {
          if (nums.length) v = String(nums[0] * (qtyCombine.factor ?? 1))
        } else if (nums.length) v = String(qtyCombine.mode === 'sum' ? nums.reduce((a, b) => a + b, 0) : nums.reduce((a, b) => a * b, 1))
      }
      if (!v && fb) {
        const k = fb.others.find((x) => (cells[x] ?? '').trim() !== '')
        if (k != null) {
          v = (cells[k] ?? '').trim()
          if (!deletedSet.has(line)) fellBack.set(f, (fellBack.get(f) ?? 0) + 1)
        }
      }
      // 新の列の〃・同上は「上の行と同じ変更」: 上の行の新の列が空・変えていない印（または上の行が無い）なら、この行も変えていない
      if (fb && dittoOf(v) && j === fb.keep) {
        const up = prevNew.get(f)
        v = up ? up : ''
        if (!v) {
          const k = fb.others.find((x) => (cells[x] ?? '').trim() !== '')
          if (k != null) v = (cells[k] ?? '').trim()
        }
        ditto++
      } else if (dittoOf(v)) {
        // 同左は、左の列が同じ項目（旧の列）のときだけ左の値。ほかは上の行と同じ
        v = /同左|左に同じ/.test(v) && j > 0 && detected[j - 1] === f ? (cells[j - 1] ?? '').trim() : (prevVal.get(f) ?? '')
        ditto++
      }
      // 1 つのセルに「旧→新」（MY2N→MY4N-D2・1→2）と書いたら新を使う
      if ((f === 'model' || f === 'maker' || f === 'qtyNeeded') && /^[^→⇒]+\s*(→|⇒|->|＞|>)\s*[^→⇒]+$/.test(v) && !/^[<>]/.test(v)) {
        const nv = v.split(/\s*(?:→|⇒|->|＞|>)\s*/).pop()!.trim()
        if (nv) {
          arrows.push(v)
          v = nv
        }
      }
      prevVal.set(f, v)
      if (fb) {
        const raw = (cells[fb.keep] ?? '').trim()
        prevNew.set(f, !raw || SAME.test(raw) ? '' : dittoOf(raw) ? (prevNew.get(f) ?? '') : raw)
      }
      if (f === 'qtyNeeded') {
        // 「2+1」「2(予備1)」は足した数（知らせる）
        const sum = /[+＋]|予備/.test(v) ? qtyOf(v) : null
        if (sum != null) {
          v = String(sum)
          summed++
        }
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
    if (unsure.has(line)) r.note = `【削除？】${r.note ?? ''}`
    return r
  }).filter((_, i) => !deletedSet.has(body[i]))
  ditto += colDitto
  if (arrows.length) warnings.unshift(`1 つのセルに「旧→新」と書いた ${arrows.length} セル（例: 「${arrows[0]}」）は、→ の右（新）の値にしました`)
  if (ditto) warnings.unshift(`「〃」「同上」「同左」の ${ditto} セルは、上の行（同左は左のセル）の値にしました`)
  for (const [f, n] of fellBack) warnings.unshift(`「${first[fallback.get(f)!.keep] ?? FIELD_LABEL[f]}」が空の ${n} 行は、ほかの「${FIELD_LABEL[f]}」の列の値を使いました`)
  if (summed) warnings.push(`「2+1」「2(予備1)」のように書いた数量 ${summed} 個は、足した数にしました`)
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
    let hiddenNames: string[] = []
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
      hiddenNames = [...hiddenCols].map((c) => (headerCells.get(c) ?? '').trim()).filter(Boolean)
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
        // 横の結合（見出しの「型式」を 2 列に）は左上だけ。縦に結合したデータ（分類・メーカを何行かまとめた）は各行に同じ値
        // 縦横に結合した範囲（2 行にまたがる表題・区切り）は、各行の左の列だけに値
        const slave = cell.isMerged && cell.master && cell.master.address !== cell.address && (cell.master.row === cell.row || cell.master.col !== cell.col)
        const v = slave ? '' : cellToText(raw[c]).replace(/[\t\n\r]/g, ' ')
        // 「"」を含むセル（〃の代わりの "）は引用符で囲む（囲まないと後ろの行が 1 つのセルにつながる）
        vals.push(v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v)
      }
      lines.push(vals.join('\t'))
    })
    // 見出しは上から 30 行まで探す（貼り付けの見出し探しと同じ。表題欄が長いシート）
    const score = lines.slice(0, 30).reduce((m, l) => Math.max(m, l.split('\t').map(detectField).filter(Boolean).length), 0)
    return { name: ws.name, text: lines.join('\n'), score, rows: lines.length, hiddenRows, hiddenCols: hiddenCols.size, hiddenNames, unhidden }
  })
  if (!sheets.length) return ''
  // 見出しの言葉が同じだけあるシートが複数なら、名前が「旧版・old・コピー」などでないシート → 左（先）のシート
  const stale = (n: string) => /旧|old|bak|backup|履歴|コピー|copy|削除|廃止|参考/i.test(n)
  const rank = (x: (typeof sheets)[number]) => x.score * 2 - (stale(x.name) ? 1 : 0)
  const best = sheets.reduce((a, b) => (rank(b) > rank(a) ? b : a))
  lastSheetName = sheets.length > 1 ? best.name : null
  hiddenNote = [
    best.hiddenCols || best.hiddenRows ? `Excel で隠した${best.hiddenCols ? `列 ${best.hiddenCols} 列${best.hiddenNames.length ? `（「${best.hiddenNames.slice(0, 3).join('」「')}」${best.hiddenNames.length > 3 ? ' ほか' : ''}）` : ''}` : ''}${best.hiddenCols && best.hiddenRows ? '・' : ''}${best.hiddenRows ? `行 ${best.hiddenRows} 行` : ''}は読んでいません（要るときは Excel で再表示してから読んでください）` : '',
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
  if (/^以上[、,]?[\d,.]*(点|個|行|件|品目|品|種)?$/.test(t)) return true
  if (/^[（(](小計|合計|総計|計)[）)]$/.test(t)) return true
  // 「計：6個」「合計 6点」「合計数量 6」「合計金額 ¥12,000」「部品点数 3」のように、同じセルに数・単位が続くものも
  // 「合計 6台分」「合計：6個 / ¥12,000」（数・単位・金額がいくつ続いても）
  // 入れ子の繰り返しの正規表現は長い数字で極端に遅くなるので、見出しの語を外した残りを文字の種類だけで見る
  if (t.length > 60) return false
  const m = /^(員数|数量|部品|金額)?(小計|合計|総計|総合計|総数量|総数|計|部品点数|点数|total|subtotal|grandtotal)(金額|数量|点数|合計|額|数|amount|qty)?[:：]?/i.exec(t)
  if (!m) return false
  const rest = t.slice(m[0].length).replace(/[（(][^）)]*[）)]/g, '').replace(/個|点|台|本|枚|式|円|pcs|ヶ|ケ|コ|品目|品|種|行|件|分/gi, '')
  return /^[\d,.¥￥$/／、]*$/.test(rest) && (rest === '' || /\d/.test(rest))
}
/**
 * 区切り・分類の見出しの行（「■ 制御部」「【電源】」「<端子部>」「1. 制御部」だけが入った行）。部品ではない。
 * width は表の列の数（xlsx は行の右の空のセルが無いので、セルの数では見ない）。1 列だけの表では使わない
 */
const PAGE_TITLE = /^(部品構成表|構成表|部品明細表|部品表|部品リスト|部品一覧|購入品リスト|購入品表|材料表|parts\s*list|bill\s*of\s*materials|BOM)\s*([(（]?\s*\d+\s*([/／]|of)\s*\d+\s*[)）]?|\d+\s*(ページ|頁)|p\.?\s*\d+(\s*[/／]\s*\d+)?|page\s*\d+(\s*(of|\/)\s*\d+)?|その\s*\d+|[(（]?\s*(続き|続|つづき)\s*[)）]?)?$/i
const PAGE_NO = /^([(（]?\s*\d+\s*[/／]\s*\d+\s*[)）]?\s*(ページ|頁)?|(ページ|頁)\s*\d+(\s*[/／]\s*\d+)?|第?\s*\d+\s*(ページ|頁)目?|sheet\s*\d+(\s*(of|\/)\s*\d+)?|p\.?\s*\d+(\s*[/／]\s*\d+)?|\d+\s*(ページ|頁)|page\s*\d+(\s*(of|\/)\s*\d+)?)$/i
export function isSectionLine(cells: string[], width = cells.length): boolean {
  // 全角の数字・記号は半角にしてから見る（「－２－」）
  const filled = cells.map((c) => toHalf(c).trim()).filter(Boolean)
  // ページの表題とページ番号だけの行（「部品表 (2/3)」と「P.2」）
  if (width > 1 && filled.length === 2 && filled.every((c) => PAGE_TITLE.test(c) || PAGE_NO.test(c))) return true
  // 表題・製品名・ページ番号の行（「部品表 (2/2)」「制御盤A」「P.2」）
  if (width > 1 && filled.length === 3 && filled.some((c) => PAGE_TITLE.test(c)) && filled.some((c) => PAGE_NO.test(c))) return true
  // 単位だけの行（見出しの下の「(個)」「(円)」）
  if (filled.length >= 1 && filled.every((c) => /^[（(][^）)]{1,6}[）)]$/.test(c))) return true
  // 署名欄（作成｜山田｜承認｜鈴木）
  const SIGN = /^(作成|承認|検図|検印|設計|確認|担当|審査|照査|作図|製図|日付|発行|査閲|承認者|作成者|確認者)(者|日)?[:：]?$/
  if (filled.length >= 2 && filled.filter((_, i) => i % 2 === 0).every((c) => SIGN.test(c))) return true
  return (
    width > 1 &&
    filled.length === 1 &&
    (/^[■□◆◇●○▼▽▲△★☆【［]/.test(filled[0]) ||
      /^([<＜〈《][^>＞〉》]+[>＞〉》]|\d+[.．、]\s*[^\d\s].*)$/.test(filled[0]) ||
      // ページごとの表題・ページ番号（部品表 (2/3)・P.2・2 / 3 ページ）
      PAGE_TITLE.test(filled[0]) ||
      PAGE_NO.test(filled[0]) ||
      // 製品名つきのページの表題（「制御盤A 部品表 2/2」「制御盤A 部品表（続き）」）
      /(部品構成表|構成表|部品明細表|部品表|部品リスト|部品一覧|購入品リスト|購入品表|材料表|bom|parts\s*list).*(\d+\s*([/／]|of)\s*\d+|続き|その\s*\d+|page\s*\d+|p\.\s*\d+)/i.test(filled[0]) ||
      // 「- 1 -」「Page 1 of 2」「（次頁へ続く）」「※ 注記」
      /^[-－—]\s*\d+\s*[-－—]$/.test(filled[0]) ||
      /^page\s*\d+\s*(of|\/)\s*\d+$/i.test(filled[0]) ||
      /(次頁|次ページ|前頁|前ページ|次葉).*(続|へ|つづ)|以下次(頁|葉|ページ)|^[（(]?\s*(続く|つづく|続き)\s*[）)]?$/.test(filled[0]) ||
      /^[※＊*]\s*\S/.test(filled[0]))
  )
}

/** 数量のセル: 数、「2+1」（足す）、「2(予備1)」（予備も足す）。読めなければ null */
function qtyOf(v0: string): number | null {
  const v = toHalf(v0).replace(/\s/g, '').replace(/＋/g, '+')
  if (/^\d+(\.\d+)?$/.test(v)) return Number(v)
  if (/^\d+(\.\d+)?(\+\d+(\.\d+)?)+$/.test(v)) return v.split('+').reduce((a, b) => a + Number(b), 0)
  const m = /^(\d+(?:\.\d+)?)[（(]予備(\d+(?:\.\d+)?)[）)]$/.exec(v)
  if (m) return Number(m[1]) + Number(m[2])
  const n = parseNumber(v0, { min: 0, max: 1e9 })
  return n.ok && n.value != null ? n.value : null
}

/** 削除の印の文（備考・新の列）: 頭が削除・廃止・撤去・取外し（済・します・しました・してください・のこと・（R012に置換） も）、
 *  「要削除」「Rev.1 削除」「不要」「欠番」「取止め」「中止」「Del」、文の終わりの「不要のため削除」「Rev.2で削除」「設計変更により削除」。
 *  あとに 不要・取消・取りやめ・中止・しない・なし・無・から・後・予定・保留・見送り・NG（「は」「も」をはさんでも）が続くものは残す。
 *  strict（新の列の値＝部品名・型式）は、語そのもの（＋済・します など）だけ。「取外し工具」「撤去用ブラケット」は部品 */
function delWord(v0: string, strict = false): boolean {
  let v = toHalf(v0).trim().replace(/^[\s　※*＊（(【\[「]+/, '').replace(/^rev\.?\s*[a-z0-9]+\s*/i, '').replace(/^(今回の変更で|今回|本変更で|要)/, '')
  v = v.replace(/^[\s　]+/, '').replace(/[\s　。.!！]+$/, '')
  if (/^(不要|不使用|欠番|取止め|取り止め|取りやめ|中止|del|delete[d]?|remove[d]?)$/i.test(v)) return true
  // 削除のあとに続いてよい語（済・します・しました・してください・のこと・（R012に置換）・→不要）
  const DONE = /^(済み?|します|しました|した|する|すること|して(ください|下さい)?|のこと|とする|とします|願います|をお願いします|予定です)?([\s　]*([（(【\[].*|→.*))?$/
  if (!strict) {
    // 文の終わりの削除（「不要のため削除」「Rev.2で削除」「B版にて削除」「設計変更により削除」）
    const tail = /^(.*?)(削除|廃止|撤去|取外し|取り外し)(済み?|します|しました|した|する|すること|のこと)?$/.exec(v)
    if (tail && tail[1] && /(ため|で|にて|により|につき|に伴い|による|に伴う|、|,|版|\s)$/.test(tail[1])) return true
  }
  const m = /^(削除|廃止|撤去|取外し|取り外し)/.exec(v)
  if (!m) return false
  const rest = v.slice(m[0].length)
  if (strict) return DONE.test(rest) || /^品$/.test(rest)
  if (/^(品)?[はもを]?(不要|取消|取り消|取りやめ|取止め|取り止め|中止|しない|せず|なし|無し|無|予定|対象外|不可|後|から|品から|保留|見送|ng|せん|できない|禁止|検討|再)/i.test(rest)) return false
  // 「撤去品を流用」「廃止品の在庫」のように、品のあとに文が続くものは部品の説明
  if (/^品./.test(rest)) return false
  if (/^し/.test(rest) || /^せ/.test(rest)) return DONE.test(rest)
  return true
}
