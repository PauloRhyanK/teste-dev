import type { TransferVerificationResult } from '../gateways/transfer-verification-result.js';
import type { ConsolidatedPaymentLine } from '../../domain/entities/consolidated-payment-line.js';
import {
  mapToPaymentProcessingOutputRow,
  mapToPaymentProcessingOutputRows,
} from './payment-processing.mapper.js';

function samplePayment(overrides: Partial<ConsolidatedPaymentLine> = {}): ConsolidatedPaymentLine {
  return {
    sourceLineIds: ['1'],
    orderDate: '2024-01-15',
    beneficiary: 'Maria Silva',
    taxId: '390.533.447-05',
    bank: '00000001',
    branch: '0001',
    account: '12345-6',
    accountType: 'corrente',
    amount: 150.5,
    domainErrors: [],
    isValid: true,
    ...overrides,
  };
}

function sampleVerification(
  overrides: Partial<TransferVerificationResult> = {},
): TransferVerificationResult {
  return {
    sourceLineIds: ['1'],
    transferId: 'transfer-abc-123',
    amount: 150.5,
    paymentStatus: 'PAGO',
    ...overrides,
  };
}

describe('payment-processing.mapper', () => {
  describe('mapToPaymentProcessingOutputRow', () => {
    it('merges consolidated payment fields with verification status', () => {
      const result = mapToPaymentProcessingOutputRow(samplePayment(), sampleVerification());

      expect(result).toEqual({
        paymentDate: '2024-01-15',
        beneficiary: 'Maria Silva',
        taxId: '390.533.447-05',
        bank: '00000001',
        branch: '0001',
        account: '12345-6',
        accountType: 'corrente',
        amount: 150.5,
        starkBankId: 'transfer-abc-123',
        status: 'PAGO',
        motivo: undefined,
      });
    });

    it('includes starkBankId only when status is PAGO', () => {
      const paid = mapToPaymentProcessingOutputRow(
        samplePayment(),
        sampleVerification({ paymentStatus: 'PAGO', transferId: 'id-paid' }),
      );
      const notPaid = mapToPaymentProcessingOutputRow(
        samplePayment(),
        sampleVerification({
          paymentStatus: 'NÃO PAGO',
          transferId: 'id-failed',
          motivo: 'Saldo insuficiente',
        }),
      );

      expect(paid.starkBankId).toBe('id-paid');
      expect(notPaid.starkBankId).toBeUndefined();
    });

    it('includes motivo for NÃO PAGO and PENDENTE - VERIFICAÇÃO MANUAL', () => {
      const notPaid = mapToPaymentProcessingOutputRow(
        samplePayment(),
        sampleVerification({
          paymentStatus: 'NÃO PAGO',
          motivo: 'Valor abaixo do mínimo',
          transferId: undefined,
        }),
      );
      const pending = mapToPaymentProcessingOutputRow(
        samplePayment(),
        sampleVerification({
          paymentStatus: 'PENDENTE - VERIFICAÇÃO MANUAL',
          motivo: 'Timeout aguardando confirmação',
          transferId: 'id-pending',
        }),
      );

      expect(notPaid.motivo).toBe('Valor abaixo do mínimo');
      expect(pending.motivo).toBe('Timeout aguardando confirmação');
      expect(pending.starkBankId).toBeUndefined();
    });

    it('prefers consolidated amount over verification amount', () => {
      const result = mapToPaymentProcessingOutputRow(
        samplePayment({ amount: 200 }),
        sampleVerification({ amount: 999 }),
      );

      expect(result.amount).toBe(200);
    });
  });

  describe('mapToPaymentProcessingOutputRows', () => {
    it('maps arrays in order', () => {
      const payments = [
        samplePayment({ beneficiary: 'Maria Silva' }),
        samplePayment({ beneficiary: 'João Santos', sourceLineIds: ['2'] }),
      ];
      const verifications = [
        sampleVerification({ paymentStatus: 'PAGO' }),
        sampleVerification({
          sourceLineIds: ['2'],
          paymentStatus: 'NÃO PAGO',
          motivo: 'Falha',
          transferId: undefined,
        }),
      ];

      const result = mapToPaymentProcessingOutputRows(payments, verifications);

      expect(result).toHaveLength(2);
      expect(result[0]?.status).toBe('PAGO');
      expect(result[0]?.starkBankId).toBe('transfer-abc-123');
      expect(result[1]?.status).toBe('NÃO PAGO');
      expect(result[1]?.starkBankId).toBeUndefined();
      expect(result[1]?.motivo).toBe('Falha');
    });

    it('throws when payment and verification arrays have different lengths', () => {
      expect(() =>
        mapToPaymentProcessingOutputRows([samplePayment()], []),
      ).toThrow(
        'Payment and verification arrays must have the same length. Received 1 payments and 0 verifications.',
      );
    });
  });
});
