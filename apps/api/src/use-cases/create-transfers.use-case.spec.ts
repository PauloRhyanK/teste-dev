import type { ConsolidatedPaymentBatch } from '../domain/entities/consolidated-payment-batch.js';
import type { StarkBankGateway } from '../adapters/gateways/stark-bank.gateway.js';
import { CreateTransfersUseCase } from './create-transfers.use-case.js';

function buildBatch(lines: ConsolidatedPaymentBatch['lines']): ConsolidatedPaymentBatch {
  return { lines };
}

describe('CreateTransfersUseCase', () => {
  const gateway = {
    createTransfers: jest.fn(),
  } as unknown as jest.Mocked<Pick<StarkBankGateway, 'createTransfers'>>;

  const useCase = new CreateTransfersUseCase(gateway as unknown as StarkBankGateway);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('skips invalid lines and creates transfers only for eligible payments', async () => {
    gateway.createTransfers.mockResolvedValue([
      {
        sourceLineIds: ['2'],
        transferId: 'transfer-2',
        transferStatus: 'processing',
        externalId: 'external-2',
        amount: 500,
        paymentStatus: 'PROCESSANDO',
      },
    ]);

    const batch = buildBatch([
      {
        sourceLineIds: ['1'],
        orderDate: '2024-01-15',
        beneficiary: 'Inválido',
        taxId: '000',
        bank: '20018183',
        branch: '0001',
        account: '1-1',
        accountType: 'Corrente',
        amount: 100,
        domainErrors: ['INVALID_TAX_ID'],
        isValid: false,
        paymentStatus: 'NÃO PAGO',
        motivo: 'Erro: CPF em formato inválido',
      },
      {
        sourceLineIds: ['2'],
        orderDate: '2024-01-15',
        beneficiary: 'Válido',
        taxId: '12345678901',
        bank: '20018183',
        branch: '0001',
        account: '2-2',
        accountType: 'Corrente',
        amount: 500,
        domainErrors: [],
        isValid: true,
      },
    ]);

    const results = await useCase.execute(batch, 'batch-abc');

    expect(gateway.createTransfers).toHaveBeenCalledWith([batch.lines[1]], 'batch-abc');
    expect(results[0]?.paymentStatus).toBe('NÃO PAGO');
    expect(results[1]?.paymentStatus).toBe('PROCESSANDO');
  });

  it('keeps valid payments paid when another line fails at the gateway', async () => {
    gateway.createTransfers.mockResolvedValue([
      {
        sourceLineIds: ['1'],
        externalId: 'pix-1',
        amount: 500,
        paymentStatus: 'NÃO PAGO',
        motivo: 'Erro StarkBank: Conta de destino inválida',
      },
      {
        sourceLineIds: ['2'],
        transferId: 'transfer-2',
        externalId: 'pix-2',
        amount: 700,
        paymentStatus: 'PROCESSANDO',
      },
    ]);

    const batch = buildBatch([
      {
        sourceLineIds: ['1'],
        orderDate: '2024-01-15',
        beneficiary: 'Conta ruim',
        taxId: '12345678901',
        bank: '20018183',
        branch: '0001',
        account: '1-1',
        accountType: 'Corrente',
        amount: 500,
        domainErrors: [],
        isValid: true,
      },
      {
        sourceLineIds: ['2'],
        orderDate: '2024-01-15',
        beneficiary: 'Conta boa',
        taxId: '98765432100',
        bank: '20018183',
        branch: '0001',
        account: '2-2',
        accountType: 'Corrente',
        amount: 700,
        domainErrors: [],
        isValid: true,
      },
    ]);

    const results = await useCase.execute(batch, 'batch-abc');

    expect(results[0]?.paymentStatus).toBe('NÃO PAGO');
    expect(results[1]?.paymentStatus).toBe('PROCESSANDO');
  });
});
