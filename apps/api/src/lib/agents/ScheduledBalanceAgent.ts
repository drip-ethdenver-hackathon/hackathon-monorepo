import { Agent } from '../framework/Agent';

export class ScheduledBalanceAgent implements Agent {
  private recentAction: string = 'No recent action.';
  private environment?: any;
  private lastEnvRefresh: number = 0;

  // We'll say we want environment refresh every 5 seconds:
  public environmentUpdateIntervalMs = 5_000;

  getName(): string {
    return 'scheduled_balance_agent';
  }

  getDescription(): string {
    return 'Periodically fetches environment data for updated on-chain balances.';
  }

  getParametersJsonSchema(): object {
    return {
      type: 'object',
      properties: {
        coinType: {
          type: 'string',
        }
      },
      required: ['coinType']
    };
  }

  getContextInfo(): string {
    return this.recentAction;
  }

  /**
   * Optionally initialize environment data. 
   */
  async initializeEnvironment(envData: any): Promise<void> {
    this.environment = envData;
    this.recentAction = `Environment updated for scheduled agent. Possibly pulled new on-chain data.`;
    this.lastEnvRefresh = Date.now();
  }

  /**
   * Decide if environment needs refreshing.
   */
  async shouldUpdateEnvironment(): Promise<boolean> {
    const now = Date.now();
    return (now - this.lastEnvRefresh) >= this.environmentUpdateIntervalMs;
  }

  /**
   * Return the interval we want to be polled on
   */
  getUpdateInterval(): number {
    return this.environmentUpdateIntervalMs;
  }

  async handleTask(args: any): Promise<any> {
    const { coinType } = args;
    // Mock 1s delay to simulate network call
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const mockBalances: Record<string, string> = {
      ETH: '2.75',
      USDC: '1500',
      DAI: '995'
    };

    const balance = mockBalances[coinType];
    if (!balance) {
      this.recentAction = `Invalid coin type: ${coinType}`;
      return {
        success: false,
        message: `Invalid coin type: ${coinType}`
      };
    }

    this.recentAction = `Handled check for ${coinType}, returned ${balance}`;
    return {
      success: true,
      message: `You have ${balance} of ${coinType}.`
    };
  }
}
