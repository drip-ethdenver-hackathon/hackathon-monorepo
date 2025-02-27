import React from "react";
import { Button, Spinner } from "@nextui-org/react";

interface SubmitProfileUpdateButtonProps {
  isSubmitting: boolean;
  isLoading: boolean;
}

const SubmitProfileUpdateButton: React.FC<SubmitProfileUpdateButtonProps> = ({ isSubmitting, isLoading }) => (
  <div className="flex justify-end mt-6">
    <Button
      type="submit"
      color="primary"
      size="md"
      className="px-6 py-2"
      disabled={isSubmitting || isLoading}
    >
      {isLoading ? (
        <div className="flex items-center">
          {/* NextUI Spinner with adjusted properties */}
          <Spinner
            size="sm"
            color="white"
            className="mr-2"
            style={{ display: "inline-block", opacity: 1 }}
          />

          {/* Fallback text */}
          {!Spinner && <span className="mr-2">(Loading...)</span>}

          {/* CSS-based spinner as an alternative */}
          {/* <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div> */}

          <span>Saving...</span>
        </div>
      ) : (
        "Save Profile"
      )}
    </Button>
  </div>
);

export default SubmitProfileUpdateButton;
