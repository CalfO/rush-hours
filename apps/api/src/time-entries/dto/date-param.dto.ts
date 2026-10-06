import { createZodDto } from "nestjs-zod";
import { z } from "zod";

/**
 * `:date` (`YYYY-MM-DD`) route param for `PUT`/`DELETE /time-entries/:date` — local
 * to the API, like the query DTOs in this same folder.
 */
export const dateParamSchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "date must be in YYYY-MM-DD format"),
});

export class DateParamDto extends createZodDto(dateParamSchema) {}
