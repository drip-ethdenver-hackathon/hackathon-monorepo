import { Agent } from '../framework/Agent';
import { prisma } from '@repo/database';
import { BaseWalletAgent } from './BaseWalletAgent';

/**
 * Agent that provides lookup functionality between phone numbers and wallet addresses
 */
export class PhoneWalletLookupAgent extends BaseWalletAgent {
  public recentAction: string = 'No recent action.';

  getName(): string {
    return 'phone_wallet_lookup';
  }

  getDescription(): string {
    return 'Looks up wallet addresses from phone numbers and vice versa based on user registration data.';
  }

  getParametersJsonSchema(): object {
    return {
      type: 'object',
      properties: {
        lookupType: {
          type: 'string',
          enum: ['phone_to_wallet', 'wallet_to_phone', 'check_registration'],
          description: 'The type of lookup to perform'
        },
        phoneNumber: {
          type: 'string',
          description: 'The phone number to look up (required for phone_to_wallet or check_registration)'
        },
        walletAddress: {
          type: 'string',
          description: 'The wallet address to look up (required for wallet_to_phone or check_registration)'
        }
      },
      required: ['lookupType'],
      additionalProperties: false
    };
  }

  getContextInfo(): string {
    return this.recentAction;
  }

  /**
   * Normalize a phone number to a standard format
   */
  private normalizePhoneNumber(phoneNumber: string): string {
    // Remove all non-digit characters except the leading +
    let normalized = phoneNumber.trim();
    
    // Ensure it starts with + if it doesn't already
    if (!normalized.startsWith('+')) {
      // If it starts with a country code without +, add it
      if (/^\d/.test(normalized)) {
        normalized = '+' + normalized;
      }
    }
    
    // Remove any spaces, dashes, or parentheses
    normalized = normalized.replace(/[\s\-()]/g, '');
    
    return normalized;
  }

  async handleTask(args: any): Promise<any> {
    const { lookupType, phoneNumber, walletAddress } = args;

    try {
      // Validate required parameters based on lookup type
      if (lookupType === 'phone_to_wallet' && !phoneNumber) {
        this.recentAction = 'Missing phone number for phone_to_wallet lookup';
        return {
          success: false,
          message: 'Phone number is required for phone_to_wallet lookup'
        };
      }

      if (lookupType === 'wallet_to_phone' && !walletAddress) {
        this.recentAction = 'Missing wallet address for wallet_to_phone lookup';
        return {
          success: false,
          message: 'Wallet address is required for wallet_to_phone lookup'
        };
      }

      if (lookupType === 'check_registration' && !phoneNumber && !walletAddress) {
        this.recentAction = 'Missing both phone number and wallet address for check_registration';
        return {
          success: false,
          message: 'Either phone number or wallet address is required for check_registration'
        };
      }

      // Perform the requested lookup
      switch (lookupType) {
        case 'phone_to_wallet': {
          const normalizedPhone = this.normalizePhoneNumber(phoneNumber);
          this.recentAction = `Looking up wallet for phone: ${normalizedPhone}`;
          
          // Try with full number first
          let user = await prisma.user.findUnique({
            where: { phone: normalizedPhone },
            select: { wallet: true }
          });

          // If not found and number starts with +1, try without +1
          if (!user && normalizedPhone.startsWith('+1')) {
            const withoutPlus = normalizedPhone.slice(1);
            user = await prisma.user.findUnique({
              where: { phone: withoutPlus },
              select: { wallet: true }
            });
          }
          
          if (!user) {
            return {
              success: true,
              found: false,
              message: 'No wallet found for this phone number'
            };
          }
          
          return {
            success: true,
            found: true,
            wallet: user.wallet
          };
        }
        
        case 'wallet_to_phone': {
          const normalizedWallet = walletAddress.toLowerCase();
          this.recentAction = `Looking up phone for wallet: ${normalizedWallet}`;
          
          const user = await prisma.user.findUnique({
            where: { wallet: normalizedWallet },
            select: { phone: true }
          });
          
          if (!user) {
            return {
              success: true,
              found: false,
              message: 'No phone number found for this wallet address'
            };
          }
          
          return {
            success: true,
            found: true,
            phoneNumber: user.phone
          };
        }
        
        case 'check_registration': {
          this.recentAction = 'Checking registration status';
          const result: { phoneRegistered?: boolean; walletRegistered?: boolean } = {};
          
          if (phoneNumber) {
            const normalizedPhone = this.normalizePhoneNumber(phoneNumber);
            const phoneCount = await prisma.user.count({
              where: { phone: normalizedPhone }
            });
            result.phoneRegistered = phoneCount > 0;
          }
          
          if (walletAddress) {
            const normalizedWallet = walletAddress.toLowerCase();
            const walletCount = await prisma.user.count({
              where: { wallet: normalizedWallet }
            });
            result.walletRegistered = walletCount > 0;
          }
          
          return {
            success: true,
            ...result
          };
        }
        
        default:
          this.recentAction = `Invalid lookup type: ${lookupType}`;
          return {
            success: false,
            message: `Invalid lookup type: ${lookupType}`
          };
      }
    } catch (error) {
      this.recentAction = `Error during ${lookupType} lookup: ${String(error)}`;
      console.error('PhoneWalletLookupAgent error:', error);
      
      return {
        success: false,
        message: `Error during lookup: ${String(error)}`
      };
    }
  }
} 