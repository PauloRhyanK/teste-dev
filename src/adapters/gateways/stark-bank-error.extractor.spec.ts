import {
  extractStarkBankInputErrors,
  isStarkBankCommunicationError,
} from './stark-bank-error.extractor.js';

describe('stark-bank-error.extractor', () => {
  it('extracts errors from starkbank InputErrors-like payloads (HTTP 400)', () => {
    const error = {
      status: 400,
      errors: [
        { code: 'invalidBankCode', message: 'Invalid bank code', status: 400 },
        { code: 'invalidAccountNumber', message: 'Invalid account', status: 400 },
      ],
    };

    expect(extractStarkBankInputErrors(error)).toEqual([
      { code: 'invalidBankCode', message: 'Invalid bank code', status: 400 },
      { code: 'invalidAccountNumber', message: 'Invalid account', status: 400 },
    ]);
    expect(isStarkBankCommunicationError(error)).toBe(false);
  });

  it('extracts errors from HTTP 422 axios-like payloads', () => {
    const error = {
      message: 'Request failed with status code 422',
      response: {
        status: 422,
        data: {
          errors: [{ code: 'invalidTaxId', message: 'Invalid tax id' }],
        },
      },
    };

    expect(extractStarkBankInputErrors(error)).toEqual([
      { code: 'invalidTaxId', message: 'Invalid tax id', status: 422 },
    ]);
    expect(isStarkBankCommunicationError(error)).toBe(false);
  });

  it('detects communication errors for network failures', () => {
    const networkError = { code: 'ECONNRESET', message: 'socket hang up' };

    expect(extractStarkBankInputErrors(networkError)).toEqual([]);
    expect(isStarkBankCommunicationError(networkError)).toBe(true);
  });

  it('detects communication errors for HTTP 500 responses', () => {
    const serverError = {
      message: 'Internal Server Error',
      response: { status: 500, data: {} },
    };

    expect(extractStarkBankInputErrors(serverError)).toEqual([]);
    expect(isStarkBankCommunicationError(serverError)).toBe(true);
  });

  it('treats generic errors without response as communication errors', () => {
    const genericError = new Error('Something went wrong');

    expect(extractStarkBankInputErrors(genericError)).toEqual([]);
    expect(isStarkBankCommunicationError(genericError)).toBe(true);
  });
});
