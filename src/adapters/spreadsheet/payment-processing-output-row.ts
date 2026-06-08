import type { TransferPaymentStatus } from '../gateways/transfer-payment-status.js';

export interface PaymentProcessingOutputRow {
  paymentDate: string;
  beneficiary: string;
  taxId: string;
  bank: string;
  branch: string;
  account: string;
  accountType: string;
  amount: number;
  starkBankId?: string;
  status: TransferPaymentStatus;
  motivo?: string;
}
