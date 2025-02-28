import { Agent } from '../framework/Agent';

export class SendCryptoAgent implements Agent {
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

  async handleTask(args: any): Promise<any> {
    // your actual send logic or calls to blockchains, etc.
    // Here, we keep the mock version:
    const { phoneNumber, amount, coinType } = args;

    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 2000));

    if (!phoneNumber.match(/^\+?[\d-]{10,}$/)) {
      return {
        success: false,
        message: 'Invalid phone number format'
      };
    }

    return {
      success: true,
      message: `MOCK: Successfully sent ${amount} ${coinType} to ${phoneNumber}`
    };
  }
}
