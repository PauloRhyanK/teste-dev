import { PAYMENT_MAX_AMOUNT, PAYMENT_MIN_AMOUNT } from '../constants/payment-limits.js';
import { DomainErrorCode } from '../errors/domain-error-codes.js';

export class PaymentLimitValidator {
  static getViolationReason(amount: number): string | null {
    if (amount < PAYMENT_MIN_AMOUNT) {
      return DomainErrorCode.BELOW_MINIMUM;
    }

    if (amount > PAYMENT_MAX_AMOUNT) {
      return DomainErrorCode.ABOVE_MAXIMUM;
    }

    return null;
  }

  static isWithinLimits(amount: number): boolean {
    return PaymentLimitValidator.getViolationReason(amount) === null;
  }
}
