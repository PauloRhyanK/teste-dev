import { DomainErrorCode, type DomainErrorCodeValue } from '../errors/domain-error-codes.js';

export const SYSTEM_COMMUNICATION_ERROR_MOTIVO =
  'Erro de Sistema: Falha de comunicação. Verificar manualmente.';

const DOMAIN_ERROR_MESSAGES: Record<DomainErrorCodeValue, string> = {
  [DomainErrorCode.INVALID_TAX_ID]: 'Erro: CPF em formato inválido',
  [DomainErrorCode.BELOW_MINIMUM]: 'Erro: Valor abaixo do mínimo de R$ 10',
  [DomainErrorCode.ABOVE_MAXIMUM]: 'Erro: Valor consolidado excede o teto de R$ 3.000',
};

const GENERIC_DOMAIN_VALIDATION_MOTIVO = 'Erro: Dados do pagamento inválidos';

const STARK_BANK_CODE_MESSAGES: Record<string, string> = {
  invalidBankCode: 'Instituição financeira de destino inválida',
  invalidAccountNumber: 'Conta de destino inválida',
  insufficientBalance: 'Saldo insuficiente na conta primária',
};

export interface StarkBankErrorInput {
  code?: string;
  message: string;
}

function isDomainErrorCode(value: string): value is DomainErrorCodeValue {
  return Object.values(DomainErrorCode).includes(value as DomainErrorCodeValue);
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

function matchStarkBankSemanticMessage(signal: string): string | null {
  const normalized = normalizeText(signal);

  if (
    normalized.includes('invalidbankcode') ||
    normalized.includes('instituição financeira') ||
    normalized.includes('instituicao financeira') ||
    normalized.includes('banco inválido') ||
    normalized.includes('banco invalido')
  ) {
    return STARK_BANK_CODE_MESSAGES.invalidBankCode!;
  }

  if (
    normalized.includes('invalidaccountnumber') ||
    normalized.includes('conta inválida') ||
    normalized.includes('conta invalida')
  ) {
    return STARK_BANK_CODE_MESSAGES.invalidAccountNumber!;
  }

  if (
    normalized.includes('insufficientbalance') ||
    normalized.includes('saldo insuficiente')
  ) {
    return STARK_BANK_CODE_MESSAGES.insufficientBalance!;
  }

  return null;
}

function mapStarkBankMessage(signal: string): string {
  const byCode = signal in STARK_BANK_CODE_MESSAGES ? STARK_BANK_CODE_MESSAGES[signal] : null;

  if (byCode) {
    return `Erro StarkBank: ${byCode}`;
  }

  const semantic = matchStarkBankSemanticMessage(signal);

  if (semantic) {
    return `Erro StarkBank: ${semantic}`;
  }

  return `Erro StarkBank: ${signal}`;
}

export function mapDomainError(code: string): string {
  if (isDomainErrorCode(code)) {
    return DOMAIN_ERROR_MESSAGES[code];
  }

  return GENERIC_DOMAIN_VALIDATION_MOTIVO;
}

export function mapFromDomainErrors(errors: string[]): string {
  const recognized = errors.find(isDomainErrorCode);

  if (recognized) {
    return mapDomainError(recognized);
  }

  return GENERIC_DOMAIN_VALIDATION_MOTIVO;
}

export function mapStarkBankInputError(error: StarkBankErrorInput): string {
  if (error.code) {
    const byCode = mapStarkBankMessage(error.code);
    if (byCode !== `Erro StarkBank: ${error.code}`) {
      return byCode;
    }
  }

  return mapStarkBankMessage(error.message);
}

export function mapStarkBankLogErrors(errors: string[]): string {
  if (errors.length === 0) {
    return mapStarkBankMessage('Transferência rejeitada pelo banco destino');
  }

  return errors.map((error) => mapStarkBankMessage(error)).join('; ');
}

export function mapSystemCommunicationError(): string {
  return SYSTEM_COMMUNICATION_ERROR_MOTIVO;
}

export function mapUnknownError(): string {
  return mapSystemCommunicationError();
}
