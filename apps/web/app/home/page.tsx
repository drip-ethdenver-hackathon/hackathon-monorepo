"use client";

import React, { useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import {
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  Divider,
  Input,
  Select,
  SelectItem,
  Spinner,
} from "@repo/ui/components";
import BottomNavBar from "../../components/BottomNavbar";
import Logo from "../../components/Logo";
import AuthGuard from "../../components/auth/AuthGuard";
import {
  useBalance,
} from "wagmi";
import { base } from "viem/chains";
import { Address, Hex, parseUnits, formatEther, formatUnits, createPublicClient, http, encodeFunctionData } from "viem";
import {useSmartWallets} from '@privy-io/react-auth/smart-wallets';
import { useFundWallet } from "../../hooks/useFundWallet";

const spendPermissionManagerAbi = [{"inputs":[{"internalType":"contract PublicERC6492Validator","name":"publicERC6492Validator","type":"address"},{"internalType":"address","name":"magicSpend","type":"address"}],"stateMutability":"nonpayable","type":"constructor"},{"inputs":[{"internalType":"uint48","name":"currentTimestamp","type":"uint48"},{"internalType":"uint48","name":"end","type":"uint48"}],"name":"AfterSpendPermissionEnd","type":"error"},{"inputs":[{"internalType":"uint48","name":"currentTimestamp","type":"uint48"},{"internalType":"uint48","name":"start","type":"uint48"}],"name":"BeforeSpendPermissionStart","type":"error"},{"inputs":[{"internalType":"address","name":"token","type":"address"}],"name":"ERC721TokenNotSupported","type":"error"},{"inputs":[],"name":"EmptySpendPermissionBatch","type":"error"},{"inputs":[{"internalType":"uint256","name":"value","type":"uint256"},{"internalType":"uint256","name":"allowance","type":"uint256"}],"name":"ExceededSpendPermission","type":"error"},{"inputs":[{"components":[{"internalType":"uint48","name":"start","type":"uint48"},{"internalType":"uint48","name":"end","type":"uint48"},{"internalType":"uint160","name":"spend","type":"uint160"}],"internalType":"struct SpendPermissionManager.PeriodSpend","name":"actualLastUpdatedPeriod","type":"tuple"},{"components":[{"internalType":"uint48","name":"start","type":"uint48"},{"internalType":"uint48","name":"end","type":"uint48"},{"internalType":"uint160","name":"spend","type":"uint160"}],"internalType":"struct SpendPermissionManager.PeriodSpend","name":"expectedLastUpdatedPeriod","type":"tuple"}],"name":"InvalidLastUpdatedPeriod","type":"error"},{"inputs":[{"internalType":"address","name":"sender","type":"address"},{"internalType":"address","name":"expected","type":"address"}],"name":"InvalidSender","type":"error"},{"inputs":[],"name":"InvalidSignature","type":"error"},{"inputs":[{"internalType":"uint48","name":"start","type":"uint48"},{"internalType":"uint48","name":"end","type":"uint48"}],"name":"InvalidStartEnd","type":"error"},{"inputs":[{"internalType":"uint128","name":"noncePostfix","type":"uint128"},{"internalType":"uint128","name":"permissionHashPostfix","type":"uint128"}],"name":"InvalidWithdrawRequestNonce","type":"error"},{"inputs":[{"internalType":"address","name":"firstAccount","type":"address"},{"internalType":"address","name":"secondAccount","type":"address"}],"name":"MismatchedAccounts","type":"error"},{"inputs":[{"internalType":"address","name":"token","type":"address"}],"name":"SafeERC20FailedOperation","type":"error"},{"inputs":[{"internalType":"address","name":"spendToken","type":"address"},{"internalType":"address","name":"withdrawAsset","type":"address"}],"name":"SpendTokenWithdrawAssetMismatch","type":"error"},{"inputs":[{"internalType":"uint256","name":"value","type":"uint256"}],"name":"SpendValueOverflow","type":"error"},{"inputs":[{"internalType":"uint256","name":"spendValue","type":"uint256"},{"internalType":"uint256","name":"withdrawAmount","type":"uint256"}],"name":"SpendValueWithdrawAmountMismatch","type":"error"},{"inputs":[],"name":"UnauthorizedSpendPermission","type":"error"},{"inputs":[{"internalType":"uint256","name":"received","type":"uint256"},{"internalType":"uint256","name":"expected","type":"uint256"}],"name":"UnexpectedReceiveAmount","type":"error"},{"inputs":[],"name":"ZeroAllowance","type":"error"},{"inputs":[],"name":"ZeroPeriod","type":"error"},{"inputs":[],"name":"ZeroSpender","type":"error"},{"inputs":[],"name":"ZeroToken","type":"error"},{"inputs":[],"name":"ZeroValue","type":"error"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"bytes32","name":"hash","type":"bytes32"},{"components":[{"internalType":"address","name":"account","type":"address"},{"internalType":"address","name":"spender","type":"address"},{"internalType":"address","name":"token","type":"address"},{"internalType":"uint160","name":"allowance","type":"uint160"},{"internalType":"uint48","name":"period","type":"uint48"},{"internalType":"uint48","name":"start","type":"uint48"},{"internalType":"uint48","name":"end","type":"uint48"},{"internalType":"uint256","name":"salt","type":"uint256"},{"internalType":"bytes","name":"extraData","type":"bytes"}],"indexed":false,"internalType":"struct SpendPermissionManager.SpendPermission","name":"spendPermission","type":"tuple"}],"name":"SpendPermissionApproved","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"bytes32","name":"hash","type":"bytes32"},{"components":[{"internalType":"address","name":"account","type":"address"},{"internalType":"address","name":"spender","type":"address"},{"internalType":"address","name":"token","type":"address"},{"internalType":"uint160","name":"allowance","type":"uint160"},{"internalType":"uint48","name":"period","type":"uint48"},{"internalType":"uint48","name":"start","type":"uint48"},{"internalType":"uint48","name":"end","type":"uint48"},{"internalType":"uint256","name":"salt","type":"uint256"},{"internalType":"bytes","name":"extraData","type":"bytes"}],"indexed":false,"internalType":"struct SpendPermissionManager.SpendPermission","name":"spendPermission","type":"tuple"}],"name":"SpendPermissionRevoked","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"bytes32","name":"hash","type":"bytes32"},{"indexed":true,"internalType":"address","name":"account","type":"address"},{"indexed":true,"internalType":"address","name":"spender","type":"address"},{"indexed":false,"internalType":"address","name":"token","type":"address"},{"components":[{"internalType":"uint48","name":"start","type":"uint48"},{"internalType":"uint48","name":"end","type":"uint48"},{"internalType":"uint160","name":"spend","type":"uint160"}],"indexed":false,"internalType":"struct SpendPermissionManager.PeriodSpend","name":"periodSpend","type":"tuple"}],"name":"SpendPermissionUsed","type":"event"},{"inputs":[],"name":"MAGIC_SPEND","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"NATIVE_TOKEN","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"PERMISSION_DETAILS_TYPEHASH","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"PUBLIC_ERC6492_VALIDATOR","outputs":[{"internalType":"contract PublicERC6492Validator","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"SPEND_PERMISSION_BATCH_TYPEHASH","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"SPEND_PERMISSION_TYPEHASH","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[{"components":[{"internalType":"address","name":"account","type":"address"},{"internalType":"address","name":"spender","type":"address"},{"internalType":"address","name":"token","type":"address"},{"internalType":"uint160","name":"allowance","type":"uint160"},{"internalType":"uint48","name":"period","type":"uint48"},{"internalType":"uint48","name":"start","type":"uint48"},{"internalType":"uint48","name":"end","type":"uint48"},{"internalType":"uint256","name":"salt","type":"uint256"},{"internalType":"bytes","name":"extraData","type":"bytes"}],"internalType":"struct SpendPermissionManager.SpendPermission","name":"spendPermission","type":"tuple"}],"name":"approve","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"components":[{"internalType":"address","name":"account","type":"address"},{"internalType":"uint48","name":"period","type":"uint48"},{"internalType":"uint48","name":"start","type":"uint48"},{"internalType":"uint48","name":"end","type":"uint48"},{"components":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"address","name":"token","type":"address"},{"internalType":"uint160","name":"allowance","type":"uint160"},{"internalType":"uint256","name":"salt","type":"uint256"},{"internalType":"bytes","name":"extraData","type":"bytes"}],"internalType":"struct SpendPermissionManager.PermissionDetails[]","name":"permissions","type":"tuple[]"}],"internalType":"struct SpendPermissionManager.SpendPermissionBatch","name":"spendPermissionBatch","type":"tuple"},{"internalType":"bytes","name":"signature","type":"bytes"}],"name":"approveBatchWithSignature","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"components":[{"internalType":"address","name":"account","type":"address"},{"internalType":"address","name":"spender","type":"address"},{"internalType":"address","name":"token","type":"address"},{"internalType":"uint160","name":"allowance","type":"uint160"},{"internalType":"uint48","name":"period","type":"uint48"},{"internalType":"uint48","name":"start","type":"uint48"},{"internalType":"uint48","name":"end","type":"uint48"},{"internalType":"uint256","name":"salt","type":"uint256"},{"internalType":"bytes","name":"extraData","type":"bytes"}],"internalType":"struct SpendPermissionManager.SpendPermission","name":"permissionToApprove","type":"tuple"},{"components":[{"internalType":"address","name":"account","type":"address"},{"internalType":"address","name":"spender","type":"address"},{"internalType":"address","name":"token","type":"address"},{"internalType":"uint160","name":"allowance","type":"uint160"},{"internalType":"uint48","name":"period","type":"uint48"},{"internalType":"uint48","name":"start","type":"uint48"},{"internalType":"uint48","name":"end","type":"uint48"},{"internalType":"uint256","name":"salt","type":"uint256"},{"internalType":"bytes","name":"extraData","type":"bytes"}],"internalType":"struct SpendPermissionManager.SpendPermission","name":"permissionToRevoke","type":"tuple"},{"components":[{"internalType":"uint48","name":"start","type":"uint48"},{"internalType":"uint48","name":"end","type":"uint48"},{"internalType":"uint160","name":"spend","type":"uint160"}],"internalType":"struct SpendPermissionManager.PeriodSpend","name":"expectedLastUpdatedPeriod","type":"tuple"}],"name":"approveWithRevoke","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"components":[{"internalType":"address","name":"account","type":"address"},{"internalType":"address","name":"spender","type":"address"},{"internalType":"address","name":"token","type":"address"},{"internalType":"uint160","name":"allowance","type":"uint160"},{"internalType":"uint48","name":"period","type":"uint48"},{"internalType":"uint48","name":"start","type":"uint48"},{"internalType":"uint48","name":"end","type":"uint48"},{"internalType":"uint256","name":"salt","type":"uint256"},{"internalType":"bytes","name":"extraData","type":"bytes"}],"internalType":"struct SpendPermissionManager.SpendPermission","name":"spendPermission","type":"tuple"},{"internalType":"bytes","name":"signature","type":"bytes"}],"name":"approveWithSignature","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"eip712Domain","outputs":[{"internalType":"bytes1","name":"fields","type":"bytes1"},{"internalType":"string","name":"name","type":"string"},{"internalType":"string","name":"version","type":"string"},{"internalType":"uint256","name":"chainId","type":"uint256"},{"internalType":"address","name":"verifyingContract","type":"address"},{"internalType":"bytes32","name":"salt","type":"bytes32"},{"internalType":"uint256[]","name":"extensions","type":"uint256[]"}],"stateMutability":"view","type":"function"},{"inputs":[{"components":[{"internalType":"address","name":"account","type":"address"},{"internalType":"uint48","name":"period","type":"uint48"},{"internalType":"uint48","name":"start","type":"uint48"},{"internalType":"uint48","name":"end","type":"uint48"},{"components":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"address","name":"token","type":"address"},{"internalType":"uint160","name":"allowance","type":"uint160"},{"internalType":"uint256","name":"salt","type":"uint256"},{"internalType":"bytes","name":"extraData","type":"bytes"}],"internalType":"struct SpendPermissionManager.PermissionDetails[]","name":"permissions","type":"tuple[]"}],"internalType":"struct SpendPermissionManager.SpendPermissionBatch","name":"spendPermissionBatch","type":"tuple"}],"name":"getBatchHash","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[{"components":[{"internalType":"address","name":"account","type":"address"},{"internalType":"address","name":"spender","type":"address"},{"internalType":"address","name":"token","type":"address"},{"internalType":"uint160","name":"allowance","type":"uint160"},{"internalType":"uint48","name":"period","type":"uint48"},{"internalType":"uint48","name":"start","type":"uint48"},{"internalType":"uint48","name":"end","type":"uint48"},{"internalType":"uint256","name":"salt","type":"uint256"},{"internalType":"bytes","name":"extraData","type":"bytes"}],"internalType":"struct SpendPermissionManager.SpendPermission","name":"spendPermission","type":"tuple"}],"name":"getCurrentPeriod","outputs":[{"components":[{"internalType":"uint48","name":"start","type":"uint48"},{"internalType":"uint48","name":"end","type":"uint48"},{"internalType":"uint160","name":"spend","type":"uint160"}],"internalType":"struct SpendPermissionManager.PeriodSpend","name":"","type":"tuple"}],"stateMutability":"view","type":"function"},{"inputs":[{"components":[{"internalType":"address","name":"account","type":"address"},{"internalType":"address","name":"spender","type":"address"},{"internalType":"address","name":"token","type":"address"},{"internalType":"uint160","name":"allowance","type":"uint160"},{"internalType":"uint48","name":"period","type":"uint48"},{"internalType":"uint48","name":"start","type":"uint48"},{"internalType":"uint48","name":"end","type":"uint48"},{"internalType":"uint256","name":"salt","type":"uint256"},{"internalType":"bytes","name":"extraData","type":"bytes"}],"internalType":"struct SpendPermissionManager.SpendPermission","name":"spendPermission","type":"tuple"}],"name":"getHash","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[{"components":[{"internalType":"address","name":"account","type":"address"},{"internalType":"address","name":"spender","type":"address"},{"internalType":"address","name":"token","type":"address"},{"internalType":"uint160","name":"allowance","type":"uint160"},{"internalType":"uint48","name":"period","type":"uint48"},{"internalType":"uint48","name":"start","type":"uint48"},{"internalType":"uint48","name":"end","type":"uint48"},{"internalType":"uint256","name":"salt","type":"uint256"},{"internalType":"bytes","name":"extraData","type":"bytes"}],"internalType":"struct SpendPermissionManager.SpendPermission","name":"spendPermission","type":"tuple"}],"name":"getLastUpdatedPeriod","outputs":[{"components":[{"internalType":"uint48","name":"start","type":"uint48"},{"internalType":"uint48","name":"end","type":"uint48"},{"internalType":"uint160","name":"spend","type":"uint160"}],"internalType":"struct SpendPermissionManager.PeriodSpend","name":"","type":"tuple"}],"stateMutability":"view","type":"function"},{"inputs":[{"components":[{"internalType":"address","name":"account","type":"address"},{"internalType":"address","name":"spender","type":"address"},{"internalType":"address","name":"token","type":"address"},{"internalType":"uint160","name":"allowance","type":"uint160"},{"internalType":"uint48","name":"period","type":"uint48"},{"internalType":"uint48","name":"start","type":"uint48"},{"internalType":"uint48","name":"end","type":"uint48"},{"internalType":"uint256","name":"salt","type":"uint256"},{"internalType":"bytes","name":"extraData","type":"bytes"}],"internalType":"struct SpendPermissionManager.SpendPermission","name":"spendPermission","type":"tuple"}],"name":"isApproved","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"components":[{"internalType":"address","name":"account","type":"address"},{"internalType":"address","name":"spender","type":"address"},{"internalType":"address","name":"token","type":"address"},{"internalType":"uint160","name":"allowance","type":"uint160"},{"internalType":"uint48","name":"period","type":"uint48"},{"internalType":"uint48","name":"start","type":"uint48"},{"internalType":"uint48","name":"end","type":"uint48"},{"internalType":"uint256","name":"salt","type":"uint256"},{"internalType":"bytes","name":"extraData","type":"bytes"}],"internalType":"struct SpendPermissionManager.SpendPermission","name":"spendPermission","type":"tuple"}],"name":"isRevoked","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"components":[{"internalType":"address","name":"account","type":"address"},{"internalType":"address","name":"spender","type":"address"},{"internalType":"address","name":"token","type":"address"},{"internalType":"uint160","name":"allowance","type":"uint160"},{"internalType":"uint48","name":"period","type":"uint48"},{"internalType":"uint48","name":"start","type":"uint48"},{"internalType":"uint48","name":"end","type":"uint48"},{"internalType":"uint256","name":"salt","type":"uint256"},{"internalType":"bytes","name":"extraData","type":"bytes"}],"internalType":"struct SpendPermissionManager.SpendPermission","name":"spendPermission","type":"tuple"}],"name":"isValid","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"components":[{"internalType":"address","name":"account","type":"address"},{"internalType":"address","name":"spender","type":"address"},{"internalType":"address","name":"token","type":"address"},{"internalType":"uint160","name":"allowance","type":"uint160"},{"internalType":"uint48","name":"period","type":"uint48"},{"internalType":"uint48","name":"start","type":"uint48"},{"internalType":"uint48","name":"end","type":"uint48"},{"internalType":"uint256","name":"salt","type":"uint256"},{"internalType":"bytes","name":"extraData","type":"bytes"}],"internalType":"struct SpendPermissionManager.SpendPermission","name":"spendPermission","type":"tuple"}],"name":"revoke","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"components":[{"internalType":"address","name":"account","type":"address"},{"internalType":"address","name":"spender","type":"address"},{"internalType":"address","name":"token","type":"address"},{"internalType":"uint160","name":"allowance","type":"uint160"},{"internalType":"uint48","name":"period","type":"uint48"},{"internalType":"uint48","name":"start","type":"uint48"},{"internalType":"uint48","name":"end","type":"uint48"},{"internalType":"uint256","name":"salt","type":"uint256"},{"internalType":"bytes","name":"extraData","type":"bytes"}],"internalType":"struct SpendPermissionManager.SpendPermission","name":"spendPermission","type":"tuple"}],"name":"revokeAsSpender","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"components":[{"internalType":"address","name":"account","type":"address"},{"internalType":"address","name":"spender","type":"address"},{"internalType":"address","name":"token","type":"address"},{"internalType":"uint160","name":"allowance","type":"uint160"},{"internalType":"uint48","name":"period","type":"uint48"},{"internalType":"uint48","name":"start","type":"uint48"},{"internalType":"uint48","name":"end","type":"uint48"},{"internalType":"uint256","name":"salt","type":"uint256"},{"internalType":"bytes","name":"extraData","type":"bytes"}],"internalType":"struct SpendPermissionManager.SpendPermission","name":"spendPermission","type":"tuple"},{"internalType":"uint160","name":"value","type":"uint160"}],"name":"spend","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"components":[{"internalType":"address","name":"account","type":"address"},{"internalType":"address","name":"spender","type":"address"},{"internalType":"address","name":"token","type":"address"},{"internalType":"uint160","name":"allowance","type":"uint160"},{"internalType":"uint48","name":"period","type":"uint48"},{"internalType":"uint48","name":"start","type":"uint48"},{"internalType":"uint48","name":"end","type":"uint48"},{"internalType":"uint256","name":"salt","type":"uint256"},{"internalType":"bytes","name":"extraData","type":"bytes"}],"internalType":"struct SpendPermissionManager.SpendPermission","name":"spendPermission","type":"tuple"},{"internalType":"uint160","name":"value","type":"uint160"},{"components":[{"internalType":"bytes","name":"signature","type":"bytes"},{"internalType":"address","name":"asset","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"},{"internalType":"uint256","name":"nonce","type":"uint256"},{"internalType":"uint48","name":"expiry","type":"uint48"}],"internalType":"struct MagicSpend.WithdrawRequest","name":"withdrawRequest","type":"tuple"}],"name":"spendWithWithdraw","outputs":[],"stateMutability":"nonpayable","type":"function"},{"stateMutability":"payable","type":"receive"}];

BigInt.prototype.toJSON = function () {
  return this.toString();
};

const HomePage = () => {
  const { logout, user, getAccessToken } = usePrivy();
  const router = useRouter();

  const { data: balance, isLoading: isBalanceLoading, refetch: onRefreshNative } = useBalance({
    address: user?.smartWallet?.address as `0x${string}`,
    chainId: base.id,
  });

  const { data: usdcBalance, isLoading: isUsdcBalanceLoading, refetch: onRefreshBalance } = useBalance({
    address: user?.smartWallet?.address as `0x${string}`,
    chainId: base.id,
    token: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913" as `0x${string}`,
  });

  const {client} = useSmartWallets();

  const [hasSignedSpendPermissions, setHasSignedSpendPermissions] = useState(false);
  const [isSigning, setIsSigning] = useState(false);

  const spenderAddress = process.env.NEXT_PUBLIC_SPENDER_PRIVATE_ADDR! as Address;

  const initialSpendPermissions = [
    {
      account: user?.smartWallet?.address as Address,
      spender: spenderAddress,
      token: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE" as Address, // ETH placeholder
      allowance: parseUnits("1", 18),
      period: 86400,
      start: 0,
      end: 281474976710655,
      salt: BigInt(0),
      extraData: "0x" as Hex,
    },
    {
      account: user?.smartWallet?.address as Address,
      spender: spenderAddress,
      token: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913" as Address, // USDC on Base
      allowance: parseUnits("1000", 6),
      period: 86400,
      start: 0,
      end: 281474976710655,
      salt: BigInt(0),
      extraData: "0x" as Hex,
    },
  ];

  const [spendPermissions, setSpendPermissions] = useState(initialSpendPermissions);

  const grantSpendPermissions = async () => {
    if(!client) return;

    setIsSigning(true);

    let accountAddress = user?.smartWallet?.address;

    try {

      const updatedPermissions = spendPermissions.map((perm) => ({
        ...perm,
        account: (accountAddress || user?.smartWallet?.address) as Address,
      }));

      console.log({
        updatedPermissions
      })

      const txHash = await client.sendTransaction({
        calls: [
          {
            to: '0xf85210B21cC50302F477BA56686d2019dC9b67Ad',
            data: encodeFunctionData({
              abi: spendPermissionManagerAbi,
              functionName: 'approve',
              args: [Object.values(updatedPermissions[0])]
            }),
          }, 
          {
            to: '0xf85210B21cC50302F477BA56686d2019dC9b67Ad',
            data: encodeFunctionData({
              abi: spendPermissionManagerAbi,
              functionName: 'approve',
              args: [Object.values(updatedPermissions[1])]
            }),
          },
        ],
      });

      console.log(txHash);
   
      // const spendReceipt = await publicClient.waitForTransactionReceipt({
      //   hash: spendTxnHash,
      // });

      setSpendPermissions(updatedPermissions);
      setHasSignedSpendPermissions(true);
    } catch (err) {
      console.error("Error signing spend permissions:", err);
    }
    setIsSigning(false);
  };

  const handleLogout = async () => {
    try {
      await logout();
      router.push("/");
    } catch (error) {
      console.error("Failed to logout:", error);
    }
  };

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
      onRefreshBalance?.();
      onRefreshNative?.();
    }
  };

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

        {/* Spend Permissions Section */}
        {!hasSignedSpendPermissions ? (
          <Card className="mb-6">
            <CardHeader>
              <h3 className="text-md font-semibold">Grant Spend Permissions</h3>
            </CardHeader>
            <Divider />
            <CardBody>
              <p className="text-sm text-default-500 mb-4">
                Before you can perform cross-chain or bridging actions, please grant permission to the Baseline Support Agent to spend funds from your smart wallet for transaction fees or bridging. This will grant permissions for both ETH and USDC.
              </p>
              <Button
                color="primary"
                disabled={isSigning}
                onPress={grantSpendPermissions}
              >
                {isSigning ? "Signing permissions..." : "Grant Spend Permissions"}
              </Button>
            </CardBody>
          </Card>
        ) : (
          <Card className="mb-6">
            <CardHeader>
              <h3 className="text-md font-semibold">Spend Permissions Granted</h3>
            </CardHeader>
            <Divider />
            <CardBody>
              <p className="text-sm text-default-500 mb-4">
                Thank you! You have granted spend permissions for both ETH and USDC.
              </p>
            </CardBody>
          </Card>
        )}

        {/* Account Overview Section */}
        <Card className="mb-6">
          <CardHeader className="flex gap-3">
            <div className="flex flex-col">
              <p className="text-md font-semibold">Account Overview</p>
              <p className="text-small text-default-500">
                {user?.smartWallet?.address}
              </p>
            </div>
          </CardHeader>
          <Divider />
          <CardBody>
            <div className="flex justify-between">
              <span>Available Balance</span>
              <span className="font-semibold">
                {isBalanceLoading ? "..." : `${formatEther(balance?.value?.toString() ?? "0")} ETH`}
              </span>
            </div>
            <div className="flex justify-between">
              <span />
              <span className="font-semibold">
                {isUsdcBalanceLoading ? "..." : `${formatUnits(usdcBalance?.value?.toString() ?? "0", 6)} USDC`}
              </span>
            </div>
          </CardBody>
          <CardFooter>
            <Button color="primary" size="sm" className="w-full">
              View Details
            </Button>
          </CardFooter>
        </Card>

        <Card className="mb-6">
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
              isDisabled={!walletAddress || !fundingAmount || Number(fundingAmount) <= 0}
            >
              {`Fund ${Number(fundingAmount).toFixed(2)} ${
                availableAssets.find(a => a.value === selectedAsset)?.label
              }`}
            </Button>
          </CardFooter>
        </Card>
        
        {/* Quick Actions Section */}
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
};

export default HomePage;
