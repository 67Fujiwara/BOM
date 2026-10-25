// ラウンド16: 取り込みの 1 セルの判定（区切り・ページの表題・合計）を長いセルで時間を測る（node で直接。式は src/io/paste.ts から写し）
const re1 = /(部品構成表|構成表|部品明細表|部品表|部品リスト|部品一覧|購入品リスト|購入品表|材料表|bom|parts\s*list).*(\d+\s*([/／]|of)\s*\d+|続き|その\s*\d+|page\s*\d+|p\.\s*\d+)/i
const re2 = /^([<＜〈《][^>＞〉》]+[>＞〉》]|\d+[.．、]\s*[^\d\s].*)$/
const re3 = /(次頁|次ページ|前頁|前ページ|次葉).*(続|へ|つづ)|以下次(頁|葉|ページ)|^[（(]?\s*(続く|つづく|続き)\s*[）)]?$/
for (const n of [1000, 5000, 20000]) {
  for (const [name, re, s] of [['bom+digits', re1, '部品表' + '1 '.repeat(n)], ['bom+spaces-digits', re1, 'BOM' + ' 1'.repeat(n) + 'x'], ['<..', re2, '<' + 'a'.repeat(n)], ['次頁', re3, '次頁' + 'x'.repeat(n)]]) {
    const t0 = performance.now(); re.test(s); console.log(n, name, Math.round(performance.now() - t0) + 'ms')
  }
}
