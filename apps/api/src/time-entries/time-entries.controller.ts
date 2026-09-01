import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Put,
  Query,
} from "@nestjs/common";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { SessionPayload } from "../auth/session-payload.interface";
import { TimeEntriesService } from "./time-entries.service";
import { UpsertTimeEntryDto } from "./dto/upsert-time-entry.dto";
import { MonthQueryDto } from "./dto/month-query.dto";
import { DateRangeQueryDto } from "./dto/date-range-query.dto";
import { DateParamDto } from "./dto/date-param.dto";

/** §6 — all routes require a session, protected by the global `AuthGuard`. */
@Controller("time-entries")
export class TimeEntriesController {
  constructor(private readonly timeEntriesService: TimeEntriesService) {}

  @Get()
  list(@CurrentUser() user: SessionPayload, @Query() query: MonthQueryDto) {
    return this.timeEntriesService.listMonth(user.sub, query.month);
  }

  @Get("summary")
  summary(@CurrentUser() user: SessionPayload, @Query() query: MonthQueryDto) {
    return this.timeEntriesService.summary(user.sub, query.month);
  }

  @Get("analytics")
  analytics(
    @CurrentUser() user: SessionPayload,
    @Query() query: DateRangeQueryDto,
  ) {
    return this.timeEntriesService.analytics(user.sub, query.from, query.to);
  }

  @Put(":date")
  upsert(
    @CurrentUser() user: SessionPayload,
    @Param() params: DateParamDto,
    @Body() body: UpsertTimeEntryDto,
  ) {
    return this.timeEntriesService.upsert(user.sub, params.date, body);
  }

  @Delete(":date")
  remove(@CurrentUser() user: SessionPayload, @Param() params: DateParamDto) {
    return this.timeEntriesService.remove(user.sub, params.date);
  }
}
