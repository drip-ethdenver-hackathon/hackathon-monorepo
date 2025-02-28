"use client";

import React from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import { 
  Button, 
  Card, 
  CardBody, 
  CardHeader, 
  Divider, 
  Avatar,
  Switch
} from "@repo/ui/components";
import BottomNavBar from "../../components/BottomNavbar";
import Logo from "../../components/Logo";
import AuthGuard from "../../components/auth/AuthGuard";

export default function ProfilePage() {
  const { user, logout } = usePrivy();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await logout();
      router.push("/");
    } catch (error) {
      console.error("Failed to logout:", error);
    }
  };

  return (
    <AuthGuard>
      <div className="w-full max-w-md mx-auto p-4 pb-20 bg-white">
        <div className="flex flex-col items-center gap-4 mb-6">
          <Logo />
          <div className="text-center">
            <h1 className="text-2xl font-bold text-primary">Your Profile</h1>
            <p className="text-default-500">
              Manage your account settings
            </p>
          </div>
        </div>

        <Card className="mb-6">
          <CardHeader className="flex gap-3">
            <Avatar 
              name={user?.email?.address?.charAt(0) || "U"} 
              size="lg"
              color="primary"
            />
            <div className="flex flex-col">
              <p className="text-md font-semibold">
                {user?.email?.address || user?.phone?.number || "User"}
              </p>
              <p className="text-small text-default-500">Account ID: {user?.id?.substring(0, 8)}...</p>
            </div>
          </CardHeader>
          <Divider />
          <CardBody>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span>Email</span>
                <span className="font-medium">{user?.email?.address || "Not set"}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Phone</span>
                <span className="font-medium">{user?.phone?.number || "Not set"}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Wallet</span>
                <span className="font-medium">
                  {user?.wallet?.address 
                    ? `${user.wallet.address.substring(0, 6)}...${user.wallet.address.substring(user.wallet.address.length - 4)}` 
                    : "Not connected"}
                </span>
              </div>
            </div>
          </CardBody>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <h3 className="text-lg font-semibold">Settings</h3>
          </CardHeader>
          <Divider />
          <CardBody>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span>Push Notifications</span>
                <Switch defaultSelected />
              </div>
              <div className="flex justify-between items-center">
                <span>Dark Mode</span>
                <Switch />
              </div>
              <div className="flex justify-between items-center">
                <span>Two-Factor Authentication</span>
                <Switch />
              </div>
              <div className="flex justify-between items-center">
                <span>Transaction Alerts</span>
                <Switch defaultSelected />
              </div>
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
      <BottomNavBar active="me" />
    </AuthGuard>
  );
} 