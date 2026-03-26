import { PrismaClient, PropertyType, RiskLevel, ConfidenceLevel } from '../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('Seeding database...')

  // Sample properties across different risk profiles
  const properties = [
    {
      address: '123 Ocean Drive',
      city: 'Miami',
      state: 'FL',
      zip: '33139',
      county: 'Miami-Dade',
      lat: 25.7617,
      lng: -80.1918,
      propertyType: PropertyType.SINGLE_FAMILY,
      yearBuilt: 1985,
      squareFeet: 2200,
      bedrooms: 3,
      bathrooms: 2.5,
      lotSize: 6500,
      estimatedValue: 850000,
    },
    {
      address: '456 Hillside Road',
      city: 'Los Angeles',
      state: 'CA',
      zip: '90210',
      county: 'Los Angeles',
      lat: 34.0901,
      lng: -118.4065,
      propertyType: PropertyType.SINGLE_FAMILY,
      yearBuilt: 1972,
      squareFeet: 3100,
      bedrooms: 4,
      bathrooms: 3.0,
      lotSize: 9200,
      estimatedValue: 2100000,
    },
    {
      address: '789 Maple Street',
      city: 'Chicago',
      state: 'IL',
      zip: '60601',
      county: 'Cook',
      lat: 41.8827,
      lng: -87.6233,
      propertyType: PropertyType.CONDO,
      yearBuilt: 2005,
      squareFeet: 1100,
      bedrooms: 2,
      bathrooms: 2.0,
      estimatedValue: 450000,
    },
  ]

  for (const prop of properties) {
    const property = await prisma.property.upsert({
      where: { address: prop.address } as never,
      update: prop,
      create: prop,
    })

    const now = new Date()
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)

    await prisma.riskProfile.upsert({
      where: { propertyId: property.id },
      update: {},
      create: {
        propertyId: property.id,
        overallRiskLevel: RiskLevel.HIGH,
        overallRiskScore: 68,
        floodRiskLevel: RiskLevel.HIGH,
        floodRiskScore: 75,
        floodZone: 'AE',
        inSFHA: true,
        floodAnnualChance: 1.0,
        fireRiskLevel: RiskLevel.LOW,
        fireRiskScore: 15,
        windRiskLevel: RiskLevel.HIGH,
        windRiskScore: 72,
        hurricaneRisk: true,
        earthquakeRiskLevel: RiskLevel.LOW,
        earthquakeRiskScore: 10,
        crimeRiskLevel: RiskLevel.MODERATE,
        crimeRiskScore: 45,
        violentCrimeIndex: 380,
        propertyCrimeIndex: 2900,
        nationalAvgDiff: 18.5,
        expiresAt: tomorrow,
      },
    })

    await prisma.insuranceEstimate.upsert({
      where: { propertyId: property.id },
      update: {},
      create: {
        propertyId: property.id,
        estimatedAnnualTotal: 8400,
        estimatedMonthlyTotal: 700,
        confidenceLevel: ConfidenceLevel.MEDIUM,
        homeownersLow: 3200,
        homeownersHigh: 5800,
        homeownersAvg: 4500,
        floodRequired: true,
        floodLow: 1800,
        floodHigh: 4200,
        floodAvg: 2900,
        windRequired: true,
        windLow: 600,
        windHigh: 1400,
        windAvg: 1000,
        expiresAt: tomorrow,
      },
    })
  }

  console.log('Seed complete.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
