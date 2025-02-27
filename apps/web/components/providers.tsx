'use client';

import PrivyAuthProvider from "./auth/privy-provider";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PrivyAuthProvider>
      {children}
    </PrivyAuthProvider>
  );
}
