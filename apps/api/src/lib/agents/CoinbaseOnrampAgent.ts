import axios from 'axios';
import { BaseWalletAgent } from './BaseWalletAgent';
import dotenv from 'dotenv';

dotenv.config();

interface OnrampArgs {
  purchaseCurrency: string;    // e.g. "BTC", "ETH"
  purchaseNetwork?: string;    // optional, e.g. "ethereum"
  paymentAmount: string;       // e.g. "100.00"
  paymentCurrency: string;     // e.g. "USD"
  paymentMethod: string;       // e.g. "CARD", "APPLE_PAY", etc.
  country: string;             // e.g. "US"
  subdivision?: string;        // e.g. "NY" if country=US
  appId: string;               // e.g. "58a3fa2e-617f-4198-81e7-096f5e498c00"
  destinationAddress: string;  // The address to receive the purchased crypto
  defaultNetwork?: string;     // If you want to set ?defaultNetwork=someNetwork
  userPhone?: string;          // Optional: User's phone number to lookup their wallet
  privyId?: string;            // Optional: User's Privy ID to lookup their wallet
}

/**
 * CoinbaseOnrampAgent
 *
 * Creates a one-click-buy link for the user to purchase crypto
 * via Coinbase Onramp API.
 */
export class CoinbaseOnrampAgent extends BaseWalletAgent {
  constructor(cdpApiKeyName?: string, cdpApiKeyPrivateKey?: string) {
    super(cdpApiKeyName, cdpApiKeyPrivateKey);
  }

  getName(): string {
    return 'coinbase_onramp';
  }

  getDescription(): string {
    return 'Generates a Coinbase Onramp one-click-buy link for purchasing crypto.';
  }

  getParametersJsonSchema(): object {
    return {
      type: 'object',
      properties: {
        purchaseCurrency: {
          type: 'string',
          description: 'ID of the crypto asset to purchase, e.g. "BTC" or "ETH".'
        },
        purchaseNetwork: {
          type: 'string',
          description: 'Optional network name (e.g. "ethereum").'
        },
        paymentAmount: {
          type: 'string',
          description: 'Fiat amount to spend, inclusive of fees, e.g. "100.00".'
        },
        paymentCurrency: {
          type: 'string',
          description: 'Fiat currency code, e.g. "USD".'
        },
        paymentMethod: {
          type: 'string',
          description: 'Payment method, e.g. "CARD", "APPLE_PAY", "ACH_BANK_ACCOUNT", etc.'
        },
        country: {
          type: 'string',
          description: 'ISO two-digit country code, e.g. "US".'
        },
        subdivision: {
          type: 'string',
          description: 'ISO two-digit subdivision code, e.g. "NY" if country="US".'
        },
        appId: {
          type: 'string',
          description: 'Coinbase Onramp App ID, e.g. "58a3fa2e-617f-4198-81e7-096f5e498c00".'
        },
        destinationAddress: {
          type: 'string',
          description: 'Wallet address to deliver purchased crypto.'
        },
        defaultNetwork: {
          type: 'string',
          description: 'Optionally set default network if multiple are available.'
        },
        userPhone: {
          type: 'string',
          description: 'User`s phone number to look up a wallet address, if destinationAddress is not provided.'
        },
        privyId: {
          type: 'string',
          description: 'User`s Privy ID to look up a wallet address, if destinationAddress not provided.'
        }
      },
      required: [
        'purchaseCurrency',
        'paymentAmount',
        'paymentCurrency',
        'paymentMethod',
        'country',
        'appId',
        'destinationAddress'
      ]
    };
  }

  getContextInfo(): string {
    return this.recentAction || 'No recent action.';
  }

  async handleTask(args: OnrampArgs): Promise<any> {
    const {
      purchaseCurrency,
      purchaseNetwork,
      paymentAmount,
      paymentCurrency,
      paymentMethod,
      country,
      subdivision,
      appId,
      destinationAddress,
      defaultNetwork
    } = args;

    try {
      // Use the provided destination address directly
      const targetAddress = destinationAddress;
      
      this.recentAction = `Creating onramp quote for ${purchaseCurrency}...`;

      // 2) Make the Coinbase Onramp Quote API call
      const quotePayload: Record<string, any> = {
        purchase_currency: purchaseCurrency,
        payment_amount: paymentAmount,
        payment_currency: paymentCurrency,
        payment_method: paymentMethod,
        country
      };

      if (purchaseNetwork) {
        quotePayload.purchase_network = purchaseNetwork;
      }

      if (subdivision) {
        quotePayload.subdivision = subdivision;
      }

      // Use your real authentication method or header
      const quoteResp = await axios.post(
        'https://api.developer.coinbase.com/onramp/v1/buy/quote',
        quotePayload,
        {
          headers: {
            'CDP-API-KEY': process.env.CDP_API_KEY,
            'Content-Type': 'application/json'
          },
        }
      );

      const quoteData = quoteResp.data;
      const quoteId = quoteData?.quote_id;
      if (!quoteId) {
        this.recentAction = 'Failed to retrieve quote_id from Coinbase Onramp.';
        return {
          success: false,
          message: 'No quote_id returned in the Onramp quote response.',
          link: null
        };
      }

      // 3) Build the One-Click-Buy URL
      const destinationWallets = encodeURIComponent(
        JSON.stringify([
          {
            address: targetAddress,
            blockchains: [purchaseNetwork || 'ethereum'] // default to "ethereum"
          }
        ])
      );

      let oneClickUrl = `https://pay.coinbase.com/buy/select-asset?appId=${appId}`;
      oneClickUrl += `&destinationWallets=${destinationWallets}`;
      oneClickUrl += `&defaultAsset=${purchaseCurrency}`;
      oneClickUrl += `&defaultPaymentMethod=${paymentMethod}`;
      oneClickUrl += `&fiatCurrency=${paymentCurrency}`;
      oneClickUrl += `&presetFiatAmount=${paymentAmount}`;
      oneClickUrl += `&quoteId=${quoteId}`;

      if (defaultNetwork) {
        oneClickUrl += `&defaultNetwork=${defaultNetwork}`;
      }

      this.recentAction = `Generated one-click-buy link. quote_id=${quoteId}`;

      return {
        success: true,
        message: `Here is your Coinbase Onramp one-click-buy link.`,
        link: oneClickUrl,
        destinationAddress: targetAddress,
        quote: quoteData // if the caller wants the full quote
      };
    } catch (error: any) {
      console.error('Error in CoinbaseOnrampAgent:', error);

      let errorMessage = error.message;
      if (error.response?.data) {
        errorMessage += ` - API response: ${JSON.stringify(error.response.data)}`;
      }

      this.recentAction = `Error creating onramp link: ${errorMessage}`;
      return {
        success: false,
        message: `Failed to create onramp link: ${errorMessage}`,
        link: null
      };
    }
  }
}
