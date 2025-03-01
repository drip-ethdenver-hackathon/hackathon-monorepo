import { Agent } from '../framework/Agent';
import { prisma } from '@repo/database';
import { createPublicClient, http, formatUnits, erc20Abi } from 'viem';
import { base } from 'viem/chains';

// Common Base tokens
const TOKENS = {
  'ETH': { decimals: 18 },
  'USDC': { 
    address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    decimals: 6
  },
  'USDbC': { 
    address: '0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA',
    decimals: 6
  },
  'DAI': {
    address: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb',
    decimals: 18
  }
} as const;

export class CheckBalanceAgent implements Agent {
  private recentAction: string = 'No recent action.';
  private environment?: { phoneNumber?: string };
  private lastEnvUpdate: number = 0;
  private client: any;

  private environmentUpdateInterval = 5 * 60_1000;

  constructor() {
    this.client = createPublicClient({
      chain: base,
      transport: http()
    });
  }

  getName(): string {
    return 'check_balance';
  }

  getDescription(): string {
    return 'Check cryptocurrency balances on Base chain';
  }

  getParametersJsonSchema(): object {
    return {
      type: 'object',
      properties: {
        coinType: {
          type: 'string',
          enum: ['ALL', ...Object.keys(TOKENS)],
          description: 'Token to check balance for'
        }
      },
      required: ['coinType']
    };
  }

  getContextInfo(): string {
    return this.recentAction;
  }

  async shouldUpdateEnvironment(): Promise<boolean> {
    const now = Date.now();
    return now - this.lastEnvUpdate > this.environmentUpdateInterval;
  }

  async initializeEnvironment(envData: any): Promise<void> {
    this.environment = envData;
    this.lastEnvUpdate = Date.now();
    this.recentAction = 'Environment refreshed with caller phone number.';
  }

  private async getTokenBalance(address: string, token: typeof TOKENS[keyof typeof TOKENS]): Promise<string> {
    if (!('address' in token)) {
   
      const balance = await this.client.getBalance({
        address: address as `0x${string}`
      });
      return formatUnits(balance, token.decimals);
    }

    const balance = await this.client.readContract({
      address: token.address as `0x${string}`,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [address as `0x${string}`]
    });

    return formatUnits(balance, token.decimals);
  }

  async handleTask(args: any): Promise<any> {
    const { coinType } = args;
    const phoneNumber = this.environment?.phoneNumber;

    if (!phoneNumber) {
      this.recentAction = 'No phone number available in environment';
      return {
        success: false,
        message: 'Unable to check balance: No phone number available'
      };
    }

    try {
      const user = await prisma.user.findUnique({
        where: { phone: phoneNumber }
      });

      if (!user) {
        this.recentAction = `No wallet found for phone number: ${phoneNumber}`;
        return {
          success: false,
          message: `No wallet found for this phone number`
        };
      }

      // If they want to see all balances
      if (coinType.toUpperCase() === 'ALL') {
        const balances = await Promise.all(
          Object.entries(TOKENS).map(async ([symbol, token]) => {
            const balance = await this.getTokenBalance(user.wallet, token);
            return { symbol, balance };
          })
        );

        // Filter out zero balances
        const nonZeroBalances = balances.filter(b => parseFloat(b.balance) > 0);
        const balanceList = nonZeroBalances
          .map(b => `${b.symbol}: ${b.balance}`)
          .join(', ');

        this.recentAction = `Checked all balances for wallet ${user.wallet}`;
        return {
          success: true,
          message: balanceList ? `Your balances: ${balanceList}` : 'No non-zero balances found',
          balances: nonZeroBalances
        };
      }

      // Check specific token
      const token = TOKENS[coinType.toUpperCase() as keyof typeof TOKENS];
      if (!token) {
        this.recentAction = `Invalid token: ${coinType}`;
        return {
          success: false,
          message: `Invalid token: ${coinType}`
        };
      }

      const balance = await this.getTokenBalance(user.wallet, token);
      this.recentAction = `Checked ${coinType} balance for wallet ${user.wallet}`;
      
      return {
        success: true,
        message: `Your ${coinType} balance is ${balance}`,
        balance
      };

    } catch (error) {
      console.error('Error in CheckBalanceAgent:', error);
      this.recentAction = `Error checking balance: ${error.message}`;
      return {
        success: false,
        message: 'Failed to check balance'
      };
    }
  }
}