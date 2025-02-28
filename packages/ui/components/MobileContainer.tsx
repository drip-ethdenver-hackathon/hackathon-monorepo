import React from "react";
import { cn } from "../lib/utils";

const MobileContainer = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white">
      <div
        className={cn(
          "relative w-full max-w-[420px] h-auto overflow-hidden bg-white",
          className,
        )}
      >
        <div className="flex w-full min-h-[100dvh] flex-col justify-center gap-2 bg-white">
          {children}
        </div>
      </div>
    </div>
  );
};

export default MobileContainer;
