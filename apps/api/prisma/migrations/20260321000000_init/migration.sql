-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('BUYER', 'AGENT', 'LENDER', 'ADMIN');

-- CreateEnum
CREATE TYPE "PropertyType" AS ENUM ('SINGLE_FAMILY', 'MULTI_FAMILY', 'CONDO', 'TOWNHOUSE', 'MOBILE_HOME', 'COMMERCIAL', 'LAND');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('LOW', 'MODERATE', 'HIGH', 'VERY_HIGH', 'EXTREME');

-- CreateEnum
CREATE TYPE "ConfidenceLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "ReportType" AS ENUM ('FULL', 'RISK_SUMMARY', 'INSURANCE_ESTIMATE');

-- CreateEnum
CREATE TYPE "ClientStatus" AS ENUM ('ACTIVE', 'PROSPECT', 'CLOSED', 'INACTIVE');

-- CreateEnum
CREATE TYPE "QuoteRequestStatus" AS ENUM ('PENDING', 'SENT', 'RESPONDED', 'DECLINED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'BUYER',
    "company" TEXT,
    "licenseNumber" TEXT,
    "avatarUrl" TEXT,
    "termsAcceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "properties" (
    "id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" CHAR(2) NOT NULL,
    "zip" VARCHAR(10) NOT NULL,
    "county" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "propertyType" "PropertyType" NOT NULL DEFAULT 'SINGLE_FAMILY',
    "yearBuilt" INTEGER,
    "squareFeet" INTEGER,
    "bedrooms" INTEGER,
    "bathrooms" DOUBLE PRECISION,
    "lotSize" DOUBLE PRECISION,
    "estimatedValue" INTEGER,
    "lastSalePrice" INTEGER,
    "lastSaleDate" TIMESTAMP(3),
    "parcelId" TEXT,
    "externalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "properties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_profiles" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "overallRiskLevel" "RiskLevel" NOT NULL DEFAULT 'MODERATE',
    "overallRiskScore" INTEGER NOT NULL,
    "floodRiskLevel" "RiskLevel" NOT NULL DEFAULT 'LOW',
    "floodRiskScore" INTEGER NOT NULL,
    "floodZone" TEXT,
    "floodFirmPanelId" TEXT,
    "floodBaseElevation" DOUBLE PRECISION,
    "inSFHA" BOOLEAN NOT NULL DEFAULT false,
    "floodAnnualChance" DOUBLE PRECISION,
    "fireRiskLevel" "RiskLevel" NOT NULL DEFAULT 'LOW',
    "fireRiskScore" INTEGER NOT NULL,
    "firHazardZone" TEXT,
    "wildlandUrbanInterface" BOOLEAN NOT NULL DEFAULT false,
    "nearestFireStation" DOUBLE PRECISION,
    "windRiskLevel" "RiskLevel" NOT NULL DEFAULT 'LOW',
    "windRiskScore" INTEGER NOT NULL,
    "designWindSpeed" INTEGER,
    "hurricaneRisk" BOOLEAN NOT NULL DEFAULT false,
    "tornadoRisk" BOOLEAN NOT NULL DEFAULT false,
    "hailRisk" BOOLEAN NOT NULL DEFAULT false,
    "earthquakeRiskLevel" "RiskLevel" NOT NULL DEFAULT 'LOW',
    "earthquakeRiskScore" INTEGER NOT NULL,
    "seismicZone" TEXT,
    "nearestFaultLine" DOUBLE PRECISION,
    "crimeRiskLevel" "RiskLevel" NOT NULL DEFAULT 'LOW',
    "crimeRiskScore" INTEGER NOT NULL,
    "violentCrimeIndex" INTEGER NOT NULL,
    "propertyCrimeIndex" INTEGER NOT NULL,
    "nationalAvgDiff" DOUBLE PRECISION NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "risk_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "insurance_estimates" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "estimatedAnnualTotal" INTEGER NOT NULL,
    "estimatedMonthlyTotal" INTEGER NOT NULL,
    "confidenceLevel" "ConfidenceLevel" NOT NULL DEFAULT 'MEDIUM',
    "homeownersLow" INTEGER NOT NULL,
    "homeownersHigh" INTEGER NOT NULL,
    "homeownersAvg" INTEGER NOT NULL,
    "floodRequired" BOOLEAN NOT NULL DEFAULT false,
    "floodLow" INTEGER,
    "floodHigh" INTEGER,
    "floodAvg" INTEGER,
    "earthquakeRequired" BOOLEAN NOT NULL DEFAULT false,
    "earthquakeLow" INTEGER,
    "earthquakeHigh" INTEGER,
    "earthquakeAvg" INTEGER,
    "windRequired" BOOLEAN NOT NULL DEFAULT false,
    "windLow" INTEGER,
    "windHigh" INTEGER,
    "windAvg" INTEGER,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "insurance_estimates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_properties" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "notes" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "savedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_properties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "property_reports" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "reportType" "ReportType" NOT NULL DEFAULT 'FULL',
    "pdfUrl" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "property_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "notes" TEXT,
    "status" "ClientStatus" NOT NULL DEFAULT 'PROSPECT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_requests" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "carrierId" TEXT NOT NULL,
    "coverageTypes" TEXT[],
    "notes" TEXT,
    "status" "QuoteRequestStatus" NOT NULL DEFAULT 'PENDING',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quote_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "search_history" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "query" TEXT NOT NULL,
    "resultCount" INTEGER NOT NULL DEFAULT 0,
    "searchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "search_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "properties_parcelId_key" ON "properties"("parcelId");

-- CreateIndex
CREATE UNIQUE INDEX "properties_externalId_key" ON "properties"("externalId");

-- CreateIndex
CREATE INDEX "properties_zip_idx" ON "properties"("zip");

-- CreateIndex
CREATE INDEX "properties_state_city_idx" ON "properties"("state", "city");

-- CreateIndex
CREATE INDEX "properties_lat_lng_idx" ON "properties"("lat", "lng");

-- CreateIndex
CREATE UNIQUE INDEX "risk_profiles_propertyId_key" ON "risk_profiles"("propertyId");

-- CreateIndex
CREATE UNIQUE INDEX "insurance_estimates_propertyId_key" ON "insurance_estimates"("propertyId");

-- CreateIndex
CREATE UNIQUE INDEX "saved_properties_userId_propertyId_key" ON "saved_properties"("userId", "propertyId");

-- CreateIndex
CREATE INDEX "clients_agentId_idx" ON "clients"("agentId");

-- CreateIndex
CREATE INDEX "quote_requests_userId_idx" ON "quote_requests"("userId");

-- CreateIndex
CREATE INDEX "quote_requests_propertyId_idx" ON "quote_requests"("propertyId");

-- CreateIndex
CREATE INDEX "search_history_userId_idx" ON "search_history"("userId");

-- AddForeignKey
ALTER TABLE "risk_profiles" ADD CONSTRAINT "risk_profiles_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insurance_estimates" ADD CONSTRAINT "insurance_estimates_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_properties" ADD CONSTRAINT "saved_properties_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_properties" ADD CONSTRAINT "saved_properties_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_reports" ADD CONSTRAINT "property_reports_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_reports" ADD CONSTRAINT "property_reports_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
