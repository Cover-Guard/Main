/**
 * Server-side PDF generation for the Property Risk Report.
 *
 * Uses `pdfkit` (pure-JS, no headless browser) to assemble a clean,
 * print-friendly document from the same data the frontend renders. The PDF is
 * intentionally text-heavy and chart-free — we want the document to be small,
 * fast to generate, and reliably renderable by every PDF viewer.
 */

import PDFDocument from 'pdfkit'
import type {
  CarriersResult,
  InsurabilityStatus,
  InsuranceCostEstimate,
  Property,
  PropertyRiskProfile,
} from '@coverguard/shared'

interface ReportBundle {
  property: Property
  risk: PropertyRiskProfile | null
  insurance: InsuranceCostEstimate | null
  insurability: InsurabilityStatus | null
  carriers: CarriersResult | null
}

const COLORS = {
  text: '#111827',
  muted: '#6b7280',
  accent: '#0f766e',
  divider: '#e5e7eb',
  warn: '#b45309',
  danger: '#b91c1c',
}

function fmtCurrency(v: number | null | undefined): string {
  if (v == null) return '—'
  return `$${Math.round(v).toLocaleString('en-US')}`
}

/** Generates the PDF and returns a Buffer of its bytes. */
export function generatePropertyReportPdf(bundle: ReportBundle): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'LETTER',
      margins: { top: 54, bottom: 54, left: 54, right: 54 },
      info: {
        Title: `Property Risk Report — ${bundle.property.address}`,
        Author: 'CoverGuard',
        Subject: 'Property insurability and risk assessment',
        CreationDate: new Date(),
      },
    })

    const chunks: Buffer[] = []
    doc.on('data', (c: Buffer) => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    renderHeader(doc, bundle.property)
    renderOverallRisk(doc, bundle.risk)
    renderRiskBreakdown(doc, bundle.risk)
    renderInsuranceEstimate(doc, bundle.insurance)
    renderInsurability(doc, bundle.insurability)
    renderCarriers(doc, bundle.carriers)
    renderFooter(doc)

    doc.end()
  })
}

// ─── Sections ───────────────────────────────────────────────────────────────

function divider(doc: PDFKit.PDFDocument): void {
  doc.moveTo(54, doc.y).lineTo(558, doc.y).strokeColor(COLORS.divider).lineWidth(0.5).stroke()
  doc.moveDown(0.5)
}

function sectionHeader(doc: PDFKit.PDFDocument, title: string): void {
  doc.moveDown(0.5)
  doc.font('Helvetica-Bold').fontSize(13).fillColor(COLORS.text).text(title)
  doc.moveDown(0.25)
  divider(doc)
}

function renderHeader(doc: PDFKit.PDFDocument, property: Property): void {
  doc.font('Helvetica-Bold').fontSize(20).fillColor(COLORS.text).text('Property Risk Report')
  doc.font('Helvetica').fontSize(10).fillColor(COLORS.muted).text('CoverGuard — Property insurability intelligence')
  doc.moveDown(0.75)

  doc.font('Helvetica-Bold').fontSize(15).fillColor(COLORS.text).text(property.address)
  doc.font('Helvetica').fontSize(11).fillColor(COLORS.muted).text(
    `${property.city}, ${property.state} ${property.zip}`,
  )

  const meta: string[] = []
  if (property.propertyType) meta.push(property.propertyType.replace(/_/g, ' '))
  if (property.yearBuilt) meta.push(`Built ${property.yearBuilt}`)
  if (property.squareFeet) meta.push(`${property.squareFeet.toLocaleString()} sq ft`)
  if (property.bedrooms != null) meta.push(`${property.bedrooms} bed`)
  if (property.bathrooms != null) meta.push(`${property.bathrooms} bath`)
  if (meta.length > 0) {
    doc.font('Helvetica').fontSize(10).fillColor(COLORS.muted).text(meta.join('  •  '))
  }

  if (property.marketValue || property.estimatedValue) {
    doc.moveDown(0.25)
    doc.font('Helvetica-Bold').fontSize(11).fillColor(COLORS.accent).text(
      `Estimated market value: ${fmtCurrency(property.marketValue ?? property.estimatedValue)}`,
    )
  }
}

function renderOverallRisk(doc: PDFKit.PDFDocument, risk: PropertyRiskProfile | null): void {
  sectionHeader(doc, 'Overall Risk')
  if (!risk) {
    doc.font('Helvetica').fontSize(10).fillColor(COLORS.muted).text(
      'Risk data is not available for this property.',
    )
    return
  }
  doc.font('Helvetica-Bold').fontSize(14).fillColor(COLORS.text).text(
    `${risk.overallRiskScore} / 100  —  ${risk.overallRiskLevel.replace(/_/g, ' ')}`,
  )
  if (risk.stateContext?.knownRisks?.length) {
    doc.moveDown(0.25)
    doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.text).text('Known state risks:')
    risk.stateContext.knownRisks.forEach((r) => {
      doc.font('Helvetica').fontSize(10).fillColor(COLORS.muted).text(`• ${r}`)
    })
  }
}

function renderRiskBreakdown(doc: PDFKit.PDFDocument, risk: PropertyRiskProfile | null): void {
  if (!risk) return
  sectionHeader(doc, 'Risk Breakdown')

  const rows: Array<{ label: string; score: number; level: string; description: string }> = [
    { label: 'Flood', score: risk.flood.score, level: risk.flood.level, description: risk.flood.description },
    { label: 'Fire', score: risk.fire.score, level: risk.fire.level, description: risk.fire.description },
    { label: 'Wind', score: risk.wind.score, level: risk.wind.level, description: risk.wind.description },
    { label: 'Earthquake', score: risk.earthquake.score, level: risk.earthquake.level, description: risk.earthquake.description },
    { label: 'Crime', score: risk.crime.score, level: risk.crime.level, description: risk.crime.description },
  ]
  if (risk.heat) {
    rows.push({ label: 'Extreme Heat', score: risk.heat.score, level: risk.heat.level, description: risk.heat.description })
  }
  if (risk.drought) {
    rows.push({ label: 'Drought', score: risk.drought.score, level: risk.drought.level, description: risk.drought.description })
  }

  rows.forEach(({ label, score, level, description }) => {
    doc.font('Helvetica-Bold').fontSize(11).fillColor(COLORS.text).text(
      `${label}  —  ${score}/100  (${level.replace(/_/g, ' ')})`,
    )
    doc.font('Helvetica').fontSize(9).fillColor(COLORS.muted).text(description, { width: 504 })
    doc.moveDown(0.4)
  })
}

function renderInsuranceEstimate(doc: PDFKit.PDFDocument, insurance: InsuranceCostEstimate | null): void {
  sectionHeader(doc, 'Insurance Cost Estimate')
  if (!insurance) {
    doc.font('Helvetica').fontSize(10).fillColor(COLORS.muted).text(
      'Insurance estimate is not available for this property.',
    )
    return
  }
  doc.font('Helvetica-Bold').fontSize(12).fillColor(COLORS.text).text(
    `Estimated annual total: ${fmtCurrency(insurance.estimatedAnnualTotal)}  (${fmtCurrency(insurance.estimatedMonthlyTotal)}/mo)`,
  )
  doc.font('Helvetica').fontSize(9).fillColor(COLORS.muted).text(
    `Confidence: ${insurance.confidenceLevel}`,
  )
  doc.moveDown(0.5)

  insurance.coverages.forEach((c) => {
    if (!c.required && !c.averageAnnualPremium) return
    const label = c.type.replace(/_/g, ' ')
    doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.text).text(
      `${label}${c.required ? '  (required)' : ''}`,
    )
    doc.font('Helvetica').fontSize(9).fillColor(COLORS.muted).text(
      `Range: ${fmtCurrency(c.lowEstimate)} – ${fmtCurrency(c.highEstimate)} • Avg: ${fmtCurrency(c.averageAnnualPremium)}`,
    )
    doc.moveDown(0.25)
  })

  if (insurance.keyRiskFactors?.length) {
    doc.moveDown(0.25)
    doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.text).text('Key risk factors:')
    insurance.keyRiskFactors.forEach((f) => {
      doc.font('Helvetica').fontSize(9).fillColor(COLORS.muted).text(`• ${f}`, { width: 504 })
    })
  }
}

function renderInsurability(doc: PDFKit.PDFDocument, status: InsurabilityStatus | null): void {
  sectionHeader(doc, 'Insurability')
  if (!status) {
    doc.font('Helvetica').fontSize(10).fillColor(COLORS.muted).text('Insurability assessment unavailable.')
    return
  }
  const color =
    status.difficultyLevel === 'LOW' ? COLORS.accent :
    status.difficultyLevel === 'MODERATE' || status.difficultyLevel === 'HIGH' ? COLORS.warn : COLORS.danger

  doc.font('Helvetica-Bold').fontSize(12).fillColor(color).text(
    `${status.isInsurable ? 'Insurable' : 'Not insurable in standard market'} — Difficulty: ${status.difficultyLevel.replace(/_/g, ' ')} (${status.overallInsurabilityScore}/100)`,
  )
  if (status.potentialIssues?.length) {
    doc.moveDown(0.25)
    doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.text).text('Potential issues:')
    status.potentialIssues.forEach((p) => {
      doc.font('Helvetica').fontSize(9).fillColor(COLORS.muted).text(`• ${p}`, { width: 504 })
    })
  }
  if (status.recommendedActions?.length) {
    doc.moveDown(0.25)
    doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.text).text('Recommended actions:')
    status.recommendedActions.forEach((p) => {
      doc.font('Helvetica').fontSize(9).fillColor(COLORS.muted).text(`• ${p}`, { width: 504 })
    })
  }
}

function renderCarriers(doc: PDFKit.PDFDocument, carriers: CarriersResult | null): void {
  sectionHeader(doc, 'Active Carriers')
  if (!carriers || !carriers.carriers?.length) {
    doc.font('Helvetica').fontSize(10).fillColor(COLORS.muted).text('No active carriers identified for this property.')
    return
  }
  doc.font('Helvetica').fontSize(9).fillColor(COLORS.muted).text(
    `Market condition: ${carriers.marketCondition?.replace(/_/g, ' ') ?? 'Unknown'}  •  ${carriers.carriers.length} carrier(s) shown`,
  )
  doc.moveDown(0.4)
  carriers.carriers.slice(0, 8).forEach((c) => {
    doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.text).text(c.name)
    const meta: string[] = []
    if (c.writingStatus) meta.push(c.writingStatus.replace(/_/g, ' '))
    if (c.amBestRating) meta.push(`AM Best: ${c.amBestRating}`)
    doc.font('Helvetica').fontSize(9).fillColor(COLORS.muted).text(meta.join('  •  '))
    if (c.coverageTypes?.length) {
      doc.font('Helvetica').fontSize(9).fillColor(COLORS.muted).text(
        `Coverage: ${c.coverageTypes.join(', ')}`,
      )
    }
    if (c.specialties?.length) {
      doc.font('Helvetica').fontSize(9).fillColor(COLORS.muted).text(
        `Specialties: ${c.specialties.join(', ')}`,
      )
    }
    doc.moveDown(0.3)
  })
}

function renderFooter(doc: PDFKit.PDFDocument): void {
  const range = doc.bufferedPageRange()
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i)
    doc.font('Helvetica').fontSize(8).fillColor(COLORS.muted).text(
      `Generated by CoverGuard on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}.  Not a binding insurance quote.`,
      54,
      doc.page.height - 36,
      { width: 504, align: 'center' },
    )
  }
}
