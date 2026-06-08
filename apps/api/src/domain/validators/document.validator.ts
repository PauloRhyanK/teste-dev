const CPF_LENGTH = 11;
const CNPJ_LENGTH = 14;

const CNPJ_FIRST_WEIGHTS = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const CNPJ_SECOND_WEIGHTS = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

function normalizeDigits(value: string): string {
  return value.replace(/\D/g, '');
}

function hasRepeatedDigits(digits: string): boolean {
  return /^(\d)\1+$/.test(digits);
}

function calculateMod11CheckDigit(digits: string, weights: number[]): number {
  const sum = digits
    .split('')
    .reduce((total, digit, index) => total + Number(digit) * (weights[index] ?? 0), 0);

  const remainder = sum % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}

export class DocumentValidator {
  static isValidCpf(value: string): boolean {
    const digits = normalizeDigits(value);

    if (digits.length !== CPF_LENGTH || hasRepeatedDigits(digits)) {
      return false;
    }

    const base = digits.slice(0, 9);
    const firstCheckDigit = calculateMod11CheckDigit(base, [10, 9, 8, 7, 6, 5, 4, 3, 2]);
    const secondCheckDigit = calculateMod11CheckDigit(
      `${base}${firstCheckDigit}`,
      [11, 10, 9, 8, 7, 6, 5, 4, 3, 2],
    );

    return digits === `${base}${firstCheckDigit}${secondCheckDigit}`;
  }

  static isValidCnpj(value: string): boolean {
    const digits = normalizeDigits(value);

    if (digits.length !== CNPJ_LENGTH || hasRepeatedDigits(digits)) {
      return false;
    }

    const base = digits.slice(0, 12);
    const firstCheckDigit = calculateMod11CheckDigit(base, CNPJ_FIRST_WEIGHTS);
    const secondCheckDigit = calculateMod11CheckDigit(
      `${base}${firstCheckDigit}`,
      CNPJ_SECOND_WEIGHTS,
    );

    return digits === `${base}${firstCheckDigit}${secondCheckDigit}`;
  }

  static isValidTaxId(value: string): boolean {
    const digits = normalizeDigits(value);

    if (digits.length === CPF_LENGTH) {
      return DocumentValidator.isValidCpf(digits);
    }

    if (digits.length === CNPJ_LENGTH) {
      return DocumentValidator.isValidCnpj(digits);
    }

    return false;
  }
}
