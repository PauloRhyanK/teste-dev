import type { ConsolidatedPaymentBatch } from '../domain/entities/consolidated-payment-batch.js';
import type { ConsolidatedPaymentLine } from '../domain/entities/consolidated-payment-line.js';
import { DomainErrorCode } from '../domain/errors/domain-error-codes.js';
import { ResolveLocalPaymentErrorsUseCase } from './resolve-local-payment-errors.use-case.js';

function createLine(overrides: Partial<ConsolidatedPaymentLine> = {}): ConsolidatedPaymentLine {
  return {
    sourceLineIds: ['1'],
    orderDate: '2024-01-15',
    beneficiary: 'Maria Silva',
    taxId: '111.111.111-11',
    bank: '00000001',
    branch: '0001',
    account: '12345-6',
    accountType: 'corrente',
    amount: 100,
    domainErrors: [DomainErrorCode.INVALID_TAX_ID],
    isValid: false,
    ...overrides,
  };
}

function createBatch(lines: ConsolidatedPaymentLine[]): ConsolidatedPaymentBatch {
  return { lines };
}

describe('ResolveLocalPaymentErrorsUseCase', () => {
  const useCase = new ResolveLocalPaymentErrorsUseCase();

  it('marks invalid lines without paymentStatus as NÃO PAGO with mapped motivo', () => {
    const result = useCase.execute(createBatch([createLine()]));

    expect(result.lines[0]?.paymentStatus).toBe('NÃO PAGO');
    expect(result.lines[0]?.motivo).toBe('Erro: CPF em formato inválido');
  });

  it('leaves valid lines unchanged', () => {
    const line = createLine({
      taxId: '390.533.447-05',
      domainErrors: [],
      isValid: true,
    });

    const result = useCase.execute(createBatch([line]));

    expect(result.lines[0]).toEqual(line);
  });

  it('does not overwrite lines that already have paymentStatus', () => {
    const line = createLine({
      paymentStatus: 'NÃO PAGO',
      motivo: 'Erro: Valor abaixo do mínimo de R$ 10',
      domainErrors: [DomainErrorCode.INVALID_TAX_ID, DomainErrorCode.BELOW_MINIMUM],
    });

    const result = useCase.execute(createBatch([line]));

    expect(result.lines[0]?.motivo).toBe('Erro: Valor abaixo do mínimo de R$ 10');
  });
});
