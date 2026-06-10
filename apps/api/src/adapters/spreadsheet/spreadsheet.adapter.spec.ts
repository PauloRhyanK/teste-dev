import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import ExcelJS from 'exceljs';

import { PROCESSING_SHEET_HEADERS } from './processing-sheet.constants.js';
import { SpreadsheetAdapter } from './spreadsheet.adapter.js';

const HEADERS = [
  'ID',
  'Data do Pedido',
  'Beneficiário',
  'CPF/CNPJ',
  'Banco',
  'Agência',
  'Conta',
  'Tipo',
  'Valor (R$)',
];

interface SampleRow {
  id: string | number;
  orderDate: string | Date;
  beneficiary: string;
  taxId: string;
  bank: string | number;
  branch: string | number;
  account: string | number;
  accountType: string;
  amount: number;
}

async function buildWorkbookBuffer(rows: (SampleRow | null)[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Lote de Pagamentos');

  worksheet.addRow(HEADERS);

  for (const row of rows) {
    if (row === null) {
      worksheet.addRow([]);
      continue;
    }

    worksheet.addRow([
      row.id,
      row.orderDate,
      row.beneficiary,
      row.taxId,
      row.bank,
      row.branch,
      row.account,
      row.accountType,
      row.amount,
    ]);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

function sampleRow(overrides: Partial<SampleRow> = {}): SampleRow {
  return {
    id: '1',
    orderDate: '2024-01-15',
    beneficiary: 'Maria Silva',
    taxId: '123.456.789-00',
    bank: 1,
    branch: 1,
    account: '12345-6',
    accountType: 'corrente',
    amount: 100,
    ...overrides,
  };
}

describe('SpreadsheetAdapter', () => {
  const adapter = new SpreadsheetAdapter();

  it('pads bank and branch codes with leading zeros', async () => {
    const buffer = await buildWorkbookBuffer([sampleRow({ bank: 1, branch: 1 })]);

    const result = await adapter.parsePaymentBatch(buffer);

    expect(result).toHaveLength(1);
    expect(result[0]?.bank).toBe('00000001');
    expect(result[0]?.branch).toBe('0001');
  });

  it('preserves account hyphen as string', async () => {
    const buffer = await buildWorkbookBuffer([sampleRow({ account: '12345-6' })]);

    const result = await adapter.parsePaymentBatch(buffer);

    expect(result[0]?.account).toBe('12345-6');
  });

  it('ignores empty rows in the middle of the spreadsheet', async () => {
    const buffer = await buildWorkbookBuffer([
      sampleRow({ id: '1', beneficiary: 'Maria Silva' }),
      null,
      sampleRow({ id: '2', beneficiary: 'João Santos' }),
    ]);

    const result = await adapter.parsePaymentBatch(buffer);

    expect(result).toHaveLength(2);
    expect(result[0]?.id).toBe('1');
    expect(result[1]?.id).toBe('2');
  });

  it('parses payment batch from a file path', async () => {
    const buffer = await buildWorkbookBuffer([sampleRow()]);
    const tempDir = await mkdtemp(join(tmpdir(), 'quansa-teste-'));
    const filePath = join(tempDir, 'lote.xlsx');

    await writeFile(filePath, buffer);

    const result = await adapter.parsePaymentBatch(filePath);

    expect(result).toHaveLength(1);
    expect(result[0]?.beneficiary).toBe('Maria Silva');
  });

  it('fills processing sheet in place while preserving existing layout', async () => {
    const workbook = new ExcelJS.Workbook();
    const inputSheet = workbook.addWorksheet('Lote de Pagamentos');
    inputSheet.addRow(HEADERS);
    inputSheet.addRow([
      '1',
      '2024-01-15',
      'Maria Silva',
      '123.456.789-00',
      '00000001',
      '0001',
      '12345-6',
      'corrente',
      100,
    ]);

    const processingSheet = workbook.addWorksheet('Processamento de Pagamentos');
    processingSheet.getCell('A1').value = 'QUANSA · Processamento';
    processingSheet.getCell('A2').value = 'Descrição do template';
    processingSheet.addRow([]);
    processingSheet.addRow([...PROCESSING_SHEET_HEADERS]);
    processingSheet.getRow(5).getCell(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFF00' },
    };

    const inputBuffer = Buffer.from(await workbook.xlsx.writeBuffer());
    const outputBuffer = await adapter.writeProcessamentoPagamentos(inputBuffer, [
      {
        paymentDate: '2024-01-15',
        beneficiary: 'Maria Silva',
        taxId: '123.456.789-00',
        bank: '00000001',
        branch: '0001',
        account: '12345-6',
        accountType: 'corrente',
        amount: 100,
        starkBankId: 'transfer-123',
        status: 'PAGO',
      },
    ]);

    const resultWorkbook = new ExcelJS.Workbook();
    await resultWorkbook.xlsx.load(outputBuffer as unknown as Parameters<ExcelJS.Xlsx['load']>[0]);

    const resultSheet = resultWorkbook.getWorksheet('Processamento de Pagamentos');
    expect(resultSheet?.getCell('A1').value).toBe('QUANSA · Processamento');
    expect(resultSheet?.getCell('A2').value).toBe('Descrição do template');
    expect(resultSheet?.getRow(5).getCell(1).fill).toMatchObject({
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFF00' },
    });
    expect(resultSheet?.getRow(5).getCell(1).value).toBe('2024-01-15');
    expect(resultSheet?.getRow(5).getCell(2).value).toBe('Maria Silva');
    expect(resultSheet?.getRow(5).getCell(10).value).toBe('PAGO');
    expect(resultWorkbook.worksheets).toHaveLength(2);
  });

  it('throws when worksheet is missing', async () => {
    const workbook = new ExcelJS.Workbook();
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

    await expect(adapter.parsePaymentBatch(buffer)).rejects.toThrow(
      'Worksheet "Lote de Pagamentos" not found',
    );
  });
});
