/**
 * State-level risk calibration profiles.
 *
 * Uses a defaults + overrides pattern to avoid 50+ near-identical entries.
 * Only states with materially different risk or regulatory profiles are listed
 * in the overrides map. All others inherit the national-average defaults.
 */

import type {
  StateRiskProfile,
  PerilProfile,
  StateComplianceInfo,
} from '@coverguard/shared'

// ─── Defaults ────────────────────────────────────────────────────────────────

const defaultPeril: PerilProfile = {
  lossRatioMultiplier: 1.0,
  catastrophicRisk: false,
}

const defaultCompliance: StateComplianceInfo = {
  buildingCodeLevel: 'CURRENT',
  buildingCodeEnforcement: 3,
  rateRegulation: 'FILE_AND_USE',
  mandatoryFloodZones: false,
  mandatoryWindstorm: false,
  earthquakeDisclosureRequired: false,
  naturalHazardDisclosure: false,
  sinkholeDisclosure: false,
  residualMarketPrograms: [],
}

const defaults: Omit<StateRiskProfile, 'stateCode' | 'stateName'> = {
  flood: { ...defaultPeril },
  fire: { ...defaultPeril },
  wind: { ...defaultPeril },
  earthquake: { ...defaultPeril },
  crime: { ...defaultPeril },
  carrierCountTrend: 'STABLE',
  residualMarketUsage: 'LOW',
  compliance: { ...defaultCompliance },
  knownRisks: [],
}

// ─── Overrides ────────────────────────────────────────────────────────────────

type StateOverride = Partial<Omit<StateRiskProfile, 'stateCode' | 'stateName'>> & {
  compliance?: Partial<StateComplianceInfo>
}

const overrides: Record<string, StateOverride> = {
  FL: {
    flood: { lossRatioMultiplier: 2.0, catastrophicRisk: true, floorScore: 35 },
    fire: { lossRatioMultiplier: 0.8, catastrophicRisk: false },
    wind: { lossRatioMultiplier: 2.5, catastrophicRisk: true, floorScore: 45 },
    earthquake: { lossRatioMultiplier: 0.4, catastrophicRisk: false },
    crime: { lossRatioMultiplier: 1.2, catastrophicRisk: false },
    carrierCountTrend: 'EXITING',
    residualMarketUsage: 'HIGH',
    compliance: {
      buildingCodeLevel: 'CURRENT', // Florida Building Code — strong post-Andrew
      buildingCodeEnforcement: 4,
      rateRegulation: 'PRIOR_APPROVAL',
      mandatoryFloodZones: true,
      mandatoryWindstorm: true,
      naturalHazardDisclosure: true,
      sinkholeDisclosure: true,
      residualMarketPrograms: [
        { name: 'Citizens Property Insurance', type: 'STATE_BACKED', usageLevel: 'HIGH' },
        { name: 'Florida Hurricane Catastrophe Fund', type: 'STATE_BACKED', usageLevel: 'HIGH' },
      ],
    },
    knownRisks: [
      'Major hurricane landfall zone — among highest storm surge and wind damage losses in the US',
      'Widespread carrier withdrawal following Hurricane Ian (2022) and prior storms',
      'Citizens Property Insurance (insurer of last resort) carrying >1M policies',
      'Sinkhole activity in central Florida (karst geology)',
      'King tide and sea-level rise accelerating flood exposure in South Florida',
    ],
  },

  CA: {
    flood: { lossRatioMultiplier: 1.0, catastrophicRisk: false },
    fire: { lossRatioMultiplier: 2.5, catastrophicRisk: true, floorScore: 30 },
    wind: { lossRatioMultiplier: 0.8, catastrophicRisk: false },
    earthquake: { lossRatioMultiplier: 2.0, catastrophicRisk: true, floorScore: 30 },
    crime: { lossRatioMultiplier: 1.1, catastrophicRisk: false },
    carrierCountTrend: 'EXITING',
    residualMarketUsage: 'HIGH',
    compliance: {
      buildingCodeLevel: 'CURRENT', // CBC — among the strongest in the US
      buildingCodeEnforcement: 4,
      rateRegulation: 'PRIOR_APPROVAL', // Prop 103 — very restrictive rate regulation
      earthquakeDisclosureRequired: true,
      naturalHazardDisclosure: true,
      residualMarketPrograms: [
        { name: 'California FAIR Plan', type: 'FAIR_PLAN', usageLevel: 'HIGH' },
        { name: 'CEA Earthquake Authority', type: 'STATE_BACKED', usageLevel: 'MODERATE' },
      ],
    },
    knownRisks: [
      'Major insurers (State Farm, Allstate, Farmers) non-renewing or pausing new homeowner policies',
      'Cascadia-adjacent seismic exposure; San Andreas, Hayward, and other active faults',
      'Wildfire risk expanding statewide — Paradise, Tubbs, Camp Fire precedents',
      'Prop 103 rate approval delays leave carriers unable to price risk adequately',
      'FAIR Plan usage surging; many properties in wildfire zones cannot get standard coverage',
    ],
  },

  TX: {
    flood: { lossRatioMultiplier: 1.5, catastrophicRisk: true, floorScore: 20 },
    fire: { lossRatioMultiplier: 1.3, catastrophicRisk: false },
    wind: { lossRatioMultiplier: 1.8, catastrophicRisk: true, floorScore: 30 },
    earthquake: { lossRatioMultiplier: 0.9, catastrophicRisk: false },
    crime: { lossRatioMultiplier: 1.1, catastrophicRisk: false },
    carrierCountTrend: 'DECLINING',
    residualMarketUsage: 'MODERATE',
    compliance: {
      buildingCodeLevel: 'PARTIAL', // adoption varies significantly by municipality
      buildingCodeEnforcement: 3,
      rateRegulation: 'FILE_AND_USE',
      mandatoryFloodZones: true,
      mandatoryWindstorm: false,
      naturalHazardDisclosure: true,
      residualMarketPrograms: [
        { name: 'Texas Windstorm Insurance Association (TWIA)', type: 'BEACH_WIND_POOL', usageLevel: 'HIGH' },
        { name: 'Texas FAIR Plan', type: 'FAIR_PLAN', usageLevel: 'LOW' },
      ],
    },
    knownRisks: [
      'Gulf Coast hurricane and storm surge exposure (Harvey 2017 — record flooding)',
      'Tornado Alley corridor across north-central Texas',
      'Coastal counties depend heavily on TWIA for wind coverage',
      'Harris County (Houston) flood losses among highest in the nation',
      'Increasing drought and wildfire risk in western and central Texas',
    ],
  },

  LA: {
    flood: { lossRatioMultiplier: 2.5, catastrophicRisk: true, floorScore: 50 },
    fire: { lossRatioMultiplier: 1.0, catastrophicRisk: false },
    wind: { lossRatioMultiplier: 2.2, catastrophicRisk: true, floorScore: 50 },
    earthquake: { lossRatioMultiplier: 0.6, catastrophicRisk: false },
    crime: { lossRatioMultiplier: 1.5, catastrophicRisk: false },
    carrierCountTrend: 'EXITING',
    residualMarketUsage: 'HIGH',
    compliance: {
      buildingCodeLevel: 'PARTIAL',
      buildingCodeEnforcement: 2,
      rateRegulation: 'PRIOR_APPROVAL',
      mandatoryFloodZones: true,
      mandatoryWindstorm: true,
      naturalHazardDisclosure: true,
      residualMarketPrograms: [
        { name: 'Louisiana Citizens Property Insurance', type: 'STATE_BACKED', usageLevel: 'HIGH' },
        { name: 'Louisiana FAIR Plan', type: 'FAIR_PLAN', usageLevel: 'MODERATE' },
      ],
    },
    knownRisks: [
      'Katrina (2005) and Ida (2021) among the costliest US hurricanes ever recorded',
      'Much of coastal Louisiana below sea level — extreme storm surge exposure',
      'Significant coastal land loss accelerating flood risk long-term',
      'Dozens of carriers exited the state post-Ida; premium increases of 30–100%',
      'High crime indices in several metro areas contribute to elevated crime scores',
    ],
  },

  OK: {
    flood: { lossRatioMultiplier: 1.1, catastrophicRisk: false },
    fire: { lossRatioMultiplier: 1.1, catastrophicRisk: false },
    wind: { lossRatioMultiplier: 2.0, catastrophicRisk: true, floorScore: 45 },
    earthquake: { lossRatioMultiplier: 1.8, catastrophicRisk: false, floorScore: 25 },
    crime: { lossRatioMultiplier: 1.2, catastrophicRisk: false },
    carrierCountTrend: 'DECLINING',
    residualMarketUsage: 'LOW',
    compliance: {
      buildingCodeLevel: 'PARTIAL',
      buildingCodeEnforcement: 2,
      rateRegulation: 'PRIOR_APPROVAL',
      naturalHazardDisclosure: true,
      residualMarketPrograms: [
        { name: 'Oklahoma FAIR Plan', type: 'FAIR_PLAN', usageLevel: 'LOW' },
      ],
    },
    knownRisks: [
      'Core Tornado Alley — highest frequency of violent tornadoes (EF4/EF5) globally',
      'Induced seismicity from wastewater injection (oil and gas) — earthquake frequency spiked post-2010',
      'Hail corridor: frequent large-hail events driving auto and roof insurance losses',
      'Oklahoma City metro has recorded multiple EF5 tornadoes in recent decades',
    ],
  },

  SC: {
    flood: { lossRatioMultiplier: 1.5, catastrophicRisk: false, floorScore: 20 },
    fire: { lossRatioMultiplier: 1.0, catastrophicRisk: false },
    wind: { lossRatioMultiplier: 1.8, catastrophicRisk: true, floorScore: 35 },
    earthquake: { lossRatioMultiplier: 1.0, catastrophicRisk: false },
    crime: { lossRatioMultiplier: 1.1, catastrophicRisk: false },
    carrierCountTrend: 'DECLINING',
    residualMarketUsage: 'MODERATE',
    compliance: {
      buildingCodeLevel: 'OUTDATED',
      buildingCodeEnforcement: 2,
      rateRegulation: 'PRIOR_APPROVAL',
      mandatoryFloodZones: true,
      mandatoryWindstorm: true,
      naturalHazardDisclosure: true,
      residualMarketPrograms: [
        { name: 'SC Wind & Hail Underwriting Association', type: 'BEACH_WIND_POOL', usageLevel: 'MODERATE' },
        { name: 'SC FAIR Plan', type: 'FAIR_PLAN', usageLevel: 'LOW' },
      ],
    },
    knownRisks: [
      'Direct hurricane path exposure — Dorian (2019), Matthew (2016) coastal impacts',
      'Low-lying coastal areas face significant storm surge and flooding risk',
      'Older building stock and weaker code enforcement in coastal counties',
      'Charleston liquefaction zones from seismic events (New Madrid zone influence)',
    ],
  },

  NC: {
    flood: { lossRatioMultiplier: 1.4, catastrophicRisk: false, floorScore: 15 },
    fire: { lossRatioMultiplier: 1.0, catastrophicRisk: false },
    wind: { lossRatioMultiplier: 1.6, catastrophicRisk: true, floorScore: 30 },
    earthquake: { lossRatioMultiplier: 1.0, catastrophicRisk: false },
    crime: { lossRatioMultiplier: 1.0, catastrophicRisk: false },
    carrierCountTrend: 'DECLINING',
    residualMarketUsage: 'MODERATE',
    compliance: {
      buildingCodeLevel: 'PARTIAL',
      buildingCodeEnforcement: 3,
      rateRegulation: 'PRIOR_APPROVAL',
      mandatoryFloodZones: true,
      naturalHazardDisclosure: true,
      residualMarketPrograms: [
        { name: 'NC Joint Underwriting Association', type: 'JOINT_UNDERWRITING', usageLevel: 'LOW' },
        { name: 'NC Insurance Underwriting Association (Beach Plan)', type: 'BEACH_WIND_POOL', usageLevel: 'MODERATE' },
      ],
    },
    knownRisks: [
      'Outer Banks and coastal counties face direct hurricane landfalls (Floyd 1999, Florence 2018)',
      'Florence produced catastrophic inland flooding in eastern NC — unprecedented rainfall totals',
      'Beach Plan covers coastal wind where private market has largely withdrawn',
      'Riverine flooding risk elevated across piedmont and coastal plain areas',
    ],
  },

  NY: {
    flood: { lossRatioMultiplier: 1.5, catastrophicRisk: true, floorScore: 20 },
    fire: { lossRatioMultiplier: 0.9, catastrophicRisk: false },
    wind: { lossRatioMultiplier: 1.3, catastrophicRisk: false },
    earthquake: { lossRatioMultiplier: 0.9, catastrophicRisk: false },
    crime: { lossRatioMultiplier: 1.1, catastrophicRisk: false },
    carrierCountTrend: 'DECLINING',
    residualMarketUsage: 'MODERATE',
    compliance: {
      buildingCodeLevel: 'CURRENT',
      buildingCodeEnforcement: 4,
      rateRegulation: 'PRIOR_APPROVAL',
      mandatoryFloodZones: true,
      naturalHazardDisclosure: true,
      residualMarketPrograms: [
        { name: 'New York Property Insurance Underwriting Association (NYPIUA)', type: 'FAIR_PLAN', usageLevel: 'MODERATE' },
        { name: 'New York Coastal Market Assistance Program', type: 'STATE_BACKED', usageLevel: 'LOW' },
      ],
    },
    knownRisks: [
      'Superstorm Sandy (2012) caused $65B in insured losses — NYC and Long Island hardest hit',
      'Coastal Long Island and Rockaways face ongoing storm surge exposure',
      'Rising sea levels and hurricane track shifts increasing long-term coastal risk',
      'Stringent Prop-103-style rate approval creates market friction in stressed zones',
    ],
  },

  NJ: {
    flood: { lossRatioMultiplier: 2.0, catastrophicRisk: true, floorScore: 30 },
    fire: { lossRatioMultiplier: 0.9, catastrophicRisk: false },
    wind: { lossRatioMultiplier: 1.5, catastrophicRisk: false },
    earthquake: { lossRatioMultiplier: 0.8, catastrophicRisk: false },
    crime: { lossRatioMultiplier: 1.0, catastrophicRisk: false },
    carrierCountTrend: 'DECLINING',
    residualMarketUsage: 'MODERATE',
    compliance: {
      buildingCodeLevel: 'CURRENT',
      buildingCodeEnforcement: 4,
      rateRegulation: 'PRIOR_APPROVAL',
      mandatoryFloodZones: true,
      naturalHazardDisclosure: true,
      residualMarketPrograms: [
        { name: 'New Jersey FAIR Plan', type: 'FAIR_PLAN', usageLevel: 'MODERATE' },
      ],
    },
    knownRisks: [
      'Sandy (2012) devastated the Jersey Shore — highest NFIP claims density in the US',
      'Densely populated coastal zone with significant storm surge and tidal flood exposure',
      'Many shore communities rely on FEMA flood insurance with inadequate private market',
      'Inland flooding risk from nor\'easters and tropical remnants (Ida 2021)',
    ],
  },

  CO: {
    flood: { lossRatioMultiplier: 0.9, catastrophicRisk: false },
    fire: { lossRatioMultiplier: 1.8, catastrophicRisk: true, floorScore: 25 },
    wind: { lossRatioMultiplier: 1.3, catastrophicRisk: false },
    earthquake: { lossRatioMultiplier: 0.7, catastrophicRisk: false },
    crime: { lossRatioMultiplier: 1.0, catastrophicRisk: false },
    carrierCountTrend: 'DECLINING',
    residualMarketUsage: 'LOW',
    compliance: {
      buildingCodeLevel: 'PARTIAL',
      buildingCodeEnforcement: 3,
      rateRegulation: 'FILE_AND_USE',
      naturalHazardDisclosure: true,
      residualMarketPrograms: [
        { name: 'Colorado FAIR Plan', type: 'FAIR_PLAN', usageLevel: 'LOW' },
      ],
    },
    knownRisks: [
      'Marshall Fire (2021) destroyed 1,000+ homes in Boulder County — urban interface wildfire',
      'Hail Corridor along Front Range generates among highest auto/property hail losses nationally',
      'Western slope WUI communities face increasing fire suppression difficulty',
      'Drought cycles amplify fire risk statewide, particularly in lower-elevation foothills',
    ],
  },

  WA: {
    flood: { lossRatioMultiplier: 1.1, catastrophicRisk: false },
    fire: { lossRatioMultiplier: 1.4, catastrophicRisk: false, floorScore: 15 },
    wind: { lossRatioMultiplier: 1.1, catastrophicRisk: false },
    earthquake: { lossRatioMultiplier: 1.8, catastrophicRisk: true, floorScore: 35 },
    crime: { lossRatioMultiplier: 1.0, catastrophicRisk: false },
    carrierCountTrend: 'STABLE',
    residualMarketUsage: 'LOW',
    compliance: {
      buildingCodeLevel: 'CURRENT',
      buildingCodeEnforcement: 4,
      rateRegulation: 'PRIOR_APPROVAL',
      earthquakeDisclosureRequired: true,
      naturalHazardDisclosure: true,
      residualMarketPrograms: [
        { name: 'Washington FAIR Plan', type: 'FAIR_PLAN', usageLevel: 'LOW' },
      ],
    },
    knownRisks: [
      'Cascadia Subduction Zone (CSZ) — potential M8.0–9.0 megathrust earthquake with 300-year recurrence',
      'Puget Sound cities (Seattle, Tacoma) have significant liquefaction exposure',
      'Eastern Washington faces substantial wildfire risk during drought conditions',
      'Mount Rainier and other Cascade volcanoes create lahar inundation zones',
      'Tsunami inundation zones along coastal communities from potential CSZ event',
    ],
  },

  OR: {
    flood: { lossRatioMultiplier: 1.1, catastrophicRisk: false },
    fire: { lossRatioMultiplier: 1.5, catastrophicRisk: false, floorScore: 15 },
    wind: { lossRatioMultiplier: 1.1, catastrophicRisk: false },
    earthquake: { lossRatioMultiplier: 1.8, catastrophicRisk: true, floorScore: 35 },
    crime: { lossRatioMultiplier: 1.0, catastrophicRisk: false },
    carrierCountTrend: 'STABLE',
    residualMarketUsage: 'LOW',
    compliance: {
      buildingCodeLevel: 'CURRENT',
      buildingCodeEnforcement: 4,
      rateRegulation: 'PRIOR_APPROVAL',
      earthquakeDisclosureRequired: true,
      naturalHazardDisclosure: true,
      residualMarketPrograms: [
        { name: 'Oregon FAIR Plan', type: 'FAIR_PLAN', usageLevel: 'LOW' },
      ],
    },
    knownRisks: [
      'Cascadia Subduction Zone megathrust earthquake and tsunami exposure (same fault as WA)',
      'Labor Day Fires (2020) burned 1M+ acres in days — record wildfire season',
      'Eastern Oregon WUI communities vulnerable to large wildfire events',
      'Portland metro sits on several active fault systems (East Bank Fault)',
    ],
  },

  AK: {
    flood: { lossRatioMultiplier: 1.2, catastrophicRisk: false },
    fire: { lossRatioMultiplier: 0.6, catastrophicRisk: false },
    wind: { lossRatioMultiplier: 1.5, catastrophicRisk: false },
    earthquake: { lossRatioMultiplier: 2.0, catastrophicRisk: true, floorScore: 45 },
    crime: { lossRatioMultiplier: 1.3, catastrophicRisk: false },
    carrierCountTrend: 'STABLE',
    residualMarketUsage: 'LOW',
    compliance: {
      buildingCodeLevel: 'PARTIAL', // remote/rural areas have minimal code enforcement
      buildingCodeEnforcement: 2,
      rateRegulation: 'FILE_AND_USE',
      earthquakeDisclosureRequired: true,
      naturalHazardDisclosure: true,
      residualMarketPrograms: [],
    },
    knownRisks: [
      'Most seismically active US state — 1964 Good Friday M9.2 remains second-largest ever recorded',
      'Tsunami exposure along all coastal communities',
      'Permafrost thaw causing foundation instability statewide',
      'Isolated communities face limited emergency response and infrastructure fragility',
      'Extreme winter weather driving heating system and freeze-related claims',
    ],
  },

  HI: {
    flood: { lossRatioMultiplier: 1.2, catastrophicRisk: false },
    fire: { lossRatioMultiplier: 1.3, catastrophicRisk: true, floorScore: 20 },
    wind: { lossRatioMultiplier: 1.8, catastrophicRisk: true, floorScore: 35 },
    earthquake: { lossRatioMultiplier: 1.3, catastrophicRisk: false },
    crime: { lossRatioMultiplier: 0.9, catastrophicRisk: false },
    carrierCountTrend: 'DECLINING',
    residualMarketUsage: 'HIGH',
    compliance: {
      buildingCodeLevel: 'CURRENT',
      buildingCodeEnforcement: 3,
      rateRegulation: 'PRIOR_APPROVAL',
      mandatoryFloodZones: true,
      mandatoryWindstorm: true,
      naturalHazardDisclosure: true,
      residualMarketPrograms: [
        { name: 'Hawaii FAIR Plan', type: 'FAIR_PLAN', usageLevel: 'HIGH' },
      ],
    },
    knownRisks: [
      'Lahaina wildfire (August 2023) — deadliest US fire in over 100 years, 100+ fatalities',
      'Hurricane Iniki (1992) direct hit on Kauai — significant carrier withdrawal followed',
      'Lava flow zones on Big Island (Zones 1–3) largely uninsurable through standard market',
      'Volcanic air quality (vog) and ashfall risk on wind-facing slopes',
      'Very limited carrier options state-wide; high FAIR Plan reliance',
    ],
  },

  MS: {
    flood: { lossRatioMultiplier: 2.0, catastrophicRisk: true, floorScore: 40 },
    fire: { lossRatioMultiplier: 1.0, catastrophicRisk: false },
    wind: { lossRatioMultiplier: 2.0, catastrophicRisk: true, floorScore: 45 },
    earthquake: { lossRatioMultiplier: 1.1, catastrophicRisk: false },
    crime: { lossRatioMultiplier: 1.4, catastrophicRisk: false },
    carrierCountTrend: 'EXITING',
    residualMarketUsage: 'HIGH',
    compliance: {
      buildingCodeLevel: 'OUTDATED',
      buildingCodeEnforcement: 1,
      rateRegulation: 'PRIOR_APPROVAL',
      mandatoryFloodZones: true,
      mandatoryWindstorm: true,
      naturalHazardDisclosure: true,
      residualMarketPrograms: [
        { name: 'Mississippi Windstorm Underwriting Association', type: 'BEACH_WIND_POOL', usageLevel: 'HIGH' },
        { name: 'Mississippi FAIR Plan', type: 'FAIR_PLAN', usageLevel: 'MODERATE' },
      ],
    },
    knownRisks: [
      'Katrina (2005) direct hit produced 30-foot storm surge — catastrophic Gulf Coast losses',
      'Low-lying Gulf Coast topography with minimal natural surge barriers',
      'Weak building codes and enforcement leading to higher structural damage in wind events',
      'New Madrid Seismic Zone — potential for large Midwest earthquakes affecting northern MS',
      'High poverty rates amplify recovery time and underinsurance problem',
    ],
  },

  AL: {
    flood: { lossRatioMultiplier: 1.6, catastrophicRisk: false, floorScore: 25 },
    fire: { lossRatioMultiplier: 1.0, catastrophicRisk: false },
    wind: { lossRatioMultiplier: 1.8, catastrophicRisk: true, floorScore: 35 },
    earthquake: { lossRatioMultiplier: 1.0, catastrophicRisk: false },
    crime: { lossRatioMultiplier: 1.2, catastrophicRisk: false },
    carrierCountTrend: 'DECLINING',
    residualMarketUsage: 'MODERATE',
    compliance: {
      buildingCodeLevel: 'PARTIAL',
      buildingCodeEnforcement: 2,
      rateRegulation: 'PRIOR_APPROVAL',
      mandatoryFloodZones: true,
      naturalHazardDisclosure: true,
      residualMarketPrograms: [
        { name: 'Alabama Insurance Underwriting Association', type: 'BEACH_WIND_POOL', usageLevel: 'MODERATE' },
        { name: 'Alabama FAIR Plan', type: 'FAIR_PLAN', usageLevel: 'LOW' },
      ],
    },
    knownRisks: [
      'Gulf Coast hurricane exposure (Ivan 2004, Katrina 2005, Sally 2020)',
      '2011 Super Outbreak — record 62 tornadoes in one day, including Birmingham metro EF4s',
      'Mobile and coastal Baldwin County face significant storm surge risk',
      'Riverine flooding from Black Warrior, Alabama, and Tennessee river systems',
    ],
  },

  GA: {
    flood: { lossRatioMultiplier: 1.2, catastrophicRisk: false },
    fire: { lossRatioMultiplier: 1.1, catastrophicRisk: false },
    wind: { lossRatioMultiplier: 1.3, catastrophicRisk: false },
    earthquake: { lossRatioMultiplier: 0.9, catastrophicRisk: false },
    crime: { lossRatioMultiplier: 1.1, catastrophicRisk: false },
    carrierCountTrend: 'STABLE',
    residualMarketUsage: 'LOW',
    compliance: {
      buildingCodeLevel: 'CURRENT',
      buildingCodeEnforcement: 3,
      rateRegulation: 'FILE_AND_USE',
      mandatoryFloodZones: true,
      naturalHazardDisclosure: true,
      residualMarketPrograms: [
        { name: 'Georgia FAIR Plan', type: 'FAIR_PLAN', usageLevel: 'LOW' },
      ],
    },
    knownRisks: [
      'Coastal Camden and Chatham counties face hurricane and storm surge exposure',
      'Inland flood risk from Oconee, Altamaha, and Chattahoochee river systems',
      'Atlanta metro has experienced tornado outbreaks (March 2008 downtown EF2)',
    ],
  },

  NE: {
    flood: { lossRatioMultiplier: 1.3, catastrophicRisk: false },
    fire: { lossRatioMultiplier: 1.0, catastrophicRisk: false },
    wind: { lossRatioMultiplier: 1.8, catastrophicRisk: false, floorScore: 35 },
    earthquake: { lossRatioMultiplier: 0.7, catastrophicRisk: false },
    crime: { lossRatioMultiplier: 1.0, catastrophicRisk: false },
    carrierCountTrend: 'STABLE',
    residualMarketUsage: 'LOW',
    compliance: {
      buildingCodeLevel: 'PARTIAL',
      buildingCodeEnforcement: 3,
      rateRegulation: 'FILE_AND_USE',
      naturalHazardDisclosure: true,
      residualMarketPrograms: [],
    },
    knownRisks: [
      'Tornado Alley — significant EF2+ tornado frequency across eastern Nebraska',
      'US hail damage capital — one of the highest hail-related insurance loss ratios in the US',
      'Missouri River and Platte River flood risk (2019 bomb cyclone caused historic flooding)',
      'Large-scale crop hail losses regularly drive statewide combined ratios above 100%',
    ],
  },

  KS: {
    flood: { lossRatioMultiplier: 1.2, catastrophicRisk: false },
    fire: { lossRatioMultiplier: 1.1, catastrophicRisk: false },
    wind: { lossRatioMultiplier: 2.0, catastrophicRisk: true, floorScore: 45 },
    earthquake: { lossRatioMultiplier: 1.3, catastrophicRisk: false },
    crime: { lossRatioMultiplier: 1.0, catastrophicRisk: false },
    carrierCountTrend: 'DECLINING',
    residualMarketUsage: 'LOW',
    compliance: {
      buildingCodeLevel: 'PARTIAL',
      buildingCodeEnforcement: 2,
      rateRegulation: 'FILE_AND_USE',
      naturalHazardDisclosure: true,
      residualMarketPrograms: [
        { name: 'Kansas FAIR Plan', type: 'FAIR_PLAN', usageLevel: 'LOW' },
      ],
    },
    knownRisks: [
      'Tornado Alley epicenter — Greensburg (2007) EF5 destroyed 95% of town',
      'Persistent hail corridor across central and eastern Kansas',
      'Induced seismicity in south-central Kansas from oil and gas wastewater disposal',
      'Prairie wind events and straight-line winds cause widespread roof damage annually',
    ],
  },
}

// ─── State name lookup ────────────────────────────────────────────────────────

const STATE_NAMES: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia',
  HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
  KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
  MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi',
  MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire',
  NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina',
  ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania',
  RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee',
  TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington',
  WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming', DC: 'Washington, D.C.',
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function getStateProfile(stateCode: string): StateRiskProfile {
  const code = stateCode.toUpperCase()
  const override = overrides[code] ?? {}

  return {
    stateCode: code,
    stateName: STATE_NAMES[code] ?? code,
    flood: { ...defaults.flood, ...(override.flood ?? {}) },
    fire: { ...defaults.fire, ...(override.fire ?? {}) },
    wind: { ...defaults.wind, ...(override.wind ?? {}) },
    earthquake: { ...defaults.earthquake, ...(override.earthquake ?? {}) },
    crime: { ...defaults.crime, ...(override.crime ?? {}) },
    carrierCountTrend: override.carrierCountTrend ?? defaults.carrierCountTrend,
    residualMarketUsage: override.residualMarketUsage ?? defaults.residualMarketUsage,
    compliance: {
      ...defaults.compliance,
      ...(override.compliance ?? {}),
      residualMarketPrograms:
        override.compliance?.residualMarketPrograms ?? defaults.compliance.residualMarketPrograms,
    },
    knownRisks: override.knownRisks ?? defaults.knownRisks,
  }
}

/**
 * Compute the regulatory/compliance risk score (0–100) from a state profile.
 *
 * Score weights:
 *   Building code quality  0–20 pts
 *   Code enforcement       0–10 pts
 *   Rate regulation        0–15 pts
 *   Residual market usage  0–30 pts
 *   Carrier count trend    0–25 pts
 *   Total                  0–100 pts
 */
export function computeComplianceScore(profile: StateRiskProfile): number {
  const c = profile.compliance

  const codeScore: Record<string, number> = {
    CURRENT: 0,
    PARTIAL: 5,
    OUTDATED: 12,
    NONE: 20,
  }
  const enfScore: Record<number, number> = { 5: 0, 4: 2, 3: 4, 2: 7, 1: 10 }
  const rateScore: Record<string, number> = {
    NO_FILE: 0,
    USE_AND_FILE: 2,
    FILE_AND_USE: 5,
    PRIOR_APPROVAL: 15,
  }
  const residualScore: Record<string, number> = {
    NONE: 0,
    LOW: 5,
    MODERATE: 15,
    HIGH: 30,
  }
  const trendScore: Record<string, number> = {
    STABLE: 0,
    DECLINING: 10,
    EXITING: 25,
  }

  const raw =
    (codeScore[c.buildingCodeLevel] ?? 12) +
    (enfScore[c.buildingCodeEnforcement] ?? 4) +
    (rateScore[c.rateRegulation] ?? 5) +
    (residualScore[profile.residualMarketUsage] ?? 5) +
    (trendScore[profile.carrierCountTrend] ?? 0)

  return Math.min(100, raw)
}

/**
 * Building-code weakness modifier applied to wind and earthquake base scores.
 * Weaker codes mean structures perform worse in wind/seismic events.
 */
export function buildingCodeWindEqBoost(profile: StateRiskProfile): number {
  switch (profile.compliance.buildingCodeLevel) {
    case 'NONE':
      return 15
    case 'OUTDATED':
      return 10
    case 'PARTIAL':
      return 5
    default:
      return 0
  }
}
