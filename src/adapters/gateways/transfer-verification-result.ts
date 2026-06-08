import type { TransferPaymentStatus } from './transfer-payment-status.js';

export interface TransferVerificationResult {
  sourceLineIds: string[];
  transferId?: string;
  externalId?: string;
  amount: number;
  paymentStatus: TransferPaymentStatus;
  motivo?: string;
  starkStatus?: string;
}
