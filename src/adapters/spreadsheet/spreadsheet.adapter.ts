import ExcelJS from 'exceljs';

import {
  sanitizeAccountNumber,
  sanitizeBankCode,
  sanitizeBranchCode,
} from './banking-field.sanitizer.js';
import type { PaymentBatchRowDto } from './payment-batch-row.dto.js';
import type { PaymentProcessingOutputRow } from './payment-processing-output-row.js';
import {
  PROCESSING_SHEET_HEADERS,
  PROCESSING_SHEET_NAME,
} from './processing-sheet.constants.js';
import { setCellAsCurrency, setCellAsText } from './spreadsheet-cell-formatter.js';

const PAYMENT_BATCH_SHEET_NAME = 'Lote de Pagamentos';

const COLUMN_HEADERS = {
  id: 'id',
  orderDate: 'data de pedido',
  beneficiary: 'beneficiário',
  taxId: 'cpf/cnpj',
  bank: 'banco',
  branch: 'agência',
  account: 'conta',
  accountType: 'tipo',
  amount: 'valor (r$)',
} as const;

type ColumnKey = keyof typeof COLUMN_HEADERS;

interface ColumnMapping {
  id: number;
  orderDate: number;
  beneficiary: number;
  taxId: number;
  bank: number;
  branch: number;
  account: number;
  accountType: number;
  amount: number;
}

interface RawRowValues {
  id: unknown;
  orderDate: unknown;
  beneficiary: unknown;
  taxId: unknown;
  bank: unknown;
  branch: unknown;
  account: unknown;
  accountType: unknown;
  amount: unknown;
  accountDisplayText?: string;
}

function normalizeHeader(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase();
}

function getCellText(cell: ExcelJS.Cell): string | undefined {
  const text = cell.text?.trim();
  return text || undefined;
}

function getCellValue(cell: ExcelJS.Cell): unknown {
  const value = cell.value;

  if (value && typeof value === 'object' && 'result' in value) {
    return value.result ?? value;
  }

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return value;
}

function parseAmount(value: unknown): number {
  if (typeof value === 'number') {
    return value;
  }

  const normalized = String(value ?? '')
    .replace(/[R$\s]/g, '')
    .replace(/\./g, '')
    .replace(',', '.');

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isRowEmpty(values: RawRowValues): boolean {
  const fields = [
    values.id,
    values.beneficiary,
    values.taxId,
    values.bank,
    values.branch,
    values.account,
    values.amount,
  ];

  return fields.every((field) => {
    if (field === null || field === undefined) {
      return true;
    }

    if (typeof field === 'number') {
      return field === 0 && values.amount === 0;
    }

    return String(field).trim() === '';
  });
}

function buildColumnMapping(headerRow: ExcelJS.Row): ColumnMapping {
  const mapping: Partial<ColumnMapping> = {};

  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const normalized = normalizeHeader(cell.value);

    for (const [key, header] of Object.entries(COLUMN_HEADERS) as [ColumnKey, string][]) {
      if (normalized === header) {
        mapping[key] = colNumber;
      }
    }
  });

  const missingColumns = (Object.keys(COLUMN_HEADERS) as ColumnKey[]).filter(
    (key) => mapping[key] === undefined,
  );

  if (missingColumns.length > 0) {
    throw new Error(
      `Missing required columns in "${PAYMENT_BATCH_SHEET_NAME}": ${missingColumns.join(', ')}`,
    );
  }

  return mapping as ColumnMapping;
}

function readRawRow(row: ExcelJS.Row, columns: ColumnMapping): RawRowValues {
  const accountCell = row.getCell(columns.account);

  return {
    id: getCellValue(row.getCell(columns.id)),
    orderDate: getCellValue(row.getCell(columns.orderDate)),
    beneficiary: getCellValue(row.getCell(columns.beneficiary)),
    taxId: getCellValue(row.getCell(columns.taxId)),
    bank: getCellValue(row.getCell(columns.bank)),
    branch: getCellValue(row.getCell(columns.branch)),
    account: getCellValue(accountCell),
    accountType: getCellValue(row.getCell(columns.accountType)),
    amount: getCellValue(row.getCell(columns.amount)),
    accountDisplayText: getCellText(accountCell),
  };
}

function toPaymentBatchRowDto(values: RawRowValues): PaymentBatchRowDto {
  return {
    id: String(values.id ?? '').trim(),
    orderDate: String(values.orderDate ?? '').trim(),
    beneficiary: String(values.beneficiary ?? '').trim(),
    taxId: String(values.taxId ?? '').trim(),
    bank: sanitizeBankCode(values.bank),
    branch: sanitizeBranchCode(values.branch),
    account: sanitizeAccountNumber(values.account, values.accountDisplayText),
    accountType: String(values.accountType ?? '').trim(),
    amount: parseAmount(values.amount),
  };
}

function parsePaymentBatchRows(worksheet: ExcelJS.Worksheet): PaymentBatchRowDto[] {
  const headerRow = worksheet.getRow(1);
  const columns = buildColumnMapping(headerRow);
  const rows: PaymentBatchRowDto[] = [];

  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    const rawValues = readRawRow(row, columns);

    if (isRowEmpty(rawValues)) {
      continue;
    }

    rows.push(toPaymentBatchRowDto(rawValues));
  }

  return rows;
}

async function loadWorkbook(input: Buffer | string): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();

  if (typeof input === 'string') {
    await workbook.xlsx.readFile(input);
  } else {
    await workbook.xlsx.load(input as unknown as Parameters<ExcelJS.Xlsx['load']>[0]);
  }

  return workbook;
}

async function workbookToBuffer(workbook: ExcelJS.Workbook): Promise<Buffer> {
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

function writeProcessingRows(
  worksheet: ExcelJS.Worksheet,
  rows: PaymentProcessingOutputRow[],
): void {
  worksheet.addRow([...PROCESSING_SHEET_HEADERS]);

  for (const row of rows) {
    const excelRow = worksheet.addRow([
      row.paymentDate,
      row.beneficiary,
      row.taxId,
      row.bank,
      row.branch,
      row.account,
      row.accountType,
      row.amount,
      row.starkBankId ?? '',
      row.status,
      row.motivo ?? '',
    ]);

    setCellAsText(excelRow.getCell(3), row.taxId);
    setCellAsText(excelRow.getCell(4), row.bank);
    setCellAsText(excelRow.getCell(5), row.branch);
    setCellAsText(excelRow.getCell(6), row.account);

    if (row.starkBankId) {
      setCellAsText(excelRow.getCell(9), row.starkBankId);
    }

    setCellAsCurrency(excelRow.getCell(8), row.amount);
  }
}

function addProcessingSheet(
  workbook: ExcelJS.Workbook,
  rows: PaymentProcessingOutputRow[],
): ExcelJS.Worksheet {
  const existingSheet = workbook.getWorksheet(PROCESSING_SHEET_NAME);

  if (existingSheet) {
    workbook.removeWorksheet(existingSheet.id);
  }

  const worksheet = workbook.addWorksheet(PROCESSING_SHEET_NAME);
  writeProcessingRows(worksheet, rows);

  return worksheet;
}

export class SpreadsheetAdapter {
  async parsePaymentBatch(input: Buffer | string): Promise<PaymentBatchRowDto[]> {
    const workbook = await loadWorkbook(input);
    const worksheet = workbook.getWorksheet(PAYMENT_BATCH_SHEET_NAME);

    if (!worksheet) {
      throw new Error(`Worksheet "${PAYMENT_BATCH_SHEET_NAME}" not found`);
    }

    return parsePaymentBatchRows(worksheet);
  }

  async writeProcessamentoPagamentos(
    source: Buffer | string,
    rows: PaymentProcessingOutputRow[],
  ): Promise<Buffer> {
    const workbook = await loadWorkbook(source);
    addProcessingSheet(workbook, rows);
    return workbookToBuffer(workbook);
  }

  async buildProcessamentoWorkbook(rows: PaymentProcessingOutputRow[]): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    addProcessingSheet(workbook, rows);
    return workbookToBuffer(workbook);
  }
}
