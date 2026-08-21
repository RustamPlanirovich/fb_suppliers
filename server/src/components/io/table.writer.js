import { stringify } from 'csv-stringify/sync';
import ExcelJS from 'exceljs';

// Выгрузка выборки в CSV или XLSX.
export class TableWriter {
  csv(headers, rows) {
    return Buffer.from(stringify([headers, ...rows], { bom: true }), 'utf8');
  }

  async xlsx(headers, rows, sheetName = 'export') {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(sheetName);
    sheet.addRow(headers);
    sheet.getRow(1).font = { bold: true };
    for (const row of rows) sheet.addRow(row);
    sheet.columns.forEach((column) => { column.width = 22; });
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }
}
