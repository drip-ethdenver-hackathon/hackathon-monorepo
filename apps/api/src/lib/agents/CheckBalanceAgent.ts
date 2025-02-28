import { Agent } from '../framework/Agent';

export class CheckBalanceAgent implements Agent {
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

  async handleTask(args: any): Promise<any> {
    const { coinType } = args;
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1000));
  
    const mockBalances: Record<string, string> = {
      ETH: '1.5',
      USDC: '1000',
      DAI: '750',
    };

    const balance = mockBalances[coinType];
    if (!balance) {
      return {
        success: false,
        message: `Invalid coin type: ${coinType}`
      };
    }

    return {
      success: true,
      message: `Your ${coinType} balance is ${balance}`,
      balance
    };
  }
}
