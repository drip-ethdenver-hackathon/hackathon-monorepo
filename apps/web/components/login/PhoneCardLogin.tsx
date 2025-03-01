"use client";

import React, { useState } from "react";
import { Button, Input, PhoneInput } from "@repo/ui/components";
import { getAccessToken, useLoginWithSms } from "@privy-io/react-auth";
import Logo from "../Logo";
import { useRouter } from "next/navigation";
import {useCreateWallet} from '@privy-io/react-auth';


export default function PhoneLoginCard() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [touched, setTouched] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [showVerification, setShowVerification] = useState(false);
  const [consentGiven, setConsentGiven] = useState(false);

  const {createWallet} = useCreateWallet();

  const { sendCode, loginWithCode, state } = useLoginWithSms({
    onComplete: async ({ user, isNewUser, wasAlreadyAuthenticated, loginMethod }) => {
      console.log("Login successful", {
        user,
        isNewUser,
        wasAlreadyAuthenticated,
        loginMethod,
      });
      if (isNewUser || !user.wallet) {
        await createWallet();
      }
      const token = await getAccessToken();
      
      // Call connect endpoint to store user data
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/connect`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          credentials: 'include',
          mode: 'cors'
        });

        if (!response.ok) {
          throw new Error('Failed to connect user');
        }

        const data = await response.json();
        console.log('User connected:', data);
      } catch (error) {
        console.error('Connect error:', error);
        // Handle error appropriately
      }

      router.push("/home");
    },
    onError: (error) => {
      console.error("Login failed:", error);
      // Handle error here (e.g., show toast)
    },
  });

  // Format phone number to E.164 format (+1XXXXXXXXXX)
  const formatToE164 = (phoneNumber: string) => {
    // Remove all non-digit characters
    const digits = phoneNumber.replace(/\D/g, "");
    
    // If it's a 10-digit number, add +1 (US country code)
    if (digits.length === 10) {
      return `+1${digits}`;
    }
    // If it's already 11 digits and starts with 1, add +
    if (digits.length === 11 && digits.startsWith("1")) {
      return `+${digits}`;
    }
    return digits;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!showVerification) {
      // Send verification code
      try {
        const formattedPhone = formatToE164(phone);
        await sendCode({
          phoneNumber: formattedPhone,
        });
        setShowVerification(true);
      } catch (error) {
        console.error("Failed to send code:", error);
      }
    } else {
      // Verify code
      try {
        await loginWithCode({
          code: verificationCode,
        });
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

  const isLoading = state.type === "LOADING";

  return (
    <div className="w-full max-w-md mx-auto p-4">
      <div className="flex flex-col items-center gap-4 mb-6">
        <Logo />
        <div className="text-center">
          <h1 className="text-2xl font-bold text-primary">Welcome Back</h1>
          <p className="text-default-500">
            {showVerification 
              ? `Enter the verification code sent to ${phone}`
              : "Enter your phone number to continue"
            }
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        {!showVerification ? (
          <>
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
            <div className="flex items-start gap-2">
              <input
                type="checkbox"
                id="consent"
                className="mt-1"
                checked={consentGiven}
                onChange={(e) => setConsentGiven(e.target.checked)}
                required
              />
              <label htmlFor="consent" className="text-sm text-default-600">
                I consent to receive important messages via SMS, including verification codes and account notifications.
              </label>
            </div>
          </>
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
          isDisabled={(!showVerification && (!isPhoneValid || !consentGiven)) || 
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
                const formattedPhone = formatToE164(phone);
                await sendCode({
                  phoneNumber: formattedPhone,
                });
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
