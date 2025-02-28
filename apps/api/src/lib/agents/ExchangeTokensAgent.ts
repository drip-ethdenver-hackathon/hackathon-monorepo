import { Agent } from '../framework/Agent';

export class ExchangeTokensAgent implements Agent {
  /**
   * Stores last action or context info for display in UI modals.
   */
  private recentAction: string = 'No recent action.';

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

  /**
   * Provide a short textual context or "recent activity"
   * that can be shown in the UI (the agent modal).
   */
  getContextInfo(): string {
    return this.recentAction;
  }

  async handleTask(args: any): Promise<any> {
    const { fromToken, toToken, amount } = args;
    await new Promise(resolve => setTimeout(resolve, 2000));

    if (fromToken === toToken) {
      this.recentAction = `Attempted exchange from ${fromToken} to same token. Failure.`;
      return {
        success: false,
        message: 'Cannot exchange a token for itself'
      };
    }

    this.recentAction = `Exchanged ${amount} ${fromToken} -> ${toToken}.`;
    return {
      success: true,
      message: `MOCK: Successfully exchanged ${amount} ${fromToken} for ${toToken}`
    };
  }
}
