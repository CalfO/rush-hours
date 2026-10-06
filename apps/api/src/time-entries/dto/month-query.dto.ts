import { createZodDto } from "nestjs-zod";
import { z } from "zod";

/**
 * `?month=YYYY-MM` query param for `GET /time-entries` and `GET
 * /time-entries/summary` — stays local to the API (not part of `@rushhours/domain`),
 * it's purely an HTTP transport concern.
 */
export const monthQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, "month must be in YYYY-MM format"),
});

export class MonthQueryDto extends createZodDto(monthQuerySchema) {}
