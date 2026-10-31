import { parse } from 'csv-parse/sync';
import ExcelJS from 'exceljs';
import { AppError } from '../middleware/errorHandler';

/** One non-empty data row, keyed by lower-cased header, with its 1-based row number in the file. */
export interface SheetRow {
  rowNumber: number;
  values: Record<string, string>;
}

/**
 * Parses an uploaded .csv or .xlsx file into header-keyed rows.
 *
 * - The first non-empty row is the header; headers are trimmed and lower-cased.
 * - Fully empty rows are skipped (spreadsheets often have trailing blanks).
 * - Only the first worksheet of an .xlsx file is read.
 * - Cell values are returned as display text, so numbers/dates/formulas arrive as strings.
 */
export async function parseSpreadsheet(buffer: Buffer, filename: string): Promise<SheetRow[]> {
  const ext = filename.toLowerCase().split('.').pop();
  let grid: { rowNumber: number; cells: string[] }[];
  if (ext === 'csv') grid = parseCsv(buffer);
  else if (ext === 'xlsx') grid = await parseXlsx(buffer);
  else throw new AppError(400, 'UNSUPPORTED_FILE', 'Only .csv and .xlsx files are supported.');

  const nonEmpty = grid.filter((r) => r.cells.some((c) => c.trim() !== ''));
  if (nonEmpty.length === 0) throw new AppError(400, 'EMPTY_FILE', 'The file has no rows.');

  const [header, ...rows] = nonEmpty;
  const keys = header.cells.map((h) => h.trim().toLowerCase());
  return rows.map(({ rowNumber, cells }) => ({
    rowNumber,
    values: Object.fromEntries(
      keys.flatMap((k, i) => (k ? [[k, (cells[i] ?? '').trim()]] : [])),
    ),
  }));
}

function parseCsv(buffer: Buffer) {
  let records: string[][];
  try {
    records = parse(buffer, { bom: true, relax_column_count: true, skip_empty_lines: false });
  } catch (err) {
    throw new AppError(400, 'INVALID_FILE', `Could not parse CSV: ${(err as Error).message}`);
  }
  // csv-parse yields one record per logical row; quoted multi-line cells make this differ
  // from the physical line number, so report the record's position instead.
  return records.map((cells, i) => ({ rowNumber: i + 1, cells }));
}

async function parseXlsx(buffer: Buffer) {
  const workbook = new ExcelJS.Workbook();
  try {
    // exceljs's types predate Node's generic Buffer<T>; the runtime value is fine.
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  } catch {
    throw new AppError(400, 'INVALID_FILE', 'Could not read the .xlsx file. Is it a valid Excel workbook?');
  }
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new AppError(400, 'EMPTY_FILE', 'The workbook has no worksheets.');

  const grid: { rowNumber: number; cells: string[] }[] = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    const cells: string[] = [];
    for (let i = 1; i <= row.cellCount; i++) cells.push(row.getCell(i).text ?? '');
    grid.push({ rowNumber, cells });
  });
  return grid;
}
