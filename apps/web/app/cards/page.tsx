"use client";

import React from "react";
import { Card, CardBody, CardHeader, Divider, Image } from "@repo/ui/components";
import BottomNavBar from "../../components/BottomNavbar";
import Logo from "../../components/Logo";
import AuthGuard from "../../components/auth/AuthGuard";

export default function CardsPage() {
  return (
    <AuthGuard>
      <div className="w-full max-w-md mx-auto p-4 pb-20 bg-white">
        <div className="flex flex-col items-center gap-4 mb-6">
          <Logo />
          <div className="text-center">
            <h1 className="text-2xl font-bold text-primary">Your Cards</h1>
            <p className="text-default-500">
              Manage your payment cards
            </p>
          </div>
        </div>

        <Card className="mb-6 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 opacity-90"></div>
          <CardHeader className="relative z-10">
            <div className="flex justify-between w-full">
              <div className="text-white">
                <p className="text-xs opacity-80">Current Balance</p>
                <p className="text-2xl font-bold">$2,450.25</p>
              </div>
              <Image
                src="/images/chip.png"
                alt="Card Chip"
                width={40}
                height={40}
                fallbackSrc="https://via.placeholder.com/40"
              />
            </div>
          </CardHeader>
          <CardBody className="relative z-10 text-white">
            <div className="mb-4">
              <p className="text-xs opacity-80">Card Number</p>
              <p className="font-mono">•••• •••• •••• 4242</p>
            </div>
            <div className="flex justify-between">
              <div>
                <p className="text-xs opacity-80">Card Holder</p>
                <p>John Doe</p>
              </div>
              <div>
                <p className="text-xs opacity-80">Expires</p>
                <p>12/25</p>
              </div>
              <div>
                <Image
                  src="/images/visa-logo.png"
                  alt="Visa"
                  width={40}
                  height={40}
                  fallbackSrc="https://via.placeholder.com/40?text=VISA"
                />
              </div>
            </div>
          </CardBody>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <h3 className="text-lg font-semibold">Recent Transactions</h3>
          </CardHeader>
          <Divider />
          <CardBody>
            <div className="space-y-4">
              {[
                { merchant: "Starbucks", date: "Today", amount: "-$4.50" },
                { merchant: "Amazon", date: "Yesterday", amount: "-$29.99" },
                { merchant: "Uber", date: "May 15", amount: "-$12.75" },
                { merchant: "Deposit", date: "May 12", amount: "+$1,000.00" }
              ].map((tx, index) => (
                <div key={index} className="flex justify-between items-center">
                  <div>
                    <p className="font-medium">{tx.merchant}</p>
                    <p className="text-xs text-default-500">{tx.date}</p>
                  </div>
                  <p className={tx.amount.startsWith("+") ? "text-success" : ""}>
                    {tx.amount}
                  </p>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>
      <BottomNavBar active="cards" />
    </AuthGuard>
  );
} 