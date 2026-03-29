# Google Play Data Safety Declaration — CoverGuard

Use this when filling out the Data Safety form in Google Play Console.

---

## Overview

CoverGuard collects and processes the following data categories.
All data is transmitted over HTTPS (encrypted in transit).

---

## Data Types Collected

### 1. Personal Information
| Data type | Collected | Shared | Purpose | Optional |
|---|---|---|---|---|
| Name | Yes | No | Account management | No |
| Email address | Yes | No | Authentication, account recovery, quote requests | No |
| Phone number | No | — | — | — |

### 2. Location
| Data type | Collected | Shared | Purpose | Optional |
|---|---|---|---|---|
| Approximate location | Yes | No | Nearby property search | Yes |
| Precise location | Yes | No | Nearby property search | Yes |

### 3. Financial Info
| Data type | Collected | Shared | Purpose | Optional |
|---|---|---|---|---|
| Purchase history | Yes | No | Subscription management | No |
| Payment info | No (handled by Stripe) | — | Stripe processes payments directly | — |

### 4. App Activity
| Data type | Collected | Shared | Purpose | Optional |
|---|---|---|---|---|
| Search history | Yes | No | Analytics, improving search results | No |
| In-app actions | Yes | No | Feature usage analytics | No |

### 5. App Info and Performance
| Data type | Collected | Shared | Purpose | Optional |
|---|---|---|---|---|
| Crash logs | Yes | No | Stability and bug fixes | No |
| Performance diagnostics | Yes | No | App performance improvement | No |

---

## Data Handling Practices

| Practice | Status |
|---|---|
| Data encrypted in transit | Yes (HTTPS/TLS) |
| Data encrypted at rest | Yes (Supabase PostgreSQL encryption) |
| Users can request data deletion | Yes (via account settings or support@coverguard.io) |
| Data retention period | Account data retained until deletion requested |
| Data shared with third parties | No personal data shared; Stripe processes payments |

---

## Third-Party Services

| Service | Data accessed | Purpose |
|---|---|---|
| Supabase | Auth credentials, user data | Authentication and database |
| Stripe | Payment method (processed by Stripe, not stored by us) | Subscription billing |
| Google Maps | Map interactions | Property visualization |
| Vercel Analytics | Anonymized page views | Web analytics |
| FEMA / USGS / NOAA / FBI | Property risk data (public) | Risk assessment |

---

## Deletion Policy

Users can delete their account and all associated data by:
1. Going to Account Settings in the app
2. Selecting "Delete Account"
3. Or emailing support@coverguard.io

All personal data is deleted within 30 days of request.
Anonymized analytics data may be retained.
