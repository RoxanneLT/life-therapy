-- Add recurring booking fields
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "recurringSeriesId" TEXT;
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "recurringPattern" TEXT;
CREATE INDEX IF NOT EXISTS "bookings_recurringSeriesId_idx" ON "bookings" ("recurringSeriesId");
