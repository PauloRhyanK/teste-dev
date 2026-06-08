import type { TransferPaymentStatus } from '@quansa/shared-types';

export interface ConsolidatedPaymentLine {
  sourceLineIds: string[];
  orderDate: string;
  beneficiary: string;
  taxId: string;
  bank: string;
  branch: string;
  account: string;
  accountType: string;
  amount: number;
  domainErrors: string[];
  isValid: boolean;
  paymentStatus?: TransferPaymentStatus;
  motivo?: string;
}
