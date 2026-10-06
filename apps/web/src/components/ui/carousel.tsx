"use client";

import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "@primeicons/react";
import type {
  CarouselContentProps,
  CarouselItemProps,
  CarouselNextProps,
  CarouselPrevProps,
  CarouselRootProps,
} from "@primereact/types/primitive/carousel";
import { Carousel as PRCarousel } from "primereact/carousel";
import * as React from "react";

// `CarouselRootProps`/`CarouselContentProps`/... resolve `className` through
// `BaseComponentProps`'s unpinned `T extends React.ElementType` generic, the
// same known `any`-leak already documented in `datepicker.tsx`'s `DatePicker`
// — re-asserted to its real type below rather than left to leak through
// `cn(...)`/JSX props.
export type CarouselProps = CarouselRootProps;

function Carousel({ className, ...rootProps }: CarouselProps) {
  const rootClassName = className as string | undefined;
  return (
    <PRCarousel.Root
      className={cn("flex flex-col gap-3", rootClassName)}
      {...rootProps}
    />
  );
}

function CarouselContent({ className, ...props }: CarouselContentProps) {
  const contentClassName = className as string | undefined;
  return (
    <PRCarousel.Content
      className={cn("overflow-hidden", contentClassName)}
      {...props}
    />
  );
}

// `value` isn't resolved by `CarouselItemProps`'s own type (its `H` generic
// is `unknown`) — declared explicitly here since `WeekCarousel` needs a
// stable identifier (the day's ISO date) per item.
function CarouselItem({
  className,
  value,
  ...props
}: Omit<CarouselItemProps, "value"> & { value?: string }) {
  const itemClassName = className as string | undefined;
  return (
    <PRCarousel.Item
      value={value}
      className={cn("w-full", itemClassName)}
      {...props}
    />
  );
}

const navButtonClass = `inline-flex items-center justify-center size-8 shrink-0 rounded-full cursor-pointer
    border border-surface-200 bg-surface-0 text-surface-600
    transition-colors duration-150
    hover:bg-surface-100 hover:text-surface-800
    dark:border-surface-700 dark:bg-surface-900 dark:text-surface-300 dark:hover:bg-surface-800
    disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-surface-0 dark:disabled:hover:bg-surface-900
    focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-primary`;

function CarouselPrev({ className, children, ...props }: CarouselPrevProps) {
  const prevClassName = className as string | undefined;
  return (
    <PRCarousel.Prev className={cn(navButtonClass, prevClassName)} {...props}>
      {children ?? <ChevronLeft />}
    </PRCarousel.Prev>
  );
}

function CarouselNext({ className, children, ...props }: CarouselNextProps) {
  const nextClassName = className as string | undefined;
  return (
    <PRCarousel.Next className={cn(navButtonClass, nextClassName)} {...props}>
      {children ?? <ChevronRight />}
    </PRCarousel.Next>
  );
}

export { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrev };
