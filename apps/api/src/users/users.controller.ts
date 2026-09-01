import { Body, Controller, Delete, Get, Patch, Put } from "@nestjs/common";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { SessionPayload } from "../auth/session-payload.interface";
import { UsersService } from "./users.service";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { WorkScheduleDto } from "./dto/work-schedule.dto";
import { ReferenceWeekDto } from "./dto/reference-week.dto";

/**
 * §6 — all routes here require a session; the global `AuthGuard` (registered via
 * `APP_GUARD` in `AuthModule`) already protects everything not marked `@Public()`,
 * so nothing extra is declared here.
 */
@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Patch("me")
  updateProfile(
    @CurrentUser() user: SessionPayload,
    @Body() body: UpdateProfileDto,
  ) {
    return this.usersService.updateProfile(user.sub, body);
  }

  @Get("me/work-schedule")
  getWorkSchedule(@CurrentUser() user: SessionPayload) {
    return this.usersService.getWorkSchedule(user.sub);
  }

  @Put("me/work-schedule")
  replaceWorkSchedule(
    @CurrentUser() user: SessionPayload,
    @Body() body: WorkScheduleDto,
  ) {
    return this.usersService.replaceWorkSchedule(user.sub, body);
  }

  @Get("me/reference-week")
  getReferenceWeek(@CurrentUser() user: SessionPayload) {
    return this.usersService.getReferenceWeek(user.sub);
  }

  @Put("me/reference-week")
  replaceReferenceWeek(
    @CurrentUser() user: SessionPayload,
    @Body() body: ReferenceWeekDto,
  ) {
    return this.usersService.replaceReferenceWeek(user.sub, body);
  }

  @Delete("me/reference-week")
  deleteReferenceWeek(@CurrentUser() user: SessionPayload) {
    return this.usersService.deleteReferenceWeek(user.sub);
  }
}
