-- =============================================================================
-- CoverGuard — Seed Data
-- Sample properties with risk profiles and insurance estimates
-- =============================================================================

-- Sample properties
INSERT INTO properties (id, address, city, state, zip, county, lat, lng, "propertyType", "yearBuilt", "squareFeet", bedrooms, bathrooms, "lotSize", "estimatedValue", "createdAt", "updatedAt")
VALUES
  ('seed-prop-001', '123 Ocean Drive', 'Miami', 'FL', '33139', 'Miami-Dade', 25.7617, -80.1918, 'SINGLE_FAMILY', 1985, 2200, 3, 2.5, 6500, 850000, NOW(), NOW()),
  ('seed-prop-002', '456 Hillside Road', 'Los Angeles', 'CA', '90210', 'Los Angeles', 34.0901, -118.4065, 'SINGLE_FAMILY', 1972, 3100, 4, 3.0, 9200, 2100000, NOW(), NOW()),
  ('seed-prop-003', '789 Maple Street', 'Chicago', 'IL', '60601', 'Cook', 41.8827, -87.6233, 'CONDO', 2005, 1100, 2, 2.0, NULL, 450000, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- Risk profiles
INSERT INTO risk_profiles (id, "propertyId", "overallRiskLevel", "overallRiskScore",
  "floodRiskLevel", "floodRiskScore", "floodZone", "inSFHA", "floodAnnualChance",
  "fireRiskLevel", "fireRiskScore",
  "windRiskLevel", "windRiskScore", "hurricaneRisk", "tornadoRisk", "hailRisk",
  "earthquakeRiskLevel", "earthquakeRiskScore",
  "crimeRiskLevel", "crimeRiskScore", "violentCrimeIndex", "propertyCrimeIndex", "nationalAvgDiff",
  "generatedAt", "expiresAt")
VALUES
  ('seed-risk-001', 'seed-prop-001', 'HIGH', 68,
   'HIGH', 75, 'AE', true, 1.0,
   'LOW', 15,
   'HIGH', 72, true, false, false,
   'LOW', 10,
   'MODERATE', 45, 380, 2900, 18.5,
   NOW(), NOW() + INTERVAL '24 hours'),
  ('seed-risk-002', 'seed-prop-002', 'HIGH', 70,
   'LOW', 12, 'X', false, 0.01,
   'VERY_HIGH', 88,
   'LOW', 15, false, false, false,
   'HIGH', 72,
   'MODERATE', 40, 350, 2600, 12.0,
   NOW(), NOW() + INTERVAL '24 hours'),
  ('seed-risk-003', 'seed-prop-003', 'MODERATE', 42,
   'LOW', 18, 'X', false, 0.05,
   'LOW', 8,
   'MODERATE', 45, false, true, true,
   'LOW', 12,
   'MODERATE', 50, 420, 3100, 22.0,
   NOW(), NOW() + INTERVAL '24 hours')
ON CONFLICT DO NOTHING;

-- Insurance estimates
INSERT INTO insurance_estimates (id, "propertyId", "estimatedAnnualTotal", "estimatedMonthlyTotal",
  "confidenceLevel", "homeownersLow", "homeownersHigh", "homeownersAvg",
  "floodRequired", "floodLow", "floodHigh", "floodAvg",
  "earthquakeRequired", "earthquakeLow", "earthquakeHigh", "earthquakeAvg",
  "windRequired", "windLow", "windHigh", "windAvg",
  "generatedAt", "expiresAt")
VALUES
  ('seed-ins-001', 'seed-prop-001', 8400, 700, 'MEDIUM',
   3200, 5800, 4500,
   true, 1800, 4200, 2900,
   false, NULL, NULL, NULL,
   true, 600, 1400, 1000,
   NOW(), NOW() + INTERVAL '24 hours'),
  ('seed-ins-002', 'seed-prop-002', 12800, 1067, 'MEDIUM',
   4200, 7200, 5700,
   false, NULL, NULL, NULL,
   true, 2400, 5600, 4000,
   false, NULL, NULL, NULL,
   NOW(), NOW() + INTERVAL '24 hours'),
  ('seed-ins-003', 'seed-prop-003', 3600, 300, 'HIGH',
   1800, 3200, 2500,
   false, NULL, NULL, NULL,
   false, NULL, NULL, NULL,
   false, NULL, NULL, NULL,
   NOW(), NOW() + INTERVAL '24 hours')
ON CONFLICT DO NOTHING;
