/**
 * csvParser tests (P0 #3 — Bulk Address Upload).
 *
 * These tests pin the contract the API and upload UI both rely on:
 *   - Valid rows arrive with status 'PENDING' and preserved row numbers.
 *   - Invalid rows land in `invalidRows` with a populated `errorMessage`.
 *   - File-level problems (missing column, too many rows) end up in `fileErrors`.
 *   - Quoted commas and external_ref are parsed correctly.
 *
 * Note on fixtures: addresses with commas (city/state/zip) MUST be quoted
 * in the test CSV — that's how real CSV files express them. Unquoted
 * commas split into multiple cells, which is the correct (and well-tested)
 * behavior of `splitCsvLine`.
 */

import { parseAddressCsv } from '../../utils/csvParser'

describe('parseAddressCsv', () => {
  it('parses a minimal valid CSV', () => {
    const csv = [
      'address',
      '"742 Evergreen Terrace, Springfield, IL 62704"',
      '"1600 Pennsylvania Ave NW, Washington, DC 20500"',
    ].join('\n')

    const result = parseAddressCsv(csv)

    expect(result.fileErrors).toEqual([])
    expect(result.invalidRows).toEqual([])
    expect(result.rows).toHaveLength(2)
    expect(result.rows[0]).toMatchObject({
      rowNumber: 1,
      status: 'PENDING',
      rawAddress: '742 Evergreen Terrace, Springfield, IL 62704',
    })
    expect(result.rows[1].rowNumber).toBe(2)
  })

  it('parses optional external_ref column', () => {
    const csv = [
      'address,external_ref',
      '"1 Main St, Chicago, IL 60601",LEAD-A',
      '"2 Oak Ave, Chicago, IL 60602",LEAD-B',
    ].join('\n')

    const result = parseAddressCsv(csv)

    expect(result.rows.map((r) => r.externalRef)).toEqual(['LEAD-A', 'LEAD-B'])
  })

  it('treats empty external_ref as null', () => {
    const csv = ['address,external_ref', '"5 Pine Ln, Austin, TX 78701",'].join('\n')
    const result = parseAddressCsv(csv)
    expect(result.rows[0].externalRef).toBeNull()
  })

  it('rejects file when required column is missing', () => {
    const csv = ['street,zip', '1 Main St,60601'].join('\n')
    const result = parseAddressCsv(csv)
    expect(result.fileErrors[0]).toMatch(/missing required column 'address'/i)
    expect(result.rows).toEqual([])
  })

  it('rejects empty CSVs', () => {
    expect(parseAddressCsv('').fileErrors[0]).toMatch(/empty/i)
    expect(parseAddressCsv('\n\n  \n').fileErrors[0]).toMatch(/empty/i)
  })

  it('rejects CSVs with header but no data rows', () => {
    const result = parseAddressCsv('address')
    expect(result.fileErrors[0]).toMatch(/no data rows/i)
  })

  it('honors the maxRows cap', () => {
    const rows = Array.from({ length: 5 }, (_, i) => `${i + 1} Main St 60601`)
    const csv = ['address', ...rows].join('\n')

    const result = parseAddressCsv(csv, { maxRows: 3 })

    expect(result.fileErrors[0]).toMatch(/cap is 3/i)
    expect(result.rows).toEqual([])
  })

  it('flags rows with too-short addresses', () => {
    const csv = ['address', 'abc', '1 OK Street 60601'].join('\n')
    const result = parseAddressCsv(csv)

    expect(result.invalidRows).toHaveLength(1)
    expect(result.invalidRows[0].errorMessage).toMatch(/too short/i)
    expect(result.rows).toHaveLength(1)
  })

  it('flags addresses missing any digit', () => {
    const csv = ['address', '"Broadway, New York, NY"'].join('\n')
    const result = parseAddressCsv(csv)
    expect(result.invalidRows[0].errorMessage).toMatch(/no numbers/i)
  })

  it('preserves 1-indexed row numbers across valid + invalid mix', () => {
    const csv = [
      'address',
      '1 Valid St 60601',
      'xyz', // invalid (too short)
      '3 Valid Ave 60602',
    ].join('\n')

    const result = parseAddressCsv(csv)

    expect(result.rows.map((r) => r.rowNumber)).toEqual([1, 3])
    expect(result.invalidRows.map((r) => r.rowNumber)).toEqual([2])
  })

  it('handles quoted cells with embedded commas', () => {
    const csv = [
      'address,external_ref',
      '"100 Suite 5, Big City, IL 60601",LEAD-Q',
    ].join('\n')

    const result = parseAddressCsv(csv)
    expect(result.rows[0].rawAddress).toBe('100 Suite 5, Big City, IL 60601')
    expect(result.rows[0].externalRef).toBe('LEAD-Q')
  })

  it('handles \\r\\n line endings (Windows-exported CSVs)', () => {
    const csv = ['address', '1 Main St 60601', '2 Oak Ave 60602'].join('\r\n')
    const result = parseAddressCsv(csv)
    expect(result.rows).toHaveLength(2)
  })
})
