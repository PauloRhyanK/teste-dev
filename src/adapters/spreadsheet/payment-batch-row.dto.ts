export interface PaymentBatchRowDto {
  id: string;
  orderDate: string;
  beneficiary: string;
  taxId: string;
  bank: string;
  branch: string;
  account: string;
  accountType: string;
  amount: number;
}
