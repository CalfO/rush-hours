import { createZodDto } from "nestjs-zod";
import { z } from "zod";

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * `?from=YYYY-MM-DD&to=YYYY-MM-DD` for `GET /time-entries/analytics` — local to the
 * API, like `month-query.dto.ts`. Plain string comparison is sufficient for
 * `from <= to` since both are zero-padded ISO dates (lexicographic order == chronological
 * order).
 */
export const dateRangeQuerySchema = z
  .object({
    from: z.string().regex(DATE_REGEX, "from must be in YYYY-MM-DD format"),
    to: z.string().regex(DATE_REGEX, "to must be in YYYY-MM-DD format"),
  })
  .refine((range) => range.from <= range.to, {
    message: "from must be before or equal to to",
    path: ["to"],
  });

export class DateRangeQueryDto extends createZodDto(dateRangeQuerySchema) {}
