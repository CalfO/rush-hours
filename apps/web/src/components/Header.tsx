import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import {
  deleteReferenceWeek,
  type ReferenceWeekState,
} from "../api/reference-week";
import ProfileModal from "./ProfileModal";
import WorkScheduleModal from "./WorkScheduleModal";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { ConfirmDialog } from "./ui/ConfirmDialog";
import {
  Menu,
  MenuItem,
  MenuList,
  MenuPopup,
  MenuPortal,
  MenuPositioner,
  MenuSeparator,
  MenuTrigger,
} from "./ui/menu";
import { Tabs, TabsList, TabsTab } from "./ui/tabs";
import { ToggleButton } from "./ui/togglebutton";
import { ToggleButtonGroup } from "./ui/togglebuttongroup";

/**
 * Spec §7.1 — the two supported UI languages. Labels are the language codes
 * themselves (FR/EN), not translated strings — a language switcher's own
 * option labels conventionally stay in each language's own name/code
 * regardless of the currently active locale.
 */
const LANGUAGE_OPTIONS: { value: string; label: string }[] = [
  { value: "fr", label: "FR" },
  { value: "en", label: "EN" },
];

/**
 * Derives avatar initials from `user.firstName`/`user.lastName` first
 * letters. Both are guaranteed non-null for any user reaching a header
 * route (`RequireAuth` routes anyone without them to `/onboarding` first,
 * see `apps/web/src/auth/RequireAuth.tsx`) — `user.username[0]` is kept
 * only as a defensive fallback, not the expected path.
 */
function getInitials(user: {
  firstName: string | null;
  lastName: string | null;
  username: string;
}): string {
  if (user.firstName && user.lastName) {
    return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
  }
  return user.username[0]?.toUpperCase() ?? "";
}

interface HeaderProps {
  /** §5.6/§5.7 — owned by `AppLayout`, `null` until its fetch resolves. */
  referenceWeek: ReferenceWeekState | null;
  refreshReferenceWeek: () => void;
}

/**
 * Sticky header rendered on every protected view (spec §7.1), via
 * `AppLayout`. Left to right: title, nav (routed `Tabs`), language
 * `ToggleButtonGroup`, avatar menu. `profileModalOpen`/`workScheduleModalOpen`/
 * `deleteConfirmOpen` are owned here rather than inside the `Menu` itself:
 * the menu closes on item selection, but the modal it opens must outlive
 * that close — so the modals render as siblings of the header bar, not
 * nested inside `Menu`.
 */
export function Header({ referenceWeek, refreshReferenceWeek }: HeaderProps) {
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [workScheduleModalOpen, setWorkScheduleModalOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // `RequireAuth` guarantees `user` is set for any route this header
  // renders on, but `useAuth()`'s type is `AuthUser | null` — guard rather
  // than a non-null assertion.
  const initials = user ? getInitials(user) : "";

  async function handleLogout() {
    // Only calls the API + resets `AuthProvider` state — no manual
    // `navigate("/login")` here. `RequireAuth` re-renders on the resulting
    // `status: "unauthenticated"` change and redirects on its own (same
    // mechanism already used elsewhere in this app).
    await logout();
  }

  return (
    <>
      <header className="sticky top-0 z-30 flex items-center gap-6 border-b border-surface-200 bg-surface-0 px-4 py-2 dark:border-surface-700 dark:bg-surface-900">
        <span className="shrink-0 text-lg font-semibold text-surface-900 dark:text-surface-0">
          {t("app.title")}
        </span>

        <Tabs
          value={location.pathname}
          onValueChange={(event) => {
            if (typeof event.value === "string") {
              navigate(event.value);
            }
          }}
        >
          <TabsList>
            <TabsTab value="/">{t("nav.entry")}</TabsTab>
            <TabsTab value="/analytics">{t("nav.analytics")}</TabsTab>
          </TabsList>
        </Tabs>

        <div className="ml-auto flex items-center gap-3">
          <ToggleButtonGroup
            value={i18n.language}
            onValueChange={(event) => {
              if (typeof event.value === "string") {
                void i18n.changeLanguage(event.value);
              }
            }}
            aria-label={t("header.languageLabel")}
          >
            {LANGUAGE_OPTIONS.map((option) => (
              <ToggleButton key={option.value} value={option.value}>
                {option.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>

          <Menu>
            <MenuTrigger className="cursor-pointer rounded-full outline-none focus-visible:outline focus-visible:outline-primary">
              <Avatar shape="circle">
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
            </MenuTrigger>
            <MenuPortal>
              <MenuPositioner sideOffset={4}>
                <MenuPopup>
                  <MenuList>
                    <MenuItem onSelect={() => setProfileModalOpen(true)}>
                      {t("header.myProfile")}
                    </MenuItem>
                    <MenuItem onSelect={() => setWorkScheduleModalOpen(true)}>
                      {t("header.myWorkSchedule")}
                    </MenuItem>
                    {referenceWeek?.exists && (
                      <MenuItem onSelect={() => setDeleteConfirmOpen(true)}>
                        {t("header.deleteReferenceWeek")}
                      </MenuItem>
                    )}
                    <MenuSeparator />
                    <MenuItem onSelect={() => void handleLogout()}>
                      {t("header.logout")}
                    </MenuItem>
                  </MenuList>
                </MenuPopup>
              </MenuPositioner>
            </MenuPortal>
          </Menu>
        </div>
      </header>

      <ProfileModal
        open={profileModalOpen}
        onOpenChange={setProfileModalOpen}
      />
      <WorkScheduleModal
        open={workScheduleModalOpen}
        onOpenChange={setWorkScheduleModalOpen}
      />
      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title={t("referenceWeek.deleteConfirmTitle")}
        description={t("referenceWeek.deleteConfirmDescription")}
        confirmLabel={t("common.confirm")}
        cancelLabel={t("common.cancel")}
        onConfirm={async () => {
          await deleteReferenceWeek();
          refreshReferenceWeek();
        }}
      />
    </>
  );
}
