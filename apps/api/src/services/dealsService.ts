/**
 * Deals service — pipeline CRUD plus aggregated stats (close rate, fall-out
 * breakdown by cause). Backs the dashboard "Deals" KPI panel.
 */

import { prisma } from '../utils/prisma'
import type {
  Deal,
  DealFalloutBreakdown,
  DealFalloutReason,
  DealStage,
  DealStageCount,
  DealStats,
  DealWithRelations,
} from '@coverguard/shared'
import { DEAL_FALLOUT_REASONS, DEAL_STAGES } from '@coverguard/shared'
import {
  DealStage as PrismaDealStage,
  DealFalloutReason as PrismaDealFalloutReason,
} from '../generated/prisma/client'
import type { Prisma } from '../generated/prisma/client'

const DEAL_INCLUDE = {
  property: { select: { id: true, address: true, city: true, state: true } },
  client: { select: { id: true, firstName: true, lastName: true } },
} as const

type PrismaDeal = Prisma.DealGetPayload<{ include: typeof DEAL_INCLUDE }>

function toDto(d: PrismaDeal): DealWithRelations {
  return {
    id: d.id,
    userId: d.userId,
    propertyId: d.propertyId,
    clientId: d.clientId,
    title: d.title,
    stage: d.stage as DealStage,
    dealValue: d.dealValue,
    carrierName: d.carrierName,
    falloutReason: d.falloutReason as DealFalloutReason | null,
    falloutNotes: d.falloutNotes,
    notes: d.notes,
    openedAt: d.openedAt.toISOString(),
    closedAt: d.closedAt?.toISOString() ?? null,
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
    property: d.property,
    client: d.client
      ? { id: d.client.id, firstName: d.client.firstName, lastName: d.client.lastName }
      : null,
  }
}

export interface CreateDealInput {
  title: string
  stage?: DealStage
  propertyId?: string | null
  clientId?: string | null
  dealValue?: number | null
  carrierName?: string | null
  notes?: string | null
}

export interface UpdateDealInput {
  title?: string
  stage?: DealStage
  propertyId?: string | null
  clientId?: string | null
  dealValue?: number | null
  carrierName?: string | null
  falloutReason?: DealFalloutReason | null
  falloutNotes?: string | null
  notes?: string | null
}

export async function listDeals(userId: string): Promise<DealWithRelations[]> {
  const deals = await prisma.deal.findMany({
    where: { userId },
    include: DEAL_INCLUDE,
    orderBy: { createdAt: 'desc' },
  })
  return deals.map(toDto)
}

export async function createDeal(userId: string, input: CreateDealInput): Promise<DealWithRelations> {
  const deal = await prisma.deal.create({
    data: {
      userId,
      title: input.title,
      stage: (input.stage ?? 'PROSPECT') as PrismaDealStage,
      propertyId: input.propertyId ?? null,
      clientId: input.clientId ?? null,
      dealValue: input.dealValue ?? null,
      carrierName: input.carrierName ?? null,
      notes: input.notes ?? null,
    },
    include: DEAL_INCLUDE,
  })
  return toDto(deal)
}

export async function updateDeal(
  userId: string,
  id: string,
  input: UpdateDealInput,
): Promise<DealWithRelations | null> {
  // Ownership check first — keeps update narrowly scoped and avoids leaking
  // the existence of another user's row via Prisma's NotFound error code.
  const existing = await prisma.deal.findFirst({ where: { id, userId }, select: { id: true, stage: true, closedAt: true } })
  if (!existing) return null

  const data: Prisma.DealUpdateInput = {}
  if (input.title !== undefined) data.title = input.title
  if (input.dealValue !== undefined) data.dealValue = input.dealValue
  if (input.carrierName !== undefined) data.carrierName = input.carrierName
  if (input.notes !== undefined) data.notes = input.notes
  if (input.falloutNotes !== undefined) data.falloutNotes = input.falloutNotes
  if (input.propertyId !== undefined) {
    data.property = input.propertyId ? { connect: { id: input.propertyId } } : { disconnect: true }
  }
  if (input.clientId !== undefined) {
    data.client = input.clientId ? { connect: { id: input.clientId } } : { disconnect: true }
  }

  if (input.stage !== undefined) {
    data.stage = input.stage as PrismaDealStage
    // Auto-set / clear closedAt when transitioning into / out of terminal stages.
    if (input.stage === 'CLOSED_WON' || input.stage === 'FELL_OUT') {
      if (!existing.closedAt) data.closedAt = new Date()
    } else {
      data.closedAt = null
    }
    // Clear falloutReason when stage moves away from FELL_OUT (unless input also sets it).
    if (input.stage !== 'FELL_OUT' && input.falloutReason === undefined) {
      data.falloutReason = null
    }
  }
  if (input.falloutReason !== undefined) {
    data.falloutReason = input.falloutReason as PrismaDealFalloutReason | null
  }

  const updated = await prisma.deal.update({
    where: { id },
    data,
    include: DEAL_INCLUDE,
  })
  return toDto(updated)
}

export async function deleteDeal(userId: string, id: string): Promise<boolean> {
  const result = await prisma.deal.deleteMany({ where: { id, userId } })
  return result.count > 0
}

// ─── Stats aggregation ──────────────────────────────────────────────────────

export async function getDealStats(userId: string): Promise<DealStats> {
  const deals = await prisma.deal.findMany({
    where: { userId },
    select: {
      stage: true,
      dealValue: true,
      falloutReason: true,
      openedAt: true,
      closedAt: true,
    },
  })

  // Initialize per-stage counters so the UI always shows every stage.
  const stageCounts: Record<DealStage, DealStageCount> = DEAL_STAGES.reduce(
    (acc, stage) => {
      acc[stage] = { stage, count: 0, totalValue: 0 }
      return acc
    },
    {} as Record<DealStage, DealStageCount>,
  )

  // Initialize fallout reason counters for stable ordering.
  const reasonCounts: Record<DealFalloutReason, { count: number; lostValue: number }> =
    DEAL_FALLOUT_REASONS.reduce(
      (acc, r) => {
        acc[r] = { count: 0, lostValue: 0 }
        return acc
      },
      {} as Record<DealFalloutReason, { count: number; lostValue: number }>,
    )

  let closedWonCount = 0
  let fellOutCount = 0
  let activeCount = 0
  let closedWonValue = 0
  let fellOutValue = 0
  let closeTimeSumMs = 0
  let closeTimeCount = 0

  for (const d of deals) {
    const stage = d.stage as DealStage
    const value = d.dealValue ?? 0
    stageCounts[stage].count += 1
    stageCounts[stage].totalValue += value

    if (stage === 'CLOSED_WON') {
      closedWonCount += 1
      closedWonValue += value
      if (d.closedAt) {
        closeTimeSumMs += d.closedAt.getTime() - d.openedAt.getTime()
        closeTimeCount += 1
      }
    } else if (stage === 'FELL_OUT') {
      fellOutCount += 1
      fellOutValue += value
      if (d.falloutReason) {
        const reason = d.falloutReason as DealFalloutReason
        reasonCounts[reason].count += 1
        reasonCounts[reason].lostValue += value
      } else {
        // Recorded as fell-out without an explicit reason — bucket as OTHER.
        reasonCounts.OTHER.count += 1
        reasonCounts.OTHER.lostValue += value
      }
    } else {
      activeCount += 1
    }
  }

  const settled = closedWonCount + fellOutCount
  const closeRate = settled > 0 ? closedWonCount / settled : null

  const falloutBreakdown: DealFalloutBreakdown[] = DEAL_FALLOUT_REASONS
    .map((reason) => {
      const { count, lostValue } = reasonCounts[reason]
      const percentage = fellOutCount > 0 ? (count / fellOutCount) * 100 : 0
      return { reason, count, lostValue, percentage }
    })
    .filter((b) => b.count > 0)
    .sort((a, b) => b.count - a.count)

  const avgCloseTimeDays = closeTimeCount > 0
    ? Math.round(closeTimeSumMs / closeTimeCount / (1000 * 60 * 60 * 24))
    : null

  return {
    totalDeals: deals.length,
    closedWonCount,
    fellOutCount,
    activeCount,
    closeRate,
    closedWonValue,
    fellOutValue,
    avgCloseTimeDays,
    byStage: DEAL_STAGES.map((s) => stageCounts[s]),
    falloutBreakdown,
    generatedAt: new Date().toISOString(),
  }
}

export type { Deal }
