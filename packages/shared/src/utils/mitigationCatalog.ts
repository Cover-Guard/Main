import type { MitigationAction } from '../types/insurance'

/**
 * Seed catalog of mitigation actions. Discount bands are order-of-magnitude
 * estimates inspired by IBHS FORTIFIED, CA Safer from Wildfires, FL Hurricane
 * Loss Mitigation, and public carrier discount schedules. Always treated as
 * "expected range" not "confirmed price" — see disclaimer on MitigationPlan.
 *
 * Source: docs/gtm/value-add-activities/06-mitigation-savings.md §4
 */
export const MITIGATION_CATALOG: MitigationAction[] = [
  {
    id: 'ibhs-fortified-roof',
    title: 'Install a FORTIFIED Roof',
    description:
      'Sealed roof deck, enhanced attachment, and impact-rated cover. Standard for wind/hail discounts with most admitted carriers.',
    peril: 'wind',
    estimatedDiscountMin: 0.1,
    estimatedDiscountMax: 0.35,
    investmentCostMin: 8000,
    investmentCostMax: 25000,
    source: 'IBHS FORTIFIED',
  },
  {
    id: 'hurricane-shutters',
    title: 'Add Hurricane Shutters or Impact Glass',
    description:
      'Protect openings against wind-borne debris. Qualifies for opening-protection credits in most coastal states.',
    peril: 'wind',
    estimatedDiscountMin: 0.05,
    estimatedDiscountMax: 0.15,
    investmentCostMin: 3500,
    investmentCostMax: 15000,
    source: 'FL OIR hurricane mitigation',
  },
  {
    id: 'defensible-space',
    title: 'Clear Defensible Space (Zone 0–2)',
    description:
      'Remove combustible material within 30 ft of the home. Required by most CA carriers and often enough to unlock re-entry into restricted ZIPs.',
    peril: 'fire',
    estimatedDiscountMin: 0.05,
    estimatedDiscountMax: 0.2,
    investmentCostMin: 500,
    investmentCostMax: 4000,
    source: 'CA Safer from Wildfires',
  },
  {
    id: 'class-a-roof',
    title: 'Upgrade to Class A Fire-Rated Roof',
    description:
      'Non-combustible roof covering (tile, metal, or Class A asphalt). Often required to place coverage in WUI ZIPs.',
    peril: 'fire',
    estimatedDiscountMin: 0.05,
    estimatedDiscountMax: 0.15,
    investmentCostMin: 10000,
    investmentCostMax: 30000,
    source: 'CA Safer from Wildfires',
  },
  {
    id: 'flood-vents',
    title: 'Install Flood Vents on Crawlspace',
    description:
      'ICC-approved flood vents reduce hydrostatic pressure and qualify for NFIP rate reductions in SFHA properties.',
    peril: 'flood',
    estimatedDiscountMin: 0.1,
    estimatedDiscountMax: 0.3,
    investmentCostMin: 1500,
    investmentCostMax: 5000,
    source: 'FEMA TB-1 openings guidance',
  },
  {
    id: 'elevate-mechanicals',
    title: 'Elevate Mechanical Equipment',
    description:
      'Raise HVAC, water heater, and electrical service above Base Flood Elevation. Material rate impact for SFHA.',
    peril: 'flood',
    estimatedDiscountMin: 0.05,
    estimatedDiscountMax: 0.2,
    investmentCostMin: 2500,
    investmentCostMax: 8000,
    source: 'FEMA P-312',
  },
  {
    id: 'seismic-retrofit',
    title: 'Seismic Retrofit (Bolting & Cripple Wall)',
    description:
      'Bolt the home to the foundation and brace cripple walls. Qualifies for earthquake-carrier premium discounts of up to 25%; California homes may additionally qualify under the CEA Brace + Bolt program.',
    peril: 'earthquake',
    estimatedDiscountMin: 0.1,
    estimatedDiscountMax: 0.25,
    investmentCostMin: 3000,
    investmentCostMax: 10000,
    source: 'FEMA P-50 / CEA Brace + Bolt (CA)',
  },
  {
    id: 'central-alarm',
    title: 'Install Central-Station Monitored Alarm',
    description:
      'Monitored fire/burglary system typically unlocks a 2–5% premium credit across most homeowners carriers.',
    peril: 'crime',
    estimatedDiscountMin: 0.02,
    estimatedDiscountMax: 0.05,
    investmentCostMin: 300,
    investmentCostMax: 1500,
    source: 'III Home Security Discounts',
  },
  {
    id: 'water-shutoff',
    title: 'Install Automatic Water-Shutoff Device',
    description:
      'Leak-detecting shutoff valves can cut water-damage claims; most carriers offer a small credit.',
    peril: 'general',
    estimatedDiscountMin: 0.02,
    estimatedDiscountMax: 0.08,
    investmentCostMin: 600,
    investmentCostMax: 2500,
    source: 'Insurance industry smart-home discounts',
  },
]
