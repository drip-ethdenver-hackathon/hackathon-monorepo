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

      if (!wallet) {
        throw new Error(`No wallet found for agent: ${agentName}`);
      }

      return {
        address: wallet.address,
        walletType: wallet.walletType,
        walletData: JSON.parse(wallet.walletData),
        networkId: wallet.networkId
      };
    } catch (err) {
      throw new Error(`Failed to get wallet info for agent ${agentName}: ${String(err)}`);
    }
  }

  /**
   * The main method that performs the agent's work.
   * Transfers funds from one agent's wallet to another.
   */
  async handleTask(args: any): Promise<any> {
    const { fromAgentName, toAgentName, amount, tokenType = "native", tokenAddress } = args;

    // Validate input parameters
    if (tokenType === "erc20" && !tokenAddress) {
      this.recentAction = "Missing token address for ERC20 transfer";
      return {
        success: false,
        message: "Token address is required for ERC20 transfers"
      };
    }

    try {
      // Step 1: Look up wallet information for both agents
      this.recentAction = `Looking up wallet information for agents: ${fromAgentName} and ${toAgentName}`;
      
      const [fromWalletInfo, toWalletInfo] = await Promise.all([
        this.getAgentWalletInfo(fromAgentName),
        this.getAgentWalletInfo(toAgentName)
      ]);

      if (!toWalletInfo.address) {
        throw new Error(`Destination agent ${toAgentName} has no wallet address`);
      }

      // Step 2: Initialize AgentKit with the source agent's wallet
      this.recentAction = `Initializing wallet for source agent: ${fromAgentName}`;
      
      // Create wallet config from the source agent's wallet data
      const walletConfig: WalletConfig = {
        type: fromWalletInfo.walletType.toLowerCase() as WalletType,
        networkId: fromWalletInfo.networkId || undefined
      };

      // Add type-specific data
      if (walletConfig.type === WalletType.CDP) {
        walletConfig.cdpWalletData = JSON.stringify(fromWalletInfo.walletData);
      } else if ([WalletType.VIEM, WalletType.SOLANA, WalletType.SMART].includes(walletConfig.type)) {
        walletConfig.privateKey = fromWalletInfo.walletData.privateKey;
      }

      // Update the wallet config
      this.walletConfig = walletConfig;
      
      // Reset wallet provider to force reinitialization with the new config
      this.walletProvider = null;
      this.agentKitClient = null;

      // Initialize AgentKit with the source agent's wallet
      await this.initializeAgentKit();

      // Step 3: Perform the transfer
      this.recentAction = `Transferring ${amount} ${tokenType === "native" ? "native tokens" : "ERC20 tokens"} from ${fromAgentName} to ${toAgentName}`;
      
      // Find the appropriate action based on token type
      const actions = this.agentKitClient!.getActions();
      const actionName = tokenType === "native" 
        ? "WalletActionProvider_native_transfer" 
        : "ERC20ActionProvider_transfer";
      
      const transferAction = actions.find(a => a.name === actionName);
      
      if (!transferAction) {
        throw new Error(`Action '${actionName}' not found`);
      }
      
      // Prepare action parameters
      const actionParams: any = {
        to: toWalletInfo.address,
        value: amount
      };
      
      // Add ERC20-specific parameters
      if (tokenType === "erc20") {
        actionParams.contractAddress = tokenAddress;
      }
      
      // Execute the transfer
      const response = await transferAction.invoke(actionParams);
      
      this.recentAction = `Successfully transferred ${amount} from ${fromAgentName} to ${toAgentName}`;
      
      return {
        success: true,
        message: `Successfully transferred ${amount} ${tokenType === "native" ? "native tokens" : "ERC20 tokens"} from ${fromAgentName} to ${toAgentName}`,
        transactionDetails: response
      };
    } catch (err: any) {
      this.recentAction = `Transfer failed: ${String(err)}`;
      
      return {
        success: false,
        message: `Failed to transfer funds: ${String(err)}`,
        details: "Please check that both agents have valid wallets and sufficient funds."
      };
    }
  }
} 