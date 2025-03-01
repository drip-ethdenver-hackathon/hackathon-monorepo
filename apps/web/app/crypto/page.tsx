"use client";

import React, { useState } from "react";
import { 
  Button, 
  Card, 
  CardBody, 
  CardHeader, 
  CardFooter,
  Divider, 
  Progress,
  Spinner,
  Input,
  Select,
  SelectItem,
} from "@repo/ui/components";
import BottomNavBar from "../../components/BottomNavbar";
import Logo from "../../components/Logo";
import AuthGuard from "../../components/auth/AuthGuard";
import { useFundWallet } from "../../hooks/useFundWallet";
import { usePrivy } from "@privy-io/react-auth";

export default function CryptoPage() {
  const { user } = usePrivy();
  const { fundWallet, isFunding } = useFundWallet();
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [fundingAmount, setFundingAmount] = useState("1");
  const [selectedAsset, setSelectedAsset] = useState<"USDC" | "native-currency">("USDC");

  const availableAssets = [
    { label: "USDC", value: "USDC" as const, icon: "💵" },
    { label: "ETH", value: "native-currency" as const, icon: "⚡" },
  ];

  // Get the user's wallet address when component mounts
  React.useEffect(() => {
    const fetchWalletAddress = async () => {
      if (user?.smartWallet?.address) {
        setWalletAddress(user.smartWallet.address);
      } else if (user?.linkedAccounts) {
        // Find the first wallet in linked accounts
        const walletAccount = user.linkedAccounts.find(
          account => account.type === "wallet"
        );
        if (walletAccount && "address" in walletAccount) {
          setWalletAddress(walletAccount.address as string);
        }
      }
    };

    fetchWalletAddress();
  }, [user]);

  const handleFundWallet = async () => {
    if (walletAddress) {
      await fundWallet(walletAddress, {
        amount: fundingAmount,
        asset: selectedAsset,
      });
    }
  };

  return (
    <AuthGuard>
      <div className="w-full max-w-md mx-auto p-4 pb-20 bg-white">
        <div className="flex flex-col items-center gap-4 mb-6">
          <Logo />
          <div className="text-center">
            <h1 className="text-2xl font-bold text-primary">Crypto Assets</h1>
            <p className="text-default-500">
              Manage your digital assets
            </p>
          </div>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <h3 className="text-lg font-semibold">Portfolio Overview</h3>
          </CardHeader>
          <Divider />
          <CardBody>
            <div className="flex justify-between mb-3">
              <span>Total Value</span>
              <span className="font-semibold">$8,245.32</span>
            </div>
            <div className="flex justify-between mb-3">
              <span>24h Change</span>
              <span className="font-semibold text-success">+$245.18 (2.9%)</span>
            </div>
            <div className="flex justify-between">
              <span>Assets</span>
              <span className="font-semibold">5</span>
            </div>
          </CardBody>
          <Divider />
          <CardFooter className="flex flex-col gap-6 p-6">
            <div className="w-full space-y-4">
              <h4 className="text-sm font-medium text-default-600">Fund Your Wallet</h4>
              <div className="flex gap-4 w-full">
                <div className="flex-1">
                  <Input
                    type="number"
                    value={fundingAmount}
                    onChange={(e) => setFundingAmount(e.target.value)}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    label="Amount"
                    size="lg"
                    labelPlacement="outside"
                    startContent={
                      <div className="pointer-events-none flex items-center">
                        <span className="text-default-400 text-sm"></span>
                      </div>
                    }
                  />
                </div>
                <div className="flex-1">
                  <Select
                    label="Select Asset"
                    selectedKeys={[selectedAsset]}
                    onChange={(e) => setSelectedAsset(e.target.value as typeof selectedAsset)}
                    size="lg"
                    labelPlacement="outside"
                    classNames={{
                      trigger: "bg-default-100",
                      value: "font-medium",
                    }}
                  >
                    {availableAssets.map((asset) => (
                      <SelectItem 
                        key={asset.value} 
                        value={asset.value}
                        className="font-medium text-black"
                      >
                        {asset.label}
                      </SelectItem>
                    ))}
                  </Select>
                </div>
              </div>
            </div>
            <Button 
              color="primary" 
              className="w-full"
              size="lg"
              onPress={handleFundWallet}
              isDisabled={!walletAddress || isFunding || !fundingAmount || Number(fundingAmount) <= 0}
              startContent={isFunding ? <Spinner size="sm" color="current" /> : null}
            >
              {isFunding ? "Processing..." : `Fund ${Number(fundingAmount).toFixed(2)} ${
                availableAssets.find(a => a.value === selectedAsset)?.label
              }`}
            </Button>
          </CardFooter>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <h3 className="text-lg font-semibold">Your Assets</h3>
          </CardHeader>
          <Divider />
          <CardBody>
            <div className="space-y-6">
              {[
                { name: "Bitcoin", symbol: "BTC", amount: "0.45", value: "$4,125.75", change: "+2.4%", allocation: 50 },
                { name: "Ethereum", symbol: "ETH", amount: "2.35", value: "$2,845.20", change: "+1.8%", allocation: 35 },
                { name: "Solana", symbol: "SOL", amount: "15.8", value: "$985.40", change: "+4.2%", allocation: 12 },
                { name: "Cardano", symbol: "ADA", amount: "450", value: "$189.00", change: "-0.8%", allocation: 2 },
                { name: "Dogecoin", symbol: "DOGE", amount: "1250", value: "$99.97", change: "-1.2%", allocation: 1 }
              ].map((asset, index) => (
                <div key={index}>
                  <div className="flex justify-between items-center mb-1">
                    <div>
                      <p className="font-medium">{asset.name}</p>
                      <p className="text-xs text-default-500">{asset.amount} {asset.symbol}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{asset.value}</p>
                      <p className={`text-xs ${asset.change.startsWith("+") ? "text-success" : "text-danger"}`}>
                        {asset.change}
                      </p>
                    </div>
                  </div>
                  <Progress 
                    value={asset.allocation} 
                    color="primary" 
                    size="sm" 
                    className="mb-1"
                  />
                  <p className="text-xs text-default-500 text-right">{asset.allocation}% of portfolio</p>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

        {walletAddress && (
          <Card className="mb-6">
            <CardHeader>
              <h3 className="text-lg font-semibold">Wallet Information</h3>
            </CardHeader>
            <Divider />
            <CardBody>
              <div className="space-y-2">
                <div>
                  <p className="text-sm text-default-500">Wallet Address</p>
                  <p className="font-mono text-xs break-all">
                    {walletAddress}
                  </p>
                </div>
              </div>
            </CardBody>
          </Card>
        )}
      </div>
      <BottomNavBar active="crypto" />
    </AuthGuard>
  );
} 