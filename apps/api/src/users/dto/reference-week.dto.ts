import { createZodDto } from "nestjs-zod";
import { referenceWeekSchema } from "@rushhours/domain";

/** Spec `time-entry-ux-and-reference-week.md` §5.4 `GET`/`PUT /users/me/reference-week`. */
export class ReferenceWeekDto extends createZodDto(referenceWeekSchema) {}
