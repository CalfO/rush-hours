import { Times } from "@primeicons/react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogBackdrop,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogHeaderActions,
  DialogPopup,
  DialogPortal,
  DialogPositioner,
  DialogTitle,
} from "./dialog";

interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /**
   * Whether Escape / outside-click can dismiss the modal. Defaults to `true`.
   * Not exercised by this lot's only consumer (`WorkScheduleModal`), but kept
   * on the shared wrapper because the non-skippable onboarding flow (spec
   * §5.4, a later lot) needs to pin this modal open with `dismissible={false}`.
   */
  dismissible?: boolean;
  /**
   * Body + action row are entirely the caller's concern — this wrapper only
   * owns the Dialog chrome (backdrop, popup, header/title/close button), so
   * it stays generic across every future modal built on it, not shaped
   * narrowly around this lot's work-schedule form.
   */
  children: ReactNode;
}

/**
 * Base modal wrapper over the PrimeReact `Dialog` Primitive
 * (`src/components/ui/dialog.tsx`). Purely controlled — no colocated
 * trigger — since every call site (this lot's `WorkScheduleModal`, and
 * later onboarding/header call sites) opens it from external state.
 */
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  dismissible = true,
  children,
}: ModalProps) {
  const { t } = useTranslation();

  return (
    <Dialog
      open={open}
      onOpenChange={(event) => onOpenChange(Boolean(event.value))}
      dismissable={dismissible}
      closeOnEscape={dismissible}
    >
      <DialogPortal>
        <DialogBackdrop />
        <DialogPositioner>
          <DialogPopup className="w-full max-w-lg">
            <DialogHeader>
              <DialogTitle>{title}</DialogTitle>
              {dismissible && (
                <DialogHeaderActions>
                  <DialogClose aria-label={t("common.close")}>
                    <Times />
                  </DialogClose>
                </DialogHeaderActions>
              )}
            </DialogHeader>
            <DialogContent>
              {description && (
                <p className="mb-4 text-sm text-surface-500">{description}</p>
              )}
              {children}
            </DialogContent>
          </DialogPopup>
        </DialogPositioner>
      </DialogPortal>
    </Dialog>
  );
}
