import { DomainErrorCode } from '../errors/domain-error-codes.js';
import {
  mapDomainError,
  mapFromDomainErrors,
  mapStarkBankInputError,
  mapStarkBankLogErrors,
  mapSystemCommunicationError,
  mapUnknownError,
  SYSTEM_COMMUNICATION_ERROR_MOTIVO,
} from './payment-error.mapper.js';

describe('PaymentErrorMapper', () => {
  describe('mapDomainError', () => {
    it('maps local validation codes to business messages', () => {
      expect(mapDomainError(DomainErrorCode.INVALID_TAX_ID)).toBe(
        'Erro: CPF em formato inválido',
      );
      expect(mapDomainError(DomainErrorCode.BELOW_MINIMUM)).toBe(
        'Erro: Valor abaixo do mínimo de R$ 10',
      );
      expect(mapDomainError(DomainErrorCode.ABOVE_MAXIMUM)).toBe(
        'Erro: Valor consolidado excede o teto de R$ 3.000',
      );
    });

    it('returns generic validation message for unknown codes', () => {
      expect(mapDomainError('UNKNOWN_CODE')).toBe('Erro: Dados do pagamento inválidos');
    });
  });

  describe('mapFromDomainErrors', () => {
    it('maps the first recognized domain error', () => {
      expect(mapFromDomainErrors(['UNKNOWN', DomainErrorCode.INVALID_TAX_ID])).toBe(
        'Erro: CPF em formato inválido',
      );
    });

    it('returns generic validation message when no recognized code exists', () => {
      expect(mapFromDomainErrors(['foo', 'bar'])).toBe('Erro: Dados do pagamento inválidos');
    });
  });

  describe('mapStarkBankInputError', () => {
    it('maps known Stark Bank codes to semantic messages', () => {
      expect(
        mapStarkBankInputError({
          code: 'invalidBankCode',
          message: 'invalid bank',
        }),
      ).toBe('Erro StarkBank: Instituição financeira de destino inválida');

      expect(
        mapStarkBankInputError({
          code: 'invalidAccountNumber',
          message: 'invalid account',
        }),
      ).toBe('Erro StarkBank: Conta de destino inválida');

      expect(
        mapStarkBankInputError({
          code: 'insufficientBalance',
          message: 'no balance',
        }),
      ).toBe('Erro StarkBank: Saldo insuficiente na conta primária');
    });

    it('maps known Portuguese log messages', () => {
      expect(mapStarkBankInputError({ message: 'Conta inválida' })).toBe(
        'Erro StarkBank: Conta de destino inválida',
      );
      expect(mapStarkBankInputError({ message: 'Saldo insuficiente' })).toBe(
        'Erro StarkBank: Saldo insuficiente na conta primária',
      );
    });

    it('falls back to original API message with StarkBank prefix', () => {
      expect(mapStarkBankInputError({ message: 'Campo taxId inválido' })).toBe(
        'Erro StarkBank: Campo taxId inválido',
      );
    });
  });

  describe('mapStarkBankLogErrors', () => {
    it('maps multiple log errors joined by semicolon', () => {
      expect(mapStarkBankLogErrors(['Conta inválida', 'Saldo insuficiente'])).toBe(
        'Erro StarkBank: Conta de destino inválida; Erro StarkBank: Saldo insuficiente na conta primária',
      );
    });

    it('maps empty log errors to fallback rejection message', () => {
      expect(mapStarkBankLogErrors([])).toBe(
        'Erro StarkBank: Transferência rejeitada pelo banco destino',
      );
    });
  });

  describe('mapSystemCommunicationError', () => {
    it('returns the system communication message', () => {
      expect(mapSystemCommunicationError()).toBe(SYSTEM_COMMUNICATION_ERROR_MOTIVO);
      expect(mapUnknownError()).toBe(SYSTEM_COMMUNICATION_ERROR_MOTIVO);
    });
  });
});
