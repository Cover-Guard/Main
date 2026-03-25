-- Add NDA and Privacy Policy acceptance timestamp columns to users table.
-- These are populated at registration time when the user checks the required
-- agreement boxes on the sign-up form.

ALTER TABLE "users" ADD COLUMN "ndaAcceptedAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "privacyAcceptedAt" TIMESTAMP(3);
