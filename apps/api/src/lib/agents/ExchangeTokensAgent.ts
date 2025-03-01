import { Agent } from '../framework/Agent';

export class ExchangeTokensAgent implements Agent {
  private recentAction: string = 'No recent action.';
  private environment?: any;

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

  getContextInfo(): string {
    return this.recentAction;
  }

  async shouldUpdateEnvironment?(): Promise<boolean> {
    // We typically do not do environment refresh for Exchange.
    return false;
  }

  async initializeEnvironment?(envData: any): Promise<void> {
    this.environment = envData;
    this.recentAction = 'Environment init for ExchangeTokensAgent.';
  }



  async handleTask(args: any): Promise<any> {
    const { fromToken, toToken, amount } = args;
    await new Promise((resolve) => setTimeout(resolve, 2000));

    if (fromToken === toToken) {
      this.recentAction = `Attempted exchange from ${fromToken} to same token. Failure.`;
      return {
        success: false,
        message: 'Cannot exchange a token for itself'
      };
    }

    this.recentAction = `Exchanged ${amount} ${fromToken} -> ${toToken}`;
    return {
      success: true,
      message: `MOCK: Successfully exchanged ${amount} ${fromToken} for ${toToken}`
    };
  }
}
