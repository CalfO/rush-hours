import { createZodDto } from "nestjs-zod";
import { workScheduleSchema } from "@rushhours/domain";

/** Spec §5.5/§6 `GET`/`PUT /users/me/work-schedule`. */
export class WorkScheduleDto extends createZodDto(workScheduleSchema) {}
