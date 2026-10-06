"use client";

import { cn } from "@/lib/utils";
import type {
  PopoverArrowProps,
  PopoverCloseProps,
  PopoverContentProps,
  PopoverPopupProps,
  PopoverPortalProps,
  PopoverPositionerProps,
  PopoverRootProps,
  PopoverTriggerProps,
} from "@primereact/types/primitive/popover";
import { Popover as PRPopover } from "primereact/popover";
import * as React from "react";

function Popover({ ...props }: PopoverRootProps) {
  return <PRPopover.Root {...props} />;
}

function PopoverTrigger({ ...props }: PopoverTriggerProps) {
  return <PRPopover.Trigger {...props} />;
}

function PopoverClose({ ...props }: PopoverCloseProps) {
  return <PRPopover.Close {...props} />;
}

function PopoverPortal({ ...props }: PopoverPortalProps) {
  return <PRPopover.Portal {...props} />;
}

function PopoverPositioner({
  sideOffset = 4,
  ...props
}: PopoverPositionerProps) {
  return <PRPopover.Positioner sideOffset={sideOffset} {...props} />;
}

function PopoverPopup({ className, ...props }: PopoverPopupProps) {
  return (
    <PRPopover.Popup
      className={cn(
        `min-w-(--px-positioner-anchor-width) rounded-lg
        border border-surface-200 bg-surface-0 p-2
        text-surface-700 shadow-md
        dark:border-surface-700 dark:bg-surface-900 dark:text-surface-0
        origin-(--px-transform-origin)
        data-enter-from:scale-[0.93] data-enter-from:opacity-0
        data-leave-to:scale-[0.93] data-leave-to:opacity-0
        transition-[opacity,scale] duration-150 ease-out will-change-transform`,
        className,
      )}
      {...props}
    />
  );
}

function PopoverArrow({ className, ...props }: PopoverArrowProps) {
  return (
    <PRPopover.Arrow
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

function PopoverContent({ className, ...props }: PopoverContentProps) {
  return <PRPopover.Content className={cn("p-2", className)} {...props} />;
}

export {
  Popover,
  PopoverArrow,
  PopoverClose,
  PopoverContent,
  PopoverPopup,
  PopoverPortal,
  PopoverPositioner,
  PopoverTrigger,
};
