-- CreateTable
CREATE TABLE "reference_week_entries" (
    "id" TEXT NOT NULL,
    "weekday" "Weekday" NOT NULL,
    "arrivalMinutes" INTEGER NOT NULL,
    "departureMinutes" INTEGER NOT NULL,
    "lunchBreakStartMinutes" INTEGER NOT NULL,
    "lunchBreakEndMinutes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "reference_week_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "reference_week_entries_userId_weekday_key" ON "reference_week_entries"("userId", "weekday");

-- AddForeignKey
ALTER TABLE "reference_week_entries" ADD CONSTRAINT "reference_week_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
