"use client";

import React, { ReactNode } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import { Spinner } from "@repo/ui/components";

interface AuthGuardProps {
  children: ReactNode;
  redirectTo?: string;
}

export default function AuthGuard({ 
  children, 
  redirectTo = "/" 
}: AuthGuardProps) {
  const { ready, authenticated } = usePrivy();
  const router = useRouter();
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    if (ready) {
      if (!authenticated) {
        router.push(redirectTo);
      } else {
        setIsLoading(false);
      }
    }
  }, [ready, authenticated, router, redirectTo]);

  if (!ready || isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-white w-full">
        <Spinner size="lg" color="primary" />
      </div>
    );
  }

  return <div className="min-h-screen bg-white w-full">{children}</div>;
} 