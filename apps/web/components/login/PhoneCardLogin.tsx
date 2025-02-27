"use client";

import React, { useState } from "react";
import { Button, PhoneInput } from "@repo/ui/components";
import { useLoginWithSms } from "@privy-io/react-auth";
import Logo from "../Logo";

export default function PhoneLoginCard() {
  const [phone, setPhone] = useState("");
  const [touched, setTouched] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [showVerification, setShowVerification] = useState(false);

  const { sendCode, loginWithCode, state } = useLoginWithSms({
    onComplete: ({ user, isNewUser, wasAlreadyAuthenticated, loginMethod }) => {
      console.log("Login successful", {
        user,
        isNewUser,
        wasAlreadyAuthenticated,
        loginMethod,
      });
      // Handle successful login here (e.g., redirect)
    },
    onError: (error) => {
      console.error("Login failed:", error);
      // Handle error here (e.g., show toast)
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!showVerification) {
      // Send verification code
      try {
        await sendCode(phone);
        setShowVerification(true);
      } catch (error) {
        console.error("Failed to send code:", error);
      }
    } else {
      // Verify code
      try {
        await loginWithCode(verificationCode);
      } catch (error) {
        console.error("Failed to verify code:", error);
      }
    }
  };

  const handleBlur = () => {
    setTouched(true);
  };

  const isPhoneValid = phone.replace(/\D/g, "").length === 10;
  const isCodeValid = verificationCode.length === 6;

  const isLoading = state === "LOADING";

  return (
    <div className="w-full max-w-md mx-auto p-4">
      <div className="flex flex-col items-center gap-4 mb-6">
        <Logo />
        <div className="text-center">
          <h1 className="text-2xl font-bold text-primary">Welcome Back</h1>
          <p className="text-default-500">
            {showVerification 
              ? "Enter the verification code sent to your phone"
              : "Enter your phone number to continue"
            }
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        {!showVerification ? (
          <PhoneInput
            value={phone}
            onChange={setPhone}
            onBlur={handleBlur}
            isRequired
            validateOnBlur
            isDisabled={isLoading}
            errorMessage={
              touched && phone && !isPhoneValid
                ? "Please enter a valid phone number"
                : undefined
            }
          />
        ) : (
          <Input
            type="text"
            label="Verification Code"
            value={verificationCode}
            onChange={(e) => setVerificationCode(e.target.value)}
            placeholder="Enter 6-digit code"
            maxLength={6}
            isRequired
            isDisabled={isLoading}
          />
        )}

        <Button
          type="submit"
          className="w-full h-12"
          color="primary"
          size="lg"
          isDisabled={(!showVerification && !isPhoneValid) || 
                     (showVerification && !isCodeValid) ||
                     isLoading}
          isLoading={isLoading}
        >
          {showVerification ? "Verify Code" : "Continue with Phone"}
        </Button>

        {showVerification && (
          <Button
            variant="light"
            onPress={async () => {
              try {
                await sendCode(phone);
              } catch (error) {
                console.error("Failed to resend code:", error);
              }
            }}
            isDisabled={isLoading}
          >
            Resend Code
          </Button>
        )}
      </form>

      <footer className="text-center mt-6">
        <p className="text-default-500 text-sm">
          By continuing, you agree to our{" "}
          <a href="#" className="text-primary font-medium">
            Terms of Service
          </a>{" "}
          and{" "}
          <a href="#" className="text-primary font-medium">
            Privacy Policy
          </a>
          .
        </p>
      </footer>
    </div>
  );
}
