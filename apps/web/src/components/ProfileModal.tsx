import { useTranslation } from "react-i18next";
import type { AuthUser } from "../api/auth";
import { useAuth } from "../auth/AuthProvider";
import { ProfileForm } from "./ProfileForm";
import { Modal } from "./ui/Modal";

interface ProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (user: AuthUser) => void;
}

/**
 * Spec §7.1 — "Mon profil" settings modal, reachable from the header
 * avatar menu (the header itself is a later lot; this lot only builds the
 * modal, same precedent as `WorkScheduleModal` before its trigger existed).
 * Normal `dismissible` default (unlike onboarding step 2's mandatory
 * `WorkScheduleModal` usage) — this is a voluntary edit, not a gate.
 *
 * `ProfileForm` is only rendered while `open`, mirroring
 * `WorkScheduleModal`'s `WorkScheduleForm` lazy-mount pattern — see that
 * file's doc comment for the full reasoning (fetch/state-reset-on-reopen
 * via mount lifecycle rather than an `open`-keyed effect). Here there's no
 * fetch (defaults come straight from `useAuth().user`, already live), but
 * the same lazy-mount keeps the form's internal RHF state fresh each time
 * the modal reopens instead of carrying over a previous edit session.
 */
export default function ProfileModal({
  open,
  onOpenChange,
  onSaved,
}: ProfileModalProps) {
  const { t } = useTranslation();
  const { user } = useAuth();

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={t("profile.title")}>
      {open && user && (
        <ProfileForm
          defaultValues={{
            firstName: user.firstName ?? "",
            lastName: user.lastName ?? "",
            email: user.email ?? "",
          }}
          submitLabel={t("profile.save")}
          onCancel={() => onOpenChange(false)}
          onSuccess={(savedUser) => {
            onOpenChange(false);
            onSaved?.(savedUser);
          }}
        />
      )}
    </Modal>
  );
}
