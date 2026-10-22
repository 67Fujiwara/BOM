import { addDays, todayStr } from './dates'

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string }

/** 全角英数・記号を半角に */
export function toHalf(s: string): string {
  return s
    .replace(/[０-９Ａ-Ｚａ-ｚ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[－−ー―]/g, (c, i, str) => (/\d/.test(str[i + 1] ?? '') || i === 0 ? '-' : c))
    .replace(/[．。]/g, '.')
    .replace(/[，、]/g, ',')
    .replace(/／/g, '/')
    .replace(/　/g, ' ')
}

const KANJI_DIGIT: Record<string, number> = { 〇: 0, 零: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 }
const KANJI_UNIT: Record<string, number> = { 十: 10, 百: 100, 千: 1000 }

function kanjiNumber(s: string): number | null {
  if (!/^[〇零一二三四五六七八九十百千]+$/.test(s)) return null
  let total = 0
  let cur = 0
  for (const ch of s) {
    if (ch in KANJI_DIGIT) cur = cur * 10 + KANJI_DIGIT[ch]
    else {
      total += (cur || 1) * KANJI_UNIT[ch]
      cur = 0
    }
  }
  return total + cur
}

/** 数値の解釈。「１,２００円」「10個」「1.2万」「十」「¥1200」を受け付ける */
export function parseNumber(raw: string, opts: { min?: number; max?: number; integer?: boolean; label?: string } = {}): Parsed<number | null> {
  let s = toHalf(raw).trim()
  if (s === '') return { ok: true, value: null }
  s = s.replace(/^[¥￥$]/, '').replace(/,/g, '').replace(/\s/g, '')
  s = s.replace(/(円|個|本|枚|台|式|セット|set|pcs|pc|ヶ|ケ|コ|つ|パック|箱|m|ｍ)$/i, '')
  let mult = 1
  const unit = /(万|千|億)$/.exec(s)
  if (unit) {
    mult = unit[1] === '万' ? 1e4 : unit[1] === '千' ? 1e3 : 1e8
    s = s.slice(0, -1)
  }
  let n = s === '' && unit ? 1 : Number(s)
  if (!Number.isFinite(n) || s.includes('e') || s.includes('E')) {
    const k = kanjiNumber(s)
    if (k == null) return { ok: false, error: `${opts.label ?? '数値'}として読めません: 「${raw}」` }
    n = k
  }
  n = n * mult
  if (opts.integer && !Number.isInteger(n)) return { ok: false, error: `${opts.label ?? '数値'}は整数で入れてください: 「${raw}」` }
  if (opts.min != null && n < opts.min) return { ok: false, error: `${opts.label ?? '数値'}は ${opts.min} 以上にしてください: 「${raw}」` }
  if (opts.max != null && n > opts.max) return { ok: false, error: `${opts.label ?? '数値'}が大きすぎます（上限 ${opts.max.toLocaleString()}）: 「${raw}」` }
  return { ok: true, value: n }
}

function validYmd(y: number, m: number, d: number): boolean {
  const dt = new Date(y, m - 1, d)
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d
}

/** 日付の解釈。YYYY-MM-DD / YYYY/M/D / M/D / YYYYMMDD / 今日・明日・昨日 / 未定（null） */
export function parseDate(raw: string, opts: { label?: string; allowUndecided?: boolean } = {}): Parsed<string | null> {
  const s = toHalf(raw).trim()
  const label = opts.label ?? '日付'
  if (s === '' || s === '未定' || s === '-') return opts.allowUndecided === false && s !== '' ? { ok: false, error: `${label}を入れてください` } : { ok: true, value: null }
  const rel: Record<string, number> = { 今日: 0, 本日: 0, 明日: 1, あした: 1, 昨日: -1, きのう: -1, 明後日: 2 }
  if (s in rel) return { ok: true, value: addDays(todayStr(), rel[s]) }
  const plus = /^\+(\d+)(日|d)?$/.exec(s)
  if (plus) return { ok: true, value: addDays(todayStr(), Number(plus[1])) }
  let y: number, m: number, d: number
  let mm: RegExpExecArray | null
  if ((mm = /^(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})日?$/.exec(s))) [y, m, d] = [Number(mm[1]), Number(mm[2]), Number(mm[3])]
  else if ((mm = /^(\d{4})(\d{2})(\d{2})$/.exec(s))) [y, m, d] = [Number(mm[1]), Number(mm[2]), Number(mm[3])]
  else if ((mm = /^(\d{1,2})[-/.月](\d{1,2})日?$/.exec(s))) {
    const t = todayStr()
    y = Number(t.slice(0, 4))
    m = Number(mm[1])
    d = Number(mm[2])
    // 今日より 60 日以上前なら来年とみなす
    const cand = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    if (cand < addDays(t, -60)) y++
  } else return { ok: false, error: `${label}として読めません: 「${raw}」（例: 2026-11-30、11/30、未定）` }
  if (!validYmd(y, m, d)) return { ok: false, error: `存在しない${label}です: 「${raw}」` }
  if (y < 2000 || y > 2100) return { ok: false, error: `${label}の年が範囲外です: 「${raw}」` }
  return { ok: true, value: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` }
}
