-- Add fire premium estimate columns to insurance_estimates table.
-- These mirror the existing earthquake/wind/flood premium fields and store
-- the computed fire/wildfire coverage premium for high fire-risk properties.

ALTER TABLE "insurance_estimates" ADD COLUMN "fireRequired" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "insurance_estimates" ADD COLUMN "fireLow" INTEGER;
ALTER TABLE "insurance_estimates" ADD COLUMN "fireHigh" INTEGER;
ALTER TABLE "insurance_estimates" ADD COLUMN "fireAvg" INTEGER;
