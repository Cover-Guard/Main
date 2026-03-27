-- =============================================================================
-- CoverGuard Database Setup Script
-- Combines all Prisma migrations for initial Supabase setup
-- =============================================================================

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
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE UNIQUE INDEX "properties_parcelId_key" ON "properties"("parcelId");
CREATE UNIQUE INDEX "properties_externalId_key" ON "properties"("externalId");
CREATE INDEX "properties_zip_idx" ON "properties"("zip");
CREATE INDEX "properties_state_city_idx" ON "properties"("state", "city");
CREATE INDEX "properties_lat_lng_idx" ON "properties"("lat", "lng");
CREATE INDEX "properties_state_idx" ON "properties"("state");
CREATE INDEX "properties_createdAt_idx" ON "properties"("createdAt");
CREATE INDEX "properties_state_createdAt_idx" ON "properties"("state", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "risk_profiles_propertyId_key" ON "risk_profiles"("propertyId");
CREATE INDEX "risk_profiles_expiresAt_idx" ON "risk_profiles"("expiresAt");
CREATE INDEX "risk_profiles_overallRiskLevel_idx" ON "risk_profiles"("overallRiskLevel");

-- CreateIndex
CREATE UNIQUE INDEX "insurance_estimates_propertyId_key" ON "insurance_estimates"("propertyId");
CREATE INDEX "insurance_estimates_expiresAt_idx" ON "insurance_estimates"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "saved_properties_userId_propertyId_key" ON "saved_properties"("userId", "propertyId");
CREATE INDEX "saved_properties_userId_savedAt_idx" ON "saved_properties"("userId", "savedAt" DESC);
CREATE INDEX "saved_properties_propertyId_idx" ON "saved_properties"("propertyId");

-- CreateIndex
CREATE INDEX "property_reports_userId_generatedAt_idx" ON "property_reports"("userId", "generatedAt" DESC);
CREATE INDEX "property_reports_propertyId_idx" ON "property_reports"("propertyId");

-- CreateIndex
CREATE INDEX "clients_agentId_idx" ON "clients"("agentId");

-- CreateIndex
CREATE INDEX "quote_requests_userId_submittedAt_idx" ON "quote_requests"("userId", "submittedAt" DESC);
CREATE INDEX "quote_requests_propertyId_submittedAt_idx" ON "quote_requests"("propertyId", "submittedAt" DESC);
CREATE INDEX "quote_requests_status_idx" ON "quote_requests"("status");

-- CreateIndex
CREATE INDEX "search_history_userId_searchedAt_idx" ON "search_history"("userId", "searchedAt" DESC);
CREATE INDEX "search_history_searchedAt_idx" ON "search_history"("searchedAt" DESC);

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

-- AddForeignKey
ALTER TABLE "quote_requests" ADD CONSTRAINT "quote_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_requests" ADD CONSTRAINT "quote_requests_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "search_history" ADD CONSTRAINT "search_history_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- =============================================================================
-- Auth sync triggers, Row Level Security, and Supabase Realtime
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 1 — auth ↔ public.users synchronisation triggers
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (
    id,
    email,
    "firstName",
    "lastName",
    role,
    company,
    "licenseNumber",
    "updatedAt"
  )
  VALUES (
    NEW.id::text,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'firstName',
      split_part(COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), ' ', 1)
    ),
    COALESCE(
      NEW.raw_user_meta_data->>'lastName',
      NULLIF(
        split_part(COALESCE(NEW.raw_user_meta_data->>'full_name', ''), ' ', 2),
        ''
      ),
      ''
    ),
    COALESCE(
      (NEW.raw_user_meta_data->>'role')::"UserRole",
      'BUYER'
    ),
    NEW.raw_user_meta_data->>'company',
    NEW.raw_user_meta_data->>'licenseNumber',
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


CREATE OR REPLACE FUNCTION public.handle_user_updated()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.users
  SET
    email       = NEW.email,
    role        = COALESCE(
                    (NEW.raw_user_meta_data->>'role')::"UserRole",
                    role
                  ),
    "avatarUrl" = COALESCE(
                    NEW.raw_user_meta_data->>'avatar_url',
                    "avatarUrl"
                  ),
    "updatedAt" = NOW()
  WHERE id = NEW.id::text;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_user_updated();


CREATE OR REPLACE FUNCTION public.handle_user_deleted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.users WHERE id = OLD.id::text;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_deleted ON auth.users;
CREATE TRIGGER on_auth_user_deleted
  AFTER DELETE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_user_deleted();


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 2 — Row Level Security
-- ─────────────────────────────────────────────────────────────────────────────

-- properties (public read)
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "properties: public read" ON public.properties FOR SELECT USING (true);

-- risk_profiles (public read)
ALTER TABLE public.risk_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "risk_profiles: public read" ON public.risk_profiles FOR SELECT USING (true);

-- insurance_estimates (public read)
ALTER TABLE public.insurance_estimates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "insurance_estimates: public read" ON public.insurance_estimates FOR SELECT USING (true);

-- users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users: select own" ON public.users FOR SELECT USING (auth.uid()::text = id);
CREATE POLICY "users: update own" ON public.users FOR UPDATE USING (auth.uid()::text = id) WITH CHECK (auth.uid()::text = id);
CREATE POLICY "users: insert own" ON public.users FOR INSERT WITH CHECK (auth.uid()::text = id);

-- saved_properties
ALTER TABLE public.saved_properties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "saved_properties: select own" ON public.saved_properties FOR SELECT USING (auth.uid()::text = "userId");
CREATE POLICY "saved_properties: insert own" ON public.saved_properties FOR INSERT WITH CHECK (auth.uid()::text = "userId");
CREATE POLICY "saved_properties: update own" ON public.saved_properties FOR UPDATE USING (auth.uid()::text = "userId") WITH CHECK (auth.uid()::text = "userId");
CREATE POLICY "saved_properties: delete own" ON public.saved_properties FOR DELETE USING (auth.uid()::text = "userId");

-- property_reports
ALTER TABLE public.property_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "property_reports: select own" ON public.property_reports FOR SELECT USING (auth.uid()::text = "userId");
CREATE POLICY "property_reports: insert own" ON public.property_reports FOR INSERT WITH CHECK (auth.uid()::text = "userId");
CREATE POLICY "property_reports: delete own" ON public.property_reports FOR DELETE USING (auth.uid()::text = "userId");

-- clients
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clients: select own" ON public.clients FOR SELECT USING (auth.uid()::text = "agentId");
CREATE POLICY "clients: insert own" ON public.clients FOR INSERT WITH CHECK (auth.uid()::text = "agentId");
CREATE POLICY "clients: update own" ON public.clients FOR UPDATE USING (auth.uid()::text = "agentId") WITH CHECK (auth.uid()::text = "agentId");
CREATE POLICY "clients: delete own" ON public.clients FOR DELETE USING (auth.uid()::text = "agentId");

-- quote_requests
ALTER TABLE public.quote_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "quote_requests: select own" ON public.quote_requests FOR SELECT USING (auth.uid()::text = "userId");
CREATE POLICY "quote_requests: insert own" ON public.quote_requests FOR INSERT WITH CHECK (auth.uid()::text = "userId");

-- search_history
ALTER TABLE public.search_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "search_history: select own" ON public.search_history FOR SELECT USING (auth.uid()::text = "userId");


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 3 — Supabase Realtime
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.saved_properties REPLICA IDENTITY FULL;
ALTER TABLE public.quote_requests REPLICA IDENTITY FULL;
ALTER TABLE public.properties REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.properties;
ALTER PUBLICATION supabase_realtime ADD TABLE public.saved_properties;
ALTER PUBLICATION supabase_realtime ADD TABLE public.quote_requests;
