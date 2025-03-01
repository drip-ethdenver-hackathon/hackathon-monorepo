 'use client';

 import {PrivyProvider} from '@privy-io/react-auth';
 import {SmartWalletsProvider} from '@privy-io/react-auth/smart-wallets';

export default function Providers({children}: {children: React.ReactNode}) {
  return (
    <PrivyProvider
      appId="cm7nies210005fwqcqoxzuk2f"
      config={{
        // Customize Privy's appearance in your app
        appearance: {
          theme: 'light',
          accentColor: '#676FFF',
          logo: '/public/images/baseline-logo.png',
        },
        // Create embedded wallets for users who don't have a wallet
        embeddedWallets: {
          createOnLogin: 'all-users',
        },
      }}
    >
      <SmartWalletsProvider>
        {children}
      </SmartWalletsProvider>
    </PrivyProvider>
  );
}