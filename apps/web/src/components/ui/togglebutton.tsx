"use client";
import { cn } from "@/lib/utils";
import { ToggleButtonRootProps } from "primereact/togglebutton";
import { cva } from "class-variance-authority";
import { ToggleButton as PRToggleButton } from "primereact/togglebutton";
import * as React from "react";

const toggleButtonVariants = cva(
  `p-1 font-medium inline-flex items-center justify-center overflow-hidden relative cursor-pointer select-none
    border border-surface-100 dark:border-surface-950 rounded-md
    bg-surface-100 dark:bg-surface-950
    text-surface-500 dark:text-surface-400
    data-pressed:text-surface-700 dark:data-pressed:text-surface-0
    focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-primary focus-visible:z-1
    disabled:cursor-default
    disabled:bg-surface-200 disabled:border-surface-200 disabled:text-surface-500
    disabled:dark:bg-surface-700 disabled:dark:border-surface-700 disabled:dark:text-surface-400
    aria-invalid:border-red-400 dark:aria-invalid:border-red-300
    transition-colors duration-200
    `,
  {
    variants: {
      size: {
        small: "text-xs",
        normal: "text-sm",
        large: "text-base",
      },
      fluid: {
        true: "w-full",
      },
    },
    defaultVariants: {
      size: "normal",
    },
  },
);

function ToggleButton({
  className,
  children,
  size = "normal",
  invalid,
  fluid,
  ...props
}: ToggleButtonRootProps) {
  return (
    <PRToggleButton.Root
      size={size}
      invalid={invalid}
      fluid={fluid}
      aria-invalid={invalid}
      className={cn(toggleButtonVariants({ size, fluid, className }))}
      {...props}
    >
      <PRToggleButton.Indicator
        className={`relative flex-auto inline-flex items-center justify-center gap-2 py-0.5 px-2.5
        rounded-md transition-colors duration-200
        data-pressed:bg-surface-0 dark:data-pressed:bg-surface-800`}
      >
        {children}
      </PRToggleButton.Indicator>
    </PRToggleButton.Root>
  );
}

export { ToggleButton };
