import type { ConsolidatedPaymentBatch } from '../domain/entities/consolidated-payment-batch.js';
import type { ConsolidatedPaymentLine } from '../domain/entities/consolidated-payment-line.js';
import { DomainErrorCode } from '../domain/errors/domain-error-codes.js';
import { ValidatePaymentLimitsUseCase } from './validate-payment-limits.use-case.js';

function createLine(overrides: Partial<ConsolidatedPaymentLine> = {}): ConsolidatedPaymentLine {
  return {
    sourceLineIds: ['1'],
    orderDate: '2024-01-15',
    beneficiary: 'Maria Silva',
    taxId: '390.533.447-05',
    bank: '00000001',
    branch: '0001',
    account: '12345-6',
    accountType: 'corrente',
    amount: 100,
    domainErrors: [],
    isValid: true,
    ...overrides,
  };
}

function createBatch(lines: ConsolidatedPaymentLine[]): ConsolidatedPaymentBatch {
  return { lines };
}

describe('ValidatePaymentLimitsUseCase', () => {
  const useCase = new ValidatePaymentLimitsUseCase();

  it('processes a mixed batch without throwing', () => {
    const result = useCase.execute(
      createBatch([
        createLine({ sourceLineIds: ['1'], amount: 100 }),
        createLine({ sourceLineIds: ['2'], amount: 5 }),
        createLine({ sourceLineIds: ['3'], amount: 5000 }),
      ]),
    );

    expect(result.lines).toHaveLength(3);
  });

  it('rejects lines below the minimum with exact motivo and status', () => {
    const result = useCase.execute(createBatch([createLine({ amount: 5 })]));

    expect(result.lines[0]?.isValid).toBe(false);
    expect(result.lines[0]?.paymentStatus).toBe('NÃO PAGO');
    expect(result.lines[0]?.motivo).toBe('Erro: Valor abaixo do mínimo de R$ 10');
    expect(result.lines[0]?.domainErrors).toContain(DomainErrorCode.BELOW_MINIMUM);
  });

  it('rejects lines above the maximum with exact motivo', () => {
    const result = useCase.execute(createBatch([createLine({ amount: 5000 })]));

    expect(result.lines[0]?.isValid).toBe(false);
    expect(result.lines[0]?.paymentStatus).toBe('NÃO PAGO');
    expect(result.lines[0]?.motivo).toBe('Erro: Valor consolidado excede o teto de R$ 3.000');
  });

  it('leaves valid lines unchanged', () => {
    const line = createLine({ amount: 100 });
    const result = useCase.execute(createBatch([line]));

    expect(result.lines[0]).toEqual(line);
    expect(result.lines[0]?.paymentStatus).toBeUndefined();
    expect(result.lines[0]?.motivo).toBeUndefined();
  });

  it('does not mutate the original batch or line objects', () => {
    const line = createLine({ amount: 5 });
    const batch = createBatch([line]);
    const originalLinesRef = batch.lines;
    const originalAmount = line.amount;
    const originalIsValid = line.isValid;

    useCase.execute(batch);

    expect(batch.lines).toBe(originalLinesRef);
    expect(line.amount).toBe(originalAmount);
    expect(line.isValid).toBe(originalIsValid);
    expect(line.paymentStatus).toBeUndefined();
    expect(line.motivo).toBeUndefined();
  });
});
