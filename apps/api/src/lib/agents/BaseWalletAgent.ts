/**
 * BaseWalletAgent.ts
 * Base class for agents that use AgentKit with wallet functionality.
 */

import { Agent } from "../framework/Agent";
import { 
  AgentKit, 
  AgentKitOptions, 
  CdpWalletProvider, 
  ViemWalletProvider,
  SmartWalletProvider,
  SolanaKeypairWalletProvider,
  WalletProvider,
  walletActionProvider
} from "@coinbase/agentkit";
import { cdpApiActionProvider, pythActionProvider, erc20ActionProvider, erc721ActionProvider } from "@coinbase/agentkit";
import { PrismaClient } from "@repo/database";
import { base } from "viem/chains";
// Initialize Prisma client
const prisma = new PrismaClient();

/**
 * Wallet types supported by the BaseWalletAgent
 */
export enum WalletType {
  CDP = "cdp",
  VIEM = "viem",
  SMART = "smart",
  SOLANA = "solana"
}

/**
 * Configuration for wallet creation/recovery
 */
export interface WalletConfig {
  type: WalletType;
  networkId?: string;
  mnemonicPhrase?: string;
  cdpWalletData?: string;
  privateKey?: string;
  walletId?: string;
  // Additional parameters for specific wallet types
  [key: string]: any;
}

/**
 * BaseWalletAgent implements common wallet functionality for AgentKit-based agents.
 */
export abstract class BaseWalletAgent implements Agent {
  // Store a short description of the most recent action, for logging/debugging.
  protected recentAction: string = "No recent action.";

  // AgentKit instance (or client) that you'll configure in the constructor.
  protected agentKitClient: AgentKit | null = null;

  // Wallet provider instance
  protected walletProvider: WalletProvider | null = null;

  /**
   * @param {string} cdpApiKeyName - The API key name for AgentKit
   * @param {string} cdpApiKeyPrivate - The private API key for AgentKit
   * @param {WalletConfig} walletConfig - Configuration for wallet creation/recovery
   * @param {AgentKitOptions} agentKitOptions - Additional configuration for AgentKit
   */
  constructor(
    protected cdpApiKeyName: string,
    protected cdpApiKeyPrivateKey: string,
    protected walletConfig?: WalletConfig,
    protected agentKitOptions?: AgentKitOptions
  ) {
    // Wallet and AgentKit will be initialized asynchronously
  }

  /**
   * Load wallet data from database
   */
  protected async loadWalletFromDatabase(): Promise<WalletConfig | null> {
    try {
      const agentName = this.getName();
      console.log(`Attempting to load wallet for agent: ${agentName}`);
      
      const wallet = await prisma.agentWallet.findUnique({
        where: { agentName }
      });

      if (!wallet) {
        console.log(`No wallet found for agent: ${agentName}`);
        return null;
      }
      
      console.log(`Found wallet in database for agent: ${agentName}, type: ${wallet.walletType}`);
      this.recentAction = `Loaded wallet data for ${agentName} from database`;
      
      // Parse the wallet data
      const walletData = JSON.parse(wallet.walletData);
      
      // Create the appropriate wallet config based on wallet type
      const config: WalletConfig = {
        type: wallet.walletType as WalletType,
        networkId: wallet.networkId || base.id.toString(),
      };
      
      // Add type-specific data
      if (wallet.walletType === WalletType.CDP) {
        config.cdpWalletData = wallet.walletData;
      } else if (['VIEM', 'SOLANA', 'SMART'].includes(wallet.walletType)) {
        config.privateKey = walletData.privateKey;
      }
      
      console.log(`Successfully loaded wallet config for ${agentName}`);
      return config;
    } catch (err) {
      console.error(`Error loading wallet data for ${this.getName()}:`, err);
      this.recentAction = `Failed to load wallet data: ${String(err)}`;
      return null;
    }
  }

  /**
   * Save wallet data to database
   */
  async saveWalletToDatabase(): Promise<any> {
    if (!this.walletProvider) {
      await this.initializeWallet();
    }

    try {
      // Export wallet data
      const exportResult = await this.exportWallet();
      
      if (!exportResult.success) {
        throw new Error(exportResult.message);
      }
      
      // Get wallet address
      const walletDetails = await this.getWalletDetails();
      console.log('Wallet details:', walletDetails);
      
      // Parse the wallet details string to extract the address
      let address = null;
      if (walletDetails) {
        const addressMatch = walletDetails.details.match(/Address:\s*([0-9a-fA-Fx]+)/);
        console.log('Address match:', addressMatch);
        if (addressMatch && addressMatch[1]) {
          address = addressMatch[1].trim();
        }
      }
      
      // Prepare wallet data for storage
      const agentName = this.getName();
      const walletType = this.walletConfig?.type || WalletType.CDP;
      const networkId = this.walletConfig?.networkId || null;
      
      // Check if wallet already exists for this agent
      const existingWallet = await prisma.agentWallet.findUnique({
        where: { agentName }
      });
      
      if (existingWallet) {
        // Update existing wallet
        const updatedWallet = await prisma.agentWallet.update({
          where: { agentName },
          data: {
            walletType: walletType.toString(),
            walletData: JSON.stringify(exportResult.walletData),
            networkId,
            address,
            updatedAt: new Date()
          }
        });
        
        this.recentAction = `Updated wallet data for ${agentName} in database`;
        
        return {
          success: true,
          message: "Wallet data updated in database"
        };
      } else {
        // Create new wallet
        const newWallet = await prisma.agentWallet.create({
          data: {
            agentName,
            walletType: walletType.toString(),
            walletData: JSON.stringify(exportResult.walletData),
            networkId,
            address
          }
        });
        
        this.recentAction = `Saved wallet data for ${agentName} to database`;
        
        return {
          success: true,
          message: "Wallet data saved to database"
        };
      }
    } catch (err) {
      this.recentAction = `Failed to save wallet data: ${String(err)}`;
      return {
        success: false,
        message: `Failed to save wallet data: ${String(err)}`
      };
    }
  }

  /**
   * Initialize the wallet provider based on configuration
   */
  protected async initializeWallet(): Promise<WalletProvider> {
    if (this.walletProvider) {
      return this.walletProvider;
    }

    try {
      // Try to load wallet from database first
      const dbWalletConfig = await this.loadWalletFromDatabase();
      
      if (dbWalletConfig) {
        console.log(`Found existing wallet for agent ${this.getName()} in database`);
        // Use the database wallet config
        this.walletConfig = { ...this.walletConfig, ...dbWalletConfig };
      } else {
        console.log(`No existing wallet found for agent ${this.getName()}, creating new wallet`);
        // Ensure we have a wallet config
        if (!this.walletConfig) {
          this.walletConfig = { type: WalletType.CDP };
        }
      }

      // Initialize the appropriate wallet provider
      switch (this.walletConfig.type) {
        case WalletType.CDP:
          this.walletProvider = await this.initializeCdpWallet();
          break;
        case WalletType.SMART:
          this.walletProvider = await this.initializeSmartWallet();
          break;
        case WalletType.SOLANA:
          this.walletProvider = await this.initializeSolanaWallet();
          break;
        case WalletType.VIEM:
          this.walletProvider = await this.initializeViemWallet();
          break;
        default:
          throw new Error(`Unsupported wallet type: ${this.walletConfig.type}`);
      }

      this.recentAction = `Initialized ${this.walletConfig.type} wallet provider`;
      
      // Only save to database if we didn't load from it (to avoid circular saves)
      if (!dbWalletConfig) {
        await this.saveWalletToDatabase();
      }
      
      return this.walletProvider;
    } catch (err) {
      this.recentAction = `Failed to initialize wallet: ${String(err)}`;
      console.error("Wallet initialization error:", err);
      throw err;
    }
  }

  /**
   * Initialize a CDP wallet provider
   */
  private async initializeCdpWallet(): Promise<CdpWalletProvider> {

    const config: any = {
      apiKeyName: this.cdpApiKeyName,
      apiKeyPrivateKey: this.cdpApiKeyPrivateKey,
      networkId: 'base-mainnet',
    };

    if (this.walletConfig?.networkId) {
      config.networkId = this.walletConfig.networkId;
    }

    if (this.walletConfig?.mnemonicPhrase) {
      config.mnemonicPhrase = this.walletConfig.mnemonicPhrase;
    }

    // If we have wallet data from the database, use it
    if (this.walletConfig?.cdpWalletData) {
      console.log('Using existing CDP wallet data from database');
      config.cdpWalletData = this.walletConfig.cdpWalletData;
    }

    if (this.walletConfig?.gas) {
      config.gas = this.walletConfig.gas;
    }

    console.log('CDP wallet config:', {
      ...config,
      cdpWalletData: config.cdpWalletData ? '[REDACTED]' : undefined
    });

    return await CdpWalletProvider.configureWithWallet(config);
  }

  /**
   * Initialize a Smart wallet provider
   */
  private async initializeSmartWallet(): Promise<SmartWalletProvider> {
    if (!this.walletConfig?.signer) {
      // If no signer is provided, create one from private key or generate a new one
      const { generatePrivateKey, privateKeyToAccount } = await import("viem/accounts");
      const privateKey = this.walletConfig?.privateKey || generatePrivateKey();
      // Ensure privateKey is in the correct format (0x-prefixed)
      const formattedPrivateKey = privateKey.startsWith('0x') 
        ? privateKey as `0x${string}` 
        : `0x${privateKey}` as `0x${string}`;
      this.walletConfig.signer = privateKeyToAccount(formattedPrivateKey);
    }

    const config: any = {
      signer: this.walletConfig.signer,
    };

    if (this.walletConfig?.networkId) {
      config.networkId = this.walletConfig.networkId;
    }

    if (this.walletConfig?.smartWalletAddress) {
      config.smartWalletAddress = this.walletConfig.smartWalletAddress;
    }

    if (this.walletConfig?.paymasterUrl) {
      config.paymasterUrl = this.walletConfig.paymasterUrl;
    }

    return await SmartWalletProvider.configureWithWallet(config);
  }

  /**
   * Initialize a Solana wallet provider
   */
  private async initializeSolanaWallet(): Promise<SolanaKeypairWalletProvider> {
    if (!this.walletConfig?.privateKey) {
      throw new Error("Solana wallet requires privateKey");
    }

    if (this.walletConfig?.rpcUrl) {
      return await SolanaKeypairWalletProvider.fromRpcUrl(
        this.walletConfig.rpcUrl,
        this.walletConfig.privateKey
      );
    } else {
      // Cast the networkId to the required type
      const networkId = (this.walletConfig?.networkId || "solana-devnet") as any;
      return await SolanaKeypairWalletProvider.fromNetwork(
        networkId,
        this.walletConfig.privateKey
      );
    }
  }

  /**
   * Initialize a Viem wallet provider
   */
  private async initializeViemWallet(): Promise<ViemWalletProvider> {
    // If no client is provided, create one with default settings
    if (!this.walletConfig?.client) {
      try {
        // Import required viem modules
        const { createWalletClient, http } = await import("viem");
        const { generatePrivateKey, privateKeyToAccount } = await import("viem/accounts");
        const { base } = await import("viem/chains");
        
        // Generate a new private key if none is provided
        const privateKey = this.walletConfig?.privateKey || generatePrivateKey();
        
        // Ensure privateKey is in the correct format (0x-prefixed)
        const formattedPrivateKey = privateKey.startsWith('0x') 
          ? privateKey as `0x${string}` 
          : `0x${privateKey}` as `0x${string}`;
        
        // Create an account from the private key
        const account = privateKeyToAccount(formattedPrivateKey);
        
        // Create a wallet client
        const client = createWalletClient({
          account,
          chain: base,
          transport: http(),
        });
        
        // Store the client in the wallet config
        this.walletConfig.client = client;
        
        this.recentAction = "Created default Viem wallet client";
      } catch (err) {
        throw new Error(`Failed to create default Viem wallet client: ${String(err)}`);
      }
    }

    const gasOptions = this.walletConfig?.gas || {};
    return new ViemWalletProvider(this.walletConfig.client, gasOptions);
  }

  /**
   * Initialize the AgentKit client
   */
  protected async initializeAgentKit(): Promise<AgentKit> {
    if (this.agentKitClient) {
      return this.agentKitClient;
    }

    try {
      // Initialize wallet provider if not already done
      if (!this.walletProvider) {
        await this.initializeWallet();
      }

      // Validate required credentials
      if (!this.cdpApiKeyName || !this.cdpApiKeyPrivateKey) {
        throw new Error(
          "Missing required CDP API credentials. Please provide cdpApiKeyName and cdpApiKeyPrivateKey."
        );
      }

      // Create AgentKit instance with the wallet provider
      this.agentKitClient = await AgentKit.from({
        cdpApiKeyName: this.cdpApiKeyName,
        cdpApiKeyPrivateKey: this.cdpApiKeyPrivateKey,
        walletProvider: this.walletProvider,
        ...this.agentKitOptions,
        actionProviders: [
            cdpApiActionProvider({
                apiKeyName: this.cdpApiKeyName,
                apiKeyPrivateKey: this.cdpApiKeyPrivateKey,
            }),
            walletActionProvider(),
            pythActionProvider(),
            erc20ActionProvider(),
            erc721ActionProvider(),
        ],
      });

      this.recentAction = "AgentKit client initialized successfully";
      return this.agentKitClient;
    } catch (err) {
      // Provide more helpful error message for common configuration issues
      let errorMessage = String(err);
      
      if (errorMessage.includes("coinbase_cloud_api_key.json")) {
        errorMessage = "CDP API key file not found. Please ensure you've properly configured your CDP API credentials. " +
          "You need to provide valid cdpApiKeyName and cdpApiKeyPrivateKey values when initializing the agent.";
      }
      
      this.recentAction = `Failed to initialize AgentKit: ${errorMessage}`;
      console.error("AgentKit initialization error:", err);
      throw new Error(errorMessage);
    }
  }

  /**
   * Export the current wallet data for persistence
   */
  async exportWallet(): Promise<any> {
    if (!this.walletProvider) {
      await this.initializeWallet();
    }

    try {
      // Check if the wallet provider has an exportWallet method
      if (typeof (this.walletProvider as any).exportWallet !== 'function') {
        throw new Error("This wallet provider does not support exporting wallet data");
      }
      
      // Call the exportWallet method using type assertion
      const walletData = await (this.walletProvider as any).exportWallet();
      this.recentAction = "Wallet data exported successfully";
      return {
        success: true,
        walletType: this.walletConfig?.type,
        walletData
      };
    } catch (err) {
      this.recentAction = `Failed to export wallet: ${String(err)}`;
      return {
        success: false,
        message: `Failed to export wallet: ${String(err)}`
      };
    }
  }

  /**
   * Get wallet details including address and balance
   */
  async getWalletDetails(): Promise<any> {
    try {
      await this.initializeAgentKit();
      
      // Find the get_wallet_details action
      const actions = this.agentKitClient!.getActions();
      const walletDetailsAction = actions.find(a => a.name === "WalletActionProvider_get_wallet_details");
      
      if (!walletDetailsAction) {
        throw new Error("get_wallet_details action not found");
      }
      
      const result = await walletDetailsAction.invoke({});
      this.recentAction = "Retrieved wallet details successfully";
      
      return {
        success: true,
        details: result
      };
    } catch (err) {
      this.recentAction = `Failed to get wallet details: ${String(err)}`;
      return {
        success: false,
        message: `Failed to get wallet details: ${String(err)}`
      };
    }
  }

  /**
   * Get the native token balance of the wallet
   * @returns Native token balance information
   */
  async getAgentNativeBalance(): Promise<any> {
    try {
      await this.initializeAgentKit();
      
      // Find the wallet details action
      const actions = this.agentKitClient!.getActions();
      const walletDetailsAction = actions.find(a => a.name === "WalletActionProvider_get_wallet_details");
      
      if (!walletDetailsAction) {
        throw new Error("WalletActionProvider_get_wallet_details action not found");
      }
      
      // The result is a string with human readable text
      const result = await walletDetailsAction.invoke({});
      this.recentAction = "Retrieved native token balance";

      console.log('Wallet details result:', result);
      
      // Parse the result string to extract balance information
      let address = '';
      let balance = '0';
      let network = 'unknown';
      let provider = '';
      
      // Parse based on the format shown in the example
      if (typeof result === 'string') {
        // Extract provider
        const providerMatch = result.match(/Provider:\s*([^\n]+)/);
        if (providerMatch && providerMatch[1]) provider = providerMatch[1].trim();
        
        // Extract address
        const addressMatch = result.match(/Address:\s*([0-9a-fA-Fx]+)/);
        if (addressMatch && addressMatch[1]) address = addressMatch[1].trim();
        
        // Extract network info
        const networkMatch = result.match(/Network ID:\s*([^\n]+)/);
        if (networkMatch && networkMatch[1]) network = networkMatch[1].trim();
        
        // Extract balance - looking for format like "Native Balance: 0 WEI"
        const balanceMatch = result.match(/Native Balance:\s*([0-9.]+)\s*([A-Za-z]+)/);
        if (balanceMatch && balanceMatch[1]) {
          const amount = balanceMatch[1];
          const unit = balanceMatch[2];
          
          // Format the balance nicely
          if (unit.toUpperCase() === 'WEI' && amount === '0') {
            balance = '0 ETH';
          } else if (unit.toUpperCase() === 'WEI') {
            // Convert WEI to ETH for better readability
            const ethValue = parseFloat(amount) / 1e18;
            balance = ethValue > 0.00001 ? `${ethValue.toFixed(6)} ETH` : '< 0.00001 ETH';
          } else {
            balance = `${amount} ${unit}`;
          }
        }
      }
      
      return {
        success: true,
        address,
        balance,
        network,
        provider
      };
    } catch (err) {
      this.recentAction = `Failed to get native balance: ${String(err)}`;
      return {
        success: false,
        message: `Failed to get native balance: ${String(err)}`
      };
    }
  }

  /**
   * Get the current wallet balance (convenience property)
   * @returns The current wallet balance as a string, or null if unavailable
   */
  get balance(): Promise<string | null> {
    return this.getAgentNativeBalance()
      .then(result => result.success ? result.balance : null)
      .catch(() => null);
  }

  /**
   * Get the wallet address (convenience property)
   * @returns The current wallet address as a string, or null if unavailable
   */
  get address(): Promise<string | null> {
    return this.getAgentNativeBalance()
      .then(result => result.success ? result.address : null)
      .catch(() => null);
  }

  /**
   * Returns any relevant context or the most recent action for this agent,
   * useful for debugging or agent introspection.
   */
  getContextInfo(): string {
    return this.recentAction;
  }

  // Abstract methods that must be implemented by subclasses
  abstract getName(): string;
  abstract getDescription(): string;
  abstract getParametersJsonSchema(): object;
  abstract handleTask(args: any): Promise<any>;
} 