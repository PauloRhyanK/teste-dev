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
  paymentStatus?: 'PAGO' | 'NÃO PAGO';
  motivo?: string;
}
