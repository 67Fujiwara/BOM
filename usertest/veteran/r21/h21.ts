// 共通: 現行 / r20b の paste.ts を SRC で読む。乱数と表の描画。
const SRC = process.env.SRC ?? '/home/user/BOM/src'
export const P = await import(SRC + '/io/paste.ts')
export const { parseBomPaste, parseTable } = P
export function rng(seed: number) {
  let s = seed >>> 0
  const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0), s / 4294967296)
  return { rnd, pick: <T,>(a: T[]): T => a[Math.floor(rnd() * a.length)], chance: (p: number) => rnd() < p, int: (n: number) => Math.floor(rnd() * n) }
}
/** RFC 風（Excel の書き出し）: コンマ・引用符・改行を含むセルだけ囲む。中の「"」は二重 */
export function renderCsv(rows: string[][], d: string, opt: { quoteAll?: boolean; crlf?: boolean } = {}) {
  const q = (c: string) => (opt.quoteAll || c.includes(d) || c.includes('"') || c.includes('\n') ? '"' + c.replace(/"/g, '""') + '"' : c)
  return rows.map((r) => r.map(q).join(d)).join(opt.crlf ? '\r\n' : '\n') + (opt.crlf ? '\r\n' : '\n')
}
/** parseTable の期待値: セル内の改行は空白 */
export const norm = (rows: string[][]) => rows.map((r) => r.map((c) => c.replace(/\r\n?|\n/g, ' ')))
export const same = (a: string[][], b: string[][]) => JSON.stringify(a) === JSON.stringify(b)
