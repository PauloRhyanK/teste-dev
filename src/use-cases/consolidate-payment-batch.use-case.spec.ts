import type { PaymentBatch } from '../domain/entities/payment-batch.js';
import type { PaymentLine } from '../domain/entities/payment-line.js';
import { DomainErrorCode } from '../domain/errors/domain-error-codes.js';
import { ConsolidatePaymentBatchUseCase } from './consolidate-payment-batch.use-case.js';

function createLine(overrides: Partial<PaymentLine> = {}): PaymentLine {
  return {
    id: '1',
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

function createBatch(lines: PaymentLine[]): PaymentBatch {
  return { lines };
}

describe('ConsolidatePaymentBatchUseCase', () => {
  const useCase = new ConsolidatePaymentBatchUseCase();

  it('sums amounts for lines with the same consolidation key', () => {
    const result = useCase.execute(
      createBatch([
        createLine({ id: '1', amount: 100 }),
        createLine({ id: '2', amount: 50 }),
      ]),
    );

    expect(result.lines).toHaveLength(1);
    expect(result.lines[0]?.amount).toBe(150);
    expect(result.lines[0]?.sourceLineIds).toEqual(['1', '2']);
  });

  it('keeps separate payments when the same tax ID has different accounts', () => {
    const result = useCase.execute(
      createBatch([
        createLine({ id: '1', account: '12345-6', amount: 100 }),
        createLine({ id: '2', account: '99999-9', amount: 200 }),
      ]),
    );

    expect(result.lines).toHaveLength(2);
    expect(result.lines[0]?.amount).toBe(100);
    expect(result.lines[1]?.amount).toBe(200);
  });

  it('does not mutate the original batch or line objects', () => {
    const lineOne = createLine({ id: '1', amount: 100 });
    const lineTwo = createLine({ id: '2', amount: 50 });
    const batch = createBatch([lineOne, lineTwo]);
    const originalLinesRef = batch.lines;
    const originalLineOneAmount = lineOne.amount;
    const originalLineTwoAmount = lineTwo.amount;

    useCase.execute(batch);

    expect(batch.lines).toBe(originalLinesRef);
    expect(batch.lines).toHaveLength(2);
    expect(lineOne.amount).toBe(originalLineOneAmount);
    expect(lineTwo.amount).toBe(originalLineTwoAmount);
  });

  it('marks consolidated group as invalid when any source line is invalid', () => {
    const result = useCase.execute(
      createBatch([
        createLine({ id: '1', isValid: true, domainErrors: [] }),
        createLine({
          id: '2',
          isValid: false,
          domainErrors: [DomainErrorCode.INVALID_TAX_ID],
        }),
      ]),
    );

    expect(result.lines).toHaveLength(1);
    expect(result.lines[0]?.isValid).toBe(false);
    expect(result.lines[0]?.domainErrors).toContain(DomainErrorCode.INVALID_TAX_ID);
  });

  it('preserves the first-appearance order of consolidation groups', () => {
    const result = useCase.execute(
      createBatch([
        createLine({ id: '1', account: '11111-1', amount: 100 }),
        createLine({ id: '2', account: '22222-2', amount: 200 }),
        createLine({ id: '3', account: '11111-1', amount: 50 }),
      ]),
    );

    expect(result.lines).toHaveLength(2);
    expect(result.lines[0]?.account).toBe('11111-1');
    expect(result.lines[0]?.amount).toBe(150);
    expect(result.lines[1]?.account).toBe('22222-2');
    expect(result.lines[1]?.amount).toBe(200);
  });
});
