import { DomainErrorCode } from '../errors/domain-error-codes.js';
import { PaymentLimitValidator } from './payment-limit.validator.js';

describe('PaymentLimitValidator', () => {
  describe('getViolationReason', () => {
    it('returns below minimum message for amounts under R$ 10', () => {
      expect(PaymentLimitValidator.getViolationReason(9.99)).toBe(
        DomainErrorCode.BELOW_MINIMUM,
      );
    });

    it('returns null for the minimum allowed amount', () => {
      expect(PaymentLimitValidator.getViolationReason(10)).toBeNull();
    });

    it('returns null for the maximum allowed amount', () => {
      expect(PaymentLimitValidator.getViolationReason(3000)).toBeNull();
    });

    it('returns above maximum message for amounts over R$ 3000', () => {
      expect(PaymentLimitValidator.getViolationReason(3000.01)).toBe(
        DomainErrorCode.ABOVE_MAXIMUM,
      );
    });
  });

  describe('isWithinLimits', () => {
    it('returns true only when getViolationReason is null', () => {
      expect(PaymentLimitValidator.isWithinLimits(100)).toBe(true);
      expect(PaymentLimitValidator.isWithinLimits(9.99)).toBe(false);
      expect(PaymentLimitValidator.isWithinLimits(3000.01)).toBe(false);
    });
  });
});
