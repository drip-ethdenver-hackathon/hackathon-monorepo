import { Agent } from '../framework/Agent';

export class CheckBalanceAgent implements Agent {
  /**
   * Stores last action or context info for UI display.
   */
  private recentAction: string = 'No recent action.';

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

  /**
   * Return the agent's recent activity or context for the UI.
   */
  getContextInfo(): string {
    return this.recentAction;
  }

  async handleTask(args: any): Promise<any> {
    const { coinType } = args;
    await new Promise(resolve => setTimeout(resolve, 1000));
  
    const mockBalances: Record<string, string> = {
      ETH: '1.5',
      USDC: '1000',
      DAI: '750',
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
