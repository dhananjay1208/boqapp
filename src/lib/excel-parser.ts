import * as XLSX from 'xlsx'

export interface ParsedLineItem {
  itemNumber: string      // e.g., "1.1", "1.2", "2.1"
  description: string
  location: string
  unit: string
  quantity: number
}

export interface ParsedHeadline {
  serialNumber: number    // e.g., 1, 2, 3
  name: string
  lineItems: ParsedLineItem[]
}

export interface ParsedBOQ {
  packageName: string
  headlines: ParsedHeadline[]
}

export interface ParseResult {
  success: boolean
  data?: ParsedBOQ[]
  error?: string
  warnings?: string[]
}

/**
 * Check if a number is a whole number (integer)
 */
function isWholeNumber(value: number): boolean {
  return Number.isInteger(value)
}

/**
 * Parse BOQ Excel file based on template structure:
 * Column A (0): S.No (whole number = headline, decimal = line item)
 * Column B (1): Description
 * Column C (2): LOCATION
 * Column D (3): Unit
 * Column E (4): Quantity
 */
export function parseBOQExcel(file: File): Promise<ParseResult> {
  return new Promise((resolve) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })

        const results: ParsedBOQ[] = []
        const warnings: string[] = []

        // Process each sheet
        for (const sheetName of workbook.SheetNames) {
          const worksheet = workbook.Sheets[sheetName]
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][]

          if (jsonData.length < 3) {
            warnings.push(`Sheet "${sheetName}" has insufficient data`)
            continue
          }

          const parsedSheet = parseSheet(jsonData, sheetName, warnings)
          if (parsedSheet) {
            results.push(parsedSheet)
          }
        }

        if (results.length === 0) {
          resolve({
            success: false,
            error: 'No valid BOQ data found in the Excel file',
            warnings,
          })
          return
        }

        resolve({
          success: true,
          data: results,
          warnings: warnings.length > 0 ? warnings : undefined,
        })
      } catch (error) {
        console.error('Excel parsing error:', error)
        resolve({
          success: false,
          error: 'Failed to parse Excel file. Please check the file format.',
        })
      }
    }

    reader.onerror = () => {
      resolve({
        success: false,
        error: 'Failed to read the file',
      })
    }

    reader.readAsArrayBuffer(file)
  })
}

function parseSheet(rows: any[][], sheetName: string, warnings: string[]): ParsedBOQ | null {
  // Get package name from sheet name or first/second row
  let packageName = sheetName

  // Check first few rows for package name (usually row 0 or 1 has project/package name)
  for (let i = 0; i < Math.min(2, rows.length); i++) {
    if (rows[i] && rows[i][0] && typeof rows[i][0] === 'string') {
      const cellValue = String(rows[i][0]).trim()
      // Use non-header rows as package name
      if (!cellValue.toLowerCase().includes('s.no') && cellValue.length > 0) {
        packageName = cellValue
        break
      }
    }
  }

  // Find header row (contains "S.No" or similar)
  let headerRowIndex = -1
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    const row = rows[i]
    if (row && row.length >= 4) {
      const firstCell = String(row[0] || '').toLowerCase().trim()
      if (firstCell.includes('s.no') || firstCell.includes('sl.no') || firstCell === 'sno') {
        headerRowIndex = i
        break
      }
    }
  }

  if (headerRowIndex === -1) {
    warnings.push(`No header row found in sheet "${sheetName}"`)
    return null
  }

  // Start parsing from row after header
  const dataStartIndex = headerRowIndex + 1

  const headlines: ParsedHeadline[] = []
  let currentHeadline: ParsedHeadline | null = null

  for (let i = dataStartIndex; i < rows.length; i++) {
    const row = rows[i]
    if (!row || row.length < 2) continue

    // Column mapping based on template (A to E only):
    // 0: S.No, 1: Description, 2: LOCATION, 3: Unit, 4: Quantity
    const sNo = row[0]
    const description = row[1] ? String(row[1]).trim() : ''
    const location = row[2] ? String(row[2]).trim() : ''
    const unit = row[3] ? String(row[3]).trim() : ''
    const quantity = typeof row[4] === 'number' ? row[4] : parseFloat(String(row[4] || '0')) || 0

    // Skip empty rows or rows without S.No
    if (sNo === undefined || sNo === null || sNo === '') {
      continue
    }

    // Parse S.No as number
    const sNoNum = typeof sNo === 'number' ? sNo : parseFloat(String(sNo).trim())

    if (isNaN(sNoNum)) {
      continue // Skip rows with non-numeric S.No
    }

    // Check if this is a headline (whole number) or line item (decimal)
    if (isWholeNumber(sNoNum)) {
      // This is a BOQ Headline
      // Save previous headline if exists
      if (currentHeadline) {
        headlines.push(currentHeadline)
      }

      currentHeadline = {
        serialNumber: sNoNum,
        name: description || `Item ${sNoNum}`,
        lineItems: [],
      }
    } else {
      // This is a BOQ Line Item (decimal number like 1.1, 1.2)
      if (currentHeadline) {
        // Format item number as string (e.g., "1.1", "1.2")
        const itemNumber = sNoNum.toString()

        currentHeadline.lineItems.push({
          itemNumber,
          description: description || '',
          location: location || '',
          unit: unit || '',
          quantity: quantity,
        })
      } else {
        // Line item without a headline - create a default headline
        currentHeadline = {
          serialNumber: Math.floor(sNoNum),
          name: `Item ${Math.floor(sNoNum)}`,
          lineItems: [{
            itemNumber: sNoNum.toString(),
            description: description || '',
            location: location || '',
            unit: unit || '',
            quantity: quantity,
          }],
        }
      }
    }
  }

  // Add last headline
  if (currentHeadline) {
    headlines.push(currentHeadline)
  }

  if (headlines.length === 0) {
    warnings.push(`No BOQ headlines found in sheet "${sheetName}"`)
    return null
  }

  return {
    packageName,
    headlines,
  }
}
