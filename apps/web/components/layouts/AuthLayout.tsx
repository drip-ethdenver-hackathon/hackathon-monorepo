"use client";

import React from "react";

interface AuthLayoutProps {
  children: React.ReactNode;
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex flex-1 items-center justify-center p-4 bg-gradient-to-br from-background to-content1">
        {children}
      </div>
    </div>
  );
}
