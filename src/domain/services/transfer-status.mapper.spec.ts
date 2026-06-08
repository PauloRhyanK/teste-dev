import {
  isFinalTransferStatus,
  mapTransferStatusToPaymentStatus,
} from './transfer-status.mapper.js';

describe('transfer-status.mapper', () => {
  it('identifies final transfer statuses', () => {
    expect(isFinalTransferStatus('success')).toBe(true);
    expect(isFinalTransferStatus('failed')).toBe(true);
    expect(isFinalTransferStatus('canceled')).toBe(true);
    expect(isFinalTransferStatus('processing')).toBe(false);
  });

  it('maps stark statuses to payment statuses', () => {
    expect(mapTransferStatusToPaymentStatus('success')).toBe('PAGO');
    expect(mapTransferStatusToPaymentStatus('failed')).toBe('NÃO PAGO');
    expect(mapTransferStatusToPaymentStatus('canceled')).toBe('NÃO PAGO');
    expect(mapTransferStatusToPaymentStatus('processing')).toBeNull();
  });
});
