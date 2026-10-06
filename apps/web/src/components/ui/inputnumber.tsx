"use client";

import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp } from "@primeicons/react";
import type {
  InputNumberDecrementProps,
  InputNumberGroupProps,
  InputNumberIncrementProps,
  InputNumberInputProps,
  InputNumberRootProps,
} from "@primereact/types/primitive/inputnumber";
import { VariantProps } from "class-variance-authority";
import { InputNumber as PRInputNumber } from "primereact/inputnumber";
import * as React from "react";
import { inputTextVariants } from "./inputtext";

function InputNumber({
  className,
  layout = "stacked",
  fluid,
  ...props
}: InputNumberRootProps) {
  return (
    <PRInputNumber.Root
      layout={layout}
      fluid={fluid}
      className={cn(
        "inline-flex relative isolate data-[layout=vertical]:flex-col data-fluid:w-full data-[layout=vertical]:w-10",
        className,
      )}
      {...props}
    />
  );
}

function InputNumberInput({
  className,
  size,
  variant = "outlined",
  ...props
}: InputNumberInputProps & VariantProps<typeof inputTextVariants>) {
  return (
    <PRInputNumber.Input
      className={cn(
        inputTextVariants({ size, variant }),
        "peer flex-auto",
        // layout
        "in-data-[layout=stacked]:pe-9 in-data-[layout=vertical]:px-1!",
        "in-data-[layout=horizontal]:rounded-none in-data-[layout=horizontal]:order-2",
        "in-data-[layout=vertical]:rounded-none in-data-[layout=vertical]:order-2 in-data-[layout=vertical]:text-center in-data-[layout=vertical]:w-full",
        // fluid
        "in-data-fluid:w-[1%]",
        "in-data-fluid:in-data-[layout=vertical]:w-full",

        className,
      )}
      {...props}
    />
  );
}

function InputNumberGroup({ className, ...props }: InputNumberGroupProps) {
  return (
    <PRInputNumber.Group
      className={cn(
        "flex flex-col absolute top-px inset-e-px h-[calc(100%-2px)] z-1",
        className,
      )}
      {...props}
    />
  );
}

const buttonBaseClasses = `inline-flex items-center justify-center flex-none cursor-pointer
    bg-surface-0 dark:bg-surface-950 text-surface-500 dark:text-surface-400
    hover:bg-surface-100 dark:hover:bg-surface-800 hover:text-surface-700 dark:hover:text-surface-0
    active:bg-surface-200 dark:active:bg-surface-700
    transition-colors duration-200
    disabled:opacity-60 disabled:pointer-events-none disabled:cursor-not-allowed
    [&>svg]:size-2.5 w-8`;

function InputNumberIncrement({
  className,
  ...props
}: InputNumberIncrementProps) {
  return (
    <PRInputNumber.Increment
      className={cn(
        buttonBaseClasses,
        "in-data-[layout=stacked]:flex-auto in-data-[layout=stacked]:rounded-tr-md in-data-[layout=stacked]:border-0 in-data-[layout=stacked]:p-0",
        "in-data-[layout=horizontal]:order-3 in-data-[layout=horizontal]:border in-data-[layout=horizontal]:border-surface-300 dark:in-data-[layout=horizontal]:border-surface-700 in-data-[layout=horizontal]:rounded-r-md in-data-[layout=horizontal]:border-l-0",
        "in-data-[layout=vertical]:order-1 in-data-[layout=vertical]:border in-data-[layout=vertical]:border-surface-300 dark:in-data-[layout=vertical]:border-surface-700 in-data-[layout=vertical]:rounded-t-md in-data-[layout=vertical]:rounded-b-none in-data-[layout=vertical]:border-b-0 in-data-[layout=vertical]:w-full in-data-[layout=vertical]:py-1",
        className,
      )}
      {...props}
    >
      {props.children ?? <ChevronUp />}
    </PRInputNumber.Increment>
  );
}

function InputNumberDecrement({
  className,
  ...props
}: InputNumberDecrementProps) {
  return (
    <PRInputNumber.Decrement
      className={cn(
        buttonBaseClasses,
        "in-data-[layout=stacked]:flex-auto in-data-[layout=stacked]:rounded-br-md in-data-[layout=stacked]:border-0 in-data-[layout=stacked]:p-0",
        "in-data-[layout=horizontal]:order-1 in-data-[layout=horizontal]:border in-data-[layout=horizontal]:border-surface-300 dark:in-data-[layout=horizontal]:border-surface-700 in-data-[layout=horizontal]:rounded-l-md in-data-[layout=horizontal]:border-r-0",
        "in-data-[layout=vertical]:order-3 in-data-[layout=vertical]:border in-data-[layout=vertical]:border-surface-300 dark:in-data-[layout=vertical]:border-surface-700 in-data-[layout=vertical]:rounded-b-md in-data-[layout=vertical]:rounded-t-none in-data-[layout=vertical]:border-t-0 in-data-[layout=vertical]:w-full in-data-[layout=vertical]:py-1",
        className,
      )}
      {...props}
    >
      {props.children ?? <ChevronDown />}
    </PRInputNumber.Decrement>
  );
}

export {
  InputNumber,
  InputNumberDecrement,
  InputNumberGroup,
  InputNumberIncrement,
  InputNumberInput,
};
