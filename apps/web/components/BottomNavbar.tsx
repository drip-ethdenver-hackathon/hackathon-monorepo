"use client";

import React from "react";
import Link from "next/link";

// NextUI components
import { Button, Icon } from "@repo/ui/components";

interface BottomNavbarProps {
  /**
   * Optional: The key of the currently active tab (e.g. "home", "pay", "cards", "crypto", "me").
   * This can be used to highlight the active route.
   */
  active?: string;
}

const BottomNavbar: React.FC<BottomNavbarProps> = ({ active }) => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50">
      <div className="bg-white dark:bg-gray-900 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] border-t border-gray-200 dark:border-gray-800 h-[72px]">
        <ul className="relative mx-auto flex h-full max-w-lg items-center justify-between px-6">
          {/* -- 1. HOME TAB -- */}
          <li>
            <Link
              href="/home"
              className={`flex flex-col items-center text-xs ${
                active === "home" ? "text-blue-600" : "text-gray-500"
              }`}
            >
              <Icon icon="mdi:home" className="h-6 w-6" aria-hidden="true" />
              <span className="mt-1">Home</span>
            </Link>
          </li>

          {/* -- 2. CARDS TAB -- */}
          <li>
            <Link
              href="/cards"
              className={`flex flex-col items-center text-xs ${
                active === "cards" ? "text-blue-600" : "text-gray-500"
              }`}
            >
              <Icon icon="mdi:credit-card" className="h-6 w-6" aria-hidden="true" />
              <span className="mt-1">Cards</span>
            </Link>
          </li>

          {/* -- 3. CENTER PAY BUTTON -- */}
          <li className="relative -mt-8 flex justify-center">
            <Button
              as={Link}
              href="/pay"
              radius="full"
              color="primary"
              variant="solid"
              className="h-14 w-14 min-w-0 rounded-full p-0 shadow-lg"
            >
              <Icon icon="mdi:bank-transfer" className="h-6 w-6" />
            </Button>
          </li>

          {/* -- 4. CRYPTO TAB -- */}
          <li>
            <Link
              href="/crypto"
              className={`flex flex-col items-center text-xs ${
                active === "crypto" ? "text-blue-600" : "text-gray-500"
              }`}
            >
              <Icon icon="mdi:bitcoin" className="h-6 w-6" aria-hidden="true" />
              <span className="mt-1">Crypto</span>
            </Link>
          </li>

          {/* -- 5. ME TAB -- */}
          <li>
            <Link
              href="/me"
              className={`flex flex-col items-center text-xs ${
                active === "me" ? "text-blue-600" : "text-gray-500"
              }`}
            >
              <Icon icon="mdi:user-circle" className="h-6 w-6" aria-hidden="true" />
              <span className="mt-1">Me</span>
            </Link>
          </li>
        </ul>
      </div>
    </nav>
  );
};

export default BottomNavbar;
