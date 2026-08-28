import {
  BadRequestException,
  ConflictException,
  Injectable,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { WorkScheduleDto } from "./dto/work-schedule.dto";
import { ReferenceWeekDto } from "./dto/reference-week.dto";

const WORK_SCHEDULE_SELECT = {
  weeklyContractHours: true,
  weekStartDay: true,
  workingDaySchedules: {
    select: { weekday: true, targetMinutes: true },
  },
} as const;

const REFERENCE_WEEK_SELECT = {
  weekday: true,
  arrivalMinutes: true,
  departureMinutes: true,
  lunchBreakStartMinutes: true,
  lunchBreakEndMinutes: true,
} as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /** §6 `PATCH /users/me` — profile fields only, explicit `select` (never spread User). */
  async updateProfile(userId: string, dto: UpdateProfileDto) {
    try {
      return await this.prisma.user.update({
        where: { id: userId },
        data: {
          firstName: dto.firstName,
          lastName: dto.lastName,
          email: dto.email,
        },
        select: {
          id: true,
          username: true,
          role: true,
          firstName: true,
          lastName: true,
          email: true,
          onboardingCompletedAt: true,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException("Email already in use");
      }
      throw error;
    }
  }

  /** §6 `GET /users/me/work-schedule`. */
  async getWorkSchedule(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: WORK_SCHEDULE_SELECT,
    });

    return {
      weeklyContractHours: Number(user.weeklyContractHours),
      weekStartDay: user.weekStartDay,
      days: user.workingDaySchedules,
    };
  }

  /**
   * §6 `PUT /users/me/work-schedule` — full replace. Interactive transaction
   * (prisma-best-practices §3): whether `onboardingCompletedAt` gets set depends on
   * reading the user's current value first, so the read and the write must happen
   * atomically inside one transaction rather than as two separate `PrismaService`
   * calls. The sum-equals-weeklyContractHours*60 rule is already enforced by
   * `workScheduleSchema` via the global Zod validation pipe (400, not a DB error).
   */
  async replaceWorkSchedule(userId: string, dto: WorkScheduleDto) {
    const updated = await this.prisma.$transaction(async (tx) => {
      const currentUser = await tx.user.findUniqueOrThrow({
        where: { id: userId },
        select: { onboardingCompletedAt: true },
      });

      await tx.workingDaySchedule.deleteMany({ where: { userId } });

      return tx.user.update({
        where: { id: userId },
        data: {
          weeklyContractHours: dto.weeklyContractHours,
          weekStartDay: dto.weekStartDay,
          onboardingCompletedAt:
            currentUser.onboardingCompletedAt ?? new Date(),
          workingDaySchedules: {
            create: dto.days.map(({ weekday, targetMinutes }) => ({
              weekday,
              targetMinutes,
            })),
          },
        },
        select: WORK_SCHEDULE_SELECT,
      });
    });

    return {
      weeklyContractHours: Number(updated.weeklyContractHours),
      weekStartDay: updated.weekStartDay,
      days: updated.workingDaySchedules,
    };
  }

  /** §5.4 `GET /users/me/reference-week`. */
  async getReferenceWeek(userId: string) {
    const days = await this.prisma.referenceWeekEntry.findMany({
      where: { userId },
      select: REFERENCE_WEEK_SELECT,
    });

    return { exists: days.length > 0, days };
  }

  /**
   * §5.4 `PUT /users/me/reference-week` — full replace, same two-step pattern as
   * `replaceWorkSchedule` (prisma-best-practices §3: interactive transaction since
   * the delete and the create must commit atomically as one full replace).
   * §5.4 also requires rejecting (400) any `weekday` in the body that isn't part of
   * the user's *current* `WorkingDaySchedule` — a reference week only ever covers
   * working days at the time it's saved (spec §5.1).
   */
  async replaceReferenceWeek(userId: string, dto: ReferenceWeekDto) {
    const workingDays = await this.prisma.workingDaySchedule.findMany({
      where: { userId },
      select: { weekday: true },
    });
    const workingWeekdays = new Set(workingDays.map((day) => day.weekday));
    const invalidWeekdays = dto
      .map((day) => day.weekday)
      .filter((weekday) => !workingWeekdays.has(weekday));

    if (invalidWeekdays.length > 0) {
      throw new BadRequestException(
        `Reference week days must be part of the current work schedule: ${invalidWeekdays.join(", ")}`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.referenceWeekEntry.deleteMany({ where: { userId } });
      await tx.referenceWeekEntry.createMany({
        data: dto.map((day) => ({ ...day, userId })),
      });
    });

    return { exists: dto.length > 0, days: dto };
  }

  /**
   * §5.4/§5.6 `DELETE /users/me/reference-week` — idempotent, no-op if already
   * empty. Return shape mirrors the existing `DELETE /time-entries/:date`
   * precedent (`TimeEntriesService.remove`, `{ success: true }`).
   */
  async deleteReferenceWeek(userId: string): Promise<{ success: true }> {
    await this.prisma.referenceWeekEntry.deleteMany({ where: { userId } });
    return { success: true };
  }
}
