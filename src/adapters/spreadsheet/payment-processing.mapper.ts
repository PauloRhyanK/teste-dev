import type { TransferVerificationResult } from '../gateways/transfer-verification-result.js';
import type { ConsolidatedPaymentLine } from '../../domain/entities/consolidated-payment-line.js';
import type { PaymentProcessingOutputRow } from './payment-processing-output-row.js';

export function mapToPaymentProcessingOutputRow(
  payment: ConsolidatedPaymentLine,
  verification: TransferVerificationResult,
): PaymentProcessingOutputRow {
  const isPaid = verification.paymentStatus === 'PAGO';

  return {
    paymentDate: payment.orderDate,
    beneficiary: payment.beneficiary,
    taxId: payment.taxId,
    bank: payment.bank,
    branch: payment.branch,
    account: payment.account,
    accountType: payment.accountType,
    amount: payment.amount,
    starkBankId: isPaid ? verification.transferId : undefined,
    status: verification.paymentStatus,
    motivo: isPaid ? undefined : verification.motivo,
  };
}

export function mapToPaymentProcessingOutputRows(
  payments: ConsolidatedPaymentLine[],
  verifications: TransferVerificationResult[],
): PaymentProcessingOutputRow[] {
  if (payments.length !== verifications.length) {
    throw new Error(
      `Payment and verification arrays must have the same length. Received ${payments.length} payments and ${verifications.length} verifications.`,
    );
  }

  return payments.map((payment, index) =>
    mapToPaymentProcessingOutputRow(payment, verifications[index]!),
  );
}
