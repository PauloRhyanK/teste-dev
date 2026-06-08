import type { PaymentLine } from '../entities/payment-line.js';
import { buildConsolidationKey } from './consolidation-key.js';

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

describe('buildConsolidationKey', () => {
  it('produces the same key for tax IDs with different masks', () => {
    const masked = buildConsolidationKey(createLine({ taxId: '390.533.447-05' }));
    const unmasked = buildConsolidationKey(createLine({ taxId: '39053344705' }));

    expect(masked).toBe(unmasked);
  });

  it('produces different keys for different accounts', () => {
    const accountA = buildConsolidationKey(createLine({ account: '12345-6' }));
    const accountB = buildConsolidationKey(createLine({ account: '99999-9' }));

    expect(accountA).not.toBe(accountB);
  });

  it('produces different keys for different order dates', () => {
    const dayOne = buildConsolidationKey(createLine({ orderDate: '2024-01-15' }));
    const dayTwo = buildConsolidationKey(createLine({ orderDate: '2024-01-16' }));

    expect(dayOne).not.toBe(dayTwo);
  });

  it('normalizes brazilian date format to ISO for grouping', () => {
    const isoDate = buildConsolidationKey(createLine({ orderDate: '2024-01-15' }));
    const brDate = buildConsolidationKey(createLine({ orderDate: '15/01/2024' }));

    expect(isoDate).toBe(brDate);
  });
});
