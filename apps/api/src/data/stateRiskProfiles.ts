/**
 * State-level risk profiles: peril modifiers, insurance market conditions, and
 * regulatory/compliance data for all 50 US states + DC.
 *
 * Peril modifiers:
 *   floor      — minimum score for this peril regardless of national-data result
 *   multiplier — applied to raw score before floor check (1.0 = no change)
 *   final      = max(floor ?? 0, min(100, rawScore * (multiplier ?? 1.0)))
 */

import type {
  StateMarketProfile,
  StateRegulatoryProfile,
  ResidualMarketProgram,
} from '@coverguard/shared'

export interface PerilModifierConfig {
  floor?: number
  multiplier?: number
  reason: string
}

export interface StateRiskConfig {
  name: string
  perils: {
    flood?: PerilModifierConfig
    fire?: PerilModifierConfig
    wind?: PerilModifierConfig
    earthquake?: PerilModifierConfig
  }
  market: StateMarketProfile
  regulatory: StateRegulatoryProfile
  knownCatastrophicExposures: string[]
  notes: string[]
}

// ─── Shared residual-market building blocks ───────────────────────────────────

const FAIR_PLAN = (state: string, extra = ''): ResidualMarketProgram => ({
  name: `${state} FAIR Plan`,
  type: 'FAIR_PLAN',
  coverageTypes: ['Fire', 'Extended Perils', 'Liability'],
  notes: `Insurer of last resort for properties denied coverage in the voluntary market.${extra ? ' ' + extra : ''}`,
})

// ─── State profiles ───────────────────────────────────────────────────────────

export const STATE_RISK_PROFILES: Record<string, StateRiskConfig> = {

  AL: {
    name: 'Alabama',
    perils: {
      wind: { floor: 35, multiplier: 1.05, reason: 'Active hurricane corridor; 2011 super outbreak produced 252 tornadoes in a single day' },
      flood: { floor: 20, multiplier: 1.05, reason: 'Gulf Coast storm surge; Mobile Bay flooding; heavy tropical rainfall events' },
    },
    market: {
      condition: 'STRESSED',
      carriersExiting: false,
      residualMarketGrowth: true,
      notes: ['Rising wind/hail premiums in coastal Baldwin and Mobile counties', 'AIUA beach plan capacity expanding due to voluntary market retreat'],
    },
    regulatory: {
      rateRegulation: 'FILE_AND_USE',
      rateRegulationNotes: 'Insurers file rates and may use immediately; DOI may challenge within 30 days',
      buildingCodeStrength: 'MODERATE',
      buildingCodeNotes: 'Alabama adopted IBC/IRC with state amendments; coastal counties require enhanced wind-resistant construction',
      residualMarketPrograms: [
        { name: 'Alabama Insurance Underwriting Association (AIUA)', type: 'BEACH_PLAN', coverageTypes: ['Wind', 'Hail'], notes: 'Provides wind/hail coverage for eligible coastal properties unable to obtain it in the standard market' },
        FAIR_PLAN('Alabama'),
      ],
      requiredDisclosures: ['Seller disclosure of known material defects (mandatory form)', 'Flood zone disclosure when in SFHA'],
      mandatedCoverages: ['Hurricane deductible (1–5% of insured value) applies in coastal counties; must be disclosed on policy declarations'],
      complianceNotes: [
        'Properties in Baldwin and Mobile counties may be required to use AIUA for wind coverage',
        'Coastal construction must meet wind-load requirements under the Alabama Residential Building Code',
        'NFIP flood insurance mandatory for federally-backed mortgages in SFHA zones',
      ],
    },
    knownCatastrophicExposures: ['Hurricane', 'Tornado', 'Flood'],
    notes: ['April 2011 outbreak remains deadliest tornado event in modern US history', 'Gulf Coast properties face compound hurricane + storm surge exposure'],
  },

  AK: {
    name: 'Alaska',
    perils: {
      earthquake: { floor: 60, multiplier: 1.2, reason: 'Most seismically active US state; 1964 M9.2 Good Friday earthquake; regular M6+ events; Anchorage M7.1 in 2018' },
    },
    market: {
      condition: 'STRESSED',
      carriersExiting: false,
      residualMarketGrowth: false,
      notes: ['Limited carrier competition in rural areas', 'Earthquake coverage expensive and often not included in standard HO policy', 'High replacement costs due to remote location logistics'],
    },
    regulatory: {
      rateRegulation: 'FILE_AND_USE',
      rateRegulationNotes: 'File-and-use system; DOI review within 30 days',
      buildingCodeStrength: 'MODERATE',
      buildingCodeNotes: 'Alaska adopted IBC/IRC; seismic design requirements enforced in Anchorage and major municipalities; rural areas often unregulated',
      residualMarketPrograms: [
        FAIR_PLAN('Alaska', 'Limited availability; primarily for fire coverage in remote areas.'),
      ],
      requiredDisclosures: ['Seller disclosure of known defects', 'Earthquake risk disclosure recommended by state DOI'],
      mandatedCoverages: [],
      complianceNotes: [
        'Standard homeowners policies in Alaska typically exclude earthquake — separate earthquake endorsement or policy required',
        'Properties on permafrost face unique structural risks not addressed by standard policies',
        'NFIP participation limited due to remote mapping; some areas lack flood maps',
      ],
    },
    knownCatastrophicExposures: ['Earthquake', 'Tsunami', 'Permafrost Subsidence'],
    notes: ['Cascadia and Pacific Rim seismic exposure; tsunami risk in coastal communities', 'Climate change accelerating permafrost thaw, creating new structural/insurance risks'],
  },

  AZ: {
    name: 'Arizona',
    perils: {
      fire: { floor: 25, multiplier: 1.05, reason: 'Significant WUI communities; Wallow Fire (2011, 538k acres) remains largest AZ fire; haboob-driven fire spread' },
    },
    market: {
      condition: 'STABLE',
      carriersExiting: false,
      residualMarketGrowth: false,
      notes: ['Relatively stable market; some WUI rate pressure in Prescott/Flagstaff areas', 'Flash flood coverage gaps common due to monsoon season misunderstanding'],
    },
    regulatory: {
      rateRegulation: 'FILE_AND_USE',
      rateRegulationNotes: 'File-and-use with prior approval for large rate increases',
      buildingCodeStrength: 'MODERATE',
      buildingCodeNotes: 'Arizona adopts IBC/IRC with local amendments; Phoenix metro has strong enforcement; rural areas vary significantly',
      residualMarketPrograms: [FAIR_PLAN('Arizona')],
      requiredDisclosures: ['Seller Property Disclosure Statement (SPDS) required', 'Flood zone and drainage disclosure required'],
      mandatedCoverages: [],
      complianceNotes: [
        'Monsoon season flash flooding is not covered under standard flood exclusion — NFIP or separate flood policy needed',
        'WUI properties in Prescott, Flagstaff, and Show Low corridors face non-renewal risk',
        'Arizona does not require earthquake disclosure but USGS maps show moderate risk in northern AZ',
      ],
    },
    knownCatastrophicExposures: ['Wildfire', 'Flash Flood', 'Extreme Heat'],
    notes: ['Monsoon season (June–September) creates flash flood and fire-spread risk', 'Haboob dust storms can cause structural and vehicle damage not covered under basic policies'],
  },

  AR: {
    name: 'Arkansas',
    perils: {
      wind: { floor: 30, multiplier: 1.05, reason: 'Tornado corridor; Dixie Alley extends through central/eastern AR; multiple F4/F5 events historically' },
      earthquake: { floor: 25, multiplier: 1.05, reason: 'New Madrid Seismic Zone (NMSZ) underlies eastern Arkansas; 1811–12 events estimated M7.5–7.9' },
    },
    market: {
      condition: 'STRESSED',
      carriersExiting: false,
      residualMarketGrowth: true,
      notes: ['Growing tornado losses driving rate increases', 'Limited carrier options in rural eastern Arkansas near NMSZ'],
    },
    regulatory: {
      rateRegulation: 'FILE_AND_USE',
      rateRegulationNotes: 'File-and-use; Commissioner may disapprove within 30 days',
      buildingCodeStrength: 'WEAK',
      buildingCodeNotes: 'Arkansas has no mandatory statewide building code; municipalities adopt codes independently; much of rural AR has no code enforcement',
      residualMarketPrograms: [FAIR_PLAN('Arkansas')],
      requiredDisclosures: ['Seller disclosure form required for residential sales'],
      mandatedCoverages: [],
      complianceNotes: [
        'No statewide building code means storm-resistant construction is not guaranteed outside major cities',
        'Earthquake coverage is excluded from standard HO policies — NMSZ risk warrants consideration of standalone earthquake policy',
        'NFIP flood insurance required in SFHA; Arkansas River and Mississippi River floodplains are extensive',
      ],
    },
    knownCatastrophicExposures: ['Tornado', 'Earthquake (New Madrid)', 'River Flooding'],
    notes: ['Eastern AR sits directly above New Madrid Seismic Zone', '"Dixie Alley" tornadoes often strike at night, increasing fatality risk'],
  },

  CA: {
    name: 'California',
    perils: {
      fire: { floor: 45, multiplier: 1.2, reason: 'Highest wildfire losses in US history; Camp Fire ($16.5B insured), Dixie, Caldor, Thomas; expanding WUI exposure statewide' },
      earthquake: { floor: 35, multiplier: 1.15, reason: 'San Andreas, Hayward, and dozens of active faults; Northridge 1994 ($44B), Loma Prieta 1989; major Cascadia subduction risk in NorCal' },
    },
    market: {
      condition: 'CRISIS',
      carriersExiting: true,
      residualMarketGrowth: true,
      notes: [
        'State Farm, Allstate, Farmers, and AIG have paused or non-renewed hundreds of thousands of CA policies since 2022',
        'CA FAIR Plan policies grew from 200k to over 450k (2020–2024); plan near capacity limits',
        'Prop 103 (1988) prevents risk-adequate pricing, accelerating voluntary market exit',
        'Insurance Commissioner implementing Sustainable Insurance Strategy (2024) to allow catastrophe modeling in rates',
      ],
    },
    regulatory: {
      rateRegulation: 'PRIOR_APPROVAL',
      rateRegulationNotes: 'Proposition 103 (1988) requires prior approval for all rate changes; historically based on historical loss data only (not forward-looking CAT models); new 2024 regulations will allow CAT modeling',
      buildingCodeStrength: 'STRONG',
      buildingCodeNotes: 'California Title 24 (Building Standards Code) is among the most comprehensive in the US; Chapter 7A wildfire-resistant construction required in High/Very High Fire Hazard Severity Zones',
      residualMarketPrograms: [
        { name: 'California FAIR Plan', type: 'FAIR_PLAN', coverageTypes: ['Fire', 'Lightning', 'Internal Explosion'], notes: 'Last-resort fire coverage; does NOT include liability or theft; must bundle with a Differences in Conditions (DIC) policy for full coverage. Growing rapidly and under severe financial stress.' },
        { name: 'California Earthquake Authority (CEA)', type: 'STATE_INSURER', coverageTypes: ['Earthquake'], notes: 'Largest provider of residential earthquake insurance in the US; policies include dwelling, personal property, and Additional Living Expense (ALE) components; offered through participating insurers' },
      ],
      requiredDisclosures: [
        'Natural Hazard Disclosure (NHD) Report required at sale — discloses SFHA, dam inundation zones, Very High FHSZ, earthquake fault zones (Alquist-Priolo), seismic hazard zones, high fire severity zones',
        'Transfer Disclosure Statement (TDS) required for residential sales',
        'Mello-Roos and special assessment disclosures',
      ],
      mandatedCoverages: [
        'Insurers must offer earthquake coverage if writing residential fire coverage (may be declined by buyer)',
        'FAIR Plan policyholders must be notified they can supplement with a DIC policy',
        'Wildfire retrofit — Chapter 7A construction standards required in VHFHSZ for new construction',
      ],
      complianceNotes: [
        'FAIR Plan covers FIRE only — liability, theft, and water damage require a separate Differences in Conditions (DIC) policy',
        'Earthquake coverage is NOT included in standard CA homeowners policies; CEA or standalone policy required',
        'Properties in Very High FHSZ must meet Chapter 7A fire-resistant construction standards (Class A roofing, ember-resistant vents, defensible space)',
        'Prop 103 rate controls are the primary driver of the ongoing insurance crisis; rates have been suppressed below actuarially sound levels',
        'New 2024 Sustainable Insurance Strategy: insurers may now factor in CAT models and reinsurance costs in rate filings in exchange for writing more policies in distressed areas',
        'Home Hardening Tax Credit available for defensible space and fire-resistant improvements',
      ],
    },
    knownCatastrophicExposures: ['Wildfire', 'Earthquake', 'Landslide', 'Drought'],
    notes: [
      'California accounts for over 60% of US insured wildfire losses in recent years',
      'San Andreas Fault runs ~800 miles through the state; "Big One" (M7.8+) could cause $200B+ in losses',
      'Mudslide and debris flow risk is high in post-fire burn scar areas (not covered under standard policies)',
    ],
  },

  CO: {
    name: 'Colorado',
    perils: {
      fire: { floor: 25, multiplier: 1.1, reason: 'Marshall Fire (2021) was costliest CO wildfire ever at $2B+; suburban WUI expansion into Front Range; drought amplification' },
      wind: { floor: 20, multiplier: 1.05, reason: 'Severe hail corridor along Front Range; Colorado has highest hail damage costs in US per capita' },
    },
    market: {
      condition: 'STRESSED',
      carriersExiting: false,
      residualMarketGrowth: true,
      notes: ['Front Range wildfire non-renewals increasing since Marshall Fire', 'Hail losses are driving double-digit rate increases across the state', 'Some carriers restricting coverage in Boulder, Jefferson, and Larimer counties'],
    },
    regulatory: {
      rateRegulation: 'FILE_AND_USE',
      rateRegulationNotes: 'File-and-use with 30-day review period; Commissioner may require justification for large increases',
      buildingCodeStrength: 'MODERATE',
      buildingCodeNotes: 'Colorado adopts IBC/IRC; WUI building codes enacted after Marshall Fire in many Front Range jurisdictions; enforcement varies by county',
      residualMarketPrograms: [FAIR_PLAN('Colorado', 'Limited capacity; covers fire and basic perils only.')],
      requiredDisclosures: ['Seller Property Disclosure required', 'Colorado Natural Hazard Assessment (wildfire, flood, radon) recommended'],
      mandatedCoverages: ['Insurers must offer extended replacement cost coverage in WUI areas'],
      complianceNotes: [
        'Post-Marshall Fire, many Front Range counties adopted new WUI construction standards (fire-resistant roofing, siding, vents)',
        'Hail damage is a leading cause of claims; impact-resistant roofing (Class 4) may qualify for premium discounts',
        'Separate flood policy required for riverine and flash flood exposure (South Platte, Colorado River basins)',
        'Radon disclosure is recommended (CO has high radon levels) though not mandated by insurance law',
      ],
    },
    knownCatastrophicExposures: ['Wildfire', 'Hail', 'Flash Flood', 'Winter Storm'],
    notes: ['Front Range urban-wildland interface is expanding rapidly', 'Colorado Springs, Boulder, and Fort Collins are among highest WUI-exposure cities in the US'],
  },

  CT: {
    name: 'Connecticut',
    perils: {
      flood: { floor: 15, multiplier: 1.05, reason: 'Long Island Sound coastal exposure; significant inland flooding from remnant tropical storms (Irene 2011, Ida 2021)' },
      wind: { floor: 15, multiplier: 1.0, reason: 'New England hurricane track; moderate nor\'easter exposure' },
    },
    market: { condition: 'STRESSED', carriersExiting: false, residualMarketGrowth: false, notes: ['Coastal flood and wind rates rising', 'Some coastal properties facing non-renewal'] },
    regulatory: {
      rateRegulation: 'PRIOR_APPROVAL',
      rateRegulationNotes: 'Prior approval required; Insurance Department reviews filings before use',
      buildingCodeStrength: 'STRONG',
      buildingCodeNotes: 'Connecticut State Building Code based on IBC/IRC with amendments; strong enforcement in coastal municipalities',
      residualMarketPrograms: [FAIR_PLAN('Connecticut')],
      requiredDisclosures: ['Residential Property Condition Disclosure Report required', 'Flood zone disclosure mandatory'],
      mandatedCoverages: ['Hurricane deductible may apply in coastal areas'],
      complianceNotes: ['Coastal Zone Management Act affects construction and rebuilding near shoreline', 'Flood insurance strongly recommended for Long Island Sound coastal properties even outside SFHA'],
    },
    knownCatastrophicExposures: ['Hurricane', 'Nor\'easter', 'Flood'],
    notes: ['Long Island Sound provides some storm surge buffering but coastal areas still highly exposed'],
  },

  DE: {
    name: 'Delaware',
    perils: {
      flood: { floor: 15, multiplier: 1.05, reason: 'Low-lying coastal state; Delaware Bay and Atlantic coast exposure; much of state near sea level' },
    },
    market: { condition: 'STABLE', carriersExiting: false, residualMarketGrowth: false, notes: ['Generally stable market; coastal properties see higher rates'] },
    regulatory: {
      rateRegulation: 'FILE_AND_USE',
      rateRegulationNotes: 'File-and-use; DOI review within 30 days',
      buildingCodeStrength: 'MODERATE',
      buildingCodeNotes: 'Delaware Building Code based on IBC/IRC; coastal construction standards apply in Sussex County',
      residualMarketPrograms: [FAIR_PLAN('Delaware')],
      requiredDisclosures: ['Seller Disclosure of Real Property Condition required', 'Coastal Zone disclosure for applicable properties'],
      mandatedCoverages: [],
      complianceNotes: ['Properties in Sussex County coastal areas should carry flood and wind coverage', 'Delaware Coastal Zone Act restricts new heavy industry but affects some property uses'],
    },
    knownCatastrophicExposures: ['Coastal Flood', 'Hurricane'],
    notes: ['One of the lowest-elevation states; sea level rise poses long-term flood risk'],
  },

  DC: {
    name: 'Washington, D.C.',
    perils: {
      flood: { floor: 15, multiplier: 1.0, reason: 'Potomac and Anacostia River flooding; some low-lying areas susceptible to flash flooding' },
    },
    market: { condition: 'STABLE', carriersExiting: false, residualMarketGrowth: false, notes: ['Stable urban market; high property values mean large absolute loss amounts'] },
    regulatory: {
      rateRegulation: 'PRIOR_APPROVAL',
      rateRegulationNotes: 'DC Department of Insurance, Securities and Banking (DISB) requires prior approval',
      buildingCodeStrength: 'STRONG',
      buildingCodeNotes: 'DC Building Code is among the most stringent; based on IBC with local amendments; historic preservation requirements add complexity',
      residualMarketPrograms: [FAIR_PLAN('DC')],
      requiredDisclosures: ['Residential Property Disclosure required', 'Flood zone disclosure required'],
      mandatedCoverages: [],
      complianceNotes: ['Historic district buildings face additional compliance requirements that may affect reconstruction costs', 'Flood insurance strongly recommended for properties near Potomac and Anacostia Rivers'],
    },
    knownCatastrophicExposures: ['Flood', 'Winter Storm'],
    notes: [],
  },

  FL: {
    name: 'Florida',
    perils: {
      wind: { floor: 55, multiplier: 1.2, reason: 'Most hurricane landfalls of any US state; Ian ($113B), Irma ($50B), Michael, Dorian, Idalia; entire peninsula in hurricane zone' },
      flood: { floor: 30, multiplier: 1.1, reason: 'Extensive NFIP exposure; highest NFIP claims volume nationally; storm surge + inland flooding compound risk; sinkholes elevate flood vulnerability' },
    },
    market: {
      condition: 'CRISIS',
      carriersExiting: true,
      residualMarketGrowth: true,
      notes: [
        'State Farm, Farmers, Bankers Insurance, and 7+ FL-specific carriers have exited or become insolvent since 2020',
        'Citizens Property Insurance exceeded 1.4M policies (2023) — largest in state history; active depopulation program underway',
        'Florida Hurricane Catastrophe Fund (FHCF) mandatory reinsurance layer for all admitted carriers',
        'Assignment of Benefits (AOB) reforms enacted 2022–2023 have begun to stabilize litigation environment',
        'Reinsurance costs at all-time highs, forcing smaller carriers into insolvency',
      ],
    },
    regulatory: {
      rateRegulation: 'FILE_AND_USE',
      rateRegulationNotes: 'File-and-use in Florida but OIR closely reviews filings; post-Ian emergency rate approvals expedited; prior approval required for rate increases >15%',
      buildingCodeStrength: 'STRONG',
      buildingCodeNotes: 'Florida Building Code (FBC) is among the strongest wind-resistant codes in the US; post-Andrew (1992) reforms mandated; High-Velocity Hurricane Zone (HVHZ) in Miami-Dade and Broward counties is most stringent nationally',
      residualMarketPrograms: [
        { name: 'Citizens Property Insurance Corporation', type: 'STATE_INSURER', coverageTypes: ['Wind', 'All-Perils', 'Flood (select policies)'], notes: 'State-created insurer of last resort; largest property insurer in FL by policy count; active depopulation program requires policyholders to move to private market when comparable coverage offered within 20% of Citizens premium' },
        { name: 'Florida Hurricane Catastrophe Fund (FHCF)', type: 'WIND_POOL', coverageTypes: ['Reinsurance (carrier-facing)'], notes: 'Mandatory reinsurance layer funded by assessment on all FL property insurance; not consumer-facing but backstops all admitted carriers' },
        { name: 'Florida Residential Property and Casualty Joint Underwriting Association (FRPCJUA)', type: 'WIND_POOL', coverageTypes: ['Wind', 'Extended Perils'], notes: 'Wind-only coverage pool for properties in coastal areas' },
      ],
      requiredDisclosures: [
        'Florida Seller Disclosure (AS-IS contract or disclosure form required)',
        'Sinkhole disclosure: sellers must disclose known sinkhole activity; insurance companies must offer sinkhole coverage',
        'Flood zone disclosure mandatory — buyer acknowledgment required',
        'Citizens policyholder notice required when offered depopulation to private carrier',
        'Wind mitigation inspection report must be offered to all HO policy applicants',
      ],
      mandatedCoverages: [
        'Hurricane deductible: separate from all-other-perils deductible; typically 2–5% of Coverage A for wind storms named by NWS',
        'Citizens and admitted carriers must offer sinkhole loss coverage upon request',
        'Insurers must offer replacement cost coverage for roof damage (no ACV-only roof settlement for roofs under 10 years in some cases)',
        'FHCF participation mandatory for all admitted residential property carriers',
      ],
      complianceNotes: [
        'Wind mitigation inspections can reduce premium by 20–70%; required features: hip roof, opening protection, roof deck attachment, roof-to-wall connection, roof covering',
        'Properties in Miami-Dade and Broward counties (HVHZ) must use FBC-compliant impact-resistant windows/doors or approved shutters',
        'Citizens eligibility: insured value must be ≤$700k (as of 2023 threshold) for new policies; properties must be "insurable" under private market standards',
        'Post-Ian SB 2-A (2023) reforms: eliminated one-way attorney fees, modified AOB, required expedited claims handling',
        'Flood insurance is NOT included in Citizens or standard HO policies — separate NFIP or private flood policy required',
        'Sinkhole subsidence is NOT covered under standard policies; separate endorsement required in designated sinkhole-prone counties (Hernando, Hillsborough, Pasco, Pinellas)',
      ],
    },
    knownCatastrophicExposures: ['Hurricane', 'Storm Surge', 'Flood', 'Sinkhole', 'Tornado'],
    notes: [
      'Florida accounts for ~80% of all property insurance litigation in the US despite having only ~12% of the national policies',
      'Post-Ian insolvencies (12+ carriers 2020–2023) have accelerated Citizens growth and reinsurance cost spiral',
      'Statewide sinkhole risk concentrated in central FL "Sinkhole Alley" (Pasco, Hernando, Hillsborough counties)',
    ],
  },

  GA: {
    name: 'Georgia',
    perils: {
      wind: { floor: 20, multiplier: 1.0, reason: 'Indirect hurricane and tropical storm exposure; tornado risk in northern GA; 2008 Fulton County tornado' },
      flood: { floor: 15, multiplier: 1.0, reason: 'Flash flooding in metro Atlanta; river flooding along Savannah and Ocmulgee; coastal surge in Savannah/Brunswick areas' },
    },
    market: { condition: 'STABLE', carriersExiting: false, residualMarketGrowth: false, notes: ['Generally stable statewide; some coastal rate pressure in Chatham and Camden counties'] },
    regulatory: {
      rateRegulation: 'FILE_AND_USE',
      rateRegulationNotes: 'File-and-use with 30-day DOI review window',
      buildingCodeStrength: 'MODERATE',
      buildingCodeNotes: 'Georgia State Minimum Standard Codes (IBC/IRC-based); mandatory statewide but enforcement quality varies by county',
      residualMarketPrograms: [
        FAIR_PLAN('Georgia'),
        { name: 'Georgia Underwriting Association (GUA)', type: 'WIND_POOL', coverageTypes: ['Wind', 'Hail', 'Fire'], notes: 'Coastal wind and fire coverage for properties in the 6 coastal counties unable to get voluntary coverage' },
      ],
      requiredDisclosures: ['Seller Property Disclosure Statement required', 'Flood zone disclosure required'],
      mandatedCoverages: [],
      complianceNotes: ['Coastal properties in Chatham, Bryan, Liberty, McIntosh, Glynn, and Camden counties should assess GUA wind eligibility', 'NFIP flood insurance required for federally-backed mortgages in SFHA'],
    },
    knownCatastrophicExposures: ['Hurricane (coastal)', 'Tornado', 'Flash Flood'],
    notes: ['Atlanta metro flash flooding risk often underestimated due to impervious surface runoff'],
  },

  HI: {
    name: 'Hawaii',
    perils: {
      earthquake: { floor: 40, multiplier: 1.1, reason: 'Active volcanic seismicity on Big Island; 2018 M6.9 Kilauea eruption; Pacific Rim subduction exposure; 2006 M6.7 Kiholo Bay' },
      fire: { floor: 30, multiplier: 1.1, reason: '2023 Lahaina fire (deadliest US wildfire in 100+ years, $5.5B insured loss); expanding WUI risk driven by drought and invasive grasses' },
      wind: { floor: 25, multiplier: 1.05, reason: 'Hurricane exposure from Central Pacific; Iniki 1992 ($3.1B); periodic tropical storms' },
    },
    market: {
      condition: 'STRESSED',
      carriersExiting: true,
      residualMarketGrowth: true,
      notes: ['Post-Lahaina insurer losses causing carrier re-evaluation of HI exposure', 'Some carriers restricting new policies on Maui', 'Hawaii FAIR Plan under increased demand post-Lahaina'],
    },
    regulatory: {
      rateRegulation: 'PRIOR_APPROVAL',
      rateRegulationNotes: 'Hawaii Insurance Division requires prior approval for rate changes',
      buildingCodeStrength: 'STRONG',
      buildingCodeNotes: 'Hawaii State Building Code based on IBC with strong wind and seismic provisions; post-Iniki coastal requirements are stringent; Maui County enacted enhanced WUI codes post-Lahaina',
      residualMarketPrograms: [
        FAIR_PLAN('Hawaii', 'Fire and extended perils; post-Lahaina demand significantly increased.'),
      ],
      requiredDisclosures: ['Seller Disclosure Statement required', 'Lava Zone disclosure for Big Island properties required by county ordinance', 'Flood zone disclosure required', 'Hurricane risk area disclosure recommended'],
      mandatedCoverages: ['Hurricane deductible: carriers may apply a separate 2–5% hurricane deductible for wind coverage in designated hurricane areas'],
      complianceNotes: [
        'Lava Zones 1 and 2 on Big Island are considered uninsurable by most standard carriers; specialty surplus lines required',
        'Earthquake coverage excluded from standard HO; separate policy or endorsement strongly recommended statewide',
        'Post-Lahaina: defensible space and ember-resistant construction increasingly required by Maui County for rebuilds',
        'Hawaii has unique "coconut palm" exclusions — check policy for specific vegetation/natural feature exclusions',
        'NFIP flood insurance required in SFHA; many coastal and low-lying areas mapped as high-risk',
      ],
    },
    knownCatastrophicExposures: ['Wildfire', 'Earthquake', 'Hurricane', 'Lava Flow', 'Tsunami'],
    notes: ['Lahaina fire (2023) exposed insurance gaps for many property owners who lacked replacement cost coverage', 'Lava Zone 1 & 2 properties on Hawaii Island are functionally uninsurable in the standard market'],
  },

  ID: {
    name: 'Idaho',
    perils: {
      fire: { floor: 20, multiplier: 1.05, reason: 'Significant wildfire history in forested areas; southern Rockies WUI communities; 2013 Beaver Creek Fire near Sun Valley' },
      earthquake: { floor: 15, multiplier: 1.05, reason: 'Intermountain Seismic Belt; 2020 M6.5 Stanley earthquake; proximity to Yellowstone volcanic system' },
    },
    market: { condition: 'STABLE', carriersExiting: false, residualMarketGrowth: false, notes: ['Stable market; some WUI areas seeing rate increases'] },
    regulatory: {
      rateRegulation: 'FILE_AND_USE',
      rateRegulationNotes: 'File-and-use; DOI review within 30 days',
      buildingCodeStrength: 'MODERATE',
      buildingCodeNotes: 'Idaho has no mandatory statewide building code; Boise and major cities adopt IBC/IRC; rural counties often have no code',
      residualMarketPrograms: [FAIR_PLAN('Idaho')],
      requiredDisclosures: ['Seller Property Condition Disclosure required'],
      mandatedCoverages: [],
      complianceNotes: ['No statewide building code; rural WUI properties may not meet any fire-resistant construction standard', 'Earthquake coverage not included in standard policies; Intermountain Seismic Belt risk warrants consideration'],
    },
    knownCatastrophicExposures: ['Wildfire', 'Earthquake'],
    notes: [],
  },

  IL: {
    name: 'Illinois',
    perils: {
      wind: { floor: 20, multiplier: 1.0, reason: 'Tornado exposure in central and southern IL; Midwest severe weather corridor; Springfield and central IL tornado history' },
      earthquake: { floor: 20, multiplier: 1.05, reason: 'Southern Illinois sits on New Madrid Seismic Zone periphery; 1968 M5.5 Illinois earthquake; potential for NMSZ amplification' },
    },
    market: { condition: 'STABLE', carriersExiting: false, residualMarketGrowth: false, notes: ['Generally stable; Chicago metro has competitive market', 'Southern IL earthquake risk largely unpriced by market'] },
    regulatory: {
      rateRegulation: 'PRIOR_APPROVAL',
      rateRegulationNotes: 'Prior approval required for rate increases; Illinois DOI closely monitors market',
      buildingCodeStrength: 'MODERATE',
      buildingCodeNotes: 'Illinois adopts IBC/IRC; Chicago has its own municipal building code; downstate enforcement varies',
      residualMarketPrograms: [FAIR_PLAN('Illinois')],
      requiredDisclosures: ['Residential Real Property Disclosure Act requires seller disclosure of known defects', 'Flood zone disclosure when in SFHA'],
      mandatedCoverages: [],
      complianceNotes: ['NMSZ earthquake risk in southern IL is generally not covered by standard policies; separate coverage available but rarely purchased', 'Chicago is subject to Lake Michigan storm surge during extreme weather events'],
    },
    knownCatastrophicExposures: ['Tornado', 'Earthquake (New Madrid)', 'Severe Winter Storm'],
    notes: ['New Madrid Seismic Zone poses low-frequency, high-consequence earthquake risk to southern IL'],
  },

  IN: {
    name: 'Indiana',
    perils: {
      wind: { floor: 20, multiplier: 1.0, reason: 'Tornado risk across central and southern Indiana; "Hoosier Alley" tornado exposure; 1974 Super Outbreak impacted IN' },
    },
    market: { condition: 'STABLE', carriersExiting: false, residualMarketGrowth: false, notes: ['Stable, competitive market statewide'] },
    regulatory: {
      rateRegulation: 'FILE_AND_USE',
      rateRegulationNotes: 'File-and-use; IDOI review within 60 days',
      buildingCodeStrength: 'MODERATE',
      buildingCodeNotes: 'Indiana Residential Code based on IRC; statewide adoption but local enforcement quality varies',
      residualMarketPrograms: [FAIR_PLAN('Indiana')],
      requiredDisclosures: ['Sales Disclosure Form required for all residential sales'],
      mandatedCoverages: [],
      complianceNotes: ['Tornado risk real but market pricing generally adequate; standard HO policies cover wind/tornado', 'NFIP flood insurance required in SFHA along Ohio, Wabash, and Kankakee River corridors'],
    },
    knownCatastrophicExposures: ['Tornado', 'Flood'],
    notes: [],
  },

  IA: {
    name: 'Iowa',
    perils: {
      wind: { floor: 30, multiplier: 1.05, reason: 'Tornado corridor; 2020 Derecho caused $11B in damage across IA/IL — most costly thunderstorm event in US history at the time' },
      flood: { floor: 15, multiplier: 1.05, reason: 'Cedar River, Des Moines River, and Missouri River flooding; 2008 Iowa floods exceeded 500-year event levels in Cedar Rapids' },
    },
    market: { condition: 'STRESSED', carriersExiting: false, residualMarketGrowth: false, notes: ['Post-Derecho rate increases; some carriers restricting wind coverage limits', 'Hail damage from severe summer storms is leading cause of claims'] },
    regulatory: {
      rateRegulation: 'FILE_AND_USE',
      rateRegulationNotes: 'File-and-use system with 30-day review period',
      buildingCodeStrength: 'MODERATE',
      buildingCodeNotes: 'Iowa State Building Code based on IBC/IRC; local amendments common; some rural areas lack enforcement',
      residualMarketPrograms: [FAIR_PLAN('Iowa')],
      requiredDisclosures: ['Seller Disclosure Statement required', 'Flood zone disclosure required'],
      mandatedCoverages: [],
      complianceNotes: ['Derecho wind damage (straight-line winds 70–100+ mph) covered under standard wind/hail provisions', 'Riverine flood risk along Cedar, Des Moines, and Missouri Rivers warrants NFIP coverage'],
    },
    knownCatastrophicExposures: ['Tornado', 'Derecho', 'Flood', 'Hail'],
    notes: ['2020 August Derecho was one of most damaging single wind events in US history; Iowa bore the brunt'],
  },

  KS: {
    name: 'Kansas',
    perils: {
      wind: { floor: 50, multiplier: 1.15, reason: 'Geographic center of Tornado Alley; Greensburg F5 (2007), Andover (1991, 2022); some of the highest tornado frequency per square mile nationally' },
    },
    market: {
      condition: 'STRESSED',
      carriersExiting: false,
      residualMarketGrowth: true,
      notes: ['Tornado and hail losses consistently elevate loss ratios', 'Some carriers limiting wind coverage in high-risk counties', 'Hail damage is second-leading cause of claims after tornado'],
    },
    regulatory: {
      rateRegulation: 'USE_AND_FILE',
      rateRegulationNotes: 'Use-and-file: insurers may use rates immediately and file with DOI within 30 days; KID may require refunds if rates found excessive',
      buildingCodeStrength: 'WEAK',
      buildingCodeNotes: 'Kansas has NO mandatory statewide building code; municipalities adopt codes independently; many rural areas have no code whatsoever, leaving properties with no storm-resistant construction baseline',
      residualMarketPrograms: [FAIR_PLAN('Kansas')],
      requiredDisclosures: ['Seller Disclosure statement required', 'Flood zone disclosure required'],
      mandatedCoverages: [],
      complianceNotes: [
        'No statewide building code means tornado-resistant construction (safe rooms, reinforced framing) is voluntary',
        'FEMA recommends all KS homeowners consider a safe room or storm shelter; some counties offer subsidies',
        'Standard HO policies include wind/tornado coverage; sub-limits or separate wind deductibles may apply',
        'Properties near Arkansas River, Kansas River, and Missouri River corridors face significant flood exposure',
      ],
    },
    knownCatastrophicExposures: ['Tornado', 'Hail', 'Flood'],
    notes: ['Wichita-Andover corridor has experienced multiple F4/F5 tornado landfalls', 'No statewide building code significantly limits tornado mitigation compliance'],
  },

  KY: {
    name: 'Kentucky',
    perils: {
      earthquake: { floor: 20, multiplier: 1.05, reason: 'Western Kentucky sits on New Madrid Seismic Zone; historical M7.5–7.9 events in 1811–12; Paducah and Owensboro are highest-risk cities' },
      flood: { floor: 15, multiplier: 1.05, reason: '2022 Eastern Kentucky floods killed 39 people; Appalachian topography creates flash flood amplification; Ohio River corridor flooding' },
    },
    market: { condition: 'STABLE', carriersExiting: false, residualMarketGrowth: false, notes: ['Stable market; eastern KY flood losses elevating awareness'] },
    regulatory: {
      rateRegulation: 'FILE_AND_USE',
      rateRegulationNotes: 'File-and-use with DOI review',
      buildingCodeStrength: 'MODERATE',
      buildingCodeNotes: 'Kentucky Building Code based on IBC/IRC; statewide adoption; rural Appalachian areas have weaker enforcement',
      residualMarketPrograms: [FAIR_PLAN('Kentucky')],
      requiredDisclosures: ['Seller Disclosure of Property Conditions required'],
      mandatedCoverages: [],
      complianceNotes: ['Earthquake coverage not standard; NMSZ risk for western KY warrants standalone earthquake policy', 'Flash flood risk in eastern KY mountain hollows is underinsured; NFIP maps may be outdated for mountain terrain'],
    },
    knownCatastrophicExposures: ['Earthquake (New Madrid)', 'Flash Flood', 'Tornado'],
    notes: ['2022 Eastern KY floods exposed severe underinsurance in rural Appalachian communities'],
  },

  LA: {
    name: 'Louisiana',
    perils: {
      flood: { floor: 45, multiplier: 1.2, reason: 'Highest NFIP claims per capita nationally; Katrina ($16.5B NFIP), Isaac, Ida; below-sea-level elevations in New Orleans metro; extensive coastal wetland loss increasing surge exposure' },
      wind: { floor: 55, multiplier: 1.2, reason: 'Katrina (Cat 5), Rita (Cat 5), Ike, Gustav, Ida (Cat 4), Laura (Cat 4) — multiple catastrophic hurricane landfalls in 20 years; Louisiana has highest storm surge loss exposure of any state' },
    },
    market: {
      condition: 'CRISIS',
      carriersExiting: true,
      residualMarketGrowth: true,
      notes: [
        '12+ insurers went insolvent or withdrew from Louisiana after Hurricane Ida (2021)',
        'Louisiana Citizens Property Insurance Corporation growing rapidly as private market contracts',
        'Reinsurance costs tripled post-Ida, making smaller regional carriers unviable',
        'Louisiana Insurance Guaranty Association (LIGA) stretched by multiple carrier insolvencies',
        'State legislature enacted SB 1 (2022) market reforms but stabilization is slow',
      ],
    },
    regulatory: {
      rateRegulation: 'FILE_AND_USE',
      rateRegulationNotes: 'File-and-use; Louisiana DOI has emergency rate authority post-catastrophe; recent reforms allow faster approvals to attract carriers back to state',
      buildingCodeStrength: 'MODERATE',
      buildingCodeNotes: 'Louisiana State Uniform Construction Code (LSUCC) based on IBC/IRC; coastal parishes have wind-resistant construction requirements; enforcement is parish-dependent and historically inconsistent',
      residualMarketPrograms: [
        { name: 'Louisiana Citizens Property Insurance Corporation', type: 'STATE_INSURER', coverageTypes: ['Wind', 'All-Perils'], notes: 'Insurer of last resort for coastal and high-risk properties; growing rapidly post-Ida insolvencies; surcharges applied to all LA policyholders to fund Citizens losses' },
        { name: 'Louisiana Insurance Guaranty Association (LIGA)', type: 'FAIR_PLAN', coverageTypes: ['Claims from insolvent insurers'], notes: 'Pays claims of insolvent carriers up to statutory limits; has been heavily utilized post-Ida' },
      ],
      requiredDisclosures: ['Louisiana Property Disclosure Document required for residential sales', 'Flood zone disclosure mandatory; must include NFIP map information', 'Hurricane surge zone disclosure for coastal properties'],
      mandatedCoverages: ['Hurricane deductible: separate deductible (typically 2–5% of Coverage A) required for named storm events in coastal parishes', 'NFIP flood insurance mandatory for federally-backed mortgages in SFHA zones'],
      complianceNotes: [
        'Flood insurance (NFIP or private) is separate from and NOT included in any homeowners policy in Louisiana',
        'Hurricane deductible triggers when NWS names a storm; separate from windstorm deductible for non-named events',
        'Properties in Plaquemines, St. Bernard, Jefferson, and Orleans parishes face highest compound flood + wind exposure',
        'Post-Ida reform: Louisiana now allows "file and use" rate increases up to 10% without DOI approval to attract carriers',
        'Citizens policyholders face potential surcharges on ALL LA policies if Citizens runs a deficit',
        'Elevation certificates are critical for accurate NFIP rating; many properties can achieve significant premium reductions with certificate showing above-BFE elevation',
      ],
    },
    knownCatastrophicExposures: ['Hurricane', 'Storm Surge', 'Flood', 'Subsidence'],
    notes: [
      'New Orleans metro is 6–8 feet below sea level in areas; relies on $14B federal levee system (post-Katrina)',
      'Coastal wetland loss is removing natural hurricane buffers at ~25 square miles per year',
      'Louisiana has the highest homeowners insurance premiums per $1,000 of insured value in the US as of 2024',
    ],
  },

  ME: {
    name: 'Maine',
    perils: {
      wind: { floor: 15, multiplier: 1.0, reason: 'Nor\'easter and coastal storm exposure; 1998 ice storm was one of most damaging in US history; limited hurricane direct-hit history' },
    },
    market: { condition: 'STABLE', carriersExiting: false, residualMarketGrowth: false, notes: ['Stable market; coastal waterfront properties see higher premiums'] },
    regulatory: {
      rateRegulation: 'PRIOR_APPROVAL',
      rateRegulationNotes: 'Prior approval required for personal lines rate changes',
      buildingCodeStrength: 'MODERATE',
      buildingCodeNotes: 'Maine Uniform Building and Energy Code (MUBEC) based on IBC/IRC; statewide adoption; coastal construction standards apply',
      residualMarketPrograms: [FAIR_PLAN('Maine')],
      requiredDisclosures: ['Seller Disclosure of Property Condition required'],
      mandatedCoverages: [],
      complianceNotes: ['Coastal properties should carry flood coverage; Maine coast has significant storm surge exposure during nor\'easters', 'Ice dam damage (common in ME winters) may be excluded or sublimited in some policies'],
    },
    knownCatastrophicExposures: ['Nor\'easter', 'Ice Storm', 'Coastal Flood'],
    notes: [],
  },

  MD: {
    name: 'Maryland',
    perils: {
      flood: { floor: 20, multiplier: 1.05, reason: 'Chesapeake Bay and Atlantic coastal exposure; Hurricane Sandy impacts; Ellicott City repeated catastrophic flash floods (2016, 2018)' },
      wind: { floor: 15, multiplier: 1.0, reason: 'Hurricane track exposure along Eastern Shore; tropical storm remnants cause significant inland flooding' },
    },
    market: { condition: 'STABLE', carriersExiting: false, residualMarketGrowth: false, notes: ['Generally stable; Eastern Shore coastal properties face higher rates', 'Post-Sandy flood insurance uptake increased significantly'] },
    regulatory: {
      rateRegulation: 'FILE_AND_USE',
      rateRegulationNotes: 'File-and-use system; MIA review within 30 days',
      buildingCodeStrength: 'STRONG',
      buildingCodeNotes: 'Maryland Building Performance Standards based on IBC/IRC; strong statewide enforcement; coastal construction requirements for Bay and Atlantic-facing areas',
      residualMarketPrograms: [
        FAIR_PLAN('Maryland'),
        { name: 'Maryland Property Insurance Program (MPIP)', type: 'FAIR_PLAN', coverageTypes: ['Fire', 'Extended Perils'], notes: 'Available for property owners unable to obtain coverage in standard market' },
      ],
      requiredDisclosures: ['Residential Property Disclosure/Disclaimer required', 'Flood zone disclosure required for properties in or near SFHA'],
      mandatedCoverages: [],
      complianceNotes: ['Chesapeake Bay Critical Area (1000-ft buffer) has strict construction and impervious surface rules', 'Ellicott City flash flood history suggests additional flood coverage beyond NFIP limits should be considered for downtown properties'],
    },
    knownCatastrophicExposures: ['Hurricane', 'Flood', 'Coastal Storm'],
    notes: ['Chesapeake Bay shoreline erosion is a growing long-term risk to waterfront properties'],
  },

  MA: {
    name: 'Massachusetts',
    perils: {
      wind: { floor: 20, multiplier: 1.05, reason: 'Nor\'easter and hurricane exposure; Cape Cod and South Shore have significant coastal wind risk; 2011 Springfield tornado (EF3)' },
      flood: { floor: 15, multiplier: 1.05, reason: 'Coastal flooding from nor\'easters and storm surge; inland flooding from rain-saturated soils; Sandy impacts on South Shore' },
    },
    market: {
      condition: 'STRESSED',
      carriersExiting: false,
      residualMarketGrowth: true,
      notes: ['Coastal properties facing non-renewals and rate increases', 'MPIUA (beach plan) growing as standard carriers reduce coastal exposure', 'Climate-driven coastal erosion accelerating insurance risk'],
    },
    regulatory: {
      rateRegulation: 'PRIOR_APPROVAL',
      rateRegulationNotes: 'Prior approval required for personal lines; Massachusetts Division of Insurance closely monitors coastal rate filings',
      buildingCodeStrength: 'STRONG',
      buildingCodeNotes: 'Massachusetts State Building Code (780 CMR) based on IBC/IRC with amendments; among strongest codes in New England; coastal construction standards applied in Coastal A and V flood zones',
      residualMarketPrograms: [
        { name: 'Massachusetts Property Insurance Underwriting Association (MPIUA / FAIR Plan)', type: 'FAIR_PLAN', coverageTypes: ['Fire', 'Extended Perils', 'Liability'], notes: 'Last-resort coverage; covers coastal areas where private market retreating; premiums are typically significantly higher than voluntary market' },
        { name: 'MPIUA Coastal Wind Program', type: 'WIND_POOL', coverageTypes: ['Wind', 'Hail'], notes: 'Wind coverage component of MPIUA for coastal properties' },
      ],
      requiredDisclosures: ['Seller Disclosure (Offer to Purchase includes lead paint, smoke detector, oil tank disclosures)', 'Flood zone disclosure required for SFHA properties', 'Coastal erosion disclosure for beachfront properties'],
      mandatedCoverages: ['Hurricane/named-storm deductible applies to coastal policies'],
      complianceNotes: [
        'Cape Cod, South Shore, and North Shore coastal properties may only be insurable through MPIUA',
        'Massachusetts Coastal Zone Management (CZM) restricts construction within 100 feet of coastal wetlands',
        'Elevation certificate required for accurate NFIP rating of coastal properties',
        'Basement flooding from groundwater infiltration is typically excluded; sump pump failure endorsement available',
      ],
    },
    knownCatastrophicExposures: ['Nor\'easter', 'Hurricane', 'Coastal Flood', 'Winter Storm'],
    notes: ['Cape Cod and Islands (Martha\'s Vineyard, Nantucket) face severe long-term coastal erosion risk'],
  },

  MI: {
    name: 'Michigan',
    perils: {},
    market: { condition: 'STABLE', carriersExiting: false, residualMarketGrowth: false, notes: ['Stable market; some UP (Upper Peninsula) areas have limited carrier options', 'Lake-effect snow and ice damming are common winter claim drivers'] },
    regulatory: {
      rateRegulation: 'PRIOR_APPROVAL',
      rateRegulationNotes: 'Prior approval required for personal lines rate changes in Michigan',
      buildingCodeStrength: 'MODERATE',
      buildingCodeNotes: 'Michigan Building Code based on IBC/IRC; statewide adoption with local enforcement',
      residualMarketPrograms: [FAIR_PLAN('Michigan')],
      requiredDisclosures: ['Seller Disclosure Statement required for residential sales'],
      mandatedCoverages: [],
      complianceNotes: ['Ice dam damage (caused by freeze-thaw cycles) is commonly disputed in claims; ensure policy covers resulting water damage', 'Lake-level flooding risk for lakefront properties along Great Lakes shorelines'],
    },
    knownCatastrophicExposures: ['Winter Storm', 'Ice Dam', 'Flood (Great Lakes shoreline)'],
    notes: [],
  },

  MN: {
    name: 'Minnesota',
    perils: {
      wind: { floor: 20, multiplier: 1.0, reason: 'Tornado risk in southern MN; 2011 Minneapolis tornado (EF1 in urban core); hail corridor in Twin Cities metro area' },
    },
    market: { condition: 'STABLE', carriersExiting: false, residualMarketGrowth: false, notes: ['Stable market; hail damage is leading cause of claims in metro areas'] },
    regulatory: {
      rateRegulation: 'FILE_AND_USE',
      rateRegulationNotes: 'File-and-use; MN DOC review within 30 days',
      buildingCodeStrength: 'MODERATE',
      buildingCodeNotes: 'Minnesota State Building Code based on IBC/IRC; comprehensive statewide adoption',
      residualMarketPrograms: [FAIR_PLAN('Minnesota')],
      requiredDisclosures: ['Seller Disclosure statement required', 'Disclosure of material facts required by MN law'],
      mandatedCoverages: [],
      complianceNotes: ['Ice dam damage common in severe winters; ensure policy includes ice dam coverage or water backup endorsement', 'Red River Valley properties in NW Minnesota face periodic major flooding'],
    },
    knownCatastrophicExposures: ['Tornado', 'Hail', 'Blizzard', 'Flood (Red River)'],
    notes: [],
  },

  MS: {
    name: 'Mississippi',
    perils: {
      wind: { floor: 50, multiplier: 1.15, reason: 'Katrina (Cat 5) directly struck MS Gulf Coast in 2005 with 28-ft storm surge; highest storm surge losses ever recorded in US; Camille 1969; continued direct-hit hurricane risk' },
      flood: { floor: 35, multiplier: 1.1, reason: 'Katrina storm surge extended 12+ miles inland; Mississippi River and Pearl River chronic flooding; high NFIP claims volume' },
    },
    market: {
      condition: 'HARD',
      carriersExiting: false,
      residualMarketGrowth: true,
      notes: ['Hard market along Gulf Coast; MWUA (wind pool) is primary wind insurer for many coastal properties', 'Limited private market options in Hancock, Harrison, and Jackson counties', 'Post-Katrina insolvencies and litigation created long-lasting market disruption'],
    },
    regulatory: {
      rateRegulation: 'FILE_AND_USE',
      rateRegulationNotes: 'File-and-use; Mississippi Insurance Department review within 30 days; may hold hearings on large increases',
      buildingCodeStrength: 'WEAK',
      buildingCodeNotes: 'Mississippi has no mandatory statewide building code; coastal counties adopted enhanced wind-resistant codes post-Katrina but enforcement is inconsistent; vast majority of rural MS has no code',
      residualMarketPrograms: [
        { name: 'Mississippi Windstorm Underwriting Association (MWUA)', type: 'WIND_POOL', coverageTypes: ['Wind', 'Hail'], notes: 'Provides wind/hail coverage for properties in 6 coastal counties (Hancock, Harrison, Jackson, George, Stone, Pearl River) that cannot obtain coverage in voluntary market. Often the only available wind insurer in coastal MS.' },
        FAIR_PLAN('Mississippi'),
      ],
      requiredDisclosures: ['Seller Disclosure of Condition of Property required', 'Flood zone and storm surge disclosure for coastal properties'],
      mandatedCoverages: ['Hurricane deductible: 5% of Coverage A for named storms in coastal counties; separate from all-other-perils deductible'],
      complianceNotes: [
        'Wind coverage in Hancock, Harrison, and Jackson counties typically requires MWUA; private market wind largely unavailable',
        'Wind and flood are separate coverages in coastal MS; most standard HO policies exclude flood AND often wind in coastal areas',
        'No statewide building code means many older homes lack basic wind-resistance features (hip roofs, hurricane straps, impact windows)',
        'Storm surge from a Gulf hurricane can extend 10–30 miles inland along MS Gulf Coast; elevation and flood coverage critical',
        'Post-Katrina "wind vs. water" litigation established important precedents; insurers now use clearer policy language',
      ],
    },
    knownCatastrophicExposures: ['Hurricane', 'Storm Surge', 'Flood', 'Tornado'],
    notes: ['Hurricane Katrina\'s storm surge was the largest insured catastrophe loss in US history at the time', 'No statewide building code is a major unaddressed vulnerability for the state\'s housing stock'],
  },

  MO: {
    name: 'Missouri',
    perils: {
      wind: { floor: 30, multiplier: 1.05, reason: 'Joplin EF5 tornado (2011, 161 deaths — deadliest single tornado since 1950); St. Louis area tornado history; Dixie Alley convergence in southern MO' },
      earthquake: { floor: 30, multiplier: 1.1, reason: 'New Madrid Seismic Zone underlies SE Missouri (Bootheel); 1811–12 M7.5–7.9 NMSZ events caused Mississippi River to flow backward; significant liquefaction risk in alluvial lowlands' },
    },
    market: { condition: 'STABLE', carriersExiting: false, residualMarketGrowth: false, notes: ['Stable statewide; Joplin corridor and NMSZ areas see elevated rates', 'Earthquake coverage rarely purchased despite significant risk'] },
    regulatory: {
      rateRegulation: 'FILE_AND_USE',
      rateRegulationNotes: 'File-and-use; Missouri DOI review within 30 days',
      buildingCodeStrength: 'WEAK',
      buildingCodeNotes: 'Missouri has NO statewide mandatory building code; some cities/counties adopt IBC/IRC voluntarily; large rural areas have no code; NMSZ risk is largely unmitigated in housing stock',
      residualMarketPrograms: [FAIR_PLAN('Missouri')],
      requiredDisclosures: ['Seller Disclosure of Property Condition required'],
      mandatedCoverages: [],
      complianceNotes: [
        'No statewide building code means NMSZ earthquake mitigation (anchor bolts, cripple wall bracing) is voluntary',
        'Earthquake insurance is NOT included in standard MO homeowners policies; separate policy required for NMSZ risk',
        'Missouri Bootheel (SE corner) is highest earthquake hazard area; alluvial soils cause extreme liquefaction amplification',
        'Mississippi and Missouri River floodplains have extensive SFHA mapping; NFIP coverage required for federally-backed loans',
      ],
    },
    knownCatastrophicExposures: ['Tornado', 'Earthquake (New Madrid)', 'River Flood'],
    notes: ['Joplin EF5 (2011) caused $2.8B in insured losses and was single deadliest tornado in US since modern records', 'New Madrid scenario (repeat of 1811–12) could cause $300B+ in losses across 8-state region'],
  },

  MT: {
    name: 'Montana',
    perils: {
      fire: { floor: 20, multiplier: 1.05, reason: 'Extensive forested WUI; 2017 fire season burned record 1.3M acres; increasing frequency driven by beetle kill and drought' },
      earthquake: { floor: 20, multiplier: 1.05, reason: 'Intermountain Seismic Belt; 1959 M7.3 Hebgen Lake earthquake; Yellowstone proximity' },
    },
    market: {
      condition: 'STRESSED',
      carriersExiting: false,
      residualMarketGrowth: true,
      notes: ['WUI areas in Bitterroot, Flathead, and Gallatin valleys seeing rate increases and non-renewals', 'Some carriers restricting new business near Glacier National Park and other fire-prone areas'],
    },
    regulatory: {
      rateRegulation: 'FILE_AND_USE',
      rateRegulationNotes: 'File-and-use; MCSIRD review',
      buildingCodeStrength: 'WEAK',
      buildingCodeNotes: 'Montana has no mandatory statewide building code; some cities adopt codes; rural areas largely unregulated',
      residualMarketPrograms: [FAIR_PLAN('Montana')],
      requiredDisclosures: ['Seller Disclosure required for residential sales'],
      mandatedCoverages: [],
      complianceNotes: ['No statewide building code means WUI fire-resistant construction is voluntary', 'Defensible space maintenance may be required by some insurance companies as policy condition in WUI areas'],
    },
    knownCatastrophicExposures: ['Wildfire', 'Earthquake', 'Winter Storm'],
    notes: [],
  },

  NE: {
    name: 'Nebraska',
    perils: {
      wind: { floor: 35, multiplier: 1.1, reason: 'Core of hail and tornado corridor; 2019 bomb cyclone caused $1.3B in insured losses; Omaha metro has high tornado/hail frequency' },
      flood: { floor: 15, multiplier: 1.05, reason: '2019 Missouri River and Platte River flooding caused $1.3B in damage; recurrent flood risk along major river corridors' },
    },
    market: { condition: 'STRESSED', carriersExiting: false, residualMarketGrowth: false, notes: ['Tornado and hail losses driving rate increases; some rate shock in metro areas'] },
    regulatory: {
      rateRegulation: 'FILE_AND_USE',
      rateRegulationNotes: 'File-and-use; Nebraska DOI review',
      buildingCodeStrength: 'MODERATE',
      buildingCodeNotes: 'Nebraska adopts IBC/IRC; some rural areas lack enforcement',
      residualMarketPrograms: [FAIR_PLAN('Nebraska')],
      requiredDisclosures: ['Seller Property Condition Disclosure Statement required'],
      mandatedCoverages: [],
      complianceNotes: ['Hail-resistant roofing (Class 3 or 4) qualifies for discounts from many carriers; worth considering for new construction', 'Missouri River SFHA properties require NFIP flood insurance'],
    },
    knownCatastrophicExposures: ['Tornado', 'Hail', 'Flood'],
    notes: [],
  },

  NV: {
    name: 'Nevada',
    perils: {
      earthquake: { floor: 25, multiplier: 1.05, reason: 'Walker Lane seismic belt; 2020 M6.5 Monte Cristo Range earthquake; Reno-Carson City corridor seismic exposure' },
    },
    market: { condition: 'STABLE', carriersExiting: false, residualMarketGrowth: false, notes: ['Competitive Las Vegas metro market; some rural areas have limited options'] },
    regulatory: {
      rateRegulation: 'FILE_AND_USE',
      rateRegulationNotes: 'File-and-use with prior approval for increases over threshold',
      buildingCodeStrength: 'MODERATE',
      buildingCodeNotes: 'Nevada adopts IBC/IRC; Clark County (Las Vegas) has strong enforcement; rural Nevada enforcement variable',
      residualMarketPrograms: [FAIR_PLAN('Nevada')],
      requiredDisclosures: ['Seller Real Property Disclosure Form required'],
      mandatedCoverages: [],
      complianceNotes: ['Earthquake coverage not standard; Walker Lane seismic risk warrants consideration for Reno area', 'Flash flood risk in Las Vegas valley from desert monsoon; standard policies may exclude flood'],
    },
    knownCatastrophicExposures: ['Earthquake', 'Flash Flood', 'Wildfire (rural)'],
    notes: [],
  },

  NH: {
    name: 'New Hampshire',
    perils: {},
    market: { condition: 'STABLE', carriersExiting: false, residualMarketGrowth: false, notes: ['Stable market; coastal Seacoast properties face higher premiums'] },
    regulatory: {
      rateRegulation: 'PRIOR_APPROVAL',
      rateRegulationNotes: 'Prior approval required for personal lines in New Hampshire',
      buildingCodeStrength: 'MODERATE',
      buildingCodeNotes: 'NH State Building Code based on IBC/IRC',
      residualMarketPrograms: [FAIR_PLAN('New Hampshire')],
      requiredDisclosures: ['Seller Disclosure of Property Condition required'],
      mandatedCoverages: [],
      complianceNotes: ['Small coastline (18 miles) but significant storm surge risk in Seacoast area during major nor\'easters'],
    },
    knownCatastrophicExposures: ['Nor\'easter', 'Winter Storm', 'Flood'],
    notes: [],
  },

  NJ: {
    name: 'New Jersey',
    perils: {
      flood: { floor: 25, multiplier: 1.1, reason: 'Hurricane Sandy (2012) caused $6.2B in NJ insured losses; extensive NFIP exposure along Jersey Shore; Raritan, Passaic, and Hackensack River corridors flood regularly' },
      wind: { floor: 20, multiplier: 1.0, reason: 'Nor\'easter and hurricane exposure along 130-mile coastline; Sandy-level storm surge risk in coastal communities' },
    },
    market: {
      condition: 'STRESSED',
      carriersExiting: false,
      residualMarketGrowth: true,
      notes: ['Post-Sandy market stress remains elevated in shore communities', 'NJ FAIR Plan demand growing for coastal Ocean and Monmouth county properties', 'Flood insurance penetration remains low despite major Sandy losses'],
    },
    regulatory: {
      rateRegulation: 'PRIOR_APPROVAL',
      rateRegulationNotes: 'Prior approval required; New Jersey DOB closely monitors coastal rate filings and has historically limited increases',
      buildingCodeStrength: 'STRONG',
      buildingCodeNotes: 'New Jersey Uniform Construction Code (UCC) based on IBC/IRC; strong statewide enforcement; post-Sandy coastal construction requirements enacted for V and Coastal A flood zones',
      residualMarketPrograms: [
        { name: 'New Jersey FAIR Plan (JUA)', type: 'FAIR_PLAN', coverageTypes: ['Fire', 'Extended Perils', 'Liability'], notes: 'Joint Underwriting Association; last-resort coverage; most commonly used in coastal shore towns and high-crime urban areas' },
      ],
      requiredDisclosures: ['Seller Disclosure of Property Condition required', 'Flood zone disclosure mandatory', 'Sandy damage disclosure: NJ requires disclosure of prior flood/storm damage', 'Coastal erosion/CAMA disclosure for beachfront properties'],
      mandatedCoverages: ['Elevation certificates required for new construction and substantial improvements in SFHA zones'],
      complianceNotes: [
        'Post-Sandy FEMA remapping dramatically increased SFHA acreage in NJ; many properties now in flood zones that were not pre-2012',
        'Coastal construction in V and Coastal A zones must meet freeboard requirements (1–2 ft above BFE)',
        'NJ Coastal Area Facility Review Act (CAFRA) regulates construction within 1000 feet of tidal water',
        'Flood insurance is NOT part of homeowners policy; NFIP or private flood required separately',
        'Sandy damage history: buyers should verify prior claims history through CLUE report; repeated flood claims may affect insurability',
      ],
    },
    knownCatastrophicExposures: ['Hurricane', 'Flood', 'Nor\'easter', 'Storm Surge'],
    notes: ['Jersey Shore communities face combined Atlantic coastal and bay-side surge exposure (front-and-back flooding from Sandy)'],
  },

  NM: {
    name: 'New Mexico',
    perils: {
      fire: { floor: 20, multiplier: 1.05, reason: 'Hermits Peak/Calf Canyon Fire (2022) was largest in NM history at 341k acres; caused by USFS prescribed burn escape — federal liability; ponderosa pine WUI in northern NM mountains' },
    },
    market: { condition: 'STABLE', carriersExiting: false, residualMarketGrowth: false, notes: ['Generally stable; northern mountain communities seeing WUI fire rate pressure'] },
    regulatory: {
      rateRegulation: 'FILE_AND_USE',
      rateRegulationNotes: 'File-and-use; New Mexico OSI review',
      buildingCodeStrength: 'MODERATE',
      buildingCodeNotes: 'New Mexico adopts IBC/IRC; Albuquerque and Santa Fe have strong enforcement; rural areas variable',
      residualMarketPrograms: [FAIR_PLAN('New Mexico')],
      requiredDisclosures: ['Seller Property Disclosure Statement required'],
      mandatedCoverages: [],
      complianceNotes: ['Flash flood risk from monsoon season (July–September) often underinsured; separate flood policy recommended for arroyo-adjacent properties', 'Hermits Peak/Calf Canyon federal fund ($5B) covers losses from that specific 2022 fire only'],
    },
    knownCatastrophicExposures: ['Wildfire', 'Flash Flood'],
    notes: [],
  },

  NY: {
    name: 'New York',
    perils: {
      flood: { floor: 20, multiplier: 1.05, reason: 'Sandy caused $4.9B in NY insured losses; extensive NFIP exposure on Long Island and NYC coastline; Hudson River and inland river flooding; subway/infrastructure flood losses' },
      wind: { floor: 15, multiplier: 1.0, reason: 'Coastal hurricane and nor\'easter exposure; Long Island vulnerable to direct hurricane hits' },
    },
    market: {
      condition: 'STRESSED',
      carriersExiting: false,
      residualMarketGrowth: true,
      notes: ['Post-Sandy coastal property rates significantly elevated', 'NY FAIR Plan growing in Long Island coastal areas', 'State Farm announced intent to reduce NY coastal exposure (2023)'],
    },
    regulatory: {
      rateRegulation: 'PRIOR_APPROVAL',
      rateRegulationNotes: 'Prior approval required; New York DFS is among the most active state insurance regulators nationally; has limited coastal rate increases historically',
      buildingCodeStrength: 'STRONG',
      buildingCodeNotes: 'New York State Building Code based on IBC/IRC; NYC has its own highly detailed Building Code; coastal flood construction requirements are strict in V and Coastal A zones',
      residualMarketPrograms: [
        { name: 'New York FAIR Plan', type: 'FAIR_PLAN', coverageTypes: ['Fire', 'Extended Perils'], notes: 'Last-resort coverage; increasingly used in coastal Long Island and NYC-area properties as voluntary market retreats' },
        { name: 'New York Property Insurance Underwriting Association (NYPIUA)', type: 'FAIR_PLAN', coverageTypes: ['Fire', 'Extended Perils', 'Liability'], notes: 'Administers the NY FAIR Plan' },
      ],
      requiredDisclosures: ['Property Condition Disclosure Act (PCDA): seller must disclose known material defects or pay buyer $500 credit', 'Flood zone disclosure required', 'Sandy damage history: buyers should request prior claim history'],
      mandatedCoverages: ['Insurers must offer replacement cost coverage; ACV-only settlement requires specific election by policyholder'],
      complianceNotes: [
        'NYC Local Law 97 (2019) mandates carbon emission reductions for large buildings; affects insurance for high-value commercial/condo properties',
        'Post-Sandy FEMA remapping created significant premium increases for newly mapped coastal properties; some reversed via litigation',
        'Flood insurance is required for federally-backed mortgages in SFHA; NOT included in standard HO policy',
        'NY DFS Regulation 168 requires insurers to provide 60-day written notice before non-renewal of homeowners policies',
        'Cooperative apartments (co-ops) and condos have unique insurance structures — master policy vs. unit owner coverage requires careful coordination',
      ],
    },
    knownCatastrophicExposures: ['Hurricane', 'Flood', 'Nor\'easter', 'Storm Surge'],
    notes: ['Long Island and Rockaway Peninsula are among most vulnerable coastal communities in the Northeast'],
  },

  NC: {
    name: 'North Carolina',
    perils: {
      wind: { floor: 30, multiplier: 1.05, reason: 'Active hurricane corridor; Floyd (1999), Fran (1996), Matthew (2016), Florence (2018), Dorian (2019) — repeated major landfalls; Outer Banks and Crystal Coast face direct-hit risk' },
      flood: { floor: 20, multiplier: 1.05, reason: 'Florence (2018) caused 30+ inches of rainfall and catastrophic inland flooding; Black, Neuse, and Tar River flooding; Outer Banks overwash and inlet migration' },
    },
    market: {
      condition: 'STRESSED',
      carriersExiting: false,
      residualMarketGrowth: true,
      notes: ['NC Rate Bureau and market disputes over coastal rate adequacy', 'Coastal market tightening; NCIUA (beach plan) growing in Brunswick, New Hanover, Pender, and Dare counties', 'Post-Florence flood losses exposed significant underinsurance in inland areas'],
    },
    regulatory: {
      rateRegulation: 'PRIOR_APPROVAL',
      rateRegulationNotes: 'Prior approval via NC Rate Bureau filing; state sets rates collectively for admitted carriers; significant regulatory constraint on coastal rates historically',
      buildingCodeStrength: 'MODERATE',
      buildingCodeNotes: 'North Carolina Building Code based on IBC/IRC with state amendments; coastal counties have enhanced wind-resistant provisions under IBHS and NC Building Code',
      residualMarketPrograms: [
        { name: 'North Carolina Insurance Underwriting Association (NCIUA — Beach Plan)', type: 'BEACH_PLAN', coverageTypes: ['Wind', 'Hail', 'Fire'], notes: 'Provides wind and hail coverage for 18 coastal counties; one of the largest beach plans in the US by exposure; properties must be within 1 mile of coast to qualify in some counties' },
        { name: 'North Carolina Joint Underwriting Association (NCJUA — FAIR Plan)', type: 'FAIR_PLAN', coverageTypes: ['Fire', 'Extended Perils'], notes: 'Last-resort fire and extended perils coverage for properties unable to obtain voluntary market coverage' },
      ],
      requiredDisclosures: ['Residential Property Disclosure Statement required', 'Flood zone disclosure required', 'Coastal Barrier Resources Act (CBRA) disclosure for barrier island properties'],
      mandatedCoverages: ['Hurricane deductible: carriers may apply 1–5% wind/hurricane deductible in coastal counties; must be disclosed at policy issuance'],
      complianceNotes: [
        'CAMA (Coastal Area Management Act) regulates development in 20 coastal counties; affects rebuilding and new construction',
        'Beach Plan (NCIUA) and All-Perils policies are split for coastal properties — two separate policies typically required',
        'CBRA zones (barrier islands) are generally not eligible for NFIP coverage; private flood coverage required',
        'NC law requires that all admitted carriers participate in NCIUA and NCJUA risk pools',
        'Flood insurance from NFIP or private carrier is a SEPARATE policy; not included in homeowners or beach plan policy',
      ],
    },
    knownCatastrophicExposures: ['Hurricane', 'Flood', 'Storm Surge', 'Nor\'easter'],
    notes: ['Outer Banks (Dare County) barrier islands face combined ocean and sound-side surge exposure', 'Post-Florence inland flooding reached areas with no prior NFIP coverage'],
  },

  ND: {
    name: 'North Dakota',
    perils: {
      flood: { floor: 15, multiplier: 1.05, reason: 'Red River Valley among most flood-prone areas in US; 1997 Grand Forks flood ($2B), 2009 and 2011 major events; flat topography with minimal drainage' },
    },
    market: { condition: 'STABLE', carriersExiting: false, residualMarketGrowth: false, notes: ['Stable market; Red River Valley properties see higher flood insurance premiums'] },
    regulatory: {
      rateRegulation: 'FILE_AND_USE',
      rateRegulationNotes: 'File-and-use system',
      buildingCodeStrength: 'MODERATE',
      buildingCodeNotes: 'North Dakota adopts IBC/IRC; enforcement varies by jurisdiction',
      residualMarketPrograms: [FAIR_PLAN('North Dakota')],
      requiredDisclosures: ['Seller Property Disclosure required'],
      mandatedCoverages: [],
      complianceNotes: ['Red River corridor properties should carry NFIP flood coverage regardless of current flood zone designation', 'Blizzard and extreme cold are leading cause of claims in winter months (frozen pipe burst, ice dam)'],
    },
    knownCatastrophicExposures: ['Flood (Red River)', 'Blizzard', 'Tornado'],
    notes: [],
  },

  OH: {
    name: 'Ohio',
    perils: {},
    market: { condition: 'STABLE', carriersExiting: false, residualMarketGrowth: false, notes: ['Competitive, stable market statewide'] },
    regulatory: {
      rateRegulation: 'FILE_AND_USE',
      rateRegulationNotes: 'File-and-use; Ohio DOI review within 30 days',
      buildingCodeStrength: 'MODERATE',
      buildingCodeNotes: 'Ohio Building Code based on IBC/IRC; statewide adoption',
      residualMarketPrograms: [FAIR_PLAN('Ohio')],
      requiredDisclosures: ['Residential Property Disclosure required for residential sales'],
      mandatedCoverages: [],
      complianceNotes: ['Ohio River floodplain communities (Cincinnati, Portsmouth, Marietta) should carry NFIP flood insurance', 'Lake Erie shoreline erosion is a growing risk for lakeshore property owners'],
    },
    knownCatastrophicExposures: ['Tornado', 'Flood', 'Winter Storm'],
    notes: [],
  },

  OK: {
    name: 'Oklahoma',
    perils: {
      wind: { floor: 55, multiplier: 1.2, reason: 'Geographic center of Tornado Alley; Moore has been struck by F4/F5 tornadoes in 1999, 2003, and 2013; highest tornado frequency per area in the world; also severe hail corridor' },
    },
    market: {
      condition: 'STRESSED',
      carriersExiting: false,
      residualMarketGrowth: true,
      notes: ['Tornado losses consistently produce some of the worst loss ratios in the US', 'Some carriers have reduced wind coverage limits or increased deductibles in central OK', 'OPIUA usage growing in OKC metro after repeated tornado losses'],
    },
    regulatory: {
      rateRegulation: 'FILE_AND_USE',
      rateRegulationNotes: 'File-and-use; Oklahoma OID review within 30 days',
      buildingCodeStrength: 'MODERATE',
      buildingCodeNotes: 'Oklahoma adopts IBC/IRC; OKC and Tulsa have reasonable enforcement; many suburban and rural areas have weak enforcement; no mandatory safe room requirement statewide',
      residualMarketPrograms: [
        { name: 'Oklahoma Property and Casualty Insurance Guaranty Association', type: 'FAIR_PLAN', coverageTypes: ['Last-resort coverage'], notes: 'Handles claims from insolvent insurers' },
        FAIR_PLAN('Oklahoma'),
      ],
      requiredDisclosures: ['Seller Disclosure of Property Condition required', 'Flood zone disclosure required'],
      mandatedCoverages: [],
      complianceNotes: [
        'Standard HO policies include wind/tornado coverage; verify that policy does NOT have a separate wind deductible in high-risk areas',
        'FEMA safe room grants available for Oklahoma homeowners; state has robust rebate program for tornado shelter installation',
        'Oklahoma now requires disclosure when a home has a storm shelter/safe room — value to buyers',
        'Hail damage to roofing is the single most common claim in Oklahoma; Class 4 impact-resistant roofing qualifies for discounts',
        'Induced seismicity from oil/gas wastewater injection dramatically increased OK earthquake frequency 2010–2016; now declining but earthquake risk remains elevated vs. historical baseline',
      ],
    },
    knownCatastrophicExposures: ['Tornado', 'Hail', 'Earthquake (Induced)', 'Flood'],
    notes: ['Oklahoma has experienced more F5 tornadoes than any other state', 'The 2011–2016 induced seismicity episode made Cushing, OK (oil hub) one of highest-risk earthquake areas in US'],
  },

  OR: {
    name: 'Oregon',
    perils: {
      fire: { floor: 25, multiplier: 1.1, reason: 'Bootleg Fire (2021, 413k acres), Labor Day 2020 fires burned 1M+ acres in 48 hours; expanding eastern Oregon WUI; drought amplification increasing fire weather days' },
      earthquake: { floor: 30, multiplier: 1.1, reason: 'Cascadia Subduction Zone (CSZ) poses M8.0–9.2 threat; DOGAMI estimates 27,000+ deaths and $32B+ losses from full CSZ rupture; Portland metro on soft soils with liquefaction risk' },
    },
    market: {
      condition: 'STRESSED',
      carriersExiting: false,
      residualMarketGrowth: true,
      notes: ['WUI areas in Ashland, Medford, and eastern OR corridors facing non-renewals', 'Oregon FAIR Plan demand growing post-2020/2021 fire seasons', 'Cascadia earthquake risk largely unpriced in current market'],
    },
    regulatory: {
      rateRegulation: 'PRIOR_APPROVAL',
      rateRegulationNotes: 'Prior approval required for personal lines in Oregon; Oregon DOI actively reviews filings',
      buildingCodeStrength: 'STRONG',
      buildingCodeNotes: 'Oregon Residential Specialty Code and Structural Specialty Code based on IBC/IRC; strong statewide enforcement; seismic design requirements apply in high-hazard zones',
      residualMarketPrograms: [FAIR_PLAN('Oregon')],
      requiredDisclosures: ['Seller Property Disclosure Statement required', 'Oregon Natural Hazard Disclosure: sellers must disclose if property is in flood, landslide, earthquake, or wildfire hazard area', 'Wildfire Risk Map disclosure: Oregon has statewide wildfire hazard mapping (ODF); high/extreme zones require disclosure at sale beginning 2025'],
      mandatedCoverages: [],
      complianceNotes: [
        'Oregon Senate Bill 82 (2021): properties in High and Extreme wildfire hazard areas must be disclosed at sale; some areas may face insurer risk classification',
        'Earthquake coverage is NOT included in standard HO policies; Cascadia Subduction Zone risk is the most significant uninsured natural hazard in the Pacific Northwest',
        'Oregon has a "Resilience Plan" (2020) recommending seismic retrofits for soft-story apartments and unreinforced masonry buildings; affects older multifamily properties',
        'WUI properties in Jackson, Josephine, Douglas, and Klamath counties face highest wildfire risk; some carriers are no longer writing new policies in high/extreme fire zones',
        'Tsunami inundation zones affect all Oregon coastal communities; not covered by standard flood or homeowners policy',
      ],
    },
    knownCatastrophicExposures: ['Wildfire', 'Earthquake (Cascadia)', 'Tsunami', 'Flood'],
    notes: ['Cascadia Subduction Zone event is considered one of the greatest unmitigated natural disaster risks in North America', 'Oregon coast tsunami inundation could reach 1–2 miles inland in some areas'],
  },

  PA: {
    name: 'Pennsylvania',
    perils: {
      flood: { floor: 15, multiplier: 1.05, reason: 'Susquehanna, Delaware, and Allegheny River systems; Ida 2021 caused catastrophic flooding in Philadelphia area; repeated flooding in Wyoming Valley (Wilkes-Barre/Nanticoke)' },
    },
    market: { condition: 'STABLE', carriersExiting: false, residualMarketGrowth: false, notes: ['Stable, competitive market; some rate pressure in flood-prone areas post-Ida'] },
    regulatory: {
      rateRegulation: 'FILE_AND_USE',
      rateRegulationNotes: 'File-and-use; Pennsylvania DOI review within 30 days',
      buildingCodeStrength: 'MODERATE',
      buildingCodeNotes: 'Pennsylvania Construction Code (UCC) based on IBC/IRC; statewide adoption with local amendments',
      residualMarketPrograms: [FAIR_PLAN('Pennsylvania')],
      requiredDisclosures: ['Real Estate Seller Disclosure Law requires property condition disclosure', 'Flood zone disclosure required'],
      mandatedCoverages: [],
      complianceNotes: ['Wyoming Valley communities have severe NFIP flood risk; some areas have been repeatedly flooded (Agnes 1972, Lee 2011, Ida 2021)', 'Philadelphia area basement flooding from combined sewer overflow is NOT covered under standard HO policies'],
    },
    knownCatastrophicExposures: ['Flood', 'Winter Storm', 'Tornado (limited)'],
    notes: [],
  },

  RI: {
    name: 'Rhode Island',
    perils: {
      wind: { floor: 20, multiplier: 1.0, reason: 'Hurricane exposure; 1938 New England Hurricane caused catastrophic surge; small coastline but densely developed' },
      flood: { floor: 15, multiplier: 1.05, reason: 'Narragansett Bay storm surge; 1938 hurricane generated 13-foot surge; limited elevation throughout state' },
    },
    market: { condition: 'STRESSED', carriersExiting: false, residualMarketGrowth: false, notes: ['Small state with significant coastal exposure density; some carriers limiting coastal new business'] },
    regulatory: {
      rateRegulation: 'PRIOR_APPROVAL',
      rateRegulationNotes: 'Prior approval required in Rhode Island',
      buildingCodeStrength: 'STRONG',
      buildingCodeNotes: 'Rhode Island Building Code based on IBC/IRC; strong enforcement statewide',
      residualMarketPrograms: [FAIR_PLAN('Rhode Island')],
      requiredDisclosures: ['Seller Property Condition Disclosure required', 'Flood zone disclosure required'],
      mandatedCoverages: [],
      complianceNotes: ['Properties along Narragansett Bay should carry flood coverage even if not in SFHA; storm surge threat is significant', 'Coastal Zone Management program restricts construction in coastal barrier areas'],
    },
    knownCatastrophicExposures: ['Hurricane', 'Storm Surge', 'Flood'],
    notes: [],
  },

  SC: {
    name: 'South Carolina',
    perils: {
      wind: { floor: 35, multiplier: 1.05, reason: 'Hugo (1989) caused $7B insured; Dorian (2019), Matthew (2016), Florence (2018); active direct-hit corridor; Grand Strand and Lowcountry face compound wind + surge exposure' },
      flood: { floor: 20, multiplier: 1.05, reason: 'Florence 2018 caused record inland flooding; Waccamaw River and Pee Dee River basin flooding; "1000-year" flood events becoming more frequent' },
    },
    market: {
      condition: 'STRESSED',
      carriersExiting: false,
      residualMarketGrowth: true,
      notes: ['SCWHUA (wind pool) expanding in coastal counties', 'Hilton Head and Grand Strand seeing carrier restrictions', 'Post-Florence inland flood losses created unexpected non-renewal waves'],
    },
    regulatory: {
      rateRegulation: 'PRIOR_APPROVAL',
      rateRegulationNotes: 'Prior approval required for personal lines rate changes',
      buildingCodeStrength: 'MODERATE',
      buildingCodeNotes: 'South Carolina Building Code based on IBC/IRC; coastal counties (Charleston, Beaufort, Horry) have enhanced wind-resistance requirements; enforcement varies',
      residualMarketPrograms: [
        { name: 'South Carolina Wind and Hail Underwriting Association (SCWHUA)', type: 'WIND_POOL', coverageTypes: ['Wind', 'Hail'], notes: 'Provides wind/hail coverage for eligible coastal properties (within 25 miles of coast) unable to obtain voluntary coverage; often the only available wind insurer for oceanfront properties' },
        FAIR_PLAN('South Carolina'),
      ],
      requiredDisclosures: ['Residential Property Condition Disclosure Statement required', 'Flood zone disclosure required for SFHA properties', 'Beachfront Management Act disclosure for oceanfront properties'],
      mandatedCoverages: ['Hurricane deductible: 1–5% of Coverage A applies in coastal counties for named storm events'],
      complianceNotes: [
        'SC Beachfront Management Act restricts construction within "dead zone" (40-year setback from beach erosion baseline)',
        'SCWHUA eligibility requires property to be within 25 miles of coast in designated coastal counties',
        'Wind and flood are separate coverages — SCWHUA handles wind; NFIP handles flood; most coastal properties need both',
        'Charleston County has one of highest NFIP claim rates in the Southeast; elevation certificate critical for rating accuracy',
      ],
    },
    knownCatastrophicExposures: ['Hurricane', 'Storm Surge', 'Flood', 'Tornado'],
    notes: [],
  },

  SD: {
    name: 'South Dakota',
    perils: {
      wind: { floor: 15, multiplier: 1.0, reason: 'Tornado risk in eastern SD; significant hail exposure; 1972 Rapid City Flash Flood (238 deaths) illustrates extreme event potential' },
    },
    market: { condition: 'STABLE', carriersExiting: false, residualMarketGrowth: false, notes: ['Stable market statewide'] },
    regulatory: {
      rateRegulation: 'FILE_AND_USE',
      rateRegulationNotes: 'File-and-use system',
      buildingCodeStrength: 'WEAK',
      buildingCodeNotes: 'South Dakota has NO mandatory statewide building code; municipalities adopt independently; most of rural SD has no code',
      residualMarketPrograms: [FAIR_PLAN('South Dakota')],
      requiredDisclosures: ['Seller Property Disclosure Statement required'],
      mandatedCoverages: [],
      complianceNotes: ['No statewide building code; construction quality varies significantly', 'NFIP flood insurance required in SFHA along Missouri and Big Sioux River corridors'],
    },
    knownCatastrophicExposures: ['Tornado', 'Hail', 'Blizzard'],
    notes: [],
  },

  TN: {
    name: 'Tennessee',
    perils: {
      wind: { floor: 25, multiplier: 1.05, reason: 'Dixie Alley tornado risk; 2020 Nashville tornado (EF3, 24 deaths) struck urban core; Cookeville 2020 EF4; multiple active tornado tracks across state' },
      earthquake: { floor: 25, multiplier: 1.1, reason: 'New Madrid Seismic Zone underlies western Tennessee (Memphis metro); liquefaction risk extreme in Mississippi River alluvial soils; potential for M7.5+ repeat event' },
    },
    market: { condition: 'STABLE', carriersExiting: false, residualMarketGrowth: false, notes: ['Stable statewide; western TN NMSZ risk largely unpriced'] },
    regulatory: {
      rateRegulation: 'FILE_AND_USE',
      rateRegulationNotes: 'File-and-use; Tennessee DOC review',
      buildingCodeStrength: 'MODERATE',
      buildingCodeNotes: 'Tennessee adopted IBC/IRC-based residential and commercial codes (2012); statewide adoption is relatively recent; rural enforcement remains inconsistent',
      residualMarketPrograms: [FAIR_PLAN('Tennessee')],
      requiredDisclosures: ['Tennessee Residential Property Condition Disclosure required'],
      mandatedCoverages: [],
      complianceNotes: [
        'Earthquake coverage not standard in TN HO policies; Memphis and western TN face severe NMSZ exposure',
        'Liquefaction in Mississippi River alluvial soils (Memphis metro) could cause catastrophic building damage in NMSZ event',
        'NFIP flood insurance required along Tennessee, Cumberland, and Mississippi River corridors',
        'Tennessee recently updated building code; older homes built before 2012 may not meet current seismic or wind standards',
      ],
    },
    knownCatastrophicExposures: ['Tornado', 'Earthquake (New Madrid)', 'Flood'],
    notes: ['Memphis is considered one of the highest NMSZ risk cities; much of the housing stock predates modern seismic codes'],
  },

  TX: {
    name: 'Texas',
    perils: {
      wind: { floor: 40, multiplier: 1.1, reason: 'Gulf Coast hurricane exposure (Ike 2008, Harvey 2017, Beryl 2024); Tornado Alley in Panhandle and north TX; central TX "hail alley" — Tarrant/Dallas counties have highest hail claim frequency in US' },
      flood: { floor: 25, multiplier: 1.1, reason: 'Harvey (2017) caused $19B NFIP losses — single largest NFIP event ever; Houston metro has recurrent 500-year flood events; "flash flood alley" in central TX Hill Country' },
    },
    market: {
      condition: 'HARD',
      carriersExiting: false,
      residualMarketGrowth: true,
      notes: [
        'Texas FAIR Plan and TWIA (coastal wind pool) growing significantly',
        'Hail losses in DFW metro are causing significant rate increases and non-renewals',
        'Post-Harvey flood losses revealed massive underinsurance gap in Houston metro',
        'Winter Storm Uri (2021) caused $15B in TX insured losses — largest non-hurricane event in TX history',
      ],
    },
    regulatory: {
      rateRegulation: 'USE_AND_FILE',
      rateRegulationNotes: 'Use-and-file: carriers may use rates immediately and file within 30 days; TDI may require refunds if rates found excessive; allows faster market response to catastrophe losses',
      buildingCodeStrength: 'MODERATE',
      buildingCodeNotes: 'Texas adopts IBC/IRC with local authority; no mandatory statewide adoption — counties over 5,000 population may adopt codes but many haven\'t; coastal counties have enhanced wind provisions; Houston (unincorporated Harris County) historically had minimal code enforcement',
      residualMarketPrograms: [
        { name: 'Texas Windstorm Insurance Association (TWIA)', type: 'WIND_POOL', coverageTypes: ['Wind', 'Hail'], notes: 'Provides wind and hail coverage for eligible properties in 14 first-tier coastal counties and parts of Harris County; largest state wind pool in the US by exposure ($100B+); requires WPI-8 certificate of compliance for new construction' },
        { name: 'Texas FAIR Plan (Texas Basic Property Insurance)', type: 'FAIR_PLAN', coverageTypes: ['Fire', 'Extended Perils'], notes: 'Last-resort fire and extended perils coverage statewide for properties denied voluntary coverage' },
      ],
      requiredDisclosures: [
        'Texas Seller\'s Disclosure Notice (TREC Form OP-H) required for all residential sales — includes flood, fire, and structural defects',
        'Flood zone disclosure required; must indicate current FEMA flood zone designation',
        'Special Flood Hazard Area (SFHA) notice required at closing if property is in SFHA',
        'TDI-required consumer notices on wind insurance availability and TWIA eligibility',
      ],
      mandatedCoverages: [
        'TWIA WPI-8 Certificate: new construction in TWIA-eligible areas must meet windstorm resistant construction standards and receive TDI certificate',
        'Separate wind deductible (1–5% of Coverage A) required in coastal areas; must be disclosed on declarations page',
        'NFIP flood insurance mandatory for federally-backed mortgages in SFHA',
      ],
      complianceNotes: [
        'TWIA-eligible counties (14 coastal): Aransas, Bee, Brooks, Calhoun, Cameron, Galveston, Hidalgo, Jefferson, Jim Hogg, Kenedy, Kleberg, Matagorda, Nueces, Refugio, San Patricio, Starr, Willacy, Zapata',
        'Properties in TWIA territory must obtain TWIA certificate (WPI-8) for all new construction and major renovations to maintain eligibility',
        'Harvey exposed that only ~15% of Houston-area flood-damage homes had NFIP coverage; flood insurance penetration remains low despite high risk',
        'Winter Storm Uri losses (frozen pipes, burst pipes) revealed policy exclusions for "ensuing loss" and water damage from freezing; verify policy language carefully',
        'Hail in DFW metro: Class 3 or 4 impact-resistant roofing may reduce premiums by 10–30% and reduce non-renewal risk',
        'No statewide building code for most unincorporated areas; significant housing stock built without wind/flood-resistant standards',
      ],
    },
    knownCatastrophicExposures: ['Hurricane', 'Flood', 'Tornado', 'Hail', 'Winter Storm', 'Storm Surge'],
    notes: [
      'Harvey\'s $19B NFIP loss shattered previous records; made inland flood coverage gaps a national conversation',
      'Texas is the largest state homeowners insurance market in the US; losses here drive national industry results',
    ],
  },

  UT: {
    name: 'Utah',
    perils: {
      earthquake: { floor: 30, multiplier: 1.1, reason: 'Wasatch Fault (Salt Lake City) rated high risk; USGS estimates M7.0 Wasatch event would cause $33B in losses; 2020 M5.7 Salt Lake City earthquake pre-COVID; liquefaction risk in Jordan River valley' },
      fire: { floor: 20, multiplier: 1.05, reason: 'Significant WUI communities in Wasatch Front; 2012 Dump Fire (Lehi), 2018 Dollar Ridge Fire; drought and beetle kill increasing fuel loads' },
    },
    market: { condition: 'STABLE', carriersExiting: false, residualMarketGrowth: false, notes: ['Relatively stable; Wasatch Front WUI areas see rate pressure'] },
    regulatory: {
      rateRegulation: 'FILE_AND_USE',
      rateRegulationNotes: 'File-and-use; Utah DOI review',
      buildingCodeStrength: 'MODERATE',
      buildingCodeNotes: 'Utah adopts IBC/IRC with seismic design requirements; Salt Lake County has strong enforcement; rural counties variable',
      residualMarketPrograms: [FAIR_PLAN('Utah')],
      requiredDisclosures: ['Seller Property Condition Disclosure required', 'Earthquake hazard area disclosure for high-risk zones'],
      mandatedCoverages: [],
      complianceNotes: ['Earthquake coverage not standard; Wasatch Fault exposure makes separate earthquake policy strongly advisable for SLC metro', 'Jordan River and Utah Lake floodplain properties should carry NFIP flood insurance'],
    },
    knownCatastrophicExposures: ['Earthquake', 'Wildfire', 'Flood (Wasatch runoff)'],
    notes: ['Salt Lake City has one of the highest earthquake risk profiles of any major US metro outside California'],
  },

  VT: {
    name: 'Vermont',
    perils: {
      flood: { floor: 15, multiplier: 1.05, reason: 'Irene (2011) caused worst flooding in VT history, damaging or destroying 2,700 homes; narrow river valleys amplify flood impact; 2023 July floods caused additional widespread damage' },
    },
    market: { condition: 'STABLE', carriersExiting: false, residualMarketGrowth: false, notes: ['Post-Irene and post-2023 flood awareness elevated; limited market disruption'] },
    regulatory: {
      rateRegulation: 'PRIOR_APPROVAL',
      rateRegulationNotes: 'Prior approval required in Vermont',
      buildingCodeStrength: 'MODERATE',
      buildingCodeNotes: 'Vermont Fire and Building Safety Code based on IBC/IRC',
      residualMarketPrograms: [FAIR_PLAN('Vermont')],
      requiredDisclosures: ['Seller Property Disclosure required', 'Flood zone disclosure required'],
      mandatedCoverages: [],
      complianceNotes: ['Vermont river valley communities face repeated flood risk; NFIP coverage strongly recommended', 'Post-Irene FEMA remapping expanded SFHA designations significantly in VT'],
    },
    knownCatastrophicExposures: ['Flood', 'Nor\'easter', 'Ice Storm'],
    notes: ['2023 July floods (second major flood in 12 years) demonstrate increasing Vermont flood frequency'],
  },

  VA: {
    name: 'Virginia',
    perils: {
      wind: { floor: 20, multiplier: 1.0, reason: 'Hurricane exposure along Hampton Roads coast; remnant tropical storm inland flooding; Norfolk area is among the most flood-vulnerable cities in US' },
      flood: { floor: 20, multiplier: 1.05, reason: 'Hampton Roads tidal flooding (second-fastest sea level rise in US); Ida 2021 caused catastrophic inland flooding in Northern VA; Shenandoah Valley flash flooding' },
    },
    market: { condition: 'STABLE', carriersExiting: false, residualMarketGrowth: false, notes: ['Stable statewide; Hampton Roads coastal market faces long-term sea level rise pricing pressure'] },
    regulatory: {
      rateRegulation: 'FILE_AND_USE',
      rateRegulationNotes: 'File-and-use; Virginia SCC/Bureau of Insurance review',
      buildingCodeStrength: 'STRONG',
      buildingCodeNotes: 'Virginia Uniform Statewide Building Code (USBC) based on IBC/IRC; strong statewide enforcement; coastal construction standards apply in SFHA',
      residualMarketPrograms: [FAIR_PLAN('Virginia')],
      requiredDisclosures: ['Residential Property Disclosure Act requires disclosure of property condition and flood zone status', 'Hampton Roads properties require additional sea level rise disclosure under some municipal ordinances'],
      mandatedCoverages: [],
      complianceNotes: ['Norfolk and Hampton Roads: among fastest sea level rise in US (+1.5 inches/decade); flood risk growing even without storm events', 'NFIP flood insurance required in SFHA; many Hampton Roads properties have chronic tidal flooding outside mapped SFHA'],
    },
    knownCatastrophicExposures: ['Hurricane', 'Flood', 'Tidal Flooding', 'Tornado'],
    notes: ['Norfolk is considered one of the most vulnerable major US cities to sea level rise'],
  },

  WA: {
    name: 'Washington',
    perils: {
      earthquake: { floor: 35, multiplier: 1.1, reason: 'Cascadia Subduction Zone poses M8.0–9.2 megathrust threat; Seattle Fault could generate M7.0; 2001 M6.8 Nisqually earthquake; WSDOT estimates $80B CSZ losses; liquefaction risk in Seattle metro lowlands' },
      fire: { floor: 20, multiplier: 1.05, reason: 'Eastern Washington WUI fires; 2015 Okanogan Complex (256k acres); increasing smoke and fire weather in Cascades and Olympics; suburban Bellevue/Redmond face low but growing WUI risk' },
    },
    market: {
      condition: 'STRESSED',
      carriersExiting: false,
      residualMarketGrowth: true,
      notes: ['WA FAIR Plan growing in eastern Washington fire-risk communities', 'Cascadia earthquake risk is largely unpriced; earthquake coverage penetration below 15% of homeowners', 'Some western WA coastal carriers restricting new business'],
    },
    regulatory: {
      rateRegulation: 'PRIOR_APPROVAL',
      rateRegulationNotes: 'Prior approval required for personal lines; Washington OIC closely monitors carrier rate filings and market conduct',
      buildingCodeStrength: 'STRONG',
      buildingCodeNotes: 'Washington State Building Code (WAC 51) based on IBC/IRC with seismic design requirements; excellent statewide enforcement; Seattle has additional seismic retrofitting requirements for unreinforced masonry and soft-story buildings',
      residualMarketPrograms: [FAIR_PLAN('Washington')],
      requiredDisclosures: ['Seller Disclosure Statement (Form 17) required — includes flood, earthquake, landslide, and wildfire disclosures', 'Natural Hazard Mitigation disclosure for properties in high-hazard zones', 'Tsunami inundation zone disclosure for coastal properties'],
      mandatedCoverages: ['Seattle mandatory soft-story retrofit ordinance for qualifying apartments (phased deadlines)'],
      complianceNotes: [
        'Earthquake coverage is NOT included in standard WA homeowners policies; with Cascadia risk, standalone policy strongly advisable',
        'Seattle\'s mandatory soft-story retrofit ordinance requires seismic upgrades to pre-1978 wood-frame apartment buildings by specific deadlines',
        'Tsunami inundation zones cover significant portions of western WA coast and Puget Sound communities; standard policies do not cover tsunami',
        'Eastern WA WUI properties in Spokane, Okanogan, and Chelan counties face growing wildfire non-renewal risk',
        'Liquefaction hazard in Seattle\'s SoDo, South Park, and SODO neighborhoods is severe in a CSZ event',
      ],
    },
    knownCatastrophicExposures: ['Earthquake (Cascadia)', 'Tsunami', 'Wildfire', 'Landslide', 'Volcanic (Rainier)'],
    notes: ['Cascadia Subduction Zone: USGS estimates 1-in-10 chance of M8.0+ in next 50 years', 'Mt. Rainier lahar risk covers thousands of homes in Pierce and King County river valleys'],
  },

  WV: {
    name: 'West Virginia',
    perils: {
      flood: { floor: 25, multiplier: 1.1, reason: '2016 Greenbrier County floods caused 23 deaths; flash flood capital of eastern US due to narrow mountain hollows; recurrent flooding in Kanawha, Elk, and Cheat River systems' },
    },
    market: { condition: 'STABLE', carriersExiting: false, residualMarketGrowth: false, notes: ['Limited carrier competition in rural areas; flood risk chronically underinsured in mountain communities'] },
    regulatory: {
      rateRegulation: 'FILE_AND_USE',
      rateRegulationNotes: 'File-and-use; West Virginia OIC review',
      buildingCodeStrength: 'WEAK',
      buildingCodeNotes: 'West Virginia Manufactured Housing Construction and Safety Standards apply to MH; site-built residential code is locally adopted and often weakly enforced; significant housing stock built without flood-resistant standards',
      residualMarketPrograms: [FAIR_PLAN('West Virginia')],
      requiredDisclosures: ['Residential Property Disclosure required'],
      mandatedCoverages: [],
      complianceNotes: ['Mountain hollow ("holler") communities face channeled flash flood amplification not reflected in standard NFIP maps', 'NFIP maps in WV may be outdated; areas without mapped SFHA still face significant flood risk', 'Post-2016 flood: FEMA remapped many WV communities significantly expanding SFHA'],
    },
    knownCatastrophicExposures: ['Flash Flood', 'Winter Storm', 'Landslide'],
    notes: ['2016 Greenbrier County floods struck areas that had never flooded in living memory; risk is systematically underappreciated'],
  },

  WI: {
    name: 'Wisconsin',
    perils: {},
    market: { condition: 'STABLE', carriersExiting: false, residualMarketGrowth: false, notes: ['Stable, competitive market statewide'] },
    regulatory: {
      rateRegulation: 'FILE_AND_USE',
      rateRegulationNotes: 'File-and-use; Wisconsin OCI review within 30 days',
      buildingCodeStrength: 'MODERATE',
      buildingCodeNotes: 'Wisconsin Uniform Dwelling Code based on IBC/IRC; statewide adoption',
      residualMarketPrograms: [FAIR_PLAN('Wisconsin')],
      requiredDisclosures: ['Real Estate Condition Report (RECR) required for residential sales'],
      mandatedCoverages: [],
      complianceNotes: ['Lake Michigan and Green Bay shoreline properties face wave action and erosion risk', 'Ice dam damage common in severe winters; ensure policy covers resulting water infiltration'],
    },
    knownCatastrophicExposures: ['Winter Storm', 'Tornado', 'Flood'],
    notes: [],
  },

  WY: {
    name: 'Wyoming',
    perils: {
      fire: { floor: 15, multiplier: 1.0, reason: 'Remote wildfire risk in forested areas; limited WUI communities; significant firefighting resources relative to population' },
    },
    market: { condition: 'STABLE', carriersExiting: false, residualMarketGrowth: false, notes: ['Stable market; limited carrier options in rural areas'] },
    regulatory: {
      rateRegulation: 'FILE_AND_USE',
      rateRegulationNotes: 'File-and-use; Wyoming DOI review',
      buildingCodeStrength: 'WEAK',
      buildingCodeNotes: 'Wyoming has NO mandatory statewide building code; municipalities may adopt codes but many do not; most of rural WY has no code requirement',
      residualMarketPrograms: [FAIR_PLAN('Wyoming')],
      requiredDisclosures: ['Seller Property Disclosure required'],
      mandatedCoverages: [],
      complianceNotes: ['No statewide building code; construction quality highly variable', 'Yellowstone supervolcano risk is extremely low-probability but not covered by any standard insurance product'],
    },
    knownCatastrophicExposures: ['Wildfire', 'Winter Storm', 'Hail'],
    notes: [],
  },
}

// ─── Lookup helper ────────────────────────────────────────────────────────────

/**
 * Returns the StateRiskConfig for a given 2-letter state code, or null if not found.
 */
export function getStateRiskConfig(stateCode: string): StateRiskConfig | null {
  return STATE_RISK_PROFILES[stateCode.toUpperCase()] ?? null
}
