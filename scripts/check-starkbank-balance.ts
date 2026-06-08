import { StarkBankGateway } from '../src/adapters/gateways/stark-bank.gateway.js';

async function main(): Promise<void> {
  const gateway = new StarkBankGateway();
  const balance = await gateway.checkBalance();

  console.info(
    `Stark Bank Sandbox conectado. Saldo: ${balance.currency} ${(balance.amount / 100).toFixed(2)}`,
  );
}

main().catch((error) => {
  console.error('Falha na autenticação ou conexão com o Stark Bank Sandbox.');
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
