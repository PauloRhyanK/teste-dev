import {
  sanitizeAccountNumber,
  sanitizeBankCode,
  sanitizeBranchCode,
} from './banking-field.sanitizer.js';

describe('banking-field.sanitizer', () => {
  it('sanitizes bank code to 8-digit ISPB', () => {
    expect(sanitizeBankCode(1)).toBe('00000001');
    expect(sanitizeBankCode('33')).toBe('00000033');
  });

  it('sanitizes branch code to minimum 4 digits', () => {
    expect(sanitizeBranchCode(1)).toBe('0001');
    expect(sanitizeBranchCode('1234')).toBe('1234');
  });

  it('preserves account display text with hyphen', () => {
    expect(sanitizeAccountNumber(123456, '12345-6')).toBe('12345-6');
    expect(sanitizeAccountNumber('10000-0')).toBe('10000-0');
  });
});
