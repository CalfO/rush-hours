import { createZodDto } from "nestjs-zod";
import { timeEntrySchema } from "@rushhours/domain";

/** Spec §4.2/§6 `PUT /time-entries/:date` body. */
export class UpsertTimeEntryDto extends createZodDto(timeEntrySchema) {}
