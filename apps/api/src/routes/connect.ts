import { Router, Request, Response } from 'express';
import { prisma } from '@repo/database';
import { PrivyClient } from '@privy-io/server-auth';
import dotenv from 'dotenv';

dotenv.config();

const router = Router();

// Initialize Privy client with your API key
const privy = new PrivyClient(process.env.PRIVY_APP_ID || '', process.env.PRIVY_SECRET_KEY || '');

// @ts-ignore
router.post('/', async (req: Request, res: Response) => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(400).json({ error: 'Missing or invalid authorization header' });
    }

    const idToken = authHeader.split(' ')[1];
    
    if (!idToken) {
      return res.status(400).json({ error: 'Missing access token' });
    }

    // Verify the access token and get user ID
    const verifiedClaims = await privy.verifyAuthToken(idToken);
    
    if (!verifiedClaims) {
      return res.status(401).json({ error: 'Invalid access token' });
    }

    // Get user details from Privy using the subject claim
    const userId = verifiedClaims.userId;
    const user = await privy.getUser(userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get phone number from linked accounts
    const phoneAccount = user.linkedAccounts.find(account => 
      account.type === 'phone'
    );

    const phone = phoneAccount?.number;

    // Get wallet address from embedded wallets
    const embeddedWallet = user.linkedAccounts.find(account => 
      account.type === 'smart_wallet'
    );

    const wallet = embeddedWallet?.address;

    if (!phone || !wallet) {
      return res.status(400).json({ 
        error: 'Missing required user information',
        details: { hasPhone: !!phone, hasWallet: !!wallet }
      });
    }

    // Store or update user in database
    const dbUser = await prisma.user.upsert({
      where: { privyId: user.id },
      update: {
        phone: phone.replaceAll(' ', ''),
        wallet: wallet.toLowerCase(),
      },
      create: {
        privyId: user.id,
        phone,
        wallet: wallet.toLowerCase()
      }
    });

    return res.json({
      success: true,
      user: {
        id: dbUser.id,
        phone: dbUser.phone,
        wallet: dbUser.wallet,
        privyId: dbUser.privyId
      }
    });

  } catch (error) {
    console.error('Connect error:', error);
    return res.status(500).json({ 
      error: 'Failed to process login',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

export const connectRouter = router; 