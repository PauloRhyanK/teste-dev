import starkbank from 'starkbank';

import {
  loadStarkBankConfig,
  type StarkBankConfig,
} from '../../infra/config/starkbank.config.js';

export interface StarkBankBalance {
  amount: number;
  currency: string;
}

export class StarkBankGateway {
  private readonly config: StarkBankConfig;

  constructor(config?: StarkBankConfig) {
    this.config = config ?? loadStarkBankConfig();
    this.initializeSdk();
  }

  private initializeSdk(): void {
    const project = new starkbank.Project({
      environment: this.config.environment,
      id: this.config.projectId,
      privateKey: this.config.privateKey,
    });

    starkbank.user = project;
  }

  async checkBalance(): Promise<StarkBankBalance> {
    const balance = await starkbank.balance.get();

    return {
      amount: balance.amount,
      currency: balance.currency,
    };
  }
}
