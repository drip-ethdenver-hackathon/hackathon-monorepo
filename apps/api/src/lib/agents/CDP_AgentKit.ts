/**
 * AgentKitBasedAgent.ts
 * Example agent that uses Coinbase's AgentKit.
 */

import { BaseWalletAgent, WalletConfig, WalletType } from "./BaseWalletAgent";
import { AgentKitOptions } from "@coinbase/agentkit";

/**
 * AgentKitBasedAgent implements a full-featured agent using AgentKit
 * with access to all available actions.
 */
export class AgentKitBasedAgent extends BaseWalletAgent {
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
    return "coinbase_agentkit_agent";
  }

  /**
   * A human-friendly description of what this agent does.
   */
  getDescription(): string {
    return "Uses AgentKit to perform on-chain actions including token transfers, NFT operations, and DeFi interactions.";
  }

  /**
   * An optional JSON Schema to describe the parameters that this agent's
   * `handleTask` method expects.
   */
  getParametersJsonSchema(): object {
    return {
      type: "object",
      properties: {
        actionName: {
          type: "string",
          description: "The name of the action to execute. Required for all operations.",
          enum: [
            'CdpApiActionProvider_address_reputation',
            'CdpApiActionProvider_request_faucet_funds',
            'WalletActionProvider_get_wallet_details',
            'WalletActionProvider_native_transfer',
            'PythActionProvider_fetch_price_feed',
            'PythActionProvider_fetch_price',
            'ERC20ActionProvider_get_balance',
            'ERC20ActionProvider_transfer',
            'Erc721ActionProvider_mint',
            'Erc721ActionProvider_transfer',
            'Erc721ActionProvider_get_balance'
          ]
        },
        // Address Reputation Parameters
        network: {
          type: "string",
          description: "The network to check the address on (e.g. 'base-mainnet', 'base-sepolia'). Required for address_reputation.",
          examples: ["base-mainnet", "base-sepolia"]
        },
        address: {
          type: "string",
          description: "The Ethereum address to check reputation for or to check NFT balance for. Required for address_reputation and optional for get_balance."
        },
        
        // Faucet Parameters
        assetId: {
          type: "string",
          description: "The asset ID to request from the faucet. For base-sepolia: 'eth' or 'usdc'. For solana-devnet: 'sol'. Optional for request_faucet_funds.",
          examples: ["eth", "usdc", "sol"]
        },
        
        // Native Transfer Parameters
        value: {
          type: "string",
          description: "The amount to transfer in whole units (e.g. 1 ETH, 0.1 SOL). Required for native_transfer and ERC20_transfer."
        },
        to: {
          type: "string",
          description: "The address to receive the funds or NFT. Required for native_transfer, ERC20_transfer, and NFT operations."
        },
        
        // Pyth Parameters
        symbol: {
          type: "string",
          description: "The token symbol to fetch price feed ID for (e.g. 'BTC', 'ETH'). Required for fetch_price_feed.",
          examples: ["BTC", "ETH", "SOL"]
        },
        priceFeedId: {
          type: "string",
          description: "The Pyth price feed ID to fetch price for. Required for fetch_price."
        },
        
        // ERC20 Parameters
        contractAddress: {
          type: "string",
          description: "The contract address of the token or NFT. Required for ERC20 and NFT operations."
        },
        
        // NFT Parameters
        tokenId: {
          type: "string",
          description: "The ID of the specific NFT to transfer. Required for NFT transfer."
        }
      },
      required: ["actionName"],
      additionalProperties: false
    };
  }

  /**
   * (Optional) Provide info about which model(s) or chain(s) this agent is
   * currently leveraging.
   */
  getReasoningModel?(): string {
    return "Coinbase AgentKit";
  }

  /**
   * List all available actions with their descriptions
   */
  async listAvailableActions(): Promise<any> {
    try {
      await this.initializeAgentKit();
      const actions = this.agentKitClient!.getActions();
      
      const actionList = actions.map(action => ({
        name: action.name,
        description: action.description,
        schema: action.schema
      }));
      
      return {
        success: true,
        actions: actionList
      };
    } catch (err) {
      return {
        success: false,
        message: `Failed to list actions: ${String(err)}`
      };
    }
  }

  /**
   * The main method that performs the agent's work.
   * Executes the specified action with the provided parameters.
   */
  async handleTask(args: any): Promise<any> {
    const { actionName, ...actionParams } = args;

    console.log('actionName', actionName);
    console.log('actionParams', actionParams);
    
    // Update recentAction for diagnostic or logging
    this.recentAction = `AgentKitBasedAgent received request for action: ${actionName || 'list actions'}`;
    
    try {
      // Initialize AgentKit if not already done
      try {
        await this.initializeAgentKit();
      } catch (initError) {
        return {
          success: false,
          message: `Failed to initialize AgentKit: ${String(initError)}`,
          details: "Please check your CDP API credentials and ensure they are correctly configured."
        };
      }

      // If no action name is provided, list all available actions
      if (!actionName) {
        return await this.listAvailableActions();
      }

      // Get all available actions from AgentKit
      const actions = this.agentKitClient!.getActions();
      
      // Find the requested action
      const action = actions.find(a => a.name === actionName);
      
      if (!action) {
        throw new Error(`Action '${actionName}' not found. Available actions: ${actions.map(a => a.name).join(', ')}`);
      }
      
      // Execute the action with provided parameters
      const response = await action.invoke(actionParams);
      console.log("Response from action:", response);
      this.recentAction = `Executed AgentKit action '${actionName}'`;

      return {
        success: true,
        action: actionName,
        result: response
      };
    } catch (err: any) {
      this.recentAction = `AgentKit handleTask failed: ${String(err)}`;
      
      // Provide more helpful error messages for common issues
      let errorMessage = String(err);
      let details = "";
      
      if (errorMessage.includes("coinbase_cloud_api_key.json")) {
        errorMessage = "CDP API key file not found";
        details = "Please ensure you've properly configured your CDP API credentials in the environment or when initializing the agent.";
      } else if (errorMessage.includes("Invalid configuration")) {
        details = "Check that your CDP API credentials are valid and have the necessary permissions.";
      } else if (errorMessage.includes("required parameter")) {
        details = "Make sure you've provided all required parameters for this action.";
      }
      
      return {
        success: false,
        message: `Failed executing action '${actionName}': ${errorMessage}`,
        details: details
      };
    }
  }

  /**
   * Validate that all required parameters are provided for a given action
   */
  private validateRequiredParams(actionName: string, params: any): string[] {
    const missingParams: string[] = [];
    
    switch (actionName) {
      case 'CdpApiActionProvider_address_reputation':
        if (!params.network) missingParams.push('network');
        if (!params.address) missingParams.push('address');
        break;
        
      case 'WalletActionProvider_native_transfer':
        if (!params.amount) missingParams.push('amount');
        if (!params.destination) missingParams.push('destination');
        break;
        
      case 'PythActionProvider_fetch_price_feed':
        if (!params.symbol) missingParams.push('symbol');
        break;
        
      case 'PythActionProvider_fetch_price':
        if (!params.priceFeedId) missingParams.push('priceFeedId');
        break;
        
      case 'ERC20ActionProvider_get_balance':
        if (!params.contractAddress) missingParams.push('contractAddress');
        break;
        
      case 'ERC20ActionProvider_transfer':
        if (!params.amount) missingParams.push('amount');
        if (!params.contractAddress) missingParams.push('contractAddress');
        if (!params.destination) missingParams.push('destination');
        break;
        
      case 'Erc721ActionProvider_mint':
        if (!params.contractAddress) missingParams.push('contractAddress');
        if (!params.destination) missingParams.push('destination');
        break;
        
      case 'Erc721ActionProvider_transfer':
        if (!params.contractAddress) missingParams.push('contractAddress');
        if (!params.tokenId) missingParams.push('tokenId');
        if (!params.destination) missingParams.push('destination');
        break;
        
      case 'Erc721ActionProvider_get_balance':
        if (!params.contractAddress) missingParams.push('contractAddress');
        break;
    }
    
    return missingParams;
  }
}
