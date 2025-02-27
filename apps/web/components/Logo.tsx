"use client";

import React from "react";
import { Image } from "@repo/ui/components";

export default function Logo() {
  return (
    <div className="flex items-center justify-center mb-6">
      <Image
        src="/images/baseline-logo.png"
        alt="Company Logo"
        width={48}
        height={48}
      />
    </div>
  );
}
