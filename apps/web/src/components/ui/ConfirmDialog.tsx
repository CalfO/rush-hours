import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal } from "./Modal";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void | Promise<void>;
  /**
   * Forwarded to the underlying `Modal`'s own `dismissible` prop. Defaults
   * to `true` — nothing in this lot needs a non-dismissible confirmation.
   */
  dismissible?: boolean;
}

/**
 * Generic Yes/No confirmation modal built on `ui/Modal.tsx`, per spec §5.5's
 * own suggestion — reused verbatim by the save-prompt (§5.5, "Enregistrer
 * comme semaine de référence ?") and the delete confirmation (§5.6,
 * "Supprimer la semaine de référence ?") rather than duplicating the same
 * submit/error/close mechanics twice. Domain-free (lives in `ui/`, same
 * genericity level as `Modal.tsx` itself) — every string is caller-supplied.
 *
 * Mirrors `WorkScheduleForm`'s own submit idiom (`WorkScheduleModal.tsx`):
 * local `isSubmitting`/`submitError` state, `setState` only inside the async
 * `try`/`catch`, never synchronously inside an effect body. Confirm awaits
 * `onConfirm()` and only closes on success; a rejection surfaces an inline
 * error and leaves the dialog open so the user can retry or cancel. Cancel
 * closes synchronously — this is the only path (together with a dismissible
 * close) callers should treat as an explicit decline, since a successful
 * confirm also calls `onOpenChange(false)`.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  dismissible = true,
}: ConfirmDialogProps) {
  const { t } = useTranslation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function handleConfirm() {
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      await onConfirm();
      setIsSubmitting(false);
      onOpenChange(false);
    } catch {
      setIsSubmitting(false);
      setSubmitError(t("common.genericError"));
    }
  }

  // Also clears a stale error from a previous failed attempt: this
  // component is rendered unconditionally by its callers (a sibling of the
  // menu/other modals, per `Header.tsx`'s established "modal state owned as
  // sibling" pattern) rather than mounted only while `open`, so nothing
  // else would reset it on reopen. Resetting here (an event handler, not an
  // effect) avoids the synchronous-setState-in-effect pattern this repo's
  // lint config forbids (`react-hooks/set-state-in-effect`).
  function handleCancel() {
    setSubmitError(null);
    onOpenChange(false);
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      dismissible={dismissible}
    >
      {submitError && (
        <p className="mb-3 text-sm text-error-700">{submitError}</p>
      )}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={handleCancel}
          disabled={isSubmitting}
          className="rounded-md border border-surface-300 px-4 py-2 text-sm text-surface-700 hover:bg-surface-100 disabled:opacity-50"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={() => void handleConfirm()}
          disabled={isSubmitting}
          className="rounded-md bg-primary-600 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
