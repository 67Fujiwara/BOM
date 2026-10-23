import type { Project, Row, Rule } from './types'
import { effective, setKnownSuppliers } from './derive'

export interface Problem {
  rowId: string
  field: keyof Row
  ruleId: string
  severity: 'error' | 'warn'
  message: string
  /** 直し方の候補 */
  fixes: Array<{ label: string; apply: (r: Row) => Partial<Row> }>
}

const FULLWIDTH = /[Ａ-Ｚａ-ｚ０-９－．／（）]/

export function toHalfWidth(s: string): string {
  return s
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/－/g, '-')
    .replace(/．/g, '.')
    .replace(/／/g, '/')
    .replace(/（/g, '(')
    .replace(/）/g, ')')
    .replace(/　/g, ' ')
}

/** 1行に対してルールを評価する。working（作業中）の値を優先 */
/** 商社マスタ（指定先が実在するかを見るため。ストアが読み込み・変更のたびに渡す） */
let supplierMaster: Array<{ id: string; name: string }> = []
export function setSupplierMaster(list: Array<{ id: string; name: string }>) {
  supplierMaster = list
  setKnownSuppliers(list)
}

/** 重複・代替可否の突き合わせを行ごとに全行走査すると行数の 2 乗になるので、行の並び（配列）ごとに索引を作って持つ */
const dupCache = new WeakMap<Row[], Map<string, Map<string, Row[]>>>()
function dupCounted(r: Row): boolean {
  return r.status !== 'cancelled' && r.status !== 'replaced' && !r.removal && !r.pendingRemoval
}
function rowsByValue(rows: Row[], field: string): Map<string, Row[]> {
  let byField = dupCache.get(rows)
  if (!byField) dupCache.set(rows, (byField = new Map()))
  let idx = byField.get(field)
  if (!idx) {
    idx = new Map()
    for (const r of rows) {
      if (field !== '#model' && !dupCounted(r)) continue
      const v = String(effective(r)[(field === '#model' ? 'model' : field) as keyof ReturnType<typeof effective>] ?? '')
      if (!v) continue
      const list = idx.get(v)
      if (list) list.push(r)
      else idx.set(v, [r])
    }
    byField.set(field, idx)
  }
  return idx
}

/** 正規表現のルールは一度だけ組み立てて持つ。読めない・極端に遅い（入れ子の繰り返しなど）ものは null（判定で飛ばす） */
const regexCache = new Map<string, RegExp | null>()
export function safeRegex(src: string): RegExp | null {
  if (regexCache.has(src)) return regexCache.get(src)!
  let re: RegExp | null = null
  try {
    re = new RegExp(src)
    // 型番によくある形の長い文字で試し、遅いものは使わない（1 キーごとに全行で判定するので）
    const t = performance.now()
    for (const probe of ['a'.repeat(28) + '!', '0'.repeat(28) + '!', 'A-'.repeat(14) + '!', 'aA0-'.repeat(8) + '#']) re.test(probe)
    if (performance.now() - t > 20) re = null
  } catch {
    re = null
  }
  regexCache.set(src, re)
  return re
}
/** 実際の値で遅かったルールも、それ以降は飛ばす（1 回で 30ms 超、または 20 回以上の平均が 1ms 超。全行で判定するので 1 行あたりの重さが効く） */
const regexCost = new Map<string, { n: number; ms: number }>()
function timedTest(re: RegExp, src: string, s: string): boolean {
  const t = performance.now()
  const ok = re.test(s)
  const dt = performance.now() - t
  const c = regexCost.get(src) ?? { n: 0, ms: 0 }
  c.n++
  c.ms += dt
  regexCost.set(src, c)
  if (dt > 30 || (c.n >= 20 && c.ms / c.n > 1)) regexCache.set(src, null)
  return ok
}

export function checkRow(row: Row, rules: Rule[], project: Project): Problem[] {
  const out: Problem[] = []
  if (row.status === 'cancelled' || row.status === 'replaced') return out
  const e = effective(row)
  for (const rule of rules) {
    if (!rule.enabled) continue
    if (rule.scope !== 'all' && rule.scope !== project.id) continue
    if (row.ackRules.includes(rule.id) && rule.severity === 'warn') continue
    const v = (e as unknown as Record<string, unknown>)[rule.field]
    const str = v == null ? '' : String(v)
    const field = rule.field
    let severity = rule.severity
    // メーカ指定＝任意 の行はメーカ必須を警告に落とす
    if (rule.type === 'required' && field === 'maker' && e.makerLock === '任意') severity = 'warn'
    if (row.ackRules.includes(rule.id) && severity === 'warn') continue
    const push = (fixes: Problem['fixes']) => out.push({ rowId: row.id, field, ruleId: rule.id, severity, message: rule.message, fixes })
    switch (rule.type) {
      case 'designated':
        if ((e.procurement === '指定商社' || e.procurement === '客先指定品') && str.trim() === '') push([])
        // 指定商社の指定先は商社マスタから（§3.1）。誤記のまま別の商社に依頼しない
        else if (e.procurement === '指定商社' && supplierMaster.length && !supplierMaster.some((x) => x.id === str.trim() || x.name === str.trim())) {
          const near = supplierMaster.find((x) => x.name.startsWith(str.trim().slice(0, 2)))
          out.push({ rowId: row.id, field, ruleId: rule.id, severity: 'error', message: `指定先「${str}」は商社マスタにありません（${supplierMaster.map((x) => x.name).join(' / ')}）`, fixes: near ? [{ label: `「${near.name}」にする`, apply: () => ({ designated: near.id }) }] : [] })
        }
        break
      case 'required':
        if (str.trim() === '') {
          const fixes: Problem['fixes'] = []
          if (field === 'maker') {
            const same = project.rows.find((r) => r.id !== row.id && effective(r).model === e.model && effective(r).maker)
            if (same) fixes.push({ label: `同じ型式の行から「${effective(same).maker}」を入れる`, apply: () => ({ maker: effective(same).maker }) })
          }
          push(fixes)
        }
        break
      case 'positive':
        if (!(Number(v) > 0)) push([{ label: '1 にする', apply: () => ({ [field]: 1 }) as Partial<Row> }])
        break
      case 'noWhitespace':
        if (str !== str.trim() || /\s{2,}/.test(str)) push([{ label: '前後の空白を削除', apply: () => ({ [field]: str.trim().replace(/\s{2,}/g, ' ') }) as Partial<Row> }])
        break
      case 'noFullWidth':
        if (FULLWIDTH.test(str)) push([{ label: '半角に変換', apply: () => ({ [field]: toHalfWidth(str) }) as Partial<Row> }])
        break
      case 'regex':
        // 書き方の誤ったルール（正規表現として読めない）は、画面を止めずに飛ばす
        try {
          const when = rule.when ? safeRegex(rule.when) : null
          const re = rule.pattern ? safeRegex(rule.pattern) : null
          if (re && str && (!rule.maker || rule.maker === e.maker) && (!rule.when || (when && timedTest(when, rule.when, str)))) {
            if (!timedTest(re, rule.pattern!, str)) push([])
          }
        } catch {
          /* 読めないルールは無視 */
        }
        break
      case 'duplicate':
        // 取消・置換の作業中の行と、置換の元と先（同じ部品位置を引き継ぐ）どうしは重複に数えない
        if (str && !row.removal && !row.pendingRemoval && (rowsByValue(project.rows, field).get(str) ?? []).some((r) => r.id !== row.id && r.replaces !== row.id && row.replaces !== r.id)) push([])
        break
      case 'packMultiple':
        // 単位が「パック」なら数量はパック数。個数で数える単位で入数があるときだけ倍数を確かめる
        if (e.unit !== 'パック' && e.packQty && e.packQty > 1 && e.qtyNeeded % e.packQty !== 0) {
          const up = Math.ceil(e.qtyNeeded / e.packQty) * e.packQty
          const packs = Math.ceil(e.qtyNeeded / e.packQty)
          push([
            { label: `入数の倍数 ${up} ${e.unit}にする`, apply: () => ({ qtyNeeded: up }) },
            { label: `単位をパックにして ${packs} パックにする`, apply: () => ({ unit: 'パック', qtyNeeded: packs }) as Partial<Row> },
          ])
        }
        break
      case 'altConsistent': {
        const other = e.model ? rowsByValue(project.rows, '#model').get(String(e.model))?.find((r) => r.id !== row.id && effective(r).altPolicy !== e.altPolicy) : undefined
        if (e.model && other) push([{ label: `${other.id} と同じ「${effective(other).altPolicy}」にする`, apply: () => ({ altPolicy: effective(other).altPolicy }) }])
        break
      }
    }
  }
  // Excel のエラー値（#REF! など）がそのまま入っている項目は、公開前に直す
  for (const f of ['name', 'model', 'maker', 'ref', 'note'] as const) {
    const v = String(e[f] ?? '')
    if (/^#(REF!|DIV\/0!|N\/A|VALUE!|NAME\?|NUM!|NULL!|SPILL!|CALC!|エラー|数式の結果なし)/i.test(v.trim())) out.push({ rowId: row.id, field: f, ruleId: 'sys.excel.error', severity: 'error', message: v.startsWith('#数式') ? '数式の計算結果が入っていないセルでした（元のファイルを Excel で開いて保存し直してから読むか、正しい値を入れてください）' : `Excel のエラー値「${v}」のままです（元の表で直してから貼り直すか、正しい値を入れてください）`, fixes: [] })
  }
  // §3.1: メーカ指定＝任意 と 代替可否＝不可 は矛盾（メーカは自由なのに代替を認めない）。ルールの登録に関係なく常に見る
  const MAKER_ALT = 'sys.makerlock.alt'
  if (e.makerLock === '任意' && e.altPolicy === '不可' && !row.ackRules.includes(MAKER_ALT))
    out.push({ rowId: row.id, field: 'altPolicy', ruleId: MAKER_ALT, severity: 'warn', message: 'メーカ指定＝任意 と 代替可否＝不可 は矛盾しています', fixes: [{ label: '代替可否を「同等品可」にする', apply: () => ({ altPolicy: '同等品可' }) }, { label: 'メーカ指定を「推奨」にする', apply: () => ({ makerLock: '推奨' }) }] })
  return out
}

export function checkProject(project: Project, rules: Rule[]): Problem[] {
  return project.rows.flatMap((r) => checkRow(r, rules, project))
}
