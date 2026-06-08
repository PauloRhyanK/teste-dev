export const DomainErrorCode = {
  INVALID_TAX_ID: 'INVALID_TAX_ID',
  BELOW_MINIMUM: 'BELOW_MINIMUM',
  ABOVE_MAXIMUM: 'ABOVE_MAXIMUM',
} as const;

export type DomainErrorCodeValue = (typeof DomainErrorCode)[keyof typeof DomainErrorCode];
