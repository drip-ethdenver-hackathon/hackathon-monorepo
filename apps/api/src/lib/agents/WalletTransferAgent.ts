import { Agent } from '../framework/Agent';
import { BaseWalletAgent, WalletConfig, WalletType } from './BaseWalletAgent';
import { prisma } from '@repo/database';
import { AgentKitOptions } from '@coinbase/agentkit';

// Initialize Prisma clien
/**
 * WalletTransferAgent allows transferring funds between agent wallets
 * by looking up wallet information from the database.
 */
export class WalletTransferAgent extends BaseWalletAgent {
  /**
   * @param {string} cdpApiKeyName - The API key name for AgentKit
   * @param {string} cdpApiKeyPrivateKey - The private API key for AgentKit
   * @param {WalletConfig} walletConfig - Configuration for wallet creation/recovery
   * @param {AgentKitOptions} agentKitOptions - Additional configuration for AgentKit
   */
  constructor(
    cdpApiKeyName: string,
    cdpApiKeyPrivateKey: string,
    walletConfig?: WalletConfig,
    agentKitOptions?: AgentKitOptions
  ) {
    super(cdpApiKeyName, cdpApiKeyPrivateKey, walletConfig, agentKitOptions);
  }

  /**
   * The unique name of this agent.
   */
  getName(): string {
    return "wallet_transfer_agent";
  }

  /**
   * A human-friendly description of what this agent does.
   */
  getDescription(): string {
    return "Transfers funds (native or ERC20 tokens) between agent wallets by looking up wallet information from the database.";
  }

  /**
   * JSON Schema for the parameters that this agent's handleTask method expects.
   */
  getParametersJsonSchema(): object {
    return {
      type: "object",
      properties: {
        fromAgentName: {
          type: "string",
          description: "The name of the source agent whose wallet will send the funds."
        },
        toAgentName: {
          type: "string",
          description: "The name of the destination agent whose wallet will receive the funds."
        },
        amount: {
          type: "string",
          description: "The amount to transfer in whole units (e.g. 0.1 ETH)."
        },
        tokenType: {
          type: "string",
          description: "The type of token to transfer.",
          enum: ["native", "erc20"],
          default: "native"
        },
        tokenAddress: {
          type: "string",
          description: "The contract address of the ERC20 token (required if tokenType is 'erc20')."
        }
      },
      required: ["fromAgentName", "toAgentName", "amount"],
      additionalProperties: false
    };
  }

  /**
   * Look up wallet information for an agent from the database
   */
  private async getAgentWalletInfo(agentName: string): Promise<any> {
    try {
      const wallet = await prisma.agentWallet.findUnique({
        where: { agentName }
      });

      console.log('agentName', agentName);
      console.log('wallet', wallet);

      if (!wallet) {
        throw new Error(`No wallet found for agent: ${agentName}`);
      }

      // Parse the wallet data - it's stored as a JSON string
      let walletData;
      try {
        walletData = JSON.parse(wallet.walletData);
      } catch (err) {
        throw new Error(`Invalid wallet data format for agent ${agentName}: ${String(err)}`);
      }

      return {
        address: wallet.address,
        walletType: wallet.walletType,
        walletData: walletData,
        networkId: wallet.networkId || walletData.networkId // Use networkId from walletData if not set in the wallet record
      };
    } catch (err) {
      throw new Error(`Failed to get wallet info for agent ${agentName}: ${String(err)}`);
    }
  }

  /**
   * Get the wallet address for an agent
   * This will use AgentKit to derive the address if it's not stored in the database
   */
  private async getWalletAddress(walletInfo: any): Promise<string> {
    // If we already have an address, return it
    if (walletInfo.address) {
      return walletInfo.address;
    }
    
    // Otherwise, we need to temporarily configure this agent with the wallet
    // to get its address
    const originalConfig = this.walletConfig;
    const originalProvider = this.walletProvider;
    const originalClient = this.agentKitClient;
    
    try {
      // Create a temporary wallet config
      const tempConfig: WalletConfig = {
        type: walletInfo.walletType.toLowerCase() as WalletType,
        networkId: walletInfo.networkId
      };
      
      // Add type-specific data
      if (tempConfig.type === WalletType.CDP) {
        tempConfig.cdpWalletData = JSON.stringify(walletInfo.walletData);
      } else if ([WalletType.VIEM, WalletType.SOLANA, WalletType.SMART].includes(tempConfig.type)) {
        if (walletInfo.walletData.privateKey) {
          tempConfig.privateKey = walletInfo.walletData.privateKey;
        } else if (walletInfo.walletData.seed) {
          tempConfig.privateKey = walletInfo.walletData.seed;
        }
      }
      
      // Update the wallet config
      this.walletConfig = tempConfig;
      this.walletProvider = null;
      this.agentKitClient = null;
      
      // Initialize AgentKit with this wallet
      await this.initializeAgentKit();
      
      // Get the wallet details to extract the address
      const details = await this.getAgentNativeBalance();
      
      if (!details.success || !details.address) {
        throw new Error("Failed to get wallet address");
      }
      
      return details.address;
    } finally {
      // Restore the original configuration
      this.walletConfig = originalConfig;
      this.walletProvider = originalProvider;
      this.agentKitClient = originalClient;
    }
  }

  /**
   * The main method that performs the agent's work.
   * Transfers funds from one agent's wallet to another.
   */
  async handleTask(args: any): Promise<any> {
    const { fromAgentName, toAgentName, amount, tokenType = "native", tokenAddress } = args;

    // Validate required parameters
    if (!fromAgentName) {
      return { success: false, message: "Source agent name (fromAgentName) is required" };
    }
    if (!toAgentName) {
      return { success: false, message: "Destination agent name (toAgentName) is required" };
    }
    if (!amount) {
      return { success: false, message: "Amount to transfer is required" };
    }
    if (tokenType === "erc20" && !tokenAddress) {
      return { success: false, message: "Token address is required for ERC20 transfers" };
    }

    try {
      // Step 1: Look up wallet information for both agents
      this.recentAction = `Looking up wallet information for ${fromAgentName} and ${toAgentName}`;
      
      const fromWalletInfo = await this.getAgentWalletInfo(fromAgentName);
      const toWalletInfo = await this.getAgentWalletInfo(toAgentName);
      
      console.log('Source wallet info:', fromWalletInfo);
      console.log('Destination wallet info:', toWalletInfo);
      
      // Step 2: Create a new AgentKit client directly from the seed
      this.recentAction = `Creating AgentKit client for ${fromAgentName}`;
      
      // Import AgentKit
      const { AgentKit } = await import("@coinbase/agentkit");
      
      // Create a CdpWalletProvider directly instead of using AgentKit.from
      const { CdpWalletProvider } = await import("@coinbase/agentkit");

      // For source wallet
      const sourceWalletProvider = await CdpWalletProvider.configureWithWallet({
        apiKeyName: this.cdpApiKeyName,
        apiKeyPrivateKey: this.cdpApiKeyPrivateKey,
        networkId: fromWalletInfo.walletData.networkId,
        cdpWalletData: JSON.stringify(fromWalletInfo.walletData)
      });

      // Then create the AgentKit instance with this provider
      const sourceAgentKit = await AgentKit.from({
        cdpApiKeyName: this.cdpApiKeyName,
        cdpApiKeyPrivateKey: this.cdpApiKeyPrivateKey,
        walletProvider: sourceWalletProvider
      });
      
      // Step 3: Get the destination address
      let destinationAddress = toWalletInfo.address;
      if (!destinationAddress) {
        this.recentAction = "Looking up destination wallet address";
        
        // Create a temporary wallet provider for the destination wallet
        const destWalletProvider = await CdpWalletProvider.configureWithWallet({
          apiKeyName: this.cdpApiKeyName,
          apiKeyPrivateKey: this.cdpApiKeyPrivateKey,
          networkId: toWalletInfo.walletData.networkId,
          cdpWalletData: JSON.stringify(toWalletInfo.walletData)
        });
        
        // Get the wallet address directly from the provider
        destinationAddress = await destWalletProvider.getAddress();
        
        if (!destinationAddress) {
          throw new Error(`Could not determine address for destination agent ${toAgentName}`);
        }
        
        console.log('Retrieved destination address:', destinationAddress);
      }

      console.log('Destination address:', destinationAddress);

      // Step 4: Perform the transfer
      this.recentAction = `Transferring ${amount} ${tokenType === "native" ? "native tokens" : "ERC20 tokens"} from ${fromAgentName} to ${toAgentName}`;
      
      // Find the appropriate action based on token type
      const actions = sourceAgentKit.getActions();
      console.log('Available actions:', actions.map(a => a.name));
      
      const actionName = tokenType === "native" 
        ? "WalletActionProvider_native_transfer" 
        : "ERC20ActionProvider_transfer";
      
      const transferAction = actions.find(a => a.name === actionName);
      
      if (!transferAction) {
        throw new Error(`Action '${actionName}' not found`);
      }
      
      // Prepare action parameters
      const actionParams: any = {
        to: destinationAddress,
        value: amount
      };
      
      console.log('Action parameters:', actionParams);
      
      // Add ERC20-specific parameters
      if (tokenType === "erc20") {
        actionParams.contractAddress = tokenAddress;
      }
      
      // Execute the transfer
      const response = await transferAction.invoke(actionParams);
      
      console.log('Transfer response:', response);
      
      this.recentAction = `Successfully transferred ${amount} from ${fromAgentName} to ${toAgentName}`;
      
      return {
        success: true,
        message: `Successfully transferred ${amount} ${tokenType === "native" ? "native tokens" : "ERC20 tokens"} from ${fromAgentName} to ${toAgentName}`,
        transactionDetails: response
      };
    } catch (err: any) {
      this.recentAction = `Transfer failed: ${String(err)}`;
      console.error('Transfer error:', err);
      
      return {
        success: false,
        message: `Failed to transfer funds: ${String(err)}`,
        details: "Please check that both agents have valid wallets and sufficient funds."
      };
    }
  }
} 