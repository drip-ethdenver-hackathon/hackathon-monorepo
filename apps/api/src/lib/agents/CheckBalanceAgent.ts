import { Agent } from '../framework/Agent';

export class CheckBalanceAgent implements Agent {
  private recentAction: string = 'No recent action.';
  private environment?: any;
  private lastEnvUpdate: number = 0;

  // e.g. refresh every 5 minutes
  private environmentUpdateInterval = 5 * 60_1000;

  getName(): string {
    return 'check_balance';
  }

  getDescription(): string {
    return 'Check the balance of a cryptocurrency (MOCK)';
  }

  getParametersJsonSchema(): object {
    return {
      type: 'object',
      properties: {
        coinType: {
          type: 'string',
          enum: ['ETH', 'USDC', 'DAI']
        }
      },
      required: ['coinType']
    };
  }

  getContextInfo(): string {
    return this.recentAction;
  }

  /**
   * Decide if environment should be updated
   */
  async shouldUpdateEnvironment(): Promise<boolean> {
    const now = Date.now();
    // Simple example: if older than environmentUpdateInterval
    return now - this.lastEnvUpdate > this.environmentUpdateInterval;
  }

  /**
   * Actually refresh environment data
   */
  async initializeEnvironment(envData: any): Promise<void> {
    this.environment = envData;
    this.lastEnvUpdate = Date.now();
    this.recentAction = 'Environment refreshed in CheckBalanceAgent.';
  }

  async handleTask(args: any): Promise<any> {
    const { coinType } = args;

    await new Promise(resolve => setTimeout(resolve, 1000)); // mock delay

    // Possibly read from environment or from a static list
    const mockBalances: Record<string, string> = {
      ETH: '1.5',
      USDC: '1000',
      DAI: '750'
    };

    const balance = mockBalances[coinType];
    if (!balance) {
      this.recentAction = `Failed to check invalid coin type: ${coinType}`;
      return {
        success: false,
        message: `Invalid coin type: ${coinType}`
      };
    }

    this.recentAction = `Checked balance for ${coinType}, found ${balance}`;
    return {
      success: true,
      message: `Your ${coinType} balance is ${balance}`,
      balance
    };
  }
}
