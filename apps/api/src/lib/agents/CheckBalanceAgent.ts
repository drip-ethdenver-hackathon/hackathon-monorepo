import { Agent } from "../framework/Agent";
import { prisma } from "@repo/database";
import { createPublicClient, http, formatUnits, erc20Abi } from "viem";
import { arbitrum, abstract, optimism, mainnet, unichain, zkSync, flowMainnet } from "viem/chains";
import { BaseWalletAgent } from "./BaseWalletAgent";
import dotenv from "dotenv";

dotenv.config();

export class CheckBalanceAgent extends BaseWalletAgent {
  public recentAction: string = "No recent action.";
  private environment?: any;
  private lastEnvUpdate: number = 0;
  private coinGeckoCache: Map<string, { timestamp: number; data: any }> = new Map();
  private cacheDurationMs = 5 * 60_1000;

  private chainToCoinSymbol: Record<string, string> = {
    ethereum: "ethereum",
    arbitrum: "ethereum",
    optimism: "ethereum",
    abstract: "ethereum",
    zkSync: "ethereum",
    unichain: "ethereum",
    flow: "ethereum",
  };

  private supportedCurrencies: any[] | null = null;
  private cgApiKey: string;
  private openaiApiKey: string;
  private environmentUpdateInterval = 5 * 60_1000;

  private clientCache: Record<string, any> = {};

  private chainToConstant: Record<string, any> = {
    ethereum: mainnet,
    arbitrum: arbitrum,
    optimism: optimism,
    abstract: abstract,
    zkSync: zkSync,
    unichain: unichain,
    flow: flowMainnet,
  };

  private erc20Whitelist: Record<string, Record<string, { address: string; decimals: number }>> = {
    ethereum: {
      USDC: { address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606EB48", decimals: 6 },
      DAI: { address: "0x6B175474E89094C44Da98b954EedeAC495271d0F", decimals: 18 },
      USDT: { address: "0xdAC17F958D2ee523a220620607b0FEdE7Fa8bCCf3975", decimals: 6 },
    },
    base: {
      USDC: { address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", decimals: 6 },
    },
    arbitrum: {
      USDC: { address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", decimals: 6 },
    },
    optimism: {
      USDC: { address: "0x0b2c639c533813f4aa9d7837caf62653d097ff85", decimals: 6 },
    },
    zkSync: {
      USDC: { address: "0x1d17CBcF0D6D143135aE902365D2E5e2A16538D4", decimals: 6 },
    },
    unichain: {
      USDC: { address: "0x31d0220469e10c4E71834a79b1f276d740d3768F", decimals: 6 },
    },
    abstract: {
      USDC: { address: "0x84a71ccd554cc1b02749b35d22f684cc8ec987e1", decimals: 6 },
    },
  };

  constructor(cgApiKey: string, openaiApiKey: string) {
    super(process.env.CDP_API_KEY_NAME || "", process.env.CDP_API_KEY_PRIVATE || "");
    this.cgApiKey = cgApiKey;
    this.openaiApiKey = openaiApiKey;
  }

  getName(): string {
    return "check_balance";
  }

  getDescription(): string {
    return "Checks native cryptocurrency and whitelisted ERC20 token balances across supported chains and aggregates portfolio USD value using CoinGecko pricing.";
  }

  getParametersJsonSchema(): object {
    return {
      type: "object",
      properties: {
        wallet: {
          type: "string",
          description: "Wallet address or ENS name. If you don't have a wallet address, use the user phone lookup agent to get their wallet address first"
        },
        erc20s: {
          type: "array",
          items: { type: "string" },
          description: "Optional list of ERC20 token symbols to check."
        },
        userPrompt: {
          type: "string",
          description: "Free-text prompt describing your wallet information (if wallet is not provided)."
        }
      }
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
    this.recentAction = "Environment refreshed.";
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
    
    const url = "https://pro-api.coingecko.com/api/v3/coins/list?include_platform=false&status=active";

    const options = {
      method: "GET",
      headers: {
        accept: "application/json",
        "x-cg-pro-api-key": this.cgApiKey
      }
    };

    const data = await this.fetchWithCache(url, options);
    
    this.supportedCurrencies = data;

    return data;
  }

  private async lookupCoinId(name: string): Promise<string | null> {

    const currencies = await this.fetchSupportedCurrencies();
  
    const match = currencies.find((coin: any) => coin.name.toLowerCase() === name);
    // console.log({ currencies , name});
    return match ? match.id : null;
  }

  private async getTokenPriceUsd(coinId: string): Promise<number> {
    const url = `https://pro-api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(coinId)}&vs_currencies=usd`;

    const data = await this.fetchWithCache(url, {
      method: "GET",
      headers: {
        accept: "application/json",
        "x-cg-pro-api-key": this.cgApiKey
      }
    });

    console.log(data);

    if (data && data[coinId] && data[coinId].usd) {
      return Number(data[coinId].usd);
    }
    
    throw new Error(`USD price not found for coin id: ${coinId}`);
  }

  private async getNativeBalance(client: any, walletAddress: string, decimals: number): Promise<number> {
    const resolvedAddress = await this.resolveWalletAddress(client, walletAddress);
    const balance = await client.getBalance({ address: resolvedAddress as `0x${string}` });
    return parseFloat(formatUnits(balance, decimals));
  }

  private async resolveWalletAddress(client: any, wallet: string): Promise<string> {
    
    if (wallet.startsWith("0x")) {
      return wallet;
    }

    try {
      const resolved = await client.getEnsAddress({ name: wallet });
      return resolved || wallet;
    } catch (e) {
      return wallet;
    }
  }

  private async determineQueryStructure(userPrompt: string): Promise<any> {
    const url = "https://api.openai.com/v1/chat/completions";

    const body = {
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content:
            "Extract the wallet address from the following text. Return a JSON object with a property 'wallet' containing the wallet address. Omit any other data.",
        },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.0
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.openaiApiKey}`,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    
    let structured;
    
    try {
      // @ts-ignore
      structured = JSON.parse(data?.choices?.[0].message.content || "{}");
    } catch (e) {
      structured = {};
    }
    return structured;
  }

  private getClientForChain(chain: string): any {
    const lowerChain = chain.toLowerCase();

    if (this.clientCache[lowerChain]) {
      return this.clientCache[lowerChain];
    }
    
    const chainConstant = this.chainToConstant[lowerChain] || mainnet;
    const client = createPublicClient({ chain: chainConstant, transport: http() });
    
    this.clientCache[lowerChain] = client;
    return client;
  }

  // Get ERC20 token balance using the ERC20 contract's "balanceOf" method.
  private async getErc20Balance(client: any, walletAddress: string, token: { address: string; decimals: number }): Promise<number> {
    const balance = await client.readContract({
      address: token.address as `0x${string}`,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [walletAddress as `0x${string}`]
    });
    return parseFloat(formatUnits(balance, token.decimals));
  }

  async handleTask(args: any): Promise<any> {
    // If a free-text prompt is provided and wallet is missing, extract the wallet using LLM.
    if (args.userPrompt && !args.wallet) {
      const structuredQuery = await this.determineQueryStructure(args.userPrompt);
      if (!structuredQuery.wallet) {
        this.recentAction = "Wallet address could not be extracted from prompt.";
        return {
          success: false,
          message: "More information needed: Please provide your wallet address."
        };
      }
      args.wallet = structuredQuery.wallet;
    }

    const wallet = args.wallet;
    if (!wallet) {
      this.recentAction = "No wallet address provided.";
      return {
        success: false,
        message: "A wallet address must be provided."
      };
    }

    this.recentAction = "Initiating balance check across chains.";

    let totalPortfolioUsd = 0;

    let details: {
      chain: string;
      nativeBalance: number;
      nativeUsdValue: number;
      nativeUsdPrice: number;
      erc20s?: { token: string; balance: number; usdValue: number; usdPrice: number }[];
    }[] = [];

    for (const chain of Object.keys(this.chainToConstant)) {
      const client = this.getClientForChain(chain);
      const nativeBalance = await this.getNativeBalance(client, wallet, 18);
      const coinSymbol = this.chainToCoinSymbol[chain.toLowerCase()] || "ethereum";
      const coinId = await this.lookupCoinId(coinSymbol);
      
      let nativeUsdPrice = 0;
      let nativeUsdValue = 0;
      
      if (coinId) {
        try {
          nativeUsdPrice = await this.getTokenPriceUsd(coinId);
          nativeUsdValue = nativeBalance * nativeUsdPrice;
        } catch (err) {
          console.error(`Error fetching USD price for coin id ${coinId}:`, err);
        }
      }

      let erc20Results: { token: string; balance: number; usdValue: number; usdPrice: number }[] = [];

      if (args.erc20s && this.erc20Whitelist[chain.toLowerCase()]) {
        const whitelist = this.erc20Whitelist[chain.toLowerCase()];
        for (const tokenSymbol of args.erc20s) {
          if (whitelist[tokenSymbol]) {
            const tokenData = whitelist[tokenSymbol];

            try {
              const tokenBalance = await this.getErc20Balance(client, wallet, tokenData);
              const tokenId = await this.lookupCoinId(tokenSymbol);
              
              let tokenUsdPrice = 0;
              let tokenUsdValue = 0;

              if (tokenId) {
                tokenUsdPrice = await this.getTokenPriceUsd(tokenId);
                tokenUsdValue = tokenBalance * tokenUsdPrice;
              }
              
              erc20Results.push({
                token: tokenSymbol,
                balance: tokenBalance,
                usdPrice: tokenUsdPrice,
                usdValue: tokenUsdValue
              });
              totalPortfolioUsd += tokenUsdValue;
            } catch (err) {
              console.error(`Error fetching balance or price for ERC20 token ${tokenSymbol} on chain ${chain}:`, err);
            }
          }
        }
      }

      details.push({
        chain,
        nativeBalance,
        nativeUsdPrice,
        nativeUsdValue,
        erc20s: erc20Results.length ? erc20Results : undefined
      });
      totalPortfolioUsd += nativeUsdValue;
    }

    const message =
      `Aggregated portfolio value: $${totalPortfolioUsd.toFixed(2)}.` +
      (Object.keys(this.chainToConstant).length === 1
        ? " For a fuller view, please check balances on additional chains."
        : "");

    this.recentAction = "Aggregated portfolio balances checked.";
    return {
      success: true,
      message,
      details,
      totalUsd: totalPortfolioUsd,
    };
  }
}
