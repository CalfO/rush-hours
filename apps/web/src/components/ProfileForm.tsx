import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Controller, useForm, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { profileSchema, type ProfileInput } from "@rushhours/domain";
import { updateProfile } from "../api/users";
import type { AuthUser } from "../api/auth";
import { Button } from "./ui/button";
import { InputText } from "./ui/inputtext";

interface ProfileFormProps {
  defaultValues: ProfileInput;
  submitLabel: string;
  /** Called with the freshly-saved user once `PATCH /users/me` succeeds. */
  onSuccess: (user: AuthUser) => void;
  /**
   * Presence alone gates whether a Cancel button renders — no separate
   * boolean prop. Onboarding step 1 has nothing to cancel back to (omitted);
   * `ProfileModal` passes one to close itself without saving.
   */
  onCancel?: () => void;
}

/**
 * Shared "profile" form (firstName/lastName/email) used both by onboarding
 * step 1 and the "Mon profil" settings modal (spec §5.4/§7.1). `ProfileInput`
 * (from `@rushhours/domain`) IS the form shape directly — unlike
 * `WorkScheduleModal`'s form, there's no UI-shape/domain-shape translation
 * layer needed here.
 */
export function ProfileForm({
  defaultValues,
  submitLabel,
  onSuccess,
  onCancel,
}: ProfileFormProps) {
  const { t } = useTranslation();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { control, handleSubmit, formState } = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
    defaultValues,
  });

  const onSubmit: SubmitHandler<ProfileInput> = async (values) => {
    setSubmitError(null);
    try {
      const savedUser = await updateProfile(values);
      onSuccess(savedUser);
    } catch {
      setSubmitError(t("profile.saveError"));
    }
  };

  return (
    <form
      onSubmit={(event) => void handleSubmit(onSubmit)(event)}
      noValidate
      className="flex flex-col gap-4"
    >
      <div>
        <label className="mb-1 block text-sm font-medium text-surface-700">
          {t("profile.firstNameLabel")}
        </label>
        <Controller
          control={control}
          name="firstName"
          render={({ field, fieldState }) => (
            <InputText
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              aria-label={t("profile.firstNameLabel")}
              invalid={fieldState.invalid}
            />
          )}
        />
        {formState.errors.firstName && (
          <p className="mt-1 text-sm text-error-700">
            {formState.errors.firstName.message}
          </p>
        )}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-surface-700">
          {t("profile.lastNameLabel")}
        </label>
        <Controller
          control={control}
          name="lastName"
          render={({ field, fieldState }) => (
            <InputText
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              aria-label={t("profile.lastNameLabel")}
              invalid={fieldState.invalid}
            />
          )}
        />
        {formState.errors.lastName && (
          <p className="mt-1 text-sm text-error-700">
            {formState.errors.lastName.message}
          </p>
        )}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-surface-700">
          {t("profile.emailLabel")}
        </label>
        <Controller
          control={control}
          name="email"
          render={({ field, fieldState }) => (
            <InputText
              type="email"
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              aria-label={t("profile.emailLabel")}
              invalid={fieldState.invalid}
            />
          )}
        />
        {formState.errors.email && (
          <p className="mt-1 text-sm text-error-700">
            {formState.errors.email.message}
          </p>
        )}
      </div>

      {submitError && <p className="text-sm text-error-700">{submitError}</p>}

      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button
            type="button"
            variant="outlined"
            severity="secondary"
            onClick={onCancel}
            className="px-4 py-2 text-sm"
          >
            {t("profile.cancel")}
          </Button>
        )}
        <Button
          type="submit"
          disabled={formState.isSubmitting}
          className="px-4 py-2 text-sm"
        >
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
