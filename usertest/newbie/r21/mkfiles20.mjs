// ラウンド20: 新人の手元の BOM その 8（ラウンド19 の直しの周り）→ files20/
import ExcelJS from '/home/user/BOM/node_modules/exceljs/excel.js'
import fs from 'node:fs'
const D = '/home/user/BOM/usertest/newbie/r21/files20/'
fs.mkdirSync(D, { recursive: true })
async function book(name, build, sheet = '部品表') { const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet(sheet); build(ws, wb); await wb.xlsx.writeFile(D + name) }
// g1: 設計変更通知（結合した表題、変更前｜変更後、縦に結合した変更区分、署名欄）
await book('g1_ecn_kind_merged.xlsx', (ws) => {
  ws.addRow(['設計変更通知書', '', '', '', '', ''])
  ws.mergeCells('A1:F1')
  ws.addRow(['ECN-2026-014', '', '', '', '', ''])
  ws.addRow(['変更区分', '品名', '変更前', '', '変更後', ''])
  ws.addRow(['', '', '型式', '数量', '型式', '数量'])
  ws.mergeCells('C3:D3'); ws.mergeCells('E3:F3'); ws.mergeCells('A3:A4'); ws.mergeCells('B3:B4')
  ws.addRow(['変更', 'リレー', 'MY2N', 4, 'MY4N-D2', 4])
  ws.addRow(['削除', 'タイマ', 'H3CR-A8', 1, '', ''])
  ws.addRow(['', 'ソケット', 'PYF14A', 2, '', ''])
  ws.mergeCells('A6:A7')
  ws.addRow(['追加', 'ランプ', '', '', 'L-1', 2])
  ws.addRow(['', '端子台', 'XW2B-20G4', 4, '', ''])
  ws.addRow([])
  ws.addRow(['作成', '山田', '承認', '鈴木', '', ''])
})
// g2: 製作台数が結合したセル＋縦の表題欄の 2 種類
await book('g2_daisu_merged.xlsx', (ws) => {
  ws.addRow(['盤名', '制御盤A', '', '製作台数', '', '台'])
  ws.addRow(['', '', '', 3, '', ''])
  ws.mergeCells('D1:E1'); ws.mergeCells('D2:E2')
  ws.addRow([])
  ws.addRow(['品名', '型式', 'メーカー', '員数'])
  ws.addRow(['リレー', 'MY4N-D2', 'オムロン', 2])
  ws.addRow(['タイマ', 'H3CR-A8', 'オムロン', 1])
})
await book('g2b_daisu_label_value_cells.xlsx', (ws) => {
  ws.addRow(['部品表'])
  ws.addRow(['製作台数', 3, '台', '', ''])
  ws.addRow(['品名', '型式', 'メーカー', '員数', '備考'])
  ws.addRow(['リレー', 'MY4N-D2', 'オムロン', 2, ''])
  ws.addRow(['タイマ', 'H3CR-A8', 'オムロン', 1, ''])
  ws.addRow(['合計', '', '', 3, ''])
})
// g3: 号機別数量（上の段を結合）＋合計＋備考。縦に結合した品名・型式
await book('g3_goukibetsu_total.xlsx', (ws) => {
  ws.addRow(['品名', '型式', 'メーカー', '号機別数量', '', '', '合計', '備考'])
  ws.addRow(['', '', '', '1', '2', '3', '', ''])
  ws.mergeCells('A1:A2'); ws.mergeCells('B1:B2'); ws.mergeCells('C1:C2'); ws.mergeCells('D1:F1'); ws.mergeCells('G1:G2'); ws.mergeCells('H1:H2')
  ws.addRow(['リレー', 'MY4N-D2', 'オムロン', 2, 2, 2, 6, ''])
  ws.addRow(['タイマ', 'H3CR-A8', 'オムロン', 1, 1, 1, 3, '予備なし'])
  ws.addRow(['ランプ', 'L-1', 'IDEC', 1, 1, null, null, '3号機なし'])
})
// g4: 半角カナの見出し＋半角カナの値＋合計＋別のシート
await book('g4_halfkana_total_sheets.xlsx', (ws, wb) => {
  ws.addRow(['ﾌﾞﾋﾝﾋｮｳ'])
  ws.addRow(['ﾋﾝﾒｲ', 'ｶﾀｼｷ', 'ﾒｰｶｰ', 'ｽｳﾘｮｳ', 'ﾋﾞｺｳ'])
  ws.addRow(['ﾘﾚｰ', 'MY4N-D2', 'ｵﾑﾛﾝ', 4, ''])
  ws.addRow(['ﾀｲﾏ', 'H3CR-A8', 'ｵﾑﾛﾝ', 1, 'ｻｸｼﾞｮ'])
  ws.addRow(['ｺﾞｳｹｲ', '', '', 5, ''])
  const h = wb.addWorksheet('改訂履歴')
  h.addRow(['Rev', '日付', '内容']); h.addRow(['A', '2026-10-01', '初版'])
})
// g5: 複数シート（表紙・部品表・変更履歴）。部品表は旧／新、変更履歴は削除の文
await book('g5_multi_sheet_cover.xlsx', (ws, wb) => {
  ws.addRow(['品名', '型式（旧）', '型式（新）', '数量', '備考'])
  ws.addRow(['リレー', 'MY2N', 'MY4N-D2', 4, ''])
  ws.addRow(['タイマ', 'H3CR-A8', '', 1, '削除済'])
  ws.addRow(['ランプ', 'L-1', '', 2, ''])
  const c = wb.addWorksheet('変更履歴'); c.addRow(['日付', '変更内容', '品名', '型式']); c.addRow(['2026-10-02', '削除', 'ヒューズ', 'F-1'])
  const cover = wb.addWorksheet('表紙'); cover.addRow(['制御盤A 部品表']); cover.addRow(['作成', '山田', '承認', '鈴木'])
  wb.worksheets.unshift(wb.worksheets.pop())
}, '部品表')
// g6: ケーブルを含む普通の BOM（型式に → ・ > ・ -> を含む）
await book('g6_cables_with_arrows.xlsx', (ws) => {
  ws.addRow(['品名', '型式', 'メーカー', '数量', '備考'])
  ws.addRow(['変換ケーブル', 'USB-A→USB-C 変換ケーブル', 'エレコム', 2, ''])
  ws.addRow(['RS232C変換', 'RS232C->USB変換', 'サンワ', 1, ''])
  ws.addRow(['リレー', 'MY4N-D2', 'オムロン', 4, ''])
  ws.addRow(['ケーブル', 'UL1007 AWG22 (赤→黒)', 'フジクラ', 10, 'm'])
})
// g7: Altium の BOM（Comment｜Description｜Designator｜Footprint｜LibRef｜Quantity）
await book('g7_altium.xlsx', (ws) => {
  ws.addRow(['Comment', 'Description', 'Designator', 'Footprint', 'LibRef', 'Quantity'])
  ws.addRow(['10k', 'Chip Resistor', 'R1, R2', 'R0603', 'RES', 2])
  ws.addRow(['LED_Red', '', 'D1', 'LED0603', 'LED', 1])
  ws.addRow(['LM358', 'Dual Op Amp', 'U1', 'SOIC8', 'LM358', 1])
})
// g8: 変更図で 変更内容｜備考 の 2 列（備考に削除、変更内容に理由）
await book('g8_change_reason_note.xlsx', (ws) => {
  ws.addRow(['品名', '型式（旧）', '型式（新）', '数量', '変更内容', '備考'])
  ws.addRow(['リレー', 'MY2N', 'MY4N-D2', 4, '廃番のため型式変更', ''])
  ws.addRow(['タイマ', 'H3CR-A8', '', 1, '', '削除'])
  ws.addRow(['ランプ', 'L-1', '', 2, '', ''])
})
// g9: 隠し列（旧型式）と非表示行、変更区分の列
await book('g9_hidden_and_kind.xlsx', (ws) => {
  ws.addRow(['変更区分', '品名', '型式', '数量', 'メモ'])
  ws.addRow(['変更', 'リレー', 'MY4N-D2', 4, ''])
  ws.addRow(['削除', 'タイマ', 'H3CR-A8', 1, ''])
  ws.addRow(['追加', 'ランプ', 'L-1', 2, ''])
  ws.getColumn(5).hidden = true
})
// g10: 台数の語がいくつもある普通の BOM（員数と台数別）
await book('g10_ordinary_daisu_words.xlsx', (ws) => {
  ws.addRow(['第3製造部 制御盤 部品表 (2台目分)'])
  ws.addRow(['品名', '型式', 'メーカー', '員数', '備考'])
  ws.addRow(['リレー', 'MY4N-D2', 'オムロン', 2, '台数多め'])
  ws.addRow(['タイマ', 'H3CR-A8', 'オムロン', 1, ''])
})
console.log(fs.readdirSync(D).join(' '))
