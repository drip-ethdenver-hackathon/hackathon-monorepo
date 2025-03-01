import { Agent } from '../framework/Agent';
import { prisma } from '@repo/database';
import { createPublicClient, http, formatUnits } from 'viem';
import { base, mainnet } from 'viem/chains';

export class CheckBalanceAgent implements Agent {
  private recentAction: string = 'No recent action.';
  private environment?: any;
  private lastEnvUpdate: number = 0;
  private clientBase: any;
  private clientEthereum: any;

  // In-memory cache for CoinGecko API responses (5 minutes)
  private coinGeckoCache: Map<string, { timestamp: number; data: any }> = new Map();
  private cacheDurationMs = 5 * 60_1000;

  // Supported native currency for each chain (whitelisted)
  private chainToCoinSymbol: Record<string, string> = {
    base: 'ethereum',
    ethereum: 'ethereum'
  };

  // Supported currencies fetched from CoinGecko (cached)
  private supportedCurrencies: any[] | null = null;

  // API keys (set on registration)
  private cgApiKey: string;
  private openaiApiKey: string;

  // Environment update interval (if needed)
  private environmentUpdateInterval = 5 * 60_1000;

  constructor(cgApiKey: string, openaiApiKey: string) {
    this.clientBase = createPublicClient({
      chain: base,
      transport: http()
    });
    this.clientEthereum = createPublicClient({
      chain: mainnet,
      transport: http()
    });
    this.cgApiKey = cgApiKey;
    this.openaiApiKey = openaiApiKey;
  }

  getName(): string {
    return 'check_balance';
  }

  getDescription(): string {
    return 'Checks cryptocurrency balances across multiple chains and aggregates portfolio USD value using CoinGecko pricing.';
  }

  getParametersJsonSchema(): object {
    return {
      type: 'object',
      properties: {
        wallets: {
          type: 'object',
          description: 'Mapping from chain names to wallet addresses.',
          properties: {
            base: { type: 'string', description: 'Wallet address on Base chain' },
            ethereum: { type: 'string', description: 'Wallet address on Ethereum chain (optional)' }
          },
          required: ['base']
        },
        userPrompt: {
          type: 'string',
          description: 'A free-text prompt describing your wallet information (if structured data is not provided).'
        }
      },
      oneOf: [
        { required: ['wallets'] },
        { required: ['userPrompt'] }
      ]
    };
  }

  getContextInfo(): string {
    return this.recentAction;
  }

  async shouldUpdateEnvironment(): Promise<boolean> {
    return Date.now() - this.lastEnvUpdate > this.environmentUpdateInterval;
  }

  async initializeEnvironment(envData: any): Promise<void> {
    this.environment = envData;
    this.lastEnvUpdate = Date.now();
    this.recentAction = 'Environment refreshed.';
  }

  private async fetchWithCache(url: string, options: any): Promise<any> {
    const now = Date.now();
    if (this.coinGeckoCache.has(url)) {
      const cached = this.coinGeckoCache.get(url)!;
      if (now - cached.timestamp < this.cacheDurationMs) {
        return cached.data;
      }
    }
    const res = await fetch(url, options);
    const data = await res.json();
    this.coinGeckoCache.set(url, { timestamp: now, data });
    return data;
  }

  private async fetchSupportedCurrencies(): Promise<any[]> {
    if (this.supportedCurrencies) return this.supportedCurrencies;
    const url = 'https://pro-api.coingecko.com/api/v3/coins/list?include_platform=true&status=active';
    const options = {
      method: 'GET',
      headers: {
        accept: 'application/json',
        'x-cg-pro-api-key': this.cgApiKey
      }
    };
    const data = await this.fetchWithCache(url, options);
    this.supportedCurrencies = data;
    return data;
  }

  private async lookupCoinId(tokenSymbol: string): Promise<string | null> {
    const currencies = await this.fetchSupportedCurrencies();
    tokenSymbol = tokenSymbol.toLowerCase();
    const match = currencies.find((coin: any) => coin.symbol.toLowerCase() === tokenSymbol);
    return match ? match.id : null;
  }

  private async getTokenPriceUsd(coinId: string): Promise<number> {
    const url = `https://pro-api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(coinId)}&vs_currencies=usd`;
    const options = {
      method: 'GET',
      headers: {
        accept: 'application/json',
        'x-cg-pro-api-key': this.cgApiKey
      }
    };
    const data = await this.fetchWithCache(url, options);
    if (data && data[coinId] && data[coinId].usd) {
      return data[coinId].usd;
    }
    throw new Error(`USD price not found for coin id: ${coinId}`);
  }

  private async getNativeBalance(client: any, walletAddress: string, decimals: number): Promise<number> {
    const balance = await client.getBalance({ address: walletAddress as `0x${string}` });
    return parseFloat(formatUnits(balance, decimals));
  }

  // Uses OpenAI to extract wallet addresses from a free-text prompt.
  private async determineQueryStructure(userPrompt: string): Promise<any> {
    const url = 'https://api.openai.com/v1/chat/completions';
    const body = {
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: "Extract wallet addresses from the following text. Return a JSON object with a property 'wallets' mapping chain names to wallet addresses. Omit any chain not mentioned."
        },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.0
    };
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.openaiApiKey}`
      },
      body: JSON.stringify(body)
    });
    const data = await response.json();
    let structured;
    try {
      // @ts-ignore
      structured = JSON.parse(data?.choices?.[0].message.content || '{}');
    } catch (e) {
      structured = {};
    }
    return structured;
  }

  async handleTask(args: any): Promise<any> {
    if (args.userPrompt && !args.wallets) {
      const structuredQuery = await this.determineQueryStructure(args.userPrompt);
      if (!structuredQuery.wallets || !structuredQuery.wallets.base) {
        this.recentAction = 'Insufficient wallet addresses extracted from prompt.';
        return {
          success: false,
          message: 'More information needed: Please provide your Base chain wallet address.'
        };
      }
      args.wallets = structuredQuery.wallets;
    }
    const { wallets } = args;
    if (!wallets || !wallets.base) {
      this.recentAction = 'Missing wallet address for Base chain.';
      return {
        success: false,
        message: 'Wallet address for Base chain is required.'
      };
    }
    this.recentAction = 'Initiating balance check across chains.';
    let totalPortfolioUsd = 0;
    let details: { chain: string; balance: number; usdValue: number; usdPrice: number }[] = [];

    for (const chain in wallets) {
      const walletAddress = wallets[chain];
      if (!walletAddress) continue;
      const client = chain.toLowerCase() === 'base' ? this.clientBase : this.clientEthereum;
      const nativeBalance = await this.getNativeBalance(client, walletAddress, 18);
      const coinSymbol = this.chainToCoinSymbol[chain.toLowerCase()];
      if (!coinSymbol) continue;
      const coinId = await this.lookupCoinId(coinSymbol);
      let usdValue = 0;
      let usdPrice = 0;
      if (coinId) {
        try {
          usdPrice = await this.getTokenPriceUsd(coinId);
          usdValue = nativeBalance * usdPrice;
        } catch (err) {
          console.error(`Error fetching USD price for coin id ${coinId}:`, err);
        }
      }
      details.push({ chain, balance: nativeBalance, usdValue, usdPrice });
      totalPortfolioUsd += usdValue;
    }

    const message = `Aggregated portfolio value: $${totalPortfolioUsd.toFixed(2)}.` +
      (Object.keys(wallets).length === 1 ? ' For a fuller view, please provide wallet addresses on additional chains.' : '');
    
    this.recentAction = 'Aggregated portfolio balances checked.';

    return {
      success: true,
      message,
      details,
      totalUsd: totalPortfolioUsd
    };
  }
}
