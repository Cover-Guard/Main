import PDFDocument from 'pdfkit'
import type { Response } from 'express'
import type {
  Property,
  PropertyRiskProfile,
  InsuranceCostEstimate,
  InsurabilityStatus,
  CarriersResult,
} from '@coverguard/shared'
import { formatAddress, formatCurrency } from '@coverguard/shared'

// ─── Color palette ────────────────────────────────────────────────────────────

const COLORS = {
  brand: '#1a6b4a',
  brandLight: '#d1fae5',
  gray900: '#111827',
  gray700: '#374151',
  gray500: '#6b7280',
  gray200: '#e5e7eb',
  gray100: '#f3f4f6',
  red: '#dc2626',
  amber: '#d97706',
  green: '#16a34a',
  blue: '#2563eb',
} as const

function riskColor(score: number): string {
  if (score >= 75) return COLORS.red
  if (score >= 50) return COLORS.amber
  if (score >= 25) return COLORS.blue
  return COLORS.green
}

function riskLabel(score: number): string {
  if (score >= 75) return 'HIGH'
  if (score >= 50) return 'ELEVATED'
  if (score >= 25) return 'MODERATE'
  return 'LOW'
}

function statusColor(status: string): string {
  switch (status) {
    case 'INSURABLE': return COLORS.green
    case 'HARD_MARKET': return COLORS.amber
    case 'HIGH_RISK': return COLORS.amber
    case 'UNINSURABLE': return COLORS.red
    default: return COLORS.gray500
  }
}

// ─── PDF generation ───────────────────────────────────────────────────────────

export interface ReportData {
  property: Property
  risk: PropertyRiskProfile | null
  insurance: InsuranceCostEstimate | null
  insurability: InsurabilityStatus | null
  carriers: CarriersResult | null
}

export function generatePropertyPDF(data: ReportData, res: Response): void {
  const doc = new PDFDocument({
    size: 'LETTER',
    margins: { top: 60, bottom: 60, left: 60, right: 60 },
    info: {
      Title: `CoverGuard Report — ${data.property.address}`,
      Author: 'CoverGuard',
      Subject: 'Property Insurability Report',
    },
  })

  // Pipe directly to response
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="coverguard-${data.property.id}.pdf"`,
  )
  doc.pipe(res)

  const PAGE_WIDTH = doc.page.width
  const MARGIN = 60
  const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2

  // ── Cover / header ──────────────────────────────────────────────────────────

  // Brand bar
  doc.rect(0, 0, PAGE_WIDTH, 8).fill(COLORS.brand)

  // Logo area
  doc.y = 30
  doc.fontSize(18).fillColor(COLORS.brand).font('Helvetica-Bold').text('CoverGuard', MARGIN, 24)
  doc.fontSize(9).fillColor(COLORS.gray500).font('Helvetica').text('Property Insurability Intelligence', MARGIN, 46)

  // Date top-right
  const dateStr = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  doc.fontSize(9).fillColor(COLORS.gray500).text(`Generated ${dateStr}`, MARGIN, 36, {
    align: 'right',
    width: CONTENT_WIDTH,
  })

  // Divider
  doc.moveDown(1.5)
  doc.moveTo(MARGIN, doc.y).lineTo(PAGE_WIDTH - MARGIN, doc.y).strokeColor(COLORS.gray200).lineWidth(1).stroke()
  doc.moveDown(1)

  // Property address block
  doc
    .fontSize(20)
    .font('Helvetica-Bold')
    .fillColor(COLORS.gray900)
    .text(data.property.address ?? 'Unknown Address', MARGIN)

  doc
    .fontSize(13)
    .font('Helvetica')
    .fillColor(COLORS.gray700)
    .text(formatAddress(data.property), MARGIN)

  // Property metadata row
  doc.moveDown(0.5)
  const metaParts: string[] = []
  if (data.property.propertyType) metaParts.push(data.property.propertyType.replace(/_/g, ' '))
  if (data.property.yearBuilt) metaParts.push(`Built ${data.property.yearBuilt}`)
  if (data.property.squareFeet) metaParts.push(`${data.property.squareFeet.toLocaleString()} sq ft`)
  if (data.property.bedrooms) metaParts.push(`${data.property.bedrooms} bed`)
  if (data.property.bathrooms) metaParts.push(`${data.property.bathrooms} bath`)
  if (metaParts.length) {
    doc.fontSize(10).fillColor(COLORS.gray500).text(metaParts.join(' · '), MARGIN)
  }

  if (data.property.estimatedValue) {
    doc.moveDown(0.3)
    doc
      .fontSize(14)
      .font('Helvetica-Bold')
      .fillColor(COLORS.brand)
      .text(`Est. Value: ${formatCurrency(data.property.estimatedValue)}`, MARGIN)
  }

  doc.moveDown(1.5)
  doc.moveTo(MARGIN, doc.y).lineTo(PAGE_WIDTH - MARGIN, doc.y).strokeColor(COLORS.gray200).lineWidth(1).stroke()
  doc.moveDown(1)

  // ── Risk summary ────────────────────────────────────────────────────────────

  if (data.risk) {
    const r = data.risk
    sectionHeader(doc, MARGIN, 'Risk Summary')

    const overallScore = r.overallScore ?? 0
    const color = riskColor(overallScore)
    const label = riskLabel(overallScore)

    // Score badge
    doc.rect(MARGIN, doc.y, 90, 32).fill(color).fillOpacity(0.1)
    doc.fillOpacity(1)
    doc
      .fontSize(24)
      .font('Helvetica-Bold')
      .fillColor(color)
      .text(`${overallScore}`, MARGIN + 4, doc.y - 30, { width: 50 })
    doc
      .fontSize(10)
      .font('Helvetica-Bold')
      .fillColor(color)
      .text(label, MARGIN + 58, doc.y - 14, { width: 36 })

    doc.moveDown(1)

    // Peril grid — 2 columns
    const perils: Array<{ label: string; score: number | null | undefined; key: string }> = [
      { label: 'Flood', score: r.flood?.score, key: 'flood' },
      { label: 'Fire', score: r.fire?.score, key: 'fire' },
      { label: 'Wind', score: r.wind?.score, key: 'wind' },
      { label: 'Earthquake', score: r.earthquake?.score, key: 'earthquake' },
      { label: 'Crime', score: r.crime?.score, key: 'crime' },
    ]

    const colW = (CONTENT_WIDTH - 12) / 2
    let colX = MARGIN
    let startY = doc.y

    perils.forEach((peril, idx) => {
      if (idx === 2) {
        // Row break after 2 items — start second row
        colX = MARGIN
        startY = doc.y + 8
      }
      if (idx % 2 === 0 && idx !== 0) {
        colX = MARGIN
      } else if (idx % 2 === 1) {
        colX = MARGIN + colW + 12
      }

      const score = peril.score ?? 0
      const pc = riskColor(score)
      const boxY = idx < 2 ? startY : doc.y

      doc.rect(colX, boxY, colW, 38).fill(COLORS.gray100)
      doc.fillOpacity(1)
      doc
        .fontSize(10)
        .font('Helvetica-Bold')
        .fillColor(COLORS.gray700)
        .text(peril.label, colX + 10, boxY + 6, { width: colW - 20 })
      doc
        .fontSize(16)
        .font('Helvetica-Bold')
        .fillColor(pc)
        .text(`${score}`, colX + 10, boxY + 18, { width: 40 })
      doc
        .fontSize(9)
        .font('Helvetica')
        .fillColor(pc)
        .text(riskLabel(score), colX + 50, boxY + 24, { width: colW - 60 })

      if (idx === 0) colX = MARGIN + colW + 12
      if (idx === 1) {
        doc.y = boxY + 46
        colX = MARGIN
      }
      if (idx === 2) colX = MARGIN + colW + 12
      if (idx === 3) {
        doc.y = boxY + 46
      }
    })

    // Handle 5th peril (crime) — full width
    if (perils[4]) {
      const p = perils[4]!
      const score = p.score ?? 0
      const pc = riskColor(score)
      const boxY = doc.y + 8
      doc.rect(MARGIN, boxY, colW, 38).fill(COLORS.gray100)
      doc.fillOpacity(1)
      doc.fontSize(10).font('Helvetica-Bold').fillColor(COLORS.gray700).text(p.label, MARGIN + 10, boxY + 6, { width: colW - 20 })
      doc.fontSize(16).font('Helvetica-Bold').fillColor(pc).text(`${score}`, MARGIN + 10, boxY + 18, { width: 40 })
      doc.fontSize(9).font('Helvetica').fillColor(pc).text(riskLabel(score), MARGIN + 50, boxY + 24, { width: colW - 60 })
      doc.y = boxY + 46
    }

    doc.moveDown(1)
  }

  // ── Insurability status ──────────────────────────────────────────────────────

  if (data.insurability) {
    const ins = data.insurability
    sectionHeader(doc, MARGIN, 'Insurability Assessment')

    const sc = statusColor(ins.status)
    doc.rect(MARGIN, doc.y, CONTENT_WIDTH, 44).fill(sc).fillOpacity(0.08)
    doc.fillOpacity(1)
    doc
      .fontSize(14)
      .font('Helvetica-Bold')
      .fillColor(sc)
      .text(ins.status.replace(/_/g, ' '), MARGIN + 12, doc.y - 38)
    doc
      .fontSize(10)
      .font('Helvetica')
      .fillColor(COLORS.gray700)
      .text(ins.summary ?? '', MARGIN + 12, doc.y - 22, { width: CONTENT_WIDTH - 24 })
    doc.moveDown(0.5)

    if (ins.flags && ins.flags.length > 0) {
      doc.moveDown(0.5)
      doc.fontSize(10).font('Helvetica-Bold').fillColor(COLORS.gray700).text('Risk Flags:', MARGIN)
      ins.flags.forEach((flag) => {
        doc
          .fontSize(10)
          .font('Helvetica')
          .fillColor(COLORS.gray700)
          .text(`• ${flag}`, MARGIN + 12)
      })
    }

    if (ins.recommendations && ins.recommendations.length > 0) {
      doc.moveDown(0.5)
      doc.fontSize(10).font('Helvetica-Bold').fillColor(COLORS.gray700).text('Recommendations:', MARGIN)
      ins.recommendations.forEach((rec) => {
        doc
          .fontSize(10)
          .font('Helvetica')
          .fillColor(COLORS.gray700)
          .text(`• ${rec}`, MARGIN + 12)
      })
    }

    doc.moveDown(1)
  }

  // ── Insurance estimate ───────────────────────────────────────────────────────

  if (data.insurance) {
    const est = data.insurance

    // Check if we need a new page
    if (doc.y > doc.page.height - 200) doc.addPage()

    sectionHeader(doc, MARGIN, 'Insurance Cost Estimate')

    // Annual premium highlight
    doc
      .fontSize(28)
      .font('Helvetica-Bold')
      .fillColor(COLORS.brand)
      .text(formatCurrency(est.annualPremium), MARGIN)
    doc
      .fontSize(10)
      .font('Helvetica')
      .fillColor(COLORS.gray500)
      .text('Estimated Annual Premium', MARGIN)

    doc.moveDown(0.8)

    // Monthly / deductible
    const cols = [
      { label: 'Monthly', value: formatCurrency(est.monthlyPremium) },
      { label: 'Deductible', value: formatCurrency(est.deductible) },
      { label: 'Dwelling Coverage', value: formatCurrency(est.coverageAmount) },
      { label: 'Market', value: est.marketCondition?.replace(/_/g, ' ') ?? 'STANDARD' },
    ]

    const cW = CONTENT_WIDTH / 4
    cols.forEach((c, i) => {
      const cx = MARGIN + i * cW
      doc.rect(cx, doc.y, cW - 4, 44).fill(COLORS.gray100)
      doc.fillOpacity(1)
      doc.fontSize(9).font('Helvetica').fillColor(COLORS.gray500).text(c.label, cx + 6, doc.y - 38, { width: cW - 12 })
      doc.fontSize(13).font('Helvetica-Bold').fillColor(COLORS.gray900).text(c.value, cx + 6, doc.y - 24, { width: cW - 12 })
    })
    doc.moveDown(0.5)

    // Breakdown
    if (est.breakdown && est.breakdown.length > 0) {
      doc.moveDown(1)
      doc.fontSize(10).font('Helvetica-Bold').fillColor(COLORS.gray700).text('Cost Breakdown by Peril', MARGIN)
      doc.moveDown(0.3)
      est.breakdown.forEach((b) => {
        const labelText = b.peril
        const amtText = formatCurrency(b.annualCost)
        doc.fontSize(10).font('Helvetica').fillColor(COLORS.gray700).text(`${labelText}:`, MARGIN + 12, doc.y, {
          continued: true,
          width: 120,
        })
        doc.fillColor(COLORS.gray900).font('Helvetica-Bold').text(amtText, { align: 'left' })
      })
    }

    doc.moveDown(1)
  }

  // ── Active carriers ──────────────────────────────────────────────────────────

  if (data.carriers && data.carriers.carriers && data.carriers.carriers.length > 0) {
    if (doc.y > doc.page.height - 200) doc.addPage()

    sectionHeader(doc, MARGIN, 'Active Carriers')

    const writing = data.carriers.carriers.filter((c) => c.writingStatus === 'WRITING')
    const limited = data.carriers.carriers.filter((c) => c.writingStatus === 'LIMITED')

    if (writing.length > 0) {
      doc
        .fontSize(10)
        .font('Helvetica-Bold')
        .fillColor(COLORS.green)
        .text(`${writing.length} carrier${writing.length !== 1 ? 's' : ''} actively writing`, MARGIN)
      doc.moveDown(0.3)
      writing.forEach((c) => {
        doc
          .fontSize(10)
          .font('Helvetica')
          .fillColor(COLORS.gray700)
          .text(`✓  ${c.name}`, MARGIN + 12)
        if (c.minPremium && c.maxPremium) {
          doc
            .fontSize(9)
            .fillColor(COLORS.gray500)
            .text(`    ${formatCurrency(c.minPremium)}–${formatCurrency(c.maxPremium)}/yr`, MARGIN + 12)
        }
      })
    }

    if (limited.length > 0) {
      doc.moveDown(0.5)
      doc
        .fontSize(10)
        .font('Helvetica-Bold')
        .fillColor(COLORS.amber)
        .text(`${limited.length} carrier${limited.length !== 1 ? 's' : ''} with limited availability`, MARGIN)
      doc.moveDown(0.3)
      limited.forEach((c) => {
        doc
          .fontSize(10)
          .font('Helvetica')
          .fillColor(COLORS.gray700)
          .text(`~  ${c.name}`, MARGIN + 12)
      })
    }

    doc.moveDown(1)
  }

  // ── Footer ───────────────────────────────────────────────────────────────────

  const footerY = doc.page.height - 50
  doc.moveTo(MARGIN, footerY).lineTo(PAGE_WIDTH - MARGIN, footerY).strokeColor(COLORS.gray200).lineWidth(1).stroke()
  doc
    .fontSize(8)
    .font('Helvetica')
    .fillColor(COLORS.gray500)
    .text(
      'This report is generated by CoverGuard for informational purposes only and does not constitute insurance advice or a binding quote. ' +
        'Risk data sourced from FEMA, USGS, Cal Fire, NOAA, and FBI CDE.',
      MARGIN,
      footerY + 8,
      { width: CONTENT_WIDTH, align: 'center' },
    )

  doc.end()
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sectionHeader(doc: PDFKit.PDFDocument, margin: number, title: string): void {
  doc
    .fontSize(13)
    .font('Helvetica-Bold')
    .fillColor(COLORS.gray900)
    .text(title, margin)
  doc
    .moveTo(margin, doc.y + 2)
    .lineTo(margin + 40, doc.y + 2)
    .strokeColor(COLORS.brand)
    .lineWidth(2)
    .stroke()
  doc.moveDown(0.8)
}
