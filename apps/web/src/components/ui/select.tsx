"use client";

import { cn } from "@/lib/utils";
import { Check, ChevronDown } from "@primeicons/react";
import type {
  SelectArrowProps,
  SelectClearProps,
  SelectEmptyProps,
  SelectFilterProps,
  SelectFooterProps,
  SelectHeaderProps,
  SelectListProps,
  SelectOptionProps,
  SelectPopupProps,
  SelectPortalProps,
  SelectPositionerProps,
  SelectRootProps,
  SelectTriggerProps,
  SelectValueProps,
} from "@primereact/types/primitive/select";
import { cva, VariantProps } from "class-variance-authority";
import { Select as PRSelect } from "primereact/select";
import * as React from "react";

const selectVariants = cva(
  `group inline-flex cursor-pointer relative select-none rounded-md
    border border-surface-300 hover:border-surface-400 dark:border-surface-700 dark:hover:border-surface-600
    focus-within:border-primary!
    data-filled:bg-surface-50 dark:data-filled:bg-surface-800
    data-invalid:border-red-400 dark:data-invalid:border-red-300
    data-disabled:bg-surface-200 data-disabled:text-surface-500 dark:data-disabled:bg-surface-700 dark:data-disabled:text-surface-400 data-disabled:pointer-events-none
    transition-colors duration-200`,
  {
    variants: {
      size: {
        small:
          "**:data-[part=value]:py-1 **:data-[part=value]:px-2 **:data-[part=value]:text-xs",
        normal:
          "**:data-[part=value]:py-1.5 **:data-[part=value]:px-2.5 **:data-[part=value]:text-sm",
        large:
          "**:data-[part=value]:py-2 **:data-[part=value]:px-3 **:data-[part=value]:text-base",
      },
      variant: {
        filled: "bg-surface-50 dark:bg-surface-800",
        outlined: "bg-surface-0 dark:bg-surface-950",
      },
      fluid: {
        true: "w-full",
      },
    },
    defaultVariants: {
      size: "normal",
      variant: "outlined",
    },
  },
);

function Select({
  className,
  size,
  variant,
  fluid,
  ...props
}: SelectRootProps & VariantProps<typeof selectVariants>) {
  return (
    <PRSelect.Root
      className={cn(selectVariants({ className, size, variant, fluid }))}
      {...props}
    />
  );
}

function SelectTrigger({ className, children, ...props }: SelectTriggerProps) {
  return (
    <PRSelect.Trigger
      className={cn(
        "flex items-center w-full outline-none cursor-pointer",
        className,
      )}
      {...props}
    >
      {children}
      <PRSelect.Indicator className="flex items-center justify-center shrink-0 bg-transparent text-surface-400 w-10 rounded-e-md">
        <ChevronDown />
      </PRSelect.Indicator>
    </PRSelect.Trigger>
  );
}

function SelectValue({ className, ...props }: SelectValueProps) {
  return (
    <PRSelect.Value
      className={cn(
        `block whitespace-nowrap overflow-hidden flex-auto w-[1%]
                text-ellipsis text-left
                bg-transparent border-none outline-none
                group-data-disabled:text-surface-500 dark:group-data-disabled:text-surface-400 group-data-invalid:text-red-600! dark:group-data-invalid:text-red-400!
                data-placeholder:text-surface-500 dark:data-placeholder:text-surface-400 text-surface-700 dark:text-surface-0
                `,
        className,
      )}
      {...props}
    />
  );
}

function SelectClear({ className, ...props }: SelectClearProps) {
  return (
    <PRSelect.Clear
      className={cn(
        "text-surface-400 absolute top-1/2 -mt-2.5 inset-e-10",
        className,
      )}
      {...props}
    />
  );
}

function SelectPortal({ ...props }: SelectPortalProps) {
  return <PRSelect.Portal {...props} />;
}

function SelectPositioner({ ...props }: SelectPositionerProps) {
  return <PRSelect.Positioner {...props} />;
}

function SelectPopup({ className, ...props }: SelectPopupProps) {
  return (
    <PRSelect.Popup
      className={cn(
        `rounded-lg min-w-(--px-positioner-anchor-width)
                bg-surface-0 dark:bg-surface-900
                border border-surface-200 dark:border-surface-700
                text-surface-700 dark:text-surface-0 shadow-md
                origin-(--px-transform-origin)
                data-enter-from:opacity-0 data-enter-from:scale-[0.93]
                data-leave-to:opacity-0 data-leave-to:scale-[0.93]
                transition-[opacity,scale] duration-150 ease-out will-change-transform
                `,
        className,
      )}
      {...props}
    />
  );
}

function SelectHeader({ className, ...props }: SelectHeaderProps) {
  return (
    <PRSelect.Header className={cn("px-2 pt-2 pb-0.5", className)} {...props} />
  );
}

function SelectFilter({ className, ...props }: SelectFilterProps) {
  return (
    <PRSelect.Filter
      className={cn(
        `w-full appearance-none rounded-md outline-hidden
                bg-surface-0 dark:bg-surface-950
                text-surface-700 dark:text-surface-0
                placeholder:text-surface-500 dark:placeholder:text-surface-400
                border border-surface-300 dark:border-surface-700
                enabled:hover:border-surface-400 dark:enabled:hover:border-surface-600
                enabled:focus:border-primary
                disabled:bg-surface-200 disabled:text-surface-500
                dark:disabled:bg-surface-700 dark:disabled:text-surface-400
                ps-3 pe-10 py-2
                transition-colors duration-200`,
        className,
      )}
      {...props}
    />
  );
}

function SelectList({ className, children, ...props }: SelectListProps) {
  return (
    <PRSelect.List
      className={cn(
        "m-0 p-1 list-none space-y-0.5 overflow-auto max-h-(--px-available-height) scroll-py-12",
        className,
      )}
      {...props}
    >
      {children ??
        ((instance: {
          options: unknown[];
          listbox: {
            isOptionGroup: (option: unknown) => boolean;
            getOptionGroupLabel: (option: unknown) => string;
            getOptionLabel: (option: unknown) => string;
          };
        }) =>
          instance.options?.map((option: unknown, index: number) => {
            const group = instance.listbox?.isOptionGroup(option);

            return (
              <SelectOption key={index} index={index} group={group}>
                {group
                  ? instance.listbox?.getOptionGroupLabel(
                      (option as Record<string, unknown>).optionGroup,
                    )
                  : instance.listbox?.getOptionLabel(option)}
              </SelectOption>
            );
          }))}
    </PRSelect.List>
  );
}

function SelectOption({
  className,
  children,
  group = false,
  ...props
}: SelectOptionProps) {
  return (
    <PRSelect.Option
      className={cn(
        `whitespace-nowrap relative overflow-hidden flex items-center gap-2
                px-2.5 py-1 border-none text-sm 
                select-none [&_svg]:pointer-events-none [&_svg]:shrink-0`,
        group
          ? "font-semibold text-surface-500 dark:text-surface-400 pl-8 mt-1"
          : `cursor-pointer font-normal bg-transparent rounded-sm data-focused:bg-surface-100 dark:data-focused:bg-surface-800 data-focused:text-surface-800 dark:data-focused:text-surface-0
                data-selected:bg-highlight data-focused:data-selected:bg-highlight-emphasis
                text-surface-700 dark:text-surface-0 
                transition-colors duration-200`,
        className,
      )}
      {...props}
    >
      {!group && (
        <PRSelect.OptionIndicator
          className={cn(
            "relative flex items-center justify-center pointer-events-none opacity-0 data-selected:opacity-100",
            className,
          )}
        >
          <Check />
        </PRSelect.OptionIndicator>
      )}
      {children}
    </PRSelect.Option>
  );
}

function SelectEmpty({ className, ...props }: SelectEmptyProps) {
  return <PRSelect.Empty className={cn("px-3 py-2", className)} {...props} />;
}

function SelectFooter({ className, ...props }: SelectFooterProps) {
  return <PRSelect.Footer className={cn("", className)} {...props} />;
}

function SelectArrow({ className, ...props }: SelectArrowProps) {
  return (
    <PRSelect.Arrow
      className={cn(
        `absolute border border-surface-200 dark:border-surface-700 bg-surface-0 dark:bg-surface-900 size-3 rounded-bl-[3px] [clip-path:polygon(0_100%,0_0,100%_100%)]
                data-[side=top]:-bottom-1.5 data-[side=top]:left-(--px-placer-arrow-x) data-[side=top]:-translate-x-1/2 data-[side=top]:-rotate-45
                data-[side=bottom]:-top-1.5 data-[side=bottom]:left-(--px-placer-arrow-x) data-[side=bottom]:-translate-x-1/2 data-[side=bottom]:rotate-135
                data-[side=left]:-right-1.5 data-[side=left]:top-(--px-placer-arrow-y) data-[side=left]:-translate-y-1/2 data-[side=left]:-rotate-135
                data-[side=right]:-left-1.5 data-[side=right]:top-(--px-placer-arrow-y) data-[side=right]:-translate-y-1/2 data-[side=right]:rotate-45`,
        className,
      )}
      {...props}
    />
  );
}

export {
  Select,
  SelectArrow,
  SelectClear,
  SelectEmpty,
  SelectFilter,
  SelectFooter,
  SelectHeader,
  SelectList,
  SelectOption,
  SelectPopup,
  SelectPortal,
  SelectPositioner,
  SelectTrigger,
  SelectValue,
};
