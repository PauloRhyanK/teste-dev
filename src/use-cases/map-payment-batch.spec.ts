import type { PaymentBatchRowDto } from '../adapters/spreadsheet/payment-batch-row.dto.js';
import { DomainErrorCode } from '../domain/errors/domain-error-codes.js';
import { mapPaymentBatchFromDtos } from './map-payment-batch.js';

function createDto(overrides: Partial<PaymentBatchRowDto> = {}): PaymentBatchRowDto {
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
    ...overrides,
  };
}

describe('mapPaymentBatchFromDtos', () => {
  it('maps all lines without throwing when some tax IDs are invalid', () => {
    const batch = mapPaymentBatchFromDtos([
      createDto({ id: '1', taxId: '390.533.447-05' }),
      createDto({ id: '2', taxId: '111.111.111-11' }),
      createDto({ id: '3', taxId: '52998224725' }),
    ]);

    expect(batch.lines).toHaveLength(3);
  });

  it('marks invalid lines with domain errors', () => {
    const batch = mapPaymentBatchFromDtos([createDto({ taxId: '111.111.111-11' })]);

    expect(batch.lines[0]?.isValid).toBe(false);
    expect(batch.lines[0]?.domainErrors).toContain(DomainErrorCode.INVALID_TAX_ID);
  });

  it('marks valid lines as valid with no domain errors', () => {
    const batch = mapPaymentBatchFromDtos([
      createDto({ id: '1', taxId: '390.533.447-05' }),
      createDto({ id: '2', taxId: '52998224725' }),
    ]);

    expect(batch.lines[0]?.isValid).toBe(true);
    expect(batch.lines[0]?.domainErrors).toEqual([]);
    expect(batch.lines[1]?.isValid).toBe(true);
    expect(batch.lines[1]?.domainErrors).toEqual([]);
  });
});
