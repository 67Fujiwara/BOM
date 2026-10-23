import ExcelJS from 'exceljs'
const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(process.argv[2])
for (const n of ['変更点', 'チェック結果']) { const sh = wb.getWorksheet(n); const rows = []; sh.eachRow((r, i) => { if (i <= 3 || /決定|指摘/.test(JSON.stringify(r.values))) rows.push(JSON.stringify(r.values.slice(1)).slice(0, 220)) }); console.log(n, sh.rowCount, '\n ', rows.slice(0, 8).join('\n  ')) }
