"use client";

import React from "react";
import AuthLayout from "../components/layouts/AuthLayout";
import PhoneLoginCard from "../components/login/PhoneCardLogin";

export default function LoginPage() {
  return (
    <AuthLayout>
      <PhoneLoginCard />
    </AuthLayout>
  );
}
