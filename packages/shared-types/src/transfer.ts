import type { TransferPaymentStatus } from './payment-status.js';

export interface TransferCreationResult {
  sourceLineIds: string[];
  transferId?: string;
  transferStatus?: string;
  externalId?: string;
  paymentStatus: TransferPaymentStatus;
  motivo?: string;
  amount: number;
}

export interface TransferVerificationResult {
  sourceLineIds: string[];
  transferId?: string;
  externalId?: string;
  amount: number;
  paymentStatus: TransferPaymentStatus;
  motivo?: string;
  starkStatus?: string;
}
