import React from "react";
import { cn } from "../lib/utils";

const AccountWrapper = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ children, className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-md bg-content2 p-4",
      className
    )}
    {...props}
  >
    {children}
  </div>
));

AccountWrapper.displayName = "AccountWrapper";

export default AccountWrapper;