import { z } from "zod";

/**
 * Spec §5.4/§6. Treated as a complete required object (no `.partial()`): both the
 * onboarding step-1 form and the "My profile" settings modal always submit all three
 * fields together, there is no partial-profile-update use case in this app.
 */
export const profileSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
});

export type ProfileInput = z.infer<typeof profileSchema>;
