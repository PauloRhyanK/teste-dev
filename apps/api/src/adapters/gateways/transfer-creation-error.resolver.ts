import {
  mapStarkBankInputError,
  mapSystemCommunicationError,
  mapUnknownError,
} from '../../domain/services/payment-error.mapper.js';
import {
  extractStarkBankInputErrors,
  isStarkBankCommunicationError,
} from './stark-bank-error.extractor.js';

export function resolveTransferCreationMotivo(error: unknown): string {
  const inputErrors = extractStarkBankInputErrors(error);

  if (inputErrors.length > 0) {
    return inputErrors.map((inputError) => mapStarkBankInputError(inputError)).join('; ');
  }

  if (isStarkBankCommunicationError(error)) {
    return mapSystemCommunicationError();
  }

  return mapUnknownError();
}
