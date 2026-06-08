import type { TransferPaymentStatus } from './transfer-payment-status.js';

export interface TransferCreationResult {
  sourceLineIds: string[];
  transferId?: string;
  transferStatus?: string;
  externalId?: string;
  paymentStatus: TransferPaymentStatus;
  motivo?: string;
  amount: number;
}
