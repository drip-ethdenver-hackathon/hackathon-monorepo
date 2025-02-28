import { Agent } from '../framework/Agent';

export class ScheduledBalanceAgent implements Agent {
  private recentAction: string = 'No recent action.';
  // For demonstration: store env data + the time we last updated.
  private environment?: any;
  private lastEnvRefresh: number = 0;

  // For example, update environment every 5 seconds:
  public environmentUpdateIntervalMs = 5 * 1000; // 5sec in ms

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
   * e.g. calling an external service to refresh user info.
   */
  async initializeEnvironment(envData: any): Promise<void> {
    this.environment = envData;
    // Suppose we do a mock call to fetch a new "balance snapshot" from envData
    this.recentAction = `Environment updated. Possibly pulled new on-chain data.`;
    this.lastEnvRefresh = Date.now();
  }

  /**
   * Optionally decide if environment needs refreshing.
   * e.g. If it's been more than 5 minutes or if usage count has increased.
   */
  async shouldUpdateEnvironment(): Promise<boolean> {
    const now = Date.now();
    return (now - this.lastEnvRefresh) >= this.environmentUpdateIntervalMs!;
  }

  /**
   * Actually handle the function call.
   */
  async handleTask(args: any): Promise<any> {
    const { coinType } = args;

    // For demonstration: we might rely on environment data to do the check.
    // We also do a short mock delay for an API call or DB retrieval.
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Some mock logic:
    const mockBalances: Record<string, string> = {
      ETH: '2.75',
      USDC: '1500',
      DAI: '995'
    };
    const balance = mockBalances[coinType];

    if (!balance) {
      this.recentAction = `Tried to check invalid coin type: ${coinType}`;
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
