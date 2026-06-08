import ExcelJS from 'exceljs';

import type { PaymentProcessingOutputRow } from './payment-processing-output-row.js';
import {
  PROCESSING_SHEET_HEADERS,
  PROCESSING_SHEET_NAME,
} from './processing-sheet.constants.js';
import { SpreadsheetAdapter } from './spreadsheet.adapter.js';

const PAYMENT_BATCH_SHEET_NAME = 'Lote de Pagamentos';

function sampleOutputRow(
  overrides: Partial<PaymentProcessingOutputRow> = {},
): PaymentProcessingOutputRow {
  return {
    paymentDate: '2024-01-15',
    beneficiary: 'Maria Silva',
    taxId: '390.533.447-05',
    bank: '00000001',
    branch: '0001',
    account: '12345-6',
    accountType: 'corrente',
    amount: 150.5,
    status: 'PAGO',
    starkBankId: 'transfer-abc-123',
    ...overrides,
  };
}

async function buildSourceWorkbookBuffer(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(PAYMENT_BATCH_SHEET_NAME);

  worksheet.addRow([
    'ID',
    'Data de pedido',
    'Beneficiário',
    'CPF/CNPJ',
    'Banco',
    'Agência',
    'Conta',
    'Tipo',
    'Valor (R$)',
  ]);
  worksheet.addRow([
    '1',
    '2024-01-15',
    'Maria Silva',
    '390.533.447-05',
    '00000001',
    '0001',
    '12345-6',
    'corrente',
    150.5,
  ]);

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

async function readProcessingSheet(buffer: Buffer): Promise<ExcelJS.Worksheet> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as Parameters<ExcelJS.Xlsx['load']>[0]);
  const worksheet = workbook.getWorksheet(PROCESSING_SHEET_NAME);

  if (!worksheet) {
    throw new Error(`Worksheet "${PROCESSING_SHEET_NAME}" not found`);
  }

  return worksheet;
}

function getRowValues(worksheet: ExcelJS.Worksheet, rowNumber: number): string[] {
  const row = worksheet.getRow(rowNumber);
  const values: string[] = [];

  for (let column = 1; column <= PROCESSING_SHEET_HEADERS.length; column++) {
    const cell = row.getCell(column);
    values.push(cell.text ?? String(cell.value ?? ''));
  }

  return values;
}

describe('SpreadsheetAdapter output', () => {
  const adapter = new SpreadsheetAdapter();

  describe('buildProcessamentoWorkbook', () => {
    it('returns a valid buffer with processing sheet headers', async () => {
      const buffer = await adapter.buildProcessamentoWorkbook([sampleOutputRow()]);

      expect(Buffer.isBuffer(buffer)).toBe(true);

      const worksheet = await readProcessingSheet(buffer);
      const headers = getRowValues(worksheet, 1);

      expect(headers).toEqual([...PROCESSING_SHEET_HEADERS]);
      expect(worksheet.rowCount).toBe(2);
    });
  });

  describe('writeProcessamentoPagamentos', () => {
    it('writes 11 columns with exact headers and row data', async () => {
      const source = await buildSourceWorkbookBuffer();
      const rows = [
        sampleOutputRow(),
        sampleOutputRow({
          beneficiary: 'João Santos',
          status: 'NÃO PAGO',
          starkBankId: undefined,
          motivo: 'Valor abaixo do mínimo',
        }),
      ];

      const buffer = await adapter.writeProcessamentoPagamentos(source, rows);
      const worksheet = await readProcessingSheet(buffer);

      expect(getRowValues(worksheet, 1)).toEqual([...PROCESSING_SHEET_HEADERS]);

      const paidDataRow = worksheet.getRow(2);
      const paidRow = getRowValues(worksheet, 2);
      expect(paidRow[0]).toBe('2024-01-15');
      expect(paidRow[1]).toBe('Maria Silva');
      expect(paidDataRow.getCell(8).value).toBe(150.5);
      expect(paidDataRow.getCell(8).numFmt).toBe('#,##0.00');
      expect(paidRow[8]).toBe('transfer-abc-123');
      expect(paidRow[9]).toBe('PAGO');
      expect(paidRow[10]).toBe('');

      const notPaidRow = getRowValues(worksheet, 3);
      expect(notPaidRow[8]).toBe('');
      expect(notPaidRow[9]).toBe('NÃO PAGO');
      expect(notPaidRow[10]).toBe('Valor abaixo do mínimo');
    });

    it('preserves taxId, branch and account as text after round-trip', async () => {
      const buffer = await adapter.buildProcessamentoWorkbook([sampleOutputRow()]);
      const worksheet = await readProcessingSheet(buffer);
      const dataRow = worksheet.getRow(2);

      expect(dataRow.getCell(3).text).toBe('390.533.447-05');
      expect(dataRow.getCell(3).numFmt).toBe('@');
      expect(dataRow.getCell(5).text).toBe('0001');
      expect(dataRow.getCell(5).numFmt).toBe('@');
      expect(dataRow.getCell(6).text).toBe('12345-6');
      expect(dataRow.getCell(6).numFmt).toBe('@');
    });

    it('formats amount as currency', async () => {
      const buffer = await adapter.buildProcessamentoWorkbook([sampleOutputRow({ amount: 150.5 })]);
      const worksheet = await readProcessingSheet(buffer);
      const amountCell = worksheet.getRow(2).getCell(8);

      expect(amountCell.value).toBe(150.5);
      expect(amountCell.numFmt).toBe('#,##0.00');
    });

    it('preserves Lote de Pagamentos sheet from source workbook', async () => {
      const source = await buildSourceWorkbookBuffer();
      const buffer = await adapter.writeProcessamentoPagamentos(source, [sampleOutputRow()]);

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer as unknown as Parameters<ExcelJS.Xlsx['load']>[0]);

      const batchSheet = workbook.getWorksheet(PAYMENT_BATCH_SHEET_NAME);
      const processingSheet = workbook.getWorksheet(PROCESSING_SHEET_NAME);

      expect(batchSheet).toBeDefined();
      expect(processingSheet).toBeDefined();
      expect(batchSheet?.rowCount).toBeGreaterThanOrEqual(2);
    });

    it('replaces existing Processamento de Pagamentos sheet', async () => {
      const source = await buildSourceWorkbookBuffer();
      const firstWrite = await adapter.writeProcessamentoPagamentos(source, [
        sampleOutputRow({ beneficiary: 'Primeira versão' }),
      ]);
      const secondWrite = await adapter.writeProcessamentoPagamentos(firstWrite, [
        sampleOutputRow({ beneficiary: 'Segunda versão' }),
      ]);

      const worksheet = await readProcessingSheet(secondWrite);
      const beneficiary = getRowValues(worksheet, 2)[1];

      expect(beneficiary).toBe('Segunda versão');
      expect(worksheet.rowCount).toBe(2);
    });
  });
});
