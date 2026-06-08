export const BANK_ISPB_LENGTH = 8;
export const BRANCH_MIN_LENGTH = 4;

export function sanitizeBankCode(value: unknown): string {
  const digits = String(value ?? '').replace(/\D/g, '');
  return digits.padStart(BANK_ISPB_LENGTH, '0');
}

export function sanitizeBranchCode(value: unknown): string {
  const digits = String(value ?? '').replace(/\D/g, '');
  return digits.padStart(BRANCH_MIN_LENGTH, '0');
}

export function sanitizeAccountNumber(value: unknown, displayText?: string): string {
  const text = displayText?.trim();
  if (text) {
    return text;
  }

  return String(value ?? '').trim();
}
