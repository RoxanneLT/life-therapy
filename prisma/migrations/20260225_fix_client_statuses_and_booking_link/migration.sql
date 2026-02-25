-- Phase 4 data fix: client statuses + orphan booking linking
-- Run in Supabase SQL Editor

-- 1. Set all clients to "active" EXCEPT bouwer.stean@gmail.com and roxannebouwer@gmail.com
--    (Those two are test accounts for the portal — keep as "potential")
UPDATE students
SET "clientStatus" = 'active'
WHERE email NOT IN ('bouwer.stean@gmail.com', 'roxannebouwer@gmail.com')
  AND "clientStatus" = 'potential';

-- 2. Link orphan bookings to their student record by matching email
--    This fixes any booking where studentId is null but a student with that email exists
UPDATE bookings b
SET "studentId" = s.id
FROM students s
WHERE b."clientEmail" = s.email
  AND b."studentId" IS NULL;

-- Verify: check the booking for bouwer.stean@gmail.com is now linked
-- SELECT b.id, b."clientEmail", b."studentId", b.status, b."sessionType"
-- FROM bookings b WHERE b."clientEmail" = 'bouwer.stean@gmail.com';
