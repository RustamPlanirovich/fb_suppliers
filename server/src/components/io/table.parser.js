import { parse } from 'csv-parse/sync';
import ExcelJS from 'exceljs';
import { ValidationError } from '../../utils/errors.js';

// Чтение загруженного файла в плоскую таблицу: [заголовки, строки].
export class TableParser {
  async parse(buffer, filename) {
    if (/\.csv$/i.test(filename)) return this.#fromCsv(buffer);
    if (/\.xlsx?$/i.test(filename)) return this.#fromExcel(buffer);
    throw new ValidationError('Поддерживаются только файлы .csv, .xls и .xlsx');
  }

  #fromCsv(buffer) {
    const records = parse(buffer, { bom: true, skip_empty_lines: true, relax_column_count: true });
    if (!records.length) throw new ValidationError('Файл пуст');
    const [headers, ...rows] = records;
    return { headers: headers.map((cell) => String(cell).trim()), rows };
  }

  async #fromExcel(buffer) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const sheet = workbook.worksheets[0];
    if (!sheet) throw new ValidationError('В книге нет листов');
    const rows = [];
    sheet.eachRow((row) => {
      rows.push(row.values.slice(1).map((cell) => this.#cellText(cell)));
    });
    if (!rows.length) throw new ValidationError('Файл пуст');
    const [headers, ...body] = rows;
    return { headers: headers.map((cell) => String(cell ?? '').trim()), rows: body };
  }

  #cellText(cell) {
    if (cell == null) return '';
    if (typeof cell === 'object') return String(cell.text ?? cell.result ?? cell.hyperlink ?? '');
    return String(cell);
  }
}
