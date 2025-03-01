"use client";

import React from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import { Button, Card, CardBody, CardFooter, CardHeader, Divider } from "@repo/ui/components";
import BottomNavBar from "../../components/BottomNavbar";
import Logo from "../../components/Logo";
import AuthGuard from "../../components/auth/AuthGuard";
import { useBalance, useReadContracts } from "wagmi";
import { base } from "viem/chains";
import { formatEther, parseEther } from "viem";

export default function HomePage() {
  const { logout, user, getAccessToken } = usePrivy();

  const router = useRouter();

  const handleLogout = async () => {
    try {
      await logout();
      router.push("/");
    } catch (error) {
      console.error("Failed to logout:", error);
    }
  };

  // TODO: Use react-query or SWR mutations here instead of a manual fetch
  const saveUserDetails = async () => {
    const accessToken = await getAccessToken();

    // This will be a proxy call to our external API ultimately
    const response = await fetch("/api/user", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`,
      },
      body: JSON.stringify({}),
    });
    if (response.ok) {
      console.log("User details saved successfully");
    } else {
      console.error("Failed to save user details");
    }
  };

  const { data: balance, isLoading: isBalanceLoading } = useBalance({
    address: user?.smartWallet?.address as `0x${string}`,
    chainId: base.id,
  });

  console.log(balance);

  return (
    <AuthGuard>
      <div className="w-full max-w-md mx-auto p-4 pb-20 bg-white">
        <div className="flex flex-col items-center gap-4 mb-6">
          <Logo />
          <div className="text-center">
            <h1 className="text-2xl font-bold text-primary">Welcome Home</h1>
            <p className="text-default-500">
              {user?.email?.address || user?.phone?.number || "You're logged in!"}
            </p>
          </div>
        </div>

        <Card className="mb-6">
          <CardHeader className="flex gap-3">
            <div className="flex flex-col">
              <p className="text-md font-semibold">Account Overview</p>
              <p className="text-small text-default-500">{user?.smartWallet?.address}</p>
            </div>
          </CardHeader>
          <Divider />
          <CardBody>
            <div className="flex justify-between">
              <span>Available Balance</span>
              <span className="font-semibold">{isBalanceLoading ? "..." : formatEther(balance?.value.toString() || "0")} ETH</span>
            </div>
          </CardBody>
          <CardFooter>
            <Button color="primary" size="sm" className="w-full">
              View Details
            </Button>
          </CardFooter>
        </Card>

        <Card className="mb-6">
          <CardHeader className="flex gap-3">
            <div className="flex flex-col">
              <p className="text-md font-semibold">Quick Actions</p>
              <p className="text-small text-default-500">Common tasks</p>
            </div>
          </CardHeader>
          <Divider />
          <CardBody>
            <div className="grid grid-cols-2 gap-3">
              <Button color="primary" variant="flat">Send Money</Button>
              <Button color="primary" variant="flat">Request</Button>
              <Button color="primary" variant="flat">Earn Yield</Button>
              <Button color="primary" variant="flat">Get Help</Button>
            </div>
          </CardBody>
        </Card>

        <div className="flex justify-center mt-6">
          <Button
            color="danger"
            variant="light"
            onPress={handleLogout}
            size="lg"
            className="px-6"
          >
            Logout
          </Button>
        </div>
      </div>
      <BottomNavBar active="home" />
    </AuthGuard>
  );
} 