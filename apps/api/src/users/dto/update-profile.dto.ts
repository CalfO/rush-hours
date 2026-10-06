import { createZodDto } from "nestjs-zod";
import { profileSchema } from "@rushhours/domain";

/** Spec §5.4 step 1 / §6 `PATCH /users/me`. */
export class UpdateProfileDto extends createZodDto(profileSchema) {}
