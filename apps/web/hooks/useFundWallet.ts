"use client";

import { useState } from "react";
import { useFundWallet as usePrivyFundWallet } from "@privy-io/react-auth";
import { toast } from "@repo/ui/components";

export interface UseFundWalletResult {
  fundWallet: (address: string) => Promise<void>;
  isFunding: boolean;
  error: Error | null;
}

export const useFundWallet = (): UseFundWalletResult => {
  const [isFunding, setIsFunding] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  const { fundWallet: privyFundWallet } = usePrivyFundWallet({
    onUserExited: (address, chain, fundingMethod, value) => {
      setIsFunding(false);
      
      if (fundingMethod) {
        toast({
          title: "Funding flow exited",
          description: `You exited the ${fundingMethod} funding flow for wallet ${address.slice(0, 6)}...${address.slice(-4)}`,
          variant: "default",
        });
      } else {
        toast({
          title: "Funding flow exited",
          description: "You exited the funding flow before selecting a method",
          variant: "default",
        });
      }
      
      console.log("Funding flow exited:", { address, chain, fundingMethod, value });
    }
  });

  const handleFundWallet = async (address: string) => {
    try {
      setIsFunding(true);
      setError(null);
      
      await privyFundWallet(address);
      
      // Note: We don't set isFunding to false here because the flow is modal-based
      // and will be handled by the onUserExited callback
    } catch (err) {
      setIsFunding(false);
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      
      toast({
        title: "Error funding wallet",
        description: error.message,
        variant: "destructive",
      });
      
      console.error("Error funding wallet:", error);
    }
  };

  return {
    fundWallet: handleFundWallet,
    isFunding,
    error
  };
}; 