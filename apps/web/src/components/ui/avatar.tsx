import { cn } from "@/lib/utils";
import type { AvatarGroupProps } from "@primereact/types/primitive/avatargroup";
import { cva, VariantProps } from "class-variance-authority";
import {
  AvatarFallbackProps,
  AvatarImageProps,
  AvatarRootProps,
  Avatar as PRAvatar,
} from "primereact/avatar";
import { AvatarGroup as PRAvatarGroup } from "primereact/avatargroup";
import * as React from "react";

const avatarVariants = cva(
  "relative flex shrink-0 overflow-hidden select-none",
  {
    variants: {
      size: {
        normal: "size-7 text-xs font-medium",
        large: "size-10.5 text-lg font-medium",
        xlarge: "size-14 text-2xl font-medium",
      },
      shape: {
        circle: "rounded-full",
        square: "rounded-md",
      },
    },
    defaultVariants: {
      size: "normal",
      shape: "square",
    },
  },
);

function Avatar({
  className,
  size = "normal",
  shape = "square",
  ...props
}: AvatarRootProps & VariantProps<typeof avatarVariants>) {
  return (
    <PRAvatar.Root
      size={size}
      shape={shape}
      className={cn(avatarVariants({ size, shape, className }))}
      {...props}
    />
  );
}

function AvatarImage({ className, ...props }: AvatarImageProps) {
  return (
    <PRAvatar.Image
      className={cn("size-full aspect-square", className)}
      {...props}
    />
  );
}

function AvatarFallback({ className, ...props }: AvatarFallbackProps) {
  return (
    <PRAvatar.Fallback
      className={cn(
        "size-full rounded-[inherit] flex items-center justify-center bg-surface-200 dark:bg-surface-700 text-surface-600 dark:text-surface-300",
        className,
      )}
      {...props}
    />
  );
}

function AvatarGroup({ className, ...props }: AvatarGroupProps) {
  return (
    <PRAvatarGroup
      className={cn(
        "flex items-center -space-x-2 **:data-[scope=avatar]:data-[part=root]:ring-2 **:data-[scope=avatar]:data-[part=root]:ring-surface-0 dark:**:data-[scope=avatar]:data-[part=root]:ring-surface-900",
        className,
      )}
      {...props}
    />
  );
}

export { Avatar, AvatarFallback, AvatarGroup, AvatarImage };
