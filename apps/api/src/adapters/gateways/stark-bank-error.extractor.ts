export interface StarkBankInputErrorDto {
  code: string;
  message: string;
  status?: number;
}

interface StarkBankInputErrorLike {
  code: string;
  message: string;
  status?: number;
}

interface StarkBankInputErrorsLike {
  status?: number;
  errors: StarkBankInputErrorLike[];
}

interface AxiosLikeError {
  code?: string;
  message?: string;
  response?: {
    status?: number;
    data?: {
      errors?: Array<{ code?: string; message?: string }>;
    };
  };
}

const COMMUNICATION_ERROR_CODES = new Set([
  'ECONNABORTED',
  'ECONNRESET',
  'ECONNREFUSED',
  'ENOTFOUND',
  'ETIMEDOUT',
  'EAI_AGAIN',
]);

function isAxiosLikeError(error: unknown): error is AxiosLikeError {
  return typeof error === 'object' && error !== null;
}

function isInputErrorsLike(error: unknown): error is StarkBankInputErrorsLike {
  if (!isAxiosLikeError(error) || !('errors' in error)) {
    return false;
  }

  const candidate = error as StarkBankInputErrorsLike;

  return (
    Array.isArray(candidate.errors) &&
    candidate.errors.every(
      (item) =>
        typeof item === 'object' &&
        item !== null &&
        typeof item.message === 'string' &&
        typeof item.code === 'string',
    )
  );
}

function toInputErrorDto(
  code: string | undefined,
  message: string | undefined,
  status?: number,
): StarkBankInputErrorDto | null {
  if (!message) {
    return null;
  }

  return {
    code: code ?? 'unknown',
    message,
    status,
  };
}

function extractFromAxiosPayload(error: AxiosLikeError): StarkBankInputErrorDto[] {
  const status = error.response?.status;
  const errors = error.response?.data?.errors;

  if (!errors || !Array.isArray(errors)) {
    return [];
  }

  return errors
    .map((item) => toInputErrorDto(item.code, item.message, status))
    .filter((item): item is StarkBankInputErrorDto => item !== null);
}

export function extractStarkBankInputErrors(error: unknown): StarkBankInputErrorDto[] {
  if (isInputErrorsLike(error)) {
    return error.errors.map((inputError) => ({
      code: inputError.code,
      message: inputError.message,
      status: inputError.status ?? error.status,
    }));
  }

  if (!isAxiosLikeError(error)) {
    return [];
  }

  const axiosErrors = extractFromAxiosPayload(error);

  if (axiosErrors.length > 0) {
    return axiosErrors;
  }

  if (error.response?.status === 400 || error.response?.status === 422) {
    const fallback = toInputErrorDto('unknown', error.message, error.response.status);

    return fallback ? [fallback] : [];
  }

  return [];
}

export function isStarkBankCommunicationError(error: unknown): boolean {
  if (extractStarkBankInputErrors(error).length > 0) {
    return false;
  }

  if (!isAxiosLikeError(error)) {
    return true;
  }

  if (error.code && COMMUNICATION_ERROR_CODES.has(error.code)) {
    return true;
  }

  const status = error.response?.status;

  if (status !== undefined && status >= 500) {
    return true;
  }

  if (error.message?.toLowerCase().includes('network')) {
    return true;
  }

  return !error.response;
}
