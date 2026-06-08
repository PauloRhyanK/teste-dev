import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import ExcelJS from 'exceljs';

import { SpreadsheetAdapter } from './spreadsheet.adapter.js';

const HEADERS = [
  'ID',
  'Data de pedido',
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

  it('throws when worksheet is missing', async () => {
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet('Outra aba');
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

    await expect(adapter.parsePaymentBatch(buffer)).rejects.toThrow(
      'Worksheet "Lote de Pagamentos" not found',
    );
  });
});
