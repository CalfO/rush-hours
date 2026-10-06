"use client";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "@primeicons/react";
import {
  TabsListProps,
  TabsPanelProps,
  TabsPanelsProps,
  TabsRootProps,
  TabsTabProps,
} from "primereact/tabs";
import { Tabs as PRTabs } from "primereact/tabs";
import * as React from "react";

function Tabs({ className, ...props }: TabsRootProps) {
  return <PRTabs.Root className={cn("flex flex-col", className)} {...props} />;
}

function TabsList({ className, children, ...props }: TabsListProps) {
  return (
    <PRTabs.List
      className={cn(
        "flex relative overflow-hidden rounded-xl bg-surface-100 dark:bg-surface-800 p-1",
        className,
      )}
      {...props}
    >
      <PRTabs.Prev
        className={`absolute shrink-0 top-0 z-20 h-full flex items-center justify-center cursor-pointer
        bg-surface-100 dark:bg-surface-800 text-surface-500 dark:text-surface-400 hover:text-surface-700 dark:hover:text-surface-0 w-9
        focus-visible:z-10 focus-visible:outline focus-visible:-outline-offset-1 focus-visible:outline-primary
        transition-colors duration-200 inset-s-0`}
      >
        <ChevronLeft />
      </PRTabs.Prev>
      <PRTabs.Content className="grow relative flex min-h-0 overflow-x-auto overflow-y-clip overscroll-y-contain overscroll-x-auto scroll-smooth scrollbar-none">
        {/* Elevated-chip style: a sliding raised chip behind whichever tab
            is active, sized/positioned from the same `--px-active-bar-*`
            vars the original underline used — the headless `useTabs` hook
            already measures the full active *tab* (offsetWidth/Height, not
            just its text), so this chip exactly matches the tab's own
            bounds, not an approximation. */}
        <PRTabs.Indicator className="absolute z-0 block w-[var(--px-active-bar-width)] h-[var(--px-active-bar-height)] left-[var(--px-active-bar-left)] top-[var(--px-active-bar-top)] rounded-lg bg-surface-0 dark:bg-surface-950 shadow-sm transition-[left,top,width,height] duration-[250ms] ease-[cubic-bezier(0.35,0,0.25,1)]" />
        {children}
      </PRTabs.Content>
      <PRTabs.Next
        className={`absolute shrink-0 top-0 z-20 h-full flex items-center justify-center cursor-pointer
        bg-surface-100 dark:bg-surface-800 text-surface-500 dark:text-surface-400 hover:text-surface-700 dark:hover:text-surface-0 w-9
        focus-visible:z-10 focus-visible:outline focus-visible:-outline-offset-1 focus-visible:outline-primary
        transition-colors duration-200 inset-e-0`}
      >
        <ChevronRight />
      </PRTabs.Next>
    </PRTabs.List>
  );
}

function TabsTab({ className, ...props }: TabsTabProps) {
  return (
    <PRTabs.Tab
      className={cn(
        `shrink-0 cursor-pointer select-none relative z-10 whitespace-nowrap inline-flex items-center gap-2 py-2 px-4 rounded-lg font-semibold text-sm
        text-surface-500 dark:text-surface-400 transition-colors duration-200
        not-data-active:hover:text-surface-700 dark:not-data-active:hover:text-surface-0
        data-active:text-primary-700 dark:data-active:text-primary-200
        disabled:pointer-events-none disabled:opacity-60
        focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-primary`,
        className,
      )}
      {...props}
    />
  );
}

function TabsPanels({ className, ...props }: TabsPanelsProps) {
  return (
    <PRTabs.Panels
      className={cn(
        `bg-surface-0 dark:bg-surface-900 text-surface-700 dark:text-surface-0 p-4 pt-3 outline-none`,
        className,
      )}
      {...props}
    />
  );
}

function TabsPanel({ className, ...props }: TabsPanelProps) {
  return <PRTabs.Panel className={cn("", className)} {...props} />;
}

export { Tabs, TabsList, TabsPanel, TabsPanels, TabsTab };
