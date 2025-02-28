"use client";

import React from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import AuthLayout from "../components/layouts/AuthLayout";
import PhoneLoginCard from "../components/login/PhoneCardLogin";

export default function LoginPage() {
  const { ready, authenticated } = usePrivy();
  const router = useRouter();

  React.useEffect(() => {
    if (ready && authenticated) {
      router.push("/home");
    }
  }, [ready, authenticated, router]);

  if (!ready) {
    return null;
  }

  return (
    <AuthLayout>
      <PhoneLoginCard />
    </AuthLayout>
  );
}
