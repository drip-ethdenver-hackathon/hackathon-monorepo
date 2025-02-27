import React from "react";
import { Button, Spinner } from "@nextui-org/react";

const SubmitRealmUpdateButton = ({ isSubmitting, isLoading, isDisabled }) => (
  <div className="flex justify-end mt-6">
    <Button
      type="submit"
      color="primary"
      size="md"
      className="px-6 py-2"
      disabled={isSubmitting || isLoading || isDisabled}
    >
      {isSubmitting || isLoading ? (
        <div className="flex items-center">
          <Spinner
            size="sm"
            color="white"
            className="mr-2"
            style={{ display: "inline-block", opacity: 1 }}
          />
          <span>Saving...</span>
        </div>
      ) : (
        "Save Realm Settings"
      )}
    </Button>
  </div>
);

export default SubmitRealmUpdateButton;
