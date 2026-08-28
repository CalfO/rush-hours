import { ConflictException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { WorkScheduleDto } from "./dto/work-schedule.dto";

const WORK_SCHEDULE_SELECT = {
  weeklyContractHours: true,
  weekStartDay: true,
  workingDaySchedules: {
    select: { weekday: true, targetMinutes: true },
  },
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
}
