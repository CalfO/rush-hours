"use client";
import { cn } from "@/lib/utils";
import type { ToggleButtonGroupProps } from "@primereact/types/primitive/togglebuttongroup";
import { cva } from "class-variance-authority";
import { ToggleButtonGroup as PRToggleButtonGroup } from "primereact/togglebuttongroup";
import * as React from "react";

const toggleButtonGroupVariants = cva(
  `inline-flex select-none align-bottom outline-transparent rounded-md
    **:data-[scope=togglebutton]:data-[part=root]:rounded-none **:data-[scope=togglebutton]:data-[part=root]:border-l-0
    **:data-[scope=togglebutton]:data-[part=root]:first:rounded-l-md **:data-[scope=togglebutton]:data-[part=root]:first:border-l
    **:data-[scope=togglebutton]:data-[part=root]:last:rounded-r-md **:data-[scope=togglebutton]:data-[part=root]:first:border-r`,
  {
    variants: {
      size: {
        small: "**:data-[scope=togglebutton]:data-[part=root]:text-xs",
        normal: "**:data-[scope=togglebutton]:data-[part=root]:text-sm",
        large: "**:data-[scope=togglebutton]:data-[part=root]:text-base",
      },
      fluid: {
        true: "flex w-full **:data-[scope=togglebutton]:data-[part=root]:flex-1",
      },
    },
    defaultVariants: {
      size: "normal",
    },
  },
);

function ToggleButtonGroup({
  className,
  size = "normal",
  fluid,
  ...props
}: ToggleButtonGroupProps) {
  return (
    <PRToggleButtonGroup
      size={size}
      fluid={fluid}
      className={cn(toggleButtonGroupVariants({ size, fluid, className }))}
      {...props}
    />
  );
}

export { ToggleButtonGroup };
