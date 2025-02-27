"use client";

import React from "react";
import { Input, InputProps } from "@nextui-org/react";

export interface PhoneInputProps extends Omit<InputProps, "value" | "onChange"> {
  /**
   * The current phone input value, e.g. "(123) 456-7890"
   */
  value: string;
  /**
   * Callback triggered whenever the user changes the input value
   */
  onChange: (value: string) => void;
  /**
   * Optional external error message that overrides the component’s own
   */
  errorMessage?: string;
  /**
   * If true, show validation error only on blur, rather than on every keystroke
   */
  validateOnBlur?: boolean;
}

/**
 * Safely removes all non-digit characters.
 */
const extractDigits = (input: string) => input.replace(/\D/g, "");

/**
 * Formats a US phone number, optionally handling a leading "1" (US country code).
 * E.g. "1234567890" -> "(123) 456-7890"
 *      "11234567890" -> "1 (123) 456-7890"
 */
const formatPhoneNumber = (rawDigits: string) => {
  if (!rawDigits) return "";

  // Optional: handle "1" as a US country code
  let country = "";
  let digits = rawDigits;

  // If it starts with "1" and length > 10, treat the first digit as country code
  if (rawDigits.length > 10 && rawDigits.startsWith("1")) {
    country = "1 ";
    digits = rawDigits.slice(1);
  }

  // Then format the next 10 digits (area code + local)
  const area = digits.slice(0, 3);
  const middle = digits.slice(3, 6);
  const last = digits.slice(6, 10);

  let formatted = "";
  if (area) {
    formatted = `(${area}`;
  }
  if (middle) {
    formatted += `) ${middle}`;
  }
  if (last) {
    formatted += `-${last}`;
  }

  // Include country code if present
  return `${country}${formatted}`.trim();
};

/**
 * Checks if the given phone number has exactly 10 digits (or 11 if including leading "1").
 */
const isValidPhoneNumber = (formattedPhone: string) => {
  const digits = extractDigits(formattedPhone);

  // Strictly require 10 digits, or 11 if it starts with "1"
  if (digits.length === 10) return true;
  if (digits.length === 11 && digits.startsWith("1")) return true;
  return false;
};

const PhoneInput = React.forwardRef<HTMLInputElement, PhoneInputProps>(
  (
    {
      value,
      onChange,
      errorMessage,
      validateOnBlur = false,
      ...props
    }: PhoneInputProps,
    ref: React.Ref<HTMLInputElement>
  ) => {
    /**
     * Handle controlled input change.
     * This approach also preserves the cursor position after formatting.
     */
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const { selectionStart, selectionEnd, value: inputValue } = e.target;
      if (selectionStart == null || selectionEnd == null) {
        // Fallback: no caret info
        onChange(formatPhoneNumber(extractDigits(inputValue)));
        return;
      }

      // Digit-only version before formatting
      const rawDigitsBefore = extractDigits(value);
      // Digit-only version after user typed
      const rawDigitsAfter = extractDigits(inputValue);

      // Format the new digits
      const newFormatted = formatPhoneNumber(rawDigitsAfter);

      // Attempt to preserve caret:
      // We figure out how many digits were added or removed
      // from the old string to the new string, then approximate
      // a new caret position. This is naive but works fairly well
      // for simple phone formats.

      const oldPos = selectionStart;
      const digitsBeforeCaret = extractDigits(inputValue.slice(0, oldPos));
      const caretTargetIndex = digitsBeforeCaret.length;
      // Now we walk through the new formatted string to find
      // where that many digits appear
      let newCaretPos = 0;
      let digitsSeen = 0;

      for (let i = 0; i < newFormatted.length; i++) {
        if (/\d/.test(newFormatted[i])) {
          digitsSeen++;
        }
        if (digitsSeen === caretTargetIndex) {
          newCaretPos = i + 1;
          break;
        }
      }

      onChange(newFormatted);

      // Defer setting the selection range until after render
      // so React updates the Input value first.
      requestAnimationFrame(() => {
        if (ref && typeof ref !== "function" && ref.current) {
          ref.current.setSelectionRange(newCaretPos, newCaretPos);
        }
      });
    };

    /**
     * If we're validating on blur, we only show an error after user leaves the field.
     * Otherwise, show on every keystroke if invalid.
     */
    const [touched, setTouched] = React.useState(false);
    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      setTouched(true);
      props.onBlur?.(e);
    };

    const showError =
      !!errorMessage ||
      ((touched || !validateOnBlur) && value && !isValidPhoneNumber(value));

    const finalErrorMessage =
      errorMessage ||
      (showError && value && !isValidPhoneNumber(value)
        ? "Please enter a valid phone number"
        : undefined);

    return (
      <Input
        ref={ref}
        type="tel"
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder="(555) 555-5555"
        labelPlacement="outside"
        isInvalid={!!finalErrorMessage}
        errorMessage={finalErrorMessage}
        {...props}
      />
    );
  }
);

PhoneInput.displayName = "PhoneInput";

export default PhoneInput;
