"use client";

import React, { useState } from "react";
import { 
  Button, 
  Card, 
  CardBody, 
  CardHeader, 
  Divider, 
  Input,
  Tabs,
  Tab,
  Avatar
} from "@repo/ui/components";
import BottomNavBar from "../../components/BottomNavbar";
import Logo from "../../components/Logo";
import AuthGuard from "../../components/auth/AuthGuard";

export default function PayPage() {
  const [amount, setAmount] = useState("");
  const [recipient, setRecipient] = useState("");

  return (
    <AuthGuard>
      <div className="w-full max-w-md mx-auto p-4 pb-20 bg-white">
        <div className="flex flex-col items-center gap-4 mb-6">
          <Logo />
          <div className="text-center">
            <h1 className="text-2xl font-bold text-primary">Send & Request</h1>
            <p className="text-default-500">
              Transfer money quickly and securely
            </p>
          </div>
        </div>

        <Tabs aria-label="Payment options" className="mb-6">
          <Tab key="send" title="Send Money">
            <Card>
              <CardBody>
                <form className="space-y-4">
                  <Input
                    type="text"
                    label="Recipient"
                    placeholder="Phone number"
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                  />
                  <Input
                    type="text"
                    label="Amount"
                    placeholder="0.00"
                    startContent={
                      <div className="pointer-events-none flex items-center">
                        <span className="text-default-400 text-small">$</span>
                      </div>
                    }
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                  <Input
                    type="text"
                    label="Note (optional)"
                    placeholder="What's it for?"
                  />
                  <Button color="primary" className="w-full">
                    Send Money
                  </Button>
                </form>
              </CardBody>
            </Card>
          </Tab>
          <Tab key="request" title="Request Money">
            <Card>
              <CardBody>
                <form className="space-y-4">
                  <Input
                    type="text"
                    label="From"
                    placeholder="Phone number"
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                  />
                  <Input
                    type="text"
                    label="Amount"
                    placeholder="0.00"
                    startContent={
                      <div className="pointer-events-none flex items-center">
                        <span className="text-default-400 text-small">$</span>
                      </div>
                    }
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                  <Input
                    type="text"
                    label="Note (optional)"
                    placeholder="What's it for?"
                  />
                  <Button color="primary" className="w-full">
                    Request Money
                  </Button>
                </form>
              </CardBody>
            </Card>
          </Tab>
        </Tabs>

        <Card className="mb-6">
          <CardHeader>
            <h3 className="text-lg font-semibold">Recent Contacts</h3>
          </CardHeader>
          <Divider />
          <CardBody>
            <div className="flex gap-4 overflow-x-auto py-2">
              {[
                { name: "Sarah J.", initial: "S" },
                { name: "Mike T.", initial: "M" },
                { name: "Alex W.", initial: "A" },
                { name: "Jamie L.", initial: "J" },
                { name: "Taylor R.", initial: "T" }
              ].map((contact, index) => (
                <div key={index} className="flex flex-col items-center min-w-[60px]">
                  <Avatar
                    name={contact.initial}
                    color="primary"
                    size="lg"
                    className="mb-1"
                  />
                  <span className="text-xs text-center">{contact.name}</span>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>
      <BottomNavBar active="pay" />
    </AuthGuard>
  );
} 