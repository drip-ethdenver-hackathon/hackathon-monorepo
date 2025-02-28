import { Agent } from '../framework/Agent';

export class SendCryptoAgent implements Agent {
  private recentAction: string = 'No recent action.';

  getName(): string {
    return 'send_crypto';
  }

  getDescription(): string {
    return 'Send cryptocurrency to a phone number (MOCK)';
  }

  getParametersJsonSchema(): object {
    return {
      type: 'object',
      properties: {
        phoneNumber: {
          type: 'string',
          description: 'The recipient phone number, e.g. +1234567890'
        },
        amount: {
          type: 'string',
          description: 'The amount of cryptocurrency to send'
        },
        coinType: {
          type: 'string',
          description: 'Type of cryptocurrency',
          enum: ['ETH', 'USDC', 'DAI']
        }
      },
      required: ['phoneNumber', 'amount', 'coinType']
    };
  }

  getContextInfo(): string {
    return this.recentAction;
  }

  async handleTask(args: any): Promise<any> {
    const { phoneNumber, amount, coinType } = args;
    await new Promise(resolve => setTimeout(resolve, 2000));

    if (!phoneNumber.match(/^\+?[\d-]{10,}$/)) {
      this.recentAction = `Failed send: invalid phoneNumber ${phoneNumber}`;
      return {
        success: false,
        message: 'Invalid phone number format'
      };
    }
    this.recentAction = `Sent ${amount} ${coinType} to ${phoneNumber}`;
    return {
      success: true,
      message: `MOCK: Successfully sent ${amount} ${coinType} to ${phoneNumber}`
    };
  }
}
