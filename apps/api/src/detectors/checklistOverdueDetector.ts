/**
 * Detector: checklist-overdue (PR 8).
 *
 * Fires when a user has a property checklist with at least one item past
 * its due date and still incomplete. Items live in a JSONB array on
 * `property_checklists.items` with the shape `{ id, label, due?, done? }`.
 *
 * One insight per overdue checklist (not per item) — the page the user
 * lands on shows the full checklist, so item-level granularity in the
 * insight would just be noise.
 *
 * Severity: actionable. Dedupe: per-checklist over the runner's 30-day
 * window so we don't re-nag on the same overdue list every day.
 */

import { type Detector, type DetectorContext, type Insight } from './types'

interface ChecklistItem {
  id?: string
  label?: string
  due?: string
  done?: boolean
}

interface ChecklistRow {
  id: string
  title: string
  propertyId: string
  items: unknown
}

export const checklistOverdueDetector: Detector = {
  name: 'checklist-overdue',

  async evaluate(ctx: DetectorContext): Promise<Insight[]> {
    const { data, error } = await ctx.supabase
      .from('property_checklists')
      .select('id,title,propertyId,items')
      .eq('userId', ctx.userId)

    if (error || !data) return []

    const insights: Insight[] = []
    const nowMs = ctx.now.getTime()

    for (const row of data as ChecklistRow[]) {
      const items = Array.isArray(row.items) ? (row.items as ChecklistItem[]) : []
      const overdue = items.filter(
        (it) => !it.done && it.due && new Date(it.due).getTime() < nowMs,
      )
      if (overdue.length === 0) continue
      const sample = overdue[0]?.label ?? 'an item'
      insights.push({
        category: 'insight',
        severity: 'actionable',
        title:
          overdue.length === 1
            ? `Overdue: ${sample}`
            : `${overdue.length} overdue items in ${row.title}`,
        body:
          overdue.length === 1
            ? `${sample} on ${row.title} is past its due date.`
            : `Including "${sample}". Open the checklist to catch up.`,
        linkUrl: `/dashboard?property=${row.propertyId}#checklist`,
        payload: {
          checklistId: row.id,
          propertyId: row.propertyId,
          overdueCount: overdue.length,
        },
        entityType: 'property_checklist',
        entityId: row.id,
        dedupeKey: `checklist-overdue:${row.id}`,
      })
    }
    return insights
  },
}
