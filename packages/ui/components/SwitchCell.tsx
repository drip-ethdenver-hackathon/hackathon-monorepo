"use client";

import React from "react";
import type { SwitchProps } from "@nextui-org/react";
import { extendVariants, Switch } from "@nextui-org/react";
import { cn } from "../lib/utils";

const CustomSwitch = extendVariants(Switch, {
  variants: {
    color: {
      foreground: {
        wrapper: [
          "group-data-[selected=true]:bg-foreground",
          "group-data-[selected=true]:text-background",
        ],
      },
    },
  },
});

export type SwitchCellProps = Omit<SwitchProps, "color"> & {
  label: string;
  description: string;
  color?: SwitchProps["color"] | "foreground";
  classNames?: SwitchProps["classNames"] & {
    description?: string | string[];
  };
};

const SwitchCell = React.forwardRef<HTMLInputElement, SwitchCellProps>(
  (
    { label, description, classNames, children, value, onChange, ...props },
    ref
  ) => (
    <CustomSwitch
      ref={ref}
      classNames={{
        ...classNames,
        base: cn(
          "inline-flex bg-content2 flex-row-reverse w-full max-w-full items-center",
          "justify-between cursor-pointer rounded-md gap-2 p-4",
          classNames?.base
        ),
      }}
      isSelected={value}
      onValueChange={onChange}
      {...props}
    >
      <div className="flex flex-col">
        <div className={cn("text-md", classNames?.label)}>{label}</div>
        <div
          className={cn("text-sm text-default-500", classNames?.description)}
        >
          {description}
        </div>
        {children}
      </div>
    </CustomSwitch>
  )
);

SwitchCell.displayName = "SwitchCell";

export default SwitchCell;
