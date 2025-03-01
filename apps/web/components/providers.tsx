"use client";

import PrivyAuthProvider from "./auth/privy-provider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createConfig } from "@privy-io/wagmi";
import { base } from "viem/chains";
import { http } from "wagmi";
import { WagmiProvider } from "@privy-io/wagmi";

const queryClient = new QueryClient();

export const config = createConfig({
  chains: [base],
  transports: {
    [base.id]: http(),
  },
});

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PrivyAuthProvider>
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={config}>{children}</WagmiProvider>
      </QueryClientProvider>
    </PrivyAuthProvider>
  );
}
