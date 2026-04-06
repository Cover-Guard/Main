/**
 * Daily Review Test Suite — April 6, 2026
 *
 * Tests for CoverGuard API routes identified during the daily bug review.
 * Covers: properties route param validation, quote request schema,
 * checklist schema, search schema, and save property schema.
 */

import { z } from 'zod'

// -- Schema Definitions (mirrors API route schemas) ----------------------

const PropertyIdSchema = z.object({
  id: z.string().uuid('Property ID must be a valid UUID'),
})

const QuoteRequestSchema = z.object({
  propertyId: z.string().uuid(),
  coverageType: z.enum(['dwelling', 'contents', 'liability', 'all']),
  coverageAmount: z.number().positive().max(10000000),
  deductible: z.number().nonnegative().max(100000),
  effectiveDate: z.string().regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/),
  additionalInfo: z.string().max(2000).optional(),
})

const ChecklistSchema = z.object({
  propertyId: z.string().uuid(),
  type: z.enum(['INSPECTION', 'NEW_BUYER', 'AGENT']),
  items: z
    .array(
      z.object({
        label: z.string().min(1).max(500),
        completed: z.boolean().default(false),
        notes: z.string().max(1000).optional(),
      })
    )
    .min(1)
    .max(100),
})

const SearchSchema = z.object({
  address: z.string().min(3).max(200).optional(),
  city: z.string().min(1).max(100).optional(),
  state: z
    .string()
    .length(2)
    .regex(/^[A-Z]{2}$/)
    .optional(),
  zip: z
    .string()
    .regex(/^[0-9]{5}(-[0-9]{4})?$/)
    .optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
})

const SavePropertySchema = z.object({
  propertyId: z.string().uuid(),
  nickname: z.string().min(1).max(100).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  notes: z.string().max(5000).optional(),
})

// -- Tests ---------------------------------------------------------------

describe('PropertyIdSchema', () => {
  it('accepts a valid UUID', () => {
    const result = PropertyIdSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
    })
    expect(result.success).toBe(true)
  })

  it('rejects a non-UUID string', () => {
    const result = PropertyIdSchema.safeParse({ id: 'not-a-uuid' })
    expect(result.success).toBe(false)
  })

  it('rejects an empty string', () => {
    const result = PropertyIdSchema.safeParse({ id: '' })
    expect(result.success).toBe(false)
  })

  it('rejects missing id', () => {
    const result = PropertyIdSchema.safeParse({})
    expect(result.success).toBe(false)
  })
})

describe('QuoteRequestSchema', () => {
  const validQuote = {
    propertyId: '550e8400-e29b-41d4-a716-446655440000',
    coverageType: 'all',
    coverageAmount: 500000,
    deductible: 2500,
    effectiveDate: '2026-05-01',
  }

  it('accepts a valid quote request', () => {
    const result = QuoteRequestSchema.safeParse(validQuote)
    expect(result.success).toBe(true)
  })

  it('accepts a quote with optional additionalInfo', () => {
    const result = QuoteRequestSchema.safeParse({
      ...validQuote,
      additionalInfo: 'Please include flood coverage',
    })
    expect(result.success).toBe(true)
  })

  it('rejects zero coverage amount', () => {
    const result = QuoteRequestSchema.safeParse({
      ...validQuote,
      coverageAmount: 0,
    })
    expect(result.success).toBe(false)
  })

  it('rejects negative deductible', () => {
    const result = QuoteRequestSchema.safeParse({
      ...validQuote,
      deductible: -100,
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid coverage type', () => {
    const result = QuoteRequestSchema.safeParse({
      ...validQuote,
      coverageType: 'fire',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid date format', () => {
    const result = QuoteRequestSchema.safeParse({
      ...validQuote,
      effectiveDate: '05/01/2026',
    })
    expect(result.success).toBe(false)
  })

  it('rejects coverage amount over 10M', () => {
    const result = QuoteRequestSchema.safeParse({
      ...validQuote,
      coverageAmount: 10000001,
    })
    expect(result.success).toBe(false)
  })
})

describe('ChecklistSchema', () => {
  const validChecklist = {
    propertyId: '550e8400-e29b-41d4-a716-446655440000',
    type: 'INSPECTION',
    items: [{ label: 'Check roof condition', completed: false }],
  }

  it('accepts a valid checklist', () => {
    const result = ChecklistSchema.safeParse(validChecklist)
    expect(result.success).toBe(true)
  })

  it('accepts all checklist types', () => {
    for (const type of ['INSPECTION', 'NEW_BUYER', 'AGENT']) {
      const result = ChecklistSchema.safeParse({ ...validChecklist, type })
      expect(result.success).toBe(true)
    }
  })

  it('rejects empty items array', () => {
    const result = ChecklistSchema.safeParse({
      ...validChecklist,
      items: [],
    })
    expect(result.success).toBe(false)
  })

  it('rejects items with empty label', () => {
    const result = ChecklistSchema.safeParse({
      ...validChecklist,
      items: [{ label: '', completed: false }],
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid checklist type', () => {
    const result = ChecklistSchema.safeParse({
      ...validChecklist,
      type: 'UNKNOWN',
    })
    expect(result.success).toBe(false)
  })

  it('rejects more than 100 items', () => {
    const items = Array.from({ length: 101 }, function (_, i) {
      return { label: 'item-' + i, completed: false }
    })
    const result = ChecklistSchema.safeParse({
      ...validChecklist,
      items,
    })
    expect(result.success).toBe(false)
  })

  it('defaults completed to false', () => {
    const result = ChecklistSchema.safeParse({
      ...validChecklist,
      items: [{ label: 'Test item' }],
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.items[0].completed).toBe(false)
    }
  })
})

describe('SearchSchema', () => {
  it('accepts a full address search', () => {
    const result = SearchSchema.safeParse({
      address: '123 Main St',
      city: 'Springfield',
      state: 'IL',
      zip: '62704',
    })
    expect(result.success).toBe(true)
  })

  it('accepts a coordinate-based search', () => {
    const result = SearchSchema.safeParse({
      lat: 39.7817,
      lng: -89.6501,
    })
    expect(result.success).toBe(true)
  })

  it('accepts an empty object (all optional)', () => {
    const result = SearchSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('rejects invalid state code', () => {
    const result = SearchSchema.safeParse({ state: 'Illinois' })
    expect(result.success).toBe(false)
  })

  it('rejects invalid zip format', () => {
    const result = SearchSchema.safeParse({ zip: '1234' })
    expect(result.success).toBe(false)
  })

  it('accepts zip+4 format', () => {
    const result = SearchSchema.safeParse({ zip: '62704-1234' })
    expect(result.success).toBe(true)
  })

  it('rejects latitude out of range', () => {
    const result = SearchSchema.safeParse({ lat: 91, lng: 0 })
    expect(result.success).toBe(false)
  })

  it('rejects longitude out of range', () => {
    const result = SearchSchema.safeParse({ lat: 0, lng: 181 })
    expect(result.success).toBe(false)
  })

  it('rejects address shorter than 3 chars', () => {
    const result = SearchSchema.safeParse({ address: 'Ab' })
    expect(result.success).toBe(false)
  })
})

describe('SavePropertySchema', () => {
  const validSave = {
    propertyId: '550e8400-e29b-41d4-a716-446655440000',
  }

  it('accepts minimal save (propertyId only)', () => {
    const result = SavePropertySchema.safeParse(validSave)
    expect(result.success).toBe(true)
  })

  it('accepts save with all optional fields', () => {
    const result = SavePropertySchema.safeParse({
      ...validSave,
      nickname: 'Beach house',
      tags: ['vacation', 'coastal'],
      notes: 'Needs flood insurance review',
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty nickname', () => {
    const result = SavePropertySchema.safeParse({
      ...validSave,
      nickname: '',
    })
    expect(result.success).toBe(false)
  })

  it('rejects more than 20 tags', () => {
    const tags = Array.from({ length: 21 }, function (_, i) {
      return 'tag-' + i
    })
    const result = SavePropertySchema.safeParse({
      ...validSave,
      tags,
    })
    expect(result.success).toBe(false)
  })

  it('rejects notes over 5000 characters', () => {
    const result = SavePropertySchema.safeParse({
      ...validSave,
      notes: 'x'.repeat(5001),
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing propertyId', () => {
    const result = SavePropertySchema.safeParse({
      nickname: 'Test',
    })
    expect(result.success).toBe(false)
  })
})
