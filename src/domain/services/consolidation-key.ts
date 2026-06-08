import type { PaymentLine } from '../entities/payment-line.js';

function normalizeTaxId(taxId: string): string {
  return taxId.replace(/\D/g, '');
}

function normalizeOrderDate(orderDate: string): string {
  const trimmed = orderDate.trim();

  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  const brMatch = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(trimmed);
  if (brMatch) {
    return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`;
  }

  return trimmed;
}

export function buildConsolidationKey(line: PaymentLine): string {
  const taxId = normalizeTaxId(line.taxId);
  const orderDate = normalizeOrderDate(line.orderDate);

  return `${taxId}|${orderDate}|${line.bank}|${line.branch}|${line.account}`;
}
