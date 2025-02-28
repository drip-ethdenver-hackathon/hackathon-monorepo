import { Agent } from '../framework/Agent';

export class ExchangeTokensAgent implements Agent {
  getName(): string {
    return 'exchange_tokens';
  }

  getDescription(): string {
    return 'Exchange one cryptocurrency for another (MOCK)';
  }

  getParametersJsonSchema(): object {
    return {
      type: 'object',
      properties: {
        fromToken: {
          type: 'string',
          enum: ['ETH', 'USDC', 'DAI']
        },
        toToken: {
          type: 'string',
          enum: ['ETH', 'USDC', 'DAI']
        },
        amount: {
          type: 'string'
        }
      },
      required: ['fromToken', 'toToken', 'amount']
    };
  }

  async handleTask(args: any): Promise<any> {
    const { fromToken, toToken, amount } = args;
    await new Promise(resolve => setTimeout(resolve, 2000));

    if (fromToken === toToken) {
      return {
        success: false,
        message: 'Cannot exchange a token for itself'
      };
    }

    return {
      success: true,
      message: `MOCK: Successfully exchanged ${amount} ${fromToken} for ${toToken}`
    };
  }
}
