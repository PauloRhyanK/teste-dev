import type { ConsolidatedPaymentLine } from '../../domain/entities/consolidated-payment-line.js';

const ACCOUNT_TYPE_MAP: Record<string, string> = {
  corrente: 'checking',
  poupança: 'savings',
  poupanca: 'savings',
  salário: 'salary',
  salario: 'salary',
  pagamento: 'payment',
};

export function mapAccountType(accountType: string): string {
  const normalized = accountType.trim().toLowerCase();
  return ACCOUNT_TYPE_MAP[normalized] ?? 'checking';
}

export function buildTransferExternalId(line: ConsolidatedPaymentLine): string {
  const taxId = line.taxId.replace(/\D/g, '');
  const orderDate = line.orderDate.trim();
  const amountCents = Math.round(line.amount * 100);

  return `pix-${taxId}-${orderDate}-${amountCents}`.replace(/[^a-zA-Z0-9-_]/g, '-');
}

export function toStarkBankTransferParams(
  line: ConsolidatedPaymentLine,
  externalId: string,
): {
  amount: number;
  name: string;
  taxId: string;
  bankCode: string;
  branchCode: string;
  accountNumber: string;
  accountType: string;
  externalId: string;
} {
  return {
    amount: Math.round(line.amount * 100),
    name: line.beneficiary,
    taxId: line.taxId,
    bankCode: line.bank,
    branchCode: line.branch,
    accountNumber: line.account,
    accountType: mapAccountType(line.accountType),
    externalId,
  };
}
