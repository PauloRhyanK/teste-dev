import type { TransferPaymentStatus } from '../../adapters/gateways/transfer-payment-status.js';

const FINAL_TRANSFER_STATUSES = new Set(['success', 'failed', 'canceled']);

export function isFinalTransferStatus(status: string): boolean {
  return FINAL_TRANSFER_STATUSES.has(status);
}

export function mapTransferStatusToPaymentStatus(
  status: string,
): TransferPaymentStatus | null {
  switch (status) {
    case 'success':
      return 'PAGO';
    case 'failed':
    case 'canceled':
      return 'NÃO PAGO';
    default:
      return null;
  }
}
